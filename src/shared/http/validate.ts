import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data;
    return next();
  };
}
