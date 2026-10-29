import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { Env, Variables } from './types';

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

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 1. Host Canonicalization (301 Permanent Redirect www.alfaazcollective.org -> apex)
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

// 2. Global CORS Middleware (Tightened against arbitrary origin reflection with credentials)
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return null;
      const allowedStatic = [
        c.env?.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:8787',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8787',
        'http://localhost:3000',
        'https://alfaaz.pages.dev',
        'https://alfaazcollective.vercel.app'
      ].filter(Boolean);

      if (allowedStatic.includes(origin)) {
        return origin;
      }

      try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();
        if (
          host === 'alfaaz.pages.dev' ||
          host.endsWith('.alfaaz.pages.dev') ||
          host === 'alfaaz.com' ||
          host.endsWith('.alfaaz.com') ||
          host === 'alfaazcollective.org' ||
          host.endsWith('.alfaazcollective.org') ||
          host === 'alfaazcollective.vercel.app' ||
          host === 'localhost' ||
          host === '127.0.0.1'
        ) {
          return origin;
        }
      } catch {
        // invalid URL format
      }

      // Reject arbitrary external origin reflection
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cf-turnstile-response'],
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
  const path = c.req.path.replace(/\/+$/, '') || '/';
  const method = c.req.method;

  if (method === 'GET' || method === 'HEAD') {
    const url = new URL(c.req.url);
    const search = url.search;

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

// 404 Handler for API routes
app.all('/api/*', (c) => c.json({ error: 'Endpoint not found on Cloudflare-native API' }, 404));

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

export default app;
