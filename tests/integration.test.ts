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

  it('OPTIONS * returns universal CORS headers for custom domain alfaazcollective.org', async () => {
    const res = await app.request('/api/events', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://alfaazcollective.org',
        'Access-Control-Request-Method': 'GET'
      }
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://alfaazcollective.org');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('GET navigation rewrites redirect or serve assets for /recruit/sjt, /recruit/admin, and /recruit/research', async () => {
    // 1. /recruit/sjt without trailing slash
    const resSjt = await app.request('/recruit/sjt');
    expect([200, 302, 307]).toContain(resSjt.status);
    if ([302, 307].includes(resSjt.status)) {
      expect(resSjt.headers.get('location')).toBe('/recruit.html');
    }

    // 2. /recruit/sjt/ with trailing slash
    const resSjtSlash = await app.request('/recruit/sjt/');
    expect([200, 302, 307]).toContain(resSjtSlash.status);
    if ([302, 307].includes(resSjtSlash.status)) {
      expect(resSjtSlash.headers.get('location')).toBe('/recruit.html');
    }

    // 3. /recruit/admin
    const resAdmin = await app.request('/recruit/admin');
    expect([200, 302, 307]).toContain(resAdmin.status);
    if ([302, 307].includes(resAdmin.status)) {
      expect(resAdmin.headers.get('location')).toBe('/admin.html');
    }

    // 4. /recruit/research without auth rewrites to research.html
    const resResearch = await app.request('/recruit/research', {
      headers: { 'Accept': 'text/html' }
    });
    expect([200, 302, 307]).toContain(resResearch.status);
    if ([302, 307].includes(resResearch.status)) {
      expect(resResearch.headers.get('location')).toBe('/research.html');
    }

    // 5. With ASSETS binding mock, env.ASSETS.fetch is invoked
    const mockAssets = {
      fetch: async (req: Request) => new Response('MOCK_HTML_PAGE', { status: 200, headers: { 'content-type': 'text/html' } })
    };
    const resAsset = await app.request('/recruit/sjt', {}, { ASSETS: mockAssets } as any);
    expect(resAsset.status).toBe(200);
    expect(await resAsset.text()).toBe('MOCK_HTML_PAGE');
  });

  it('HEAD navigation rewrites return proper headers without 404 or 401', async () => {
    // 1. HEAD /recruit/sjt
    const resSjt = await app.request('/recruit/sjt', { method: 'HEAD' });
    expect([200, 302, 307]).toContain(resSjt.status);

    // 2. HEAD /recruit/admin
    const resAdmin = await app.request('/recruit/admin', { method: 'HEAD' });
    expect([200, 302, 307]).toContain(resAdmin.status);

    // 3. HEAD /recruit/research (must NOT fall through to 401 requireAdmin)
    const resResearch = await app.request('/recruit/research', {
      method: 'HEAD',
      headers: { 'Accept': 'text/html' }
    });
    expect([200, 302, 307]).toContain(resResearch.status);
    expect(resResearch.status).not.toBe(401);

    // 4. HEAD with mock ASSETS binding
    let capturedMethod = '';
    const mockAssets = {
      fetch: async (req: Request) => {
        capturedMethod = req.method;
        return new Response(null, { status: 200, headers: { 'content-type': 'text/html' } });
      }
    };
    const resAssetHead = await app.request('/recruit/sjt', { method: 'HEAD' }, { ASSETS: mockAssets } as any);
    expect(resAssetHead.status).toBe(200);
    expect(capturedMethod).toBe('HEAD');
  });

  it('preserves query parameters during navigation rewrites', async () => {
    let capturedUrl = '';
    const mockAssets = {
      fetch: async (req: Request) => {
        capturedUrl = req.url;
        return new Response('PAGE', { status: 200 });
      }
    };

    await app.request('/recruit/sjt?campaign=fall2026&ref=ig', {}, { ASSETS: mockAssets } as any);
    expect(capturedUrl).toContain('campaign=fall2026');
    expect(capturedUrl).toContain('ref=ig');
  });

  it('redirects www.alfaazcollective.org to apex domain https://alfaazcollective.org', async () => {
    const res = await app.request('http://www.alfaazcollective.org/recruit', {
      headers: { 'Host': 'www.alfaazcollective.org' }
    });

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://alfaazcollective.org/recruit');
  });

  it('GET /api/unknown-endpoint returns 404 with JSON error', async () => {
    const res = await app.request('/api/unknown-endpoint');
    expect(res.status).toBe(404);

    const data: any = await res.json();
    expect(data.error).toContain('Endpoint not found');
  });
});
