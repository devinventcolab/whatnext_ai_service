import http from 'http';
import { env } from './config/env';
import { createApp } from './http/app';
import { attachVoiceGateway } from './realtime/voice.gateway';

function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);
  attachVoiceGateway(server);

  server.listen(env.PORT, () => {
    console.log('Voice assistant microservice listening on port ' + env.PORT);
  });
}

try {
  bootstrap();
} catch (error) {
  console.error(error);
  process.exit(1);
}
