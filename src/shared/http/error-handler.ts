import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors/api-error';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      statusCode: 400,
      message: 'Validation failed',
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

  res.status(500).json({ statusCode: 500, message: 'Internal server error' });
};
