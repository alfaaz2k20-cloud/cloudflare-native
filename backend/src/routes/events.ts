import { Hono } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate_limit';
import { sendSystemEmail } from '../notifications/email';

export const eventsRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

eventsRouter.get('/active', async (c) => {
  const events = await c.env.DB
    .prepare('SELECT id, name, description, event_date, capacity FROM events WHERE registration_open = 1 ORDER BY created_at DESC')
    .all<{ id: number; name: string; description: string; event_date: string; capacity: number }>();

  if (!events.results || events.results.length === 0) {
    return c.json([]);
  }

  const counts = await c.env.DB
    .prepare('SELECT event_id, COUNT(*) as count FROM event_registrations GROUP BY event_id')
    .all<{ event_id: number; count: number }>();

  const countMap = new Map<number, number>();
  for (const row of counts.results || []) {
    countMap.set(row.event_id, row.count);
  }

  const result = events.results.map(e => {
    const regCount = countMap.get(e.id) || 0;
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      event_date: e.event_date,
      capacity: e.capacity,
      registered: regCount,
      spots_left: e.capacity > 0 ? (e.capacity - regCount) : null,
      full: e.capacity > 0 && regCount >= e.capacity
    };
  });

  return c.json(result);
});

eventsRouter.post('/register', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const eventId = Number(body.event_id);
  const whatsappNumber = body.whatsapp_number ? String(body.whatsapp_number).trim() : null;

  if (!eventId || isNaN(eventId)) {
    return c.json({ detail: 'Valid event_id required' }, 400);
  }

  const event = await c.env.DB
    .prepare('SELECT id, name, event_date, registration_open, capacity FROM events WHERE id = ?')
    .bind(eventId)
    .first<{ id: number; name: string; event_date: string; registration_open: number; capacity: number }>();

  if (!event || event.registration_open !== 1) {
    return c.json({ detail: 'Registration closed.' }, 400);
  }

  const already = await c.env.DB
    .prepare('SELECT id FROM event_registrations WHERE event_id = ? AND user_email = ?')
    .bind(eventId, user.email)
    .first();

  if (already) {
    return c.json({ detail: 'Already registered.' }, 400);
  }

  const countRow = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM event_registrations WHERE event_id = ?')
    .bind(eventId)
    .first<{ cnt: number }>();

  const currentCount = countRow?.cnt || 0;
  if (event.capacity > 0 && currentCount >= event.capacity) {
    return c.json({ detail: 'Event full.' }, 400);
  }

  try {
    await c.env.DB
      .prepare('INSERT INTO event_registrations (event_id, user_email, whatsapp_number) VALUES (?, ?, ?)')
      .bind(eventId, user.email, whatsappNumber)
      .run();
  } catch (err: any) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
      return c.json({ detail: 'Already registered.' }, 400);
    }
    throw err;
  }

  try {
    const appUrl = c.env.FRONTEND_URL || 'https://alfaazcollective.org';
    await sendSystemEmail(
      c.env,
      user.email,
      `ALFAAZ — RSVP Confirmed: ${event.name}`,
      `Greetings,\n\nYour registration for the following Alfaaz Collective event is confirmed:\n\nEvent: ${event.name}\nDate: ${event.event_date || 'TBD'}\n\nYou can view your active RSVPs anytime on your dashboard:\n${appUrl}/dashboard.html\n\n— Alfaaz Events`
    );
  } catch (emailErr) {
    console.warn('[EMAIL WARNING] Event registration email failed:', emailErr);
  }

  return c.json({ status: 'SUCCESS' });
});

eventsRouter.get('/my-registrations', requireAuth, async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB
    .prepare(`
      SELECT r.event_id, e.name as event_name, e.event_date
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_email = ?
      ORDER BY r.created_at DESC
    `)
    .bind(user.email)
    .all<{ event_id: number; event_name: string; event_date: string }>();

  return c.json(rows.results || []);
});

export default eventsRouter;
