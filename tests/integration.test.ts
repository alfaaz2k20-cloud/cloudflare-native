import { describe, it, expect } from 'vitest';
import app from '../backend/src/index';

describe('Hono Worker Integration Endpoints', () => {
  it('GET /ping returns ALIVE status and cloudflare-workers runtime', async () => {
    const res = await app.request('/ping');
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.status).toBe('ALIVE');
    expect(data.runtime).toBe('cloudflare-workers');
    expect(data.service).toBe('alfaaz-collective');
  });

  it('GET /api/ping returns identical health check payload for dual-mounted /api prefix', async () => {
    const res = await app.request('/api/ping');
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.status).toBe('ALIVE');
  });

  it('OPTIONS * returns universal CORS headers', async () => {
    const res = await app.request('/api/events', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://alfaazcollective.vercel.app',
        'Access-Control-Request-Method': 'GET'
      }
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://alfaazcollective.vercel.app');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('GET /recruit/sjt/public returns public scenarios without exposing scoring keys', async () => {
    const res = await app.request('/recruit/sjt/public');
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.scenarios).toHaveLength(7);
    expect(data.sjt_version).toBe('2026-09-rev');

    for (const s of data.scenarios) {
      for (const opt of s.options) {
        expect(opt.keys).toBeUndefined();
      }
    }
  });

  it('POST /phantom/ask answers cultural queries with grounded responses', async () => {
    const res = await app.request('/phantom/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is the philosophy of Alfaaz Collective?'
      })
    }, {
      // Mock Bindings
      DB: {} as any
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.answer).toBeDefined();
    expect(data.answer.length).toBeGreaterThan(20);
  });

  it('GET /api/unknown-endpoint returns 404 with JSON error', async () => {
    const res = await app.request('/api/unknown-endpoint');
    expect(res.status).toBe(404);

    const data: any = await res.json();
    expect(data.error).toContain('Endpoint not found');
  });
});
