import express from 'express';
import request from 'supertest';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { errorHandler } from '../../middleware/error.middleware';

/** Minimal app so the limiter can be tested without the audit pipeline. */
function buildApp(max: number, windowMs = 60_000) {
  const app = express();
  app.get('/ping', rateLimit({ windowMs, max }), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('rateLimit', () => {
  it('lets requests through up to the limit', async () => {
    const app = buildApp(2);

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
  });

  it('rejects the request after the limit with 429 and a retry hint', async () => {
    const app = buildApp(2);

    await request(app).get('/ping');
    await request(app).get('/ping');
    const response = await request(app).get('/ping').expect(429);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(response.body.error.message).toMatch(/try again in \d+s/i);
  });

  it('starts a fresh window once the old one expires', async () => {
    const app = buildApp(1, 30); // 30ms window keeps the test fast

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(429);

    await new Promise((resolve) => setTimeout(resolve, 40));
    await request(app).get('/ping').expect(200);
  });
});