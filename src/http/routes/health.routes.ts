import { Router } from 'express';
import { env } from '../../config/env';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'voice-assistant-service',
    dotnetApiBaseUrl: env.DOTNET_API_BASE_URL,
    timestamp: new Date().toISOString(),
  });
});
