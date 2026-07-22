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
  // Hard timeout for outbound calls to the .NET backend so a slow/unreachable
  // host fails fast instead of hanging the socket handshake or a tool call.
  DOTNET_API_TIMEOUT_MS: z.coerce.number().default(8000),
  DOTNET_AUTH_ME_PATH: z.string().default('/auth/me'),
  DOTNET_TASKS_PATH: z.string().default('/user/add-confirm-task-details'),
  DOTNET_EVENTS_PATH: z.string().default('/user/create-event-calendar'),
  DOTNET_NOTES_PATH: z.string().default('/user/CreateNote'),
  DOTNET_WORKLOGS_PATH: z.string().default('/user/create-worklog'),
  DOTNET_TASKS_LIST_PATH: z.string().optional(),
  DOTNET_TASKS_DETAIL_PATH: z.string().default('/user/GetTaskDetailList'),
  DOTNET_TASKS_UPDATE_PATH: z.string().default('/user/add-task-details'),
  DOTNET_TASKS_DELETE_PATH: z.string().default('/user/DeleteTaskDetail'),
  DOTNET_NOTES_LIST_PATH: z.string().default('/user/NotesList'),
  DOTNET_NOTES_UPDATE_PATH: z.string().default('/user/CreateNote'),
  DOTNET_NOTES_DELETE_PATH: z.string().default('/user/DeleteNotes'),
  DOTNET_EVENTS_LIST_PATH: z.string().default('/user/GetEventCalendarList'),
  DOTNET_EVENTS_UPDATE_PATH: z.string().default('/user/create-event-calendar'),
  DOTNET_EVENTS_DELETE_PATH: z.string().optional(),
  DOTNET_WORKLOGS_LIST_PATH: z.string().optional(),
  DOTNET_WORKLOGS_UPDATE_PATH: z.string().optional(),
  DOTNET_WORKLOGS_DELETE_PATH: z.string().optional(),
  DOTNET_WORKLOG_DROPDOWNS_PATH: z
    .string()
    .default('/user/GetWorkLogDropdowns'),
  DOTNET_REMINDERS_LIST_PATH: z.string().optional(),
  DOTNET_REMINDERS_UPDATE_PATH: z.string().optional(),
  DOTNET_REMINDERS_DELETE_PATH: z.string().optional(),
  JWT_SHARED_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  // OpenAI TTS is used for non-English speech (multilingual). Aura is English-only.
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_VOICE: z.string().default('alloy'),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_STT_MODEL: z.string().default('nova-3'),
  // STT recognition language. "multi" enables Deepgram nova-3 multilingual
  // recognition; set to a specific code (e.g. "en") to lock the language.
  DEEPGRAM_STT_LANGUAGE: z.string().default('multi'),
  DEEPGRAM_TTS_MODEL: z.string().default('aura-2-thalia-en'),
});

export const env = envSchema.parse(process.env);
