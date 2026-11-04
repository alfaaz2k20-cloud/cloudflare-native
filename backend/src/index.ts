import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { Env, Variables } from './types';
import { STATIC_SECURITY_HEADERS, cspForPath } from './security/headers';
import { generateCuratorEssay } from './services/curator';

import authRouter from './routes/auth';
import eventsRouter from './routes/events';
import clubsRouter from './routes/clubs';
import exhibitionsRouter from './routes/exhibitions';
import vaultRouter from './routes/vault';
import blogsRouter from './routes/blogs';
import curatorRouter from './routes/curator';
import adminRouter from './routes/admin';
import recruitRouter from './routes/recruit';
import researchRouter from './routes/research';
import noticesRouter from './routes/notices';
import verificationRouter from './routes/verification';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 1. Security Headers Middleware (CSP, Clickjacking & MIME-type protection)
app.use('*', async (c, next) => {
  await next();
  for (const [name, value] of STATIC_SECURITY_HEADERS) {
    c.res.headers.set(name, value);
  }
  c.res.headers.set('Content-Security-Policy', cspForPath(c.req.path));
});

// 2. Host Canonicalization (301 Permanent Redirect www.alfaazcollective.org -> apex)
app.use('*', async (c, next) => {
  const host = c.req.header('host')?.toLowerCase().split(':')[0];
  if (host === 'www.alfaazcollective.org') {
    const url = new URL(c.req.url);
    url.hostname = 'alfaazcollective.org';
    url.protocol = 'https:';
    url.port = '';
    return c.redirect(url.toString(), 301);
  }
  await next();
});

// 3. Global CORS Middleware (exact-origin allowlist; no suffix wildcards on owned domains)
const FIRST_PARTY_ORIGINS = new Set([
  'https://alfaazcollective.org',
  'https://www.alfaazcollective.org',
  'https://alfaazcollective.vercel.app',
  'https://alfaaz.pages.dev'
]);

// Loopback origins are only honoured outside production, where they are the dev servers
// declared in frontend/vite.config.js and `wrangler dev`. Any port is not enough: a pinned
// port still lets a local process speak to the API, so these never ship to production.
const LOOPBACK_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787'
]);

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return null;

      if (FIRST_PARTY_ORIGINS.has(origin) || (c.env?.FRONTEND_URL && origin === c.env.FRONTEND_URL)) {
        return origin;
      }

      if (c.env?.ENV !== 'production' && LOOPBACK_ORIGINS.has(origin)) {
        return origin;
      }

      // Cloudflare Pages assigns each preview build a hashed subdomain, which cannot be
      // enumerated ahead of time. `alfaaz.pages.dev` is a subdomain we control, so the
      // suffix match is bounded to our own project rather than to a domain we merely resemble.
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        return null;
      }
      if (
        parsed.protocol === 'https:' &&
        !parsed.port &&
        parsed.hostname.toLowerCase().endsWith('.alfaaz.pages.dev')
      ) {
        return origin;
      }

      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cf-turnstile-response', 'Accept', 'Origin'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 86400,
    credentials: true
  });
  return corsMiddleware(c, next);
});

// Root and Health Endpoints
app.get('/ping', (c) => c.json({
  status: 'ALIVE',
  runtime: 'cloudflare-workers',
  service: 'alfaaz-collective',
  timestamp: new Date().toISOString()
}));

app.get('/api/ping', (c) => c.json({
  status: 'ALIVE',
  runtime: 'cloudflare-workers',
  service: 'alfaaz-collective',
  timestamp: new Date().toISOString()
}));

// Legacy Vercel Navigation Rewrites (Matching vercel.json)
app.use('*', async (c, next) => {
  const method = c.req.method;

  if (method === 'GET' || method === 'HEAD') {
    const rawPath = c.req.path;
    const path = rawPath.replace(/\/+$/, '') || '/';
    const url = new URL(c.req.url);
    const search = url.search;
    const host = (c.req.header('host') || url.host).toLowerCase();

    // 1. Permanent redirect for /tch or /tchandervar without trailing slash
    // Guarantees browser base URL is /tch/ so relative asset paths resolve cleanly
    if (rawPath === '/tch' || rawPath === '/tchandervar') {
      return c.redirect('/tch/' + search, 301);
    }

    // 2. Tchandervar Subdomain & Route Isolation (tch.alfaazcollective.org or /tch/, /tchandervar/)
    if (host.startsWith('tch.') || path === '/tch' || path === '/tchandervar' || path.startsWith('/tch/') || path.startsWith('/tchandervar/')) {
      let subPath = path;
      if (path === '/tch' || path === '/tchandervar' || path === '/') {
        subPath = '/tchandervar/index.html';
      } else if (path.startsWith('/tch/')) {
        const afterTch = path.slice(5);
        if (afterTch.startsWith('assets/')) {
          subPath = '/' + afterTch;
        } else if (afterTch.startsWith('images/')) {
          subPath = '/tchandervar/' + afterTch;
        } else {
          subPath = '/tchandervar/' + afterTch;
        }
      } else if (path.startsWith('/assets/')) {
        // Shared Vite assets bundle is placed at /assets/ in dist
        subPath = path;
      } else if (!path.startsWith('/tchandervar/')) {
        subPath = '/tchandervar' + path;
      }

      // Canonicalize asset URL to the primary apex domain so env.ASSETS always matches
      const assetUrl = new URL(subPath + search, 'https://alfaazcollective.org');
      return c.env?.ASSETS
        ? c.env.ASSETS.fetch(new Request(assetUrl, { method, headers: c.req.raw.headers }))
        : c.redirect('/tchandervar/index.html' + search);
    }

    // 3. Failsafe: Direct requests to Tchandervar images from apex domain
    if (path.startsWith('/images/artwork-') || path.startsWith('/images/frame') || path.startsWith('/images/slide-new')) {
      const subPath = '/tchandervar' + path;
      const assetUrl = new URL(subPath + search, 'https://alfaazcollective.org');
      return c.env?.ASSETS
        ? c.env.ASSETS.fetch(new Request(assetUrl, { method, headers: c.req.raw.headers }))
        : c.redirect(subPath + search);
    }

    if (path === '/recruit/sjt') {
      const destUrl = new URL('/recruit.html' + search, c.req.url);
      return c.env?.ASSETS
        ? c.env.ASSETS.fetch(new Request(destUrl, { method, headers: c.req.raw.headers }))
        : c.redirect('/recruit.html' + search);
    }
    if (path === '/recruit/admin') {
      const destUrl = new URL('/admin.html' + search, c.req.url);
      return c.env?.ASSETS
        ? c.env.ASSETS.fetch(new Request(destUrl, { method, headers: c.req.raw.headers }))
        : c.redirect('/admin.html' + search);
    }
    if (path === '/recruit/research') {
      const isJsonPreferred = c.req.header('accept')?.includes('application/json') && !c.req.header('accept')?.includes('text/html');
      const hasAuth = Boolean(c.req.header('authorization'));
      if (!hasAuth && !isJsonPreferred) {
        const destUrl = new URL('/research.html' + search, c.req.url);
        return c.env?.ASSETS
          ? c.env.ASSETS.fetch(new Request(destUrl, { method, headers: c.req.raw.headers }))
          : c.redirect('/research.html' + search);
      }
    }
    if (path === '/service-worker.js') {
      const destUrl = new URL('/sw.js' + search, c.req.url);
      return c.env?.ASSETS
        ? c.env.ASSETS.fetch(new Request(destUrl, { method, headers: c.req.raw.headers }))
        : next();
    }
  }

  await next();
});

// Dual-Mount Routers (Direct root paths + /api prefix for maximum client compatibility)
// 1. Authentication
app.route('/auth', authRouter);
app.route('/api/auth', authRouter);

// 2. Events & RSVPs
app.route('/events', eventsRouter);
app.route('/api/events', eventsRouter);

// 3. Collective Circles / Clubs
app.route('/clubs', clubsRouter);
app.route('/api/clubs', clubsRouter);

// 4. Exhibitions
app.route('/exhibitions', exhibitionsRouter);
app.route('/api/exhibitions', exhibitionsRouter);

// 5. Creative Vault
app.route('/vault', vaultRouter);
app.route('/api/vault', vaultRouter);

// 6. Curated Blogs
app.route('/blogs', blogsRouter);
app.route('/api/blogs', blogsRouter);

// 7. Curator AI
app.route('/phantom', curatorRouter);
app.route('/api/phantom', curatorRouter);
app.route('/curator', curatorRouter);
app.route('/api/curator', curatorRouter);

// 8. Administrative Portal
app.route('/admin', adminRouter);
app.route('/api/admin', adminRouter);

// 9. Recruitment Dossier (Admin Research View)
app.route('/recruit/research', researchRouter);
app.route('/api/recruit/research', researchRouter);

// 10. Candidate Recruitment Subsystem
app.route('/recruit', recruitRouter);
app.route('/api/recruit', recruitRouter);

// 11. Community Notices Feed & Legacy Vercel Serverless Function Endpoints (/notices, /api/notices, /api/blogs, /api/blog)
app.route('/notices', noticesRouter);
app.route('/api', noticesRouter);

// 12. Contact Cross-Verification
app.route('/verification', verificationRouter);
app.route('/api/verification', verificationRouter);

// 404 Handler for API routes
app.all('/api/*', (c) => c.json({ error: 'Endpoint not found on Cloudflare-native API' }, 404));

// Static asset fallthrough. Registered last so every router above wins first.
// `run_worker_first` in wrangler.jsonc sends all requests to the Worker before the asset
// router, and there is no automatic fallthrough: without this handler every HTML page,
// image, and bundle would 404. Routing through here is also what lets the security header
// middleware above cover static responses, which the asset router would otherwise skip.
app.use('*', async (c) => {
  if (!c.env?.ASSETS) return c.notFound();
  return c.env.ASSETS.fetch(new Request(c.req.url, { method: c.req.method, headers: c.req.raw.headers }));
});

// Global Error Handler (Guarantees JSON error response instead of plain text 500)
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error('[FATAL SERVER ERROR]', err);
  const isProd = c.env?.ENV === 'production' || c.env?.ENVIRONMENT === 'production';
  return c.json({
    error: 'Internal Server Error',
    detail: isProd ? 'An unexpected error occurred.' : (err.message || 'An unexpected error occurred.')
  }, 500);
});

// Cloudflare Cron Trigger Handler for Weekly Curatorial Writer
(app as any).scheduled = async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
  ctx.waitUntil((async () => {
    try {
      console.log('[CRON] Weekly Curatorial Writer triggered by Cloudflare Cron Trigger.');
      const generated = await generateCuratorEssay(env);
      const title = generated.title || 'Untitled Reflection';
      const excerpt = generated.excerpt || '';
      const content = generated.content || '';

      // Idempotency: skip insertion if identical title already published
      const existing = await env.DB.prepare(
        'SELECT id FROM blogs WHERE title = ? LIMIT 1'
      ).bind(title).first();

      if (existing) {
        console.log('[CRON] Article already published with title:', title, '— skipping duplicate insertion.');
        return;
      }

      await env.DB.prepare(`
        INSERT INTO blogs (title, excerpt, content, is_published)
        VALUES (?, ?, ?, 1)
      `).bind(title, excerpt, content).run();

      if (env.CACHE_KV) {
        await env.CACHE_KV.delete('notices_feed');
      }
      console.log('[CRON] Published weekly blog:', title);
    } catch (err) {
      console.error('[CRON ERROR] Curator Writer cron execution failed:', err);
    }
  })());
};

export default app;
