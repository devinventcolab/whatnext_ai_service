import request from 'supertest';
import { createApp } from '../src/http/app';

describe('voice microservice health', () => {
  it('returns service health', async () => {
    await request(createApp())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('voice-assistant-service');
      });
  });
});
