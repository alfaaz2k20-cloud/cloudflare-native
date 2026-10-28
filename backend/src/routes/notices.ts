import { Hono, Context } from 'hono';
import { Env, Variables } from '../types';

const noticesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Handler for live community notices feed
async function handleNotices(c: Context<{ Bindings: Env; Variables: Variables }>) {
  // Query active open events
  const eventsResult = await c.env.DB.prepare(`
    SELECT e.id, e.name, e.event_date, e.description, e.capacity,
           (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as registered_count
    FROM events e
    WHERE e.registration_open = 1
    ORDER BY e.created_at DESC
  `).all();

  const events = (eventsResult.results || []).map((e: any) => {
    const capacity = Number(e.capacity) || 0;
    const count = Number(e.registered_count) || 0;
    return {
      name: e.name,
      event_date: e.event_date,
      description: e.description,
      capacity: capacity,
      spots_left: capacity > 0 ? Math.max(0, capacity - count) : null,
      full: capacity > 0 && count >= capacity
    };
  });

  // Query active exhibition
  const exhRow = await c.env.DB.prepare(`
    SELECT title, date_text, about_text
    FROM exhibitions_list
    WHERE is_active = 1
    LIMIT 1
  `).first<{ title: string; date_text: string; about_text: string }>();

  const exhibition = exhRow ? {
    is_open: true,
    title: exhRow.title,
    date_text: exhRow.date_text,
    about_text: exhRow.about_text
  } : null;

  // Query latest published blog matching cdn.py behavior
  const blogRow = await c.env.DB.prepare(`
    SELECT id, title, excerpt, created_at
    FROM blogs
    WHERE is_published = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).first<{ id: number; title: string; excerpt: string; created_at: string }>();

  const latest_blog = blogRow ? {
    id: blogRow.id,
    title: blogRow.title,
    excerpt: blogRow.excerpt,
    created_at: blogRow.created_at
  } : null;

  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.json({ events, exhibition, latest_blog });
}

// Support both GET /notices and GET / (when mounted at /notices or /api/notices)
noticesRouter.get('/notices', handleNotices);
noticesRouter.get('/', handleNotices);

// GET /api/blogs - Legacy Vercel endpoint: List all published blogs
noticesRouter.get('/blogs', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT id, title, excerpt, created_at
    FROM blogs
    WHERE is_published = 1
    ORDER BY created_at DESC
  `).all();

  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.json(result.results || []);
});

// GET /api/blog - Legacy Vercel endpoint: Single published blog by query param ?id=
noticesRouter.get('/blog', async (c) => {
  const idStr = c.req.query('id');
  if (!idStr) {
    return c.json({ error: 'Missing article ID' }, 400);
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }

  const article = await c.env.DB.prepare(`
    SELECT *
    FROM blogs
    WHERE id = ? AND is_published = 1
  `).bind(id).first();

  if (!article) {
    return c.json({ error: 'Article not found.' }, 404);
  }

  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.json(article);
});

export default noticesRouter;
