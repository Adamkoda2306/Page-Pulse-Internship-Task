import request from 'supertest';
import { app } from '../../app';

describe('app-level behaviour', () => {
  it('reports health', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.ok).toBe(true);
    expect(typeof response.body.uptime).toBe('number');
  });

  it('returns a JSON 404 for an unknown api route', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);
    expect(response.body).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'No such endpoint.' },
    });
  });

  it('returns INVALID_JSON rather than a 500 for a malformed body', async () => {
    const response = await request(app)
      .post('/api/audit')
      .set('content-type', 'application/json')
      .send('{"url": ')
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects an oversized body', async () => {
    const response = await request(app)
      .post('/api/audit')
      .send({ url: 'https://example.com/', padding: 'x'.repeat(20_000) })
      .expect(413);

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('uses the same error envelope on every failure', async () => {
    const response = await request(app).post('/api/audit').send({}).expect(400);

    expect(Object.keys(response.body)).toEqual(['ok', 'error']);
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'message']);
  });
});