import { Router } from 'express';
import { AuthRequest } from '../../auth/auth.request';
import { requireAuth } from '../../auth/auth.middleware';
import { DotnetApiClient } from '../../integrations/dotnet/dotnet-api.client';
import { asyncHandler } from '../../shared/http/async-handler';

const dotnetApi = new DotnetApiClient();

export const proxyRouter = Router();

proxyRouter.get('/me', requireAuth, (req, res) => {
  res.json((req as AuthRequest).auth.user);
});

proxyRouter.post(
  '/test-task',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as AuthRequest).auth;
    res.status(201).json(await dotnetApi.createTask(auth.token, req.body));
  }),
);
