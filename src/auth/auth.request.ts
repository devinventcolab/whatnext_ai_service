import { Request } from 'express';
import { AuthContext } from './auth.types';

export interface AuthRequest extends Request {
  auth: AuthContext;
}
