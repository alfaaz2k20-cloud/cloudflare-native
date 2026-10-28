import { Hono } from 'hono';
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

// Global CORS Middleware
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cf-turnstile-response'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 86400,
  credentials: true
}));

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

// 11. Legacy Vercel Serverless Function Endpoints (/api/notices, /api/blogs, /api/blog)
app.route('/api', noticesRouter);

// 404 Handler for API routes
app.all('/api/*', (c) => c.json({ error: 'Endpoint not found on Cloudflare-native API' }, 404));

export default app;
