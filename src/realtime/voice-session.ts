import { Socket } from 'socket.io';
import { OpenAiAssistantService } from '../ai/openai-assistant.service';
import { AuthContext } from '../auth/auth.types';
import { DeepgramSttService } from '../speech/deepgram-stt.service';
import { DeepgramTtsService } from '../speech/deepgram-tts.service';

// How long to wait for trailing Deepgram finals after a manual commit before we
// treat the utterance as complete. The timer resets every time a new final
// arrives, so multi-segment sentences are kept together.
const FINALIZE_DEBOUNCE_MS = 700;

// Shorter debounce for automatic (silence-based) endpointing: Deepgram already
// detected end-of-speech, so we only briefly wait for the trailing final.
const AUTO_FINALIZE_DEBOUNCE_MS = 250;

export class VoiceSession {
  private readonly stt = new DeepgramSttService();
  private readonly tts = new DeepgramTtsService();
  private readonly assistant = new OpenAiAssistantService();

  /** Finalized transcript segments accumulated during the current utterance. */
  private finals: string[] = [];
  /** Latest interim (not-yet-final) transcript text. */
  private latestPartial = '';
  /** True once the user has committed and we are waiting for trailing finals. */
  private finalizing = false;
  /** True while an assistant turn is in flight (prevents overlapping replies). */
  private processing = false;
  /** Debounce to use for the in-progress finalize (manual vs. auto). */
  private flushDelay = FINALIZE_DEBOUNCE_MS;
  private finalizeTimer?: NodeJS.Timeout;

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthContext,
  ) {}

  start() {
    this.stt.start();

    this.stt.on('warning', (message) =>
      this.socket.emit('voice:warning', { message }),
    );

    this.stt.on('partial', (text) => {
      this.latestPartial = String(text);
      this.socket.emit('transcript:partial', { text: this.combinedText() });
    });

    this.stt.on('final', (text) => {
      const segment = String(text).trim();
      if (segment) this.finals.push(segment);
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
      if (this.processing) return;
      if (!this.finals.length && !this.latestPartial.trim()) return;
      this.finalizing = true;
      this.flushDelay = AUTO_FINALIZE_DEBOUNCE_MS;
      this.scheduleFlush(AUTO_FINALIZE_DEBOUNCE_MS);
    });

    this.stt.on('error', (error) =>
      this.socket.emit('voice:error', { message: (error as Error).message }),
    );

    this.socket.emit('voice:ready', {
      userId: this.auth.user.id,
      encoding: 'linear16',
      sampleRate: 16000,
    });
  }

  audio(chunk: Buffer) {
    this.stt.send(chunk);
  }

  commit() {
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

    void this.handleTranscript(text);
  }

  private async handleTranscript(text: string) {
    this.processing = true;
    try {
      this.socket.emit('transcript:final', { text });
      const response = await this.assistant.handleTranscript({
        token: this.auth.token,
        transcript: text,
        userId: this.auth.user.id,
      });

      this.socket.emit('assistant:text', response);
      const audio = await this.tts.synthesize(response.text);
      if (audio.byteLength) this.socket.emit('assistant:audio', audio);
    } catch (error) {
      this.socket.emit('voice:error', { message: (error as Error).message });
    } finally {
      this.processing = false;
    }
  }
}
