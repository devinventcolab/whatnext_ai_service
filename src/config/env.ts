import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(8980),
  // Verbose voice-pipeline logging. Leave unset to default to on outside prod.
  DEBUG_VOICE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  APP_ORIGIN: z.string().default('*'),
  DOTNET_API_BASE_URL: z.string().url().default('http://localhost:5000/api'),
  DOTNET_AUTH_ME_PATH: z.string().default('/auth/me'),
  DOTNET_TASKS_PATH: z.string().default('/tasks'),
  DOTNET_EVENTS_PATH: z.string().default('/events'),
  DOTNET_NOTES_PATH: z.string().default('/notes'),
  DOTNET_WORKLOGS_PATH: z.string().default('/worklogs'),
  JWT_SHARED_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_STT_MODEL: z.string().default('nova-3'),
  DEEPGRAM_TTS_MODEL: z.string().default('aura-2-thalia-en'),
});

export const env = envSchema.parse(process.env);
