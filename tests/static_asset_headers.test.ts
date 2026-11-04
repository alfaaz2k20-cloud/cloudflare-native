import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import app from '../backend/src/index';
import {
  STRICT_CSP,
  JIT_CSP,
  STATIC_SECURITY_HEADERS,
  STRICT_TRANSPORT_SECURITY
} from '../backend/src/security/headers';

const ROOT = process.cwd();

function mockAssets() {
  return {
    fetch: async () => new Response('<!doctype html><title>stub</title>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  };
}

async function getAsset(path: string) {
  return app.request(path, { method: 'GET' }, { ASSETS: mockAssets(), ENV: 'production' } as any);
}

describe('Static asset security headers', () => {
  it('run_worker_first is enabled, otherwise the asset router bypasses the Worker entirely', () => {
    const config = readFileSync(resolve(ROOT, 'wrangler.jsonc'), 'utf8');
    expect(config).toMatch(/"run_worker_first"\s*:\s*true/);
  });

  it('ships no _headers file, which would comma-join a second Content-Security-Policy', () => {
    // Cloudflare joins duplicate header values with a comma instead of letting the more
    // specific rule win, so a static _headers CSP would stack on top of the Worker's.
    expect(existsSync(resolve(ROOT, 'frontend/public/_headers'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'frontend/dist/_headers'))).toBe(false);
  });

  it('applies every static security header to HTML pages served through the Worker', async () => {
    const res = await getAsset('/login.html');

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('stub');

    for (const [name, value] of STATIC_SECURITY_HEADERS) {
      expect(res.headers.get(name), name).toBe(value);
    }
  });

  it('enforces frame-ancestors none on static pages per the AGENTS.md CSP invariant', async () => {
    for (const path of ['/index.html', '/login.html', '/recruit.html', '/research.html', '/admin.html']) {
      const res = await getAsset(path);
      expect(res.headers.get('Content-Security-Policy'), path).toContain("frame-ancestors 'none'");
    }
  });

  it('grants the Tailwind JIT allowance only to recruit and research', async () => {
    const jit = ['/recruit.html', '/recruit', '/research.html', '/research'];
    for (const path of jit) {
      const res = await getAsset(path);
      expect(res.headers.get('Content-Security-Policy'), path).toBe(JIT_CSP);
      expect(res.headers.get('Content-Security-Policy'), path).toContain("'unsafe-eval'");
      expect(res.headers.get('Content-Security-Policy'), path).toContain('cdn.tailwindcss.com');
    }

    const strict = ['/index.html', '/login.html', '/register.html', '/reset.html', '/admin.html',
      '/blogs.html', '/post.html', '/dashboard.html', '/exhibition.html', '/submit.html',
      '/404.html', '/tchandervar/index.html', '/offline.html'];
    for (const path of strict) {
      const res = await getAsset(path);
      expect(res.headers.get('Content-Security-Policy'), path).toBe(STRICT_CSP);
      expect(res.headers.get('Content-Security-Policy'), path).not.toContain("'unsafe-eval'");
      expect(res.headers.get('Content-Security-Policy'), path).not.toContain('cdn.tailwindcss.com');
    }
  });

  it('emits exactly one Content-Security-Policy header, not a comma-joined pair', async () => {
    const res = await getAsset('/index.html');
    const raw = res.headers.get('Content-Security-Policy') || '';
    expect(raw.split("default-src 'self'").length - 1).toBe(1);
  });

  it('covers non-HTML static assets too', async () => {
    const res = await getAsset('/assets/index-abc123.css');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBe(STRICT_CSP);
  });

  it('no longer allowlists decommissioned Apple and Meta identity providers in the CSP', () => {
    for (const csp of [STRICT_CSP, JIT_CSP]) {
      expect(csp).not.toContain('graph.facebook.com');
      expect(csp).not.toContain('appleid.cdn-apple.com');
      expect(csp).not.toContain('appleid.apple.com');
      expect(csp).not.toContain('securetoken.google.com');
    }
  });

  it('still forwards to the asset router when no route matched, and 404s without the binding', async () => {
    const withoutAssets = await app.request('/index.html', { method: 'GET' }, { ENV: 'production' } as any);
    expect(withoutAssets.status).toBe(404);
  });

  it('keeps the CSP on error responses, since Hono skips middleware that awaits before throwing', async () => {
    // Hono's HTTPException and onError paths build their own Response. If the header
    // middleware only ran on the happy path, every 401 and 500 would ship without CSP.
    const unauthorized = await app.request('/auth/me', { method: 'GET' }, { ENV: 'production' } as any);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('Content-Security-Policy')).toBe(STRICT_CSP);
    expect(unauthorized.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);

    const crashed = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-turnstile-response': '0x4AAAAAAtestdummytoken' },
      body: JSON.stringify({ email: 'crash@alfaaz.local', password: 'hunter2!' })
    }, {
      ENV: 'development',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      DB: { prepare: () => { throw new Error('injected failure'); } }
    } as any);
    expect(crashed.status).toBe(500);
    expect(crashed.headers.get('Content-Security-Policy')).toBe(STRICT_CSP);
    expect(crashed.headers.get('Strict-Transport-Security')).toBe(STRICT_TRANSPORT_SECURITY);
  });
});
