import { Hono, Context } from 'hono';
import { Env, Variables } from '../types';

const noticesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Handler for live community notices feed
async function handleNotices(c: Context<{ Bindings: Env; Variables: Variables }>) {
  // Check KV cache first
  const cached = await c.env.CACHE_KV?.get('notices_feed');
  if (cached) {
    try {
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
      return c.json(JSON.parse(cached));
    } catch {}
  }

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

  // Query active exhibitions (support single or multiple concurrent cycles)
  let exhibitions: any[] = [];
  try {
    const exhRows = await c.env.DB.prepare(`
      SELECT id, title, date_text, about_text, require_over_18
      FROM exhibitions_list
      WHERE is_active = 1
      ORDER BY id ASC
    `).all<any>();
    exhibitions = (exhRows.results || []).map((row: any) => ({
      id: row.id,
      is_open: true,
      title: row.title,
      date_text: row.date_text,
      about_text: row.about_text,
      require_over_18: row.require_over_18 === undefined || row.require_over_18 === null ? 1 : Number(row.require_over_18)
    }));
  } catch {
    try {
      const exhRows = await c.env.DB.prepare(`
        SELECT id, title, date_text, about_text
        FROM exhibitions_list
        WHERE is_active = 1
        ORDER BY id ASC
      `).all<any>();
      exhibitions = (exhRows.results || []).map((row: any) => ({
        id: row.id,
        is_open: true,
        title: row.title,
        date_text: row.date_text,
        about_text: row.about_text,
        require_over_18: 1
      }));
    } catch {}
  }

  const exhibition = exhibitions.length > 0 ? exhibitions[0] : null;

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
  const responseData = { events, exhibition, exhibitions, latest_blog };
  if (c.env.CACHE_KV) {
    try {
      await c.env.CACHE_KV.put('notices_feed', JSON.stringify(responseData), { expirationTtl: 60 });
    } catch {}
  }
  return c.json(responseData);
}

// Support both GET /notices and GET / (when mounted at /notices or /api/notices)
noticesRouter.get('/notices', handleNotices);
noticesRouter.get('/', handleNotices);

// Legacy backward-compatibility redirects: Canonical blog endpoints reside in blogsRouter (/api/blogs)
noticesRouter.get('/blogs', (c) => c.redirect('/api/blogs', 301));

noticesRouter.get('/blog', (c) => {
  const idStr = c.req.query('id');
  if (!idStr) {
    return c.json({ error: 'Missing article ID' }, 400);
  }
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }
  return c.redirect(`/api/blogs/${id}`, 301);
});

export default noticesRouter;
