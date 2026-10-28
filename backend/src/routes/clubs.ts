import { Hono } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { requireAuth } from '../middleware/auth';

export const clubsRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

const VALID_CLUBS = ["Art & Craft", "Film Club", "Photography", "Philosophy", "Literature"];

clubsRouter.post('/apply', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const clubName = String(body.club_name || '').trim();
  const note = body.note ? String(body.note).trim() : null;

  if (!VALID_CLUBS.includes(clubName)) {
    return c.json({ detail: 'Invalid club.' }, 400);
  }

  const approved = await c.env.DB
    .prepare("SELECT club_name FROM club_applications WHERE user_email = ? AND status = 'APPROVED'")
    .bind(user.email)
    .first<{ club_name: string }>();

  if (approved) {
    return c.json({ detail: `Already a member of ${approved.club_name}.` }, 400);
  }

  const existingClub = await c.env.DB
    .prepare('SELECT id, status FROM club_applications WHERE user_email = ? AND club_name = ?')
    .bind(user.email, clubName)
    .first<{ id: number; status: string }>();

  if (existingClub) {
    if (existingClub.status === 'PENDING') {
      return c.json({ detail: 'Pending application exists.' }, 400);
    }
    // Re-apply if previously rejected
    await c.env.DB
      .prepare("UPDATE club_applications SET status = 'PENDING', note = ?, admin_note = NULL WHERE id = ?")
      .bind(note, existingClub.id)
      .run();
    return c.json({ status: 'PENDING' });
  }

  const otherPending = await c.env.DB
    .prepare("SELECT id FROM club_applications WHERE user_email = ? AND status = 'PENDING'")
    .bind(user.email)
    .first();

  if (otherPending) {
    return c.json({ detail: 'Pending application exists.' }, 400);
  }

  await c.env.DB
    .prepare("INSERT INTO club_applications (user_email, club_name, note, status) VALUES (?, ?, ?, 'PENDING')")
    .bind(user.email, clubName, note)
    .run();

  return c.json({ status: 'PENDING' });
});

clubsRouter.get('/my-status', requireAuth, async (c) => {
  const user = c.get('user');
  const row = await c.env.DB
    .prepare('SELECT status, club_name as club, admin_note FROM club_applications WHERE user_email = ? ORDER BY created_at DESC')
    .bind(user.email)
    .first<{ status: string; club: string; admin_note: string }>();

  if (!row) {
    return c.json({ status: 'NONE' });
  }
  return c.json({
    status: row.status,
    club: row.club,
    club_name: row.club,
    admin_note: row.admin_note
  });
});

export default clubsRouter;
