import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { languageManager } from '../../i18n/language-manager';
import { ApiError } from '../errors/api-error';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const lang = req.language ?? languageManager.defaultLanguage;

  if (error instanceof ZodError) {
    res.status(400).json({
      statusCode: 400,
      message: languageManager.t('error.validation', lang),
      details: error.flatten(),
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    });
    return;
  }

  res.status(500).json({
    statusCode: 500,
    message: languageManager.t('error.internal', lang),
  });
};
