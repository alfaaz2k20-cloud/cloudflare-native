import { describe, it, expect } from 'vitest';
import app from '../backend/src/index';

async function preflight(origin: string, env: Record<string, any> = {}) {
  return app.request('/api/events', {
    method: 'OPTIONS',
    headers: {
      'Origin': origin,
      'Access-Control-Request-Method': 'GET'
    }
  }, env as any);
}

const PRODUCTION_ENV = { ENV: 'production' };

describe('CORS exact-origin allowlist', () => {
  it('reflects first-party production origins', async () => {
    for (const origin of [
      'https://alfaazcollective.org',
      'https://www.alfaazcollective.org',
      'https://alfaazcollective.vercel.app',
      'https://alfaaz.pages.dev'
    ]) {
      const res = await preflight(origin, PRODUCTION_ENV);
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    }
  });

  it('reflects hashed Cloudflare Pages preview subdomains', async () => {
    const res = await preflight('https://8f3c1a2b.alfaaz.pages.dev', PRODUCTION_ENV);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://8f3c1a2b.alfaaz.pages.dev');
  });

  it('omits Access-Control-Allow-Origin for every unlisted origin', async () => {
    const rejected = [
      // Domains we do not own. `alfaaz.com` was previously accepted by suffix match.
      'https://alfaaz.com',
      'https://mail.alfaaz.com',
      // Lookalike and suffix-attack hosts against the domain we do own.
      'https://notalfaazcollective.org',
      'https://alfaazcollective.org.evil.test',
      'https://evil-alfaazcollective.org',
      'https://x.alfaazcollective.org',
      // Wrong scheme or a spoofed pages.dev suffix.
      'http://alfaaz.pages.dev',
      'https://alfaaz.pages.dev.evil.test',
      'https://evilalfaaz.pages.dev',
      // Subdomain that makes no API calls, so it is deliberately not allowlisted.
      'https://tch.alfaazcollective.org',
      // Loopback on an unpinned port is refused in production.
      'http://localhost:9999',
      'http://127.0.0.1:4242',
      'http://localhost',
      // Loopback is refused outright once ENV is production.
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8787',
      'http://127.0.0.1:8787'
    ];

    for (const origin of rejected) {
      const res = await preflight(origin, PRODUCTION_ENV);
      // Absence of Access-Control-Allow-Origin is the gate; the browser blocks the
      // response regardless of the inert allow-credentials header Hono still emits.
      expect(res.headers.get('access-control-allow-origin'), origin).toBeNull();
    }
  });

  it('honours the three pinned loopback dev ports outside production', async () => {
    for (const origin of [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8787',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8787'
    ]) {
      const res = await preflight(origin, { ENV: 'development' });
      expect(res.headers.get('access-control-allow-origin'), origin).toBe(origin);
    }
  });

  it('still refuses unpinned loopback ports outside production', async () => {
    for (const origin of ['http://localhost:9999', 'http://127.0.0.1', 'https://localhost:3000']) {
      const res = await preflight(origin, { ENV: 'development' });
      expect(res.headers.get('access-control-allow-origin'), origin).toBeNull();
    }
  });

  it('honours an operator-supplied FRONTEND_URL exactly, not as a suffix', async () => {
    const res = await preflight('https://staging.internal.test', {
      ENV: 'production',
      FRONTEND_URL: 'https://staging.internal.test'
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://staging.internal.test');

    const spoof = await preflight('https://staging.internal.test.evil.test', {
      ENV: 'production',
      FRONTEND_URL: 'https://staging.internal.test'
    });
    expect(spoof.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('does not reflect an Origin header on a non-preflight request', async () => {
    const res = await app.request('/ping', {
      headers: { 'Origin': 'https://evil.test' }
    }, PRODUCTION_ENV as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
