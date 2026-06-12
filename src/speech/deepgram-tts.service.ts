import { env } from '../config/env';

export class DeepgramTtsService {
  async synthesize(text: string) {
    if (!env.DEEPGRAM_API_KEY) return Buffer.from('');

    const response = await fetch(
      'https://api.deepgram.com/v1/speak?model=' +
        encodeURIComponent(env.DEEPGRAM_TTS_MODEL),
      {
        method: 'POST',
        headers: {
          Authorization: 'Token ' + env.DEEPGRAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      },
    );

    if (!response.ok)
      throw new Error('Deepgram TTS failed: ' + response.statusText);
    return Buffer.from(await response.arrayBuffer());
  }
}
