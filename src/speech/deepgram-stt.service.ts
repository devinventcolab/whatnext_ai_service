import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { env } from '../config/env';
import { vlog } from '../shared/debug';

export class DeepgramSttService extends EventEmitter {
  private socket?: WebSocket;
  private keepAlive?: NodeJS.Timeout;
  private forwarded = 0;
  private dropped = 0;

  start() {
    if (!env.DEEPGRAM_API_KEY) {
      this.emit('warning', 'Deepgram API key is not configured');
      return;
    }

    const url =
      'wss://api.deepgram.com/v1/listen?model=' +
      encodeURIComponent(env.DEEPGRAM_STT_MODEL) +
      // Recognition language. "multi" enables nova-3 multilingual recognition
      // (e.g. English + Serbian) so the user's language is detected automatically;
      // set DEEPGRAM_STT_LANGUAGE to a fixed code to lock it.
      '&language=' +
      encodeURIComponent(env.DEEPGRAM_STT_LANGUAGE) +
      '&encoding=linear16&sample_rate=16000&channels=1' +
      '&interim_results=true&punctuate=true&smart_format=true' +
      // Server-side endpointing: Deepgram detects end-of-speech automatically
      // (silence) and flags speech_final / emits UtteranceEnd, enabling a
      // hands-free conversation without a manual "send".
      '&endpointing=300&utterance_end_ms=1000&vad_events=true';

    this.socket = new WebSocket(url, {
      headers: { Authorization: 'Token ' + env.DEEPGRAM_API_KEY },
    });

    // Deepgram closes the stream after ~10s of silence. A periodic KeepAlive
    // keeps the connection alive between utterances so the first words of the
    // next turn are not dropped.
    this.socket.on('open', () => {
      vlog(
        'stt',
        'deepgram connected',
        `${env.DEEPGRAM_STT_MODEL} (lang=${env.DEEPGRAM_STT_LANGUAGE})`,
      );
      this.keepAlive = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 8000);
    });
    this.socket.on('close', () => vlog('stt', 'deepgram closed'));

    this.socket.on('message', (data) => {
      const event = JSON.parse(data.toString());

      // Deepgram detected the end of an utterance (silence) -> let the session
      // know it can finalize and respond, hands-free.
      if (event.type === 'UtteranceEnd') {
        this.emit('utteranceEnd');
        return;
      }
      if (event.type && event.type !== 'Results') return;

      const transcript = event.channel?.alternatives?.[0]?.transcript;
      if (transcript) {
        this.emit(event.is_final ? 'final' : 'partial', transcript);
      }
      // speech_final marks the last final of a spoken utterance (endpointing).
      if (event.speech_final) this.emit('utteranceEnd');
    });
    this.socket.on('error', (error) => this.emit('error', error));
  }

  send(chunk: Buffer) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(chunk);
      this.forwarded += 1;
      if (this.forwarded === 1) {
        vlog('stt', 'forwarding audio to deepgram', `${chunk.length} bytes`);
      }
    } else if (!env.DEEPGRAM_API_KEY) {
      // No key: warning already emitted on start(); nothing to forward to.
    } else {
      // Audio arrived before the Deepgram socket was open (or after it closed)
      // and is being dropped — a common cause of "no transcript".
      this.dropped += 1;
      if (this.dropped === 1 || this.dropped % 50 === 0) {
        vlog(
          'stt',
          `DROPPING audio: deepgram socket not open (state=${this.socket?.readyState}), dropped=${this.dropped}`,
        );
      }
    }
  }

  /**
   * Asks Deepgram to flush any buffered audio into a final result without
   * closing the connection. Used to finalize the current utterance when the
   * user releases the mic.
   */
  finalize() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'Finalize' }));
    }
  }

  stop() {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = undefined;
    }
    this.socket?.close();
  }
}
