import { NextFunction, Request, Response } from 'express';
import { languageManager } from '../../i18n/language-manager';
import { SupportedLanguage } from '../../i18n/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Detected request language (set by languageMiddleware). */
      language: SupportedLanguage;
    }
  }
}

/**
 * Resolves the request language and attaches it as `req.language`.
 * Priority: explicit `?lang=`/body.language -> request text content -> the
 * Accept-Language header -> default. Never throws; always sets a language.
 */
export function languageMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const explicit =
    (typeof req.query.lang === 'string' && req.query.lang) ||
    (req.body && typeof req.body.language === 'string' && req.body.language) ||
    undefined;

  if (explicit && languageManager.isSupported(explicit)) {
    req.language = languageManager.normalize(explicit);
    return next();
  }

  const bodyText = collectText(req.body);
  const detected = languageManager.detect(bodyText);
  req.language =
    detected ??
    languageManager.fromAcceptLanguage(req.headers['accept-language']);
  next();
}

/** Pulls a few likely text fields out of a JSON body for detection. */
function collectText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const candidates = ['text', 'transcript', 'message', 'title', 'content'];
  const parts: string[] = [];
  for (const key of candidates) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === 'string') parts.push(value);
  }
  return parts.join(' ');
}
