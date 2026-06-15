import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { isOriginAllowed } from '../config/cors';
import { env } from '../config/env';
import { errorHandler } from '../shared/http/error-handler';
import { languageMiddleware } from './middleware/language.middleware';
import { healthRouter } from './routes/health.routes';
import { proxyRouter } from './routes/proxy.routes';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('CORS blocked for origin: ' + origin));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '2mb' }));
  // Detect request language (body text / Accept-Language) -> req.language.
  app.use(languageMiddleware);
  app.use(healthRouter);
  app.use('/api/voice', proxyRouter);
  app.use(errorHandler);
  return app;
}
