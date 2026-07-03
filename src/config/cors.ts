import { env } from './env';

const localhostOriginPattern =
  /^(?:https?|wss?):\/\/(localhost|127\.\d+\.\d+(?:\.\d+)?)(:\d+)?$/i;
const allowedOrigins = env.APP_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isOriginAllowed(origin?: string) {
  if (allowedOrigins.includes('*')) return true;
  if (!origin) return true;
  if (env.NODE_ENV !== 'production' && localhostOriginPattern.test(origin))
    return true;
  return allowedOrigins.includes(origin);
}

export function socketCorsOrigin() {
  if (allowedOrigins.includes('*')) return true;
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('CORS blocked for origin: ' + origin));
  };
}
