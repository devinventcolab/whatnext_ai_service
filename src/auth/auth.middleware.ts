import { NextFunction, RequestHandler, Response } from 'express';
import { ApiError } from '../shared/errors/api-error';
import { AuthRequest } from './auth.request';
import { AuthService } from './auth.service';

const authService = new AuthService();

export const requireAuth: RequestHandler = async (
  req,
  _res: Response,
  next: NextFunction,
) => {
  try {
    (req as AuthRequest).auth = await authService.authenticateBearer(
      req.headers.authorization,
    );
    return next();
  } catch (error) {
    return next(
      error instanceof Error ? error : new ApiError(401, 'Unauthorized'),
    );
  }
};
