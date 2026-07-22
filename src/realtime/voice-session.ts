import { Socket } from 'socket.io';
import { ConversationManagerService } from '../ai/conversation-manager.service';
import { SpeechFormatter } from '../ai/speech-formatter';
import { AuthContext } from '../auth/auth.types';
import { vlog } from '../shared/debug';
import { DeepgramSttService } from '../speech/deepgram-stt.service';
import { TtsService } from '../speech/tts.service';

// How long to wait for trailing Deepgram finals after a manual commit before we
// treat the utterance as complete. The timer resets every time a new final
// arrives, so multi-segment sentences are kept together.
const FINALIZE_DEBOUNCE_MS = 700;

// Shorter debounce for automatic (silence-based) endpointing: Deepgram already
// detected end-of-speech, so we only briefly wait for the trailing final.
const AUTO_FINALIZE_DEBOUNCE_MS = 250;

export class VoiceSession {
  private readonly stt = new DeepgramSttService();
  private readonly tts = new TtsService();
  private readonly assistant = new ConversationManagerService();
  private readonly speechFormatter = new SpeechFormatter();

  /** Finalized transcript segments accumulated during the current utterance. */
  private finals: string[] = [];
  /** Latest interim (not-yet-final) transcript text. */
  private latestPartial = '';
  /** True once the user has committed and we are waiting for trailing finals. */
  private finalizing = false;
  /** True while an assistant turn is in flight (prevents overlapping replies). */
  private processing = false;
  /** One-time flag to log the first interim transcript from Deepgram. */
  private sawPartial = false;
  /** Debounce to use for the in-progress finalize (manual vs. auto). */
  private flushDelay = FINALIZE_DEBOUNCE_MS;
  private finalizeTimer?: NodeJS.Timeout;

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthContext,
    private readonly taskId?: string,
  ) {}

  start() {
    this.stt.start();

    this.stt.on('warning', (message) =>
      this.socket.emit('voice:warning', { message }),
    );

    this.stt.on('partial', (text) => {
      if (!this.sawPartial) {
        this.sawPartial = true;
        vlog('session', 'stt first partial (deepgram is transcribing)', text);
      }
      this.latestPartial = String(text);
      this.socket.emit('transcript:partial', { text: this.combinedText() });
    });

    this.stt.on('final', (text) => {
      const segment = String(text).trim();
      if (segment) {
        this.finals.push(segment);
        vlog('session', 'stt final segment', segment);
      }
      this.latestPartial = '';
      // Stream the growing utterance so the UI shows live progress, but DO NOT
      // run the assistant yet — that only happens once the utterance is
      // finalized (silence-based endpointing or a manual commit).
      this.socket.emit('transcript:partial', { text: this.combinedText() });
      if (this.finalizing) this.scheduleFlush(this.flushDelay);
    });

    // Hands-free: Deepgram detected end-of-speech (silence) -> finalize the
    // utterance automatically and respond, then keep listening for the next one.
    this.stt.on('utteranceEnd', () => {
      if (this.processing) {
        vlog('session', 'utteranceEnd ignored (busy)');
        return;
      }
      if (!this.finals.length && !this.latestPartial.trim()) return;
      vlog('session', 'utteranceEnd -> auto finalize (silence)');
      this.finalizing = true;
      this.flushDelay = AUTO_FINALIZE_DEBOUNCE_MS;
      this.scheduleFlush(AUTO_FINALIZE_DEBOUNCE_MS);
    });

    this.stt.on('error', (error) =>
      this.socket.emit('voice:error', { message: (error as Error).message }),
    );

    vlog('session', 'started -> voice:ready', { user: this.auth.user.id });
    this.socket.emit('voice:ready', {
      userId: this.auth.user.id,
      encoding: 'linear16',
      sampleRate: 16000,
    });
  }

  audio(chunk: Buffer) {
    this.stt.send(chunk);
  }

  /**
   * Direct text input from a client that performs its own (on-device) speech
   * recognition and sends the final transcript instead of streaming audio.
   * Runs the same assistant + TTS pipeline as a Deepgram transcript.
   */
  submitText(text: string) {
    const clean = text.trim();
    if (!clean) return;
    if (this.processing) {
      vlog('session', 'voice:text ignored (assistant busy)');
      return;
    }
    // Discard any partial audio-based state; this turn is text-driven.
    this.clearFinalizeTimer();
    this.finalizing = false;
    this.finals = [];
    this.latestPartial = '';
    vlog('session', 'voice:text (device STT) -> assistant', clean);
    void this.handleTranscript(clean);
  }

  commit() {
    vlog('session', 'commit (manual finalize)');
    this.socket.emit('voice:committed', {
      timestamp: new Date().toISOString(),
    });
    if (this.processing) return;
    this.finalizing = true;
    this.flushDelay = FINALIZE_DEBOUNCE_MS;
    // Flush any audio Deepgram still has buffered, then wait briefly for the
    // resulting final(s) before assembling the full utterance.
    this.stt.finalize();
    this.scheduleFlush(FINALIZE_DEBOUNCE_MS);
  }

  stop() {
    this.clearFinalizeTimer();
    this.stt.stop();
    this.socket.emit('voice:closed');
  }

  private combinedText(): string {
    return [...this.finals, this.latestPartial]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private scheduleFlush(delayMs: number = FINALIZE_DEBOUNCE_MS) {
    this.clearFinalizeTimer();
    this.finalizeTimer = setTimeout(() => this.flushUtterance(), delayMs);
  }

  private clearFinalizeTimer() {
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
      this.finalizeTimer = undefined;
    }
  }

  private flushUtterance() {
    this.clearFinalizeTimer();
    this.finalizing = false;

    const text = this.combinedText();
    this.finals = [];
    this.latestPartial = '';
    if (!text) return;

    vlog('session', 'flush utterance -> transcript:final', text);
    void this.handleTranscript(text);
  }

  private async handleTranscript(text: string) {
    this.processing = true;
    try {
      this.socket.emit('transcript:final', { text });

      vlog('session', 'assistant thinking…');
      const response = await this.assistant.handle({
        token: this.auth.token,
        transcript: text,
        userId: this.auth.user.id,
        userName: this.auth.user.name,
        taskId: this.taskId,
      });
      vlog('session', 'assistant:text', {
        text: response.text,
        language: response.language,
        tools: response.toolResults.map((t) => t.toolName),
      });
      // Show the reply exactly as built (original wording/dates) to the client.
      this.socket.emit('assistant:text', response);

      const textToSpeak = response.speechText || response.text;
      const speechText = this.speechFormatter.sanitizeForSpeech(
        textToSpeak,
        response.language,
      );
      const audio = await this.tts.synthesize(speechText, response.language);
      if (audio.byteLength) {
        vlog('session', 'assistant:audio', `${audio.byteLength} bytes`);
        this.socket.emit('assistant:audio', audio);
      } else {
        vlog('session', 'assistant:audio skipped (no audio)');
      }
    } catch (error) {
      vlog('session', 'error', (error as Error).message);
      this.socket.emit('voice:error', { message: (error as Error).message });
    } finally {
      this.processing = false;
    }
  }
}
