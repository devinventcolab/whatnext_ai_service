import jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { DotnetApiClient } from '../integrations/dotnet/dotnet-api.client';
import { ApiError } from '../shared/errors/api-error';
import { AuthContext, AuthUser } from './auth.types';

const dotnetNameIdentifierClaim =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

function mapJwtPayloadToUser(
  payload: JwtPayload | Record<string, unknown>,
): AuthUser {
  const id =
    payload.sub ??
    payload.id ??
    payload.userId ??
    payload.nameid ??
    payload[dotnetNameIdentifierClaim];

  if (!id) {
    throw new ApiError(401, 'Token does not contain a supported user id claim');
  }

  return {
    id: String(id),
    email: payload.email ? String(payload.email) : undefined,
    name: payload.name
      ? String(payload.name)
      : payload.username
        ? String(payload.username)
        : undefined,
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : undefined,
  };
}

export class AuthService {
  constructor(private readonly dotnetApi = new DotnetApiClient()) {}

  async authenticateBearer(header?: string): Promise<AuthContext> {
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new ApiError(401, 'Missing bearer token');
    return this.authenticateToken(token);
  }

  async authenticateToken(token?: string): Promise<AuthContext> {
    if (!token) throw new ApiError(401, 'Missing auth token');

    let user: AuthUser;

    if (env.JWT_SHARED_SECRET) {
      const payload = jwt.verify(token, env.JWT_SHARED_SECRET) as Record<
        string,
        unknown
      >;
      user = mapJwtPayloadToUser(payload);
    } else {
      try {
        user = await this.dotnetApi.getCurrentUser(token);
      } catch (error) {
        if (env.NODE_ENV === 'development') {
          const decoded = jwt.decode(token);
          if (decoded && typeof decoded === 'object') {
            user = mapJwtPayloadToUser(decoded);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    console.log('Login user details:', {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    });

    return { token, user };
  }
}
