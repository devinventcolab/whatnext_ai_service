import OpenAI from 'openai';
import { env } from '../config/env';
import { SupportedLanguage } from '../i18n/types';
import { vlog } from '../shared/debug';
import { DeepgramTtsService } from './deepgram-tts.service';

/**
 * Language-aware text-to-speech.
 *
 * Deepgram Aura voices are English-only, so English uses Deepgram (most
 * natural) and every other language uses OpenAI TTS, which speaks the language
 * of the input text. Each provider is a fallback for the other when a key is
 * missing, so the service degrades gracefully.
 */
export class TtsService {
  private readonly deepgram = new DeepgramTtsService();
  private readonly openai = env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : undefined;

  async synthesize(text: string, language: SupportedLanguage): Promise<Buffer> {
    const clean = text.trim();
    if (!clean) return Buffer.from('');

    const preferOpenAi = language !== 'en';

    if (preferOpenAi && this.openai) {
      return this.openAiTts(clean, language);
    }
    if (env.DEEPGRAM_API_KEY) {
      vlog('tts', 'deepgram', { language });
      return this.deepgram.synthesize(clean);
    }
    if (this.openai) {
      return this.openAiTts(clean, language);
    }
    return Buffer.from('');
  }

  private async openAiTts(
    text: string,
    language: SupportedLanguage,
  ): Promise<Buffer> {
    vlog('tts', 'openai', { language, model: env.OPENAI_TTS_MODEL });
    const response = await this.openai!.audio.speech.create({
      model: env.OPENAI_TTS_MODEL,
      voice: env.OPENAI_TTS_VOICE as never,
      input: text,
      response_format: 'mp3',
    });
    return Buffer.from(await response.arrayBuffer());
  }
}
