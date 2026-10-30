import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { generateCuratorEssay } from '../services/curator';
import { timingSafeEqual } from '../auth/crypto';

const blogsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /blogs - All published articles
blogsRouter.get('/', async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT id, title, excerpt, created_at
    FROM blogs
    WHERE is_published = 1
    ORDER BY created_at DESC
  `).all();

  const blogs = (result.results || []).map((b: any) => ({
    id: b.id,
    title: b.title,
    excerpt: b.excerpt,
    created_at: b.created_at
  }));

  return c.json(blogs);
});

// GET /blogs/:id - Single published article detail
blogsRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json({ error: 'Invalid article ID' }, 400);
  }

  const blog = await c.env.DB.prepare(`
    SELECT id, title, content, created_at
    FROM blogs
    WHERE id = ? AND is_published = 1
  `).bind(id).first<{ id: number; title: string; content: string; created_at: string }>();

  if (!blog) {
    return c.json({ error: 'Article not found.' }, 404);
  }

  return c.json(blog);
});

// POST /blogs/generate - Autonomous Curator AI essay generation
blogsRouter.post('/generate', async (c) => {
  const expectedToken = c.env.PHANTOM_SECRET_TOKEN;
  if (!expectedToken) {
    console.error('[CURATOR ERROR] PHANTOM_SECRET_TOKEN not configured in environment.');
    return c.json({ error: 'Autonomous generation is unavailable.' }, 503);
  }

  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || !timingSafeEqual(token, expectedToken)) {
    return c.json({ error: 'Unauthorized Curator Access' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const activeTopic = body.topic || (
    'Explore a profound intersection between Kashmiri cultural heritage and global movements in ' +
    'art, photography, film, philosophy, or literature. Focus on a specific, authentic, and scholarly ' +
    'topic that resonates with local identity while connecting to a broader human narrative.'
  );

  try {
    const generated = await generateCuratorEssay(c.env, activeTopic);
    const title = generated.title || 'Untitled Reflection';
    const excerpt = generated.excerpt || '';
    const content = generated.content || '';

    // Idempotency: skip duplicate publication if identical title exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM blogs WHERE title = ? LIMIT 1'
    ).bind(title).first();

    if (existing) {
      return c.json({ status: 'SKIPPED', message: 'Article with identical title already published.' });
    }

    await c.env.DB.prepare(`
      INSERT INTO blogs (title, excerpt, content, is_published)
      VALUES (?, ?, ?, 1)
    `).bind(title, excerpt, content).run();

    // In Cloudflare-native architecture, notice feeds update automatically via D1 / KV cache
    if (c.env.CACHE_KV) {
      await c.env.CACHE_KV.delete('notices_feed');
    }

    return c.json({ status: 'SUCCESS', message: 'Autonomous research published.' });
  } catch (err: any) {
    console.error('[CURATOR CRITICAL] Generation failed:', err);
    return c.json({ error: 'The Curator failed to generate the article.' }, 500);
  }
});

export default blogsRouter;
