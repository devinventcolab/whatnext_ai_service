import { env } from '../config/env';

// Verbose voice-pipeline logging. On by default outside production; set
// DEBUG_VOICE=false to silence, or DEBUG_VOICE=true to force it on.
const enabled =
  env.DEBUG_VOICE === undefined
    ? env.NODE_ENV !== 'production'
    : env.DEBUG_VOICE;

/**
 * Logs a voice-pipeline event with a timestamp and scope so you can trace which
 * event fired and when (mirrors the frontend's on-screen event log).
 */
export function vlog(scope: string, message: string, detail?: unknown): void {
  if (!enabled) return;
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[${ts}] [voice:${scope}] ${message}`;
  if (detail !== undefined) {
    console.log(prefix, detail);
  } else {
    console.log(prefix);
  }
}
