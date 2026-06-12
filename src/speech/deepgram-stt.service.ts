import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { env } from '../config/env';

export class DeepgramSttService extends EventEmitter {
  private socket?: WebSocket;

  start() {
    if (!env.DEEPGRAM_API_KEY) {
      this.emit('warning', 'Deepgram API key is not configured');
      return;
    }

    const url =
      'wss://api.deepgram.com/v1/listen?model=' +
      encodeURIComponent(env.DEEPGRAM_STT_MODEL) +
      '&encoding=linear16&sample_rate=16000&channels=1&interim_results=true';

    this.socket = new WebSocket(url, {
      headers: { Authorization: 'Token ' + env.DEEPGRAM_API_KEY },
    });

    this.socket.on('message', (data) => {
      const event = JSON.parse(data.toString());
      const transcript = event.channel?.alternatives?.[0]?.transcript;
      if (!transcript) return;
      this.emit(event.is_final ? 'final' : 'partial', transcript);
    });
    this.socket.on('error', (error) => this.emit('error', error));
  }

  send(chunk: Buffer) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(chunk);
  }

  stop() {
    this.socket?.close();
  }
}
