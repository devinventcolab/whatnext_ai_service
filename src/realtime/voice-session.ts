import { Socket } from 'socket.io';
import { OpenAiAssistantService } from '../ai/openai-assistant.service';
import { AuthContext } from '../auth/auth.types';
import { DeepgramSttService } from '../speech/deepgram-stt.service';
import { DeepgramTtsService } from '../speech/deepgram-tts.service';

export class VoiceSession {
  private readonly stt = new DeepgramSttService();
  private readonly tts = new DeepgramTtsService();
  private readonly assistant = new OpenAiAssistantService();

  constructor(
    private readonly socket: Socket,
    private readonly auth: AuthContext,
  ) {}

  start() {
    this.stt.start();
    this.stt.on('warning', (message) =>
      this.socket.emit('voice:warning', { message }),
    );
    this.stt.on('partial', (text) =>
      this.socket.emit('transcript:partial', { text }),
    );
    this.stt.on('final', (text) =>
      this.handleTranscript(String(text)).catch((error) =>
        this.socket.emit('voice:error', { message: error.message }),
      ),
    );
    this.stt.on('error', (error) =>
      this.socket.emit('voice:error', { message: error.message }),
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
  }

  stop() {
    this.stt.stop();
    this.socket.emit('voice:closed');
  }

  private async handleTranscript(text: string) {
    this.socket.emit('transcript:final', { text });
    const response = await this.assistant.handleTranscript({
      token: this.auth.token,
      transcript: text,
      userId: this.auth.user.id,
    });

    this.socket.emit('assistant:text', response);
    const audio = await this.tts.synthesize(response.text);
    if (audio.byteLength) this.socket.emit('assistant:audio', audio);
  }
}
