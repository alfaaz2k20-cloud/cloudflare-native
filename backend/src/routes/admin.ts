import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { requireAdmin } from '../middleware/auth';
import { getEmailProvider } from '../notifications/email';

const adminRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All admin routes require admin role
adminRouter.use('*', requireAdmin);

async function logAudit(
  db: D1Database,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: string | null
) {
  try {
    await db.prepare(`
      INSERT INTO admin_audit_logs (admin_email, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).bind(adminEmail, action, targetType, targetId, details).run();
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}

// ── Events ───────────────────────────────────────────────────────────────────
adminRouter.post('/events/create', async (c) => {
  const admin = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const name = (body.name || '').trim();
  const description = (body.description || '').trim();
  const event_date = (body.event_date || '').trim();
  const capacity = parseInt(body.capacity, 10) || 0;

  if (!name) return c.json({ error: 'Event name is required' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO events (name, description, event_date, capacity, registration_open)
    VALUES (?, ?, ?, ?, 0)
  `).bind(name, description, event_date, capacity).run();

  await logAudit(c.env.DB, admin.email, 'CREATE_EVENT', 'event', name, `Created event: ${name}`);
  return c.json({ status: 'SUCCESS' });
});

adminRouter.patch('/events/:id/toggle', async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid event ID' }, 400);

  const event = await c.env.DB.prepare('SELECT id, name, registration_open FROM events WHERE id = ?').bind(id).first<{ id: number; name: string; registration_open: number }>();
  if (!event) return c.json({ error: 'Event not found.' }, 404);

  const nextStatus = event.registration_open ? 0 : 1;
  await c.env.DB.prepare('UPDATE events SET registration_open = ? WHERE id = ?').bind(nextStatus, id).run();

  await logAudit(c.env.DB, admin.email, 'TOGGLE_EVENT', 'event', String(id), `Toggled event to ${nextStatus ? 'OPEN' : 'CLOSED'}`);
  return c.json({ status: nextStatus ? 'OPEN' : 'CLOSED' });
});

adminRouter.get('/events', async (c) => {
  const events = await c.env.DB.prepare(`
    SELECT e.id, e.name, e.description, e.event_date, e.registration_open, e.capacity,
           (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as registered
    FROM events e
    ORDER BY e.created_at DESC
  `).all();

  const formatted = (events.results || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    event_date: e.event_date,
    registration_open: Boolean(e.registration_open),
    capacity: e.capacity,
    registered: Number(e.registered) || 0
  }));

  return c.json(formatted);
});

adminRouter.get('/events/:id/registrations', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid event ID' }, 400);

  const regs = await c.env.DB.prepare(`
    SELECT user_email, whatsapp_number, created_at
    FROM event_registrations
    WHERE event_id = ?
    ORDER BY created_at DESC
  `).bind(id).all();

  return c.json({
    registrations: (regs.results || []).map((r: any) => ({
      email: r.user_email,
      whatsapp: r.whatsapp_number || '—',
      registered_at: String(r.created_at)
    }))
  });
});

adminRouter.delete('/events/:id', async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid event ID' }, 400);

  const event = await c.env.DB.prepare('SELECT id, name FROM events WHERE id = ?').bind(id).first();
  if (!event) return c.json({ error: 'Event not found.' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM event_registrations WHERE event_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id)
  ]);

  await logAudit(c.env.DB, admin.email, 'DELETE_EVENT', 'event', String(id), `Deleted event ${id}`);
  return c.json({ status: 'SUCCESS' });
});

// ── Clubs ────────────────────────────────────────────────────────────────────
adminRouter.get('/club-applications', async (c) => {
  const apps = await c.env.DB.prepare(`
    SELECT id, user_email, club_name, note, status, admin_note, created_at
    FROM club_applications
    ORDER BY created_at DESC
  `).all();

  return c.json((apps.results || []).map((a: any) => ({
    id: a.id,
    user_email: a.user_email,
    club_name: a.club_name,
    note: a.note,
    status: a.status,
    admin_note: a.admin_note,
    created_at: String(a.created_at)
  })));
});

adminRouter.post('/club-applications/review', async (c) => {
  const admin = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const applicationId = parseInt(body.application_id, 10);
  const status = (body.status || '').trim().toUpperCase();
  const adminNote = body.admin_note !== undefined ? body.admin_note : null;

  if (isNaN(applicationId) || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return c.json({ error: 'Valid application_id and status are required' }, 400);
  }

  const app = await c.env.DB.prepare('SELECT id FROM club_applications WHERE id = ?').bind(applicationId).first();
  if (!app) return c.json({ error: 'Application not found.' }, 404);

  await c.env.DB.prepare(`
    UPDATE club_applications
    SET status = ?, admin_note = ?
    WHERE id = ?
  `).bind(status, adminNote, applicationId).run();

  await logAudit(c.env.DB, admin.email, 'REVIEW_CLUB_APP', 'club_app', String(applicationId), `Status: ${status}`);
  return c.json({ status: 'SUCCESS' });
});

adminRouter.patch('/club-applications/:id/revert', async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid application ID' }, 400);

  const app = await c.env.DB.prepare('SELECT id FROM club_applications WHERE id = ?').bind(id).first();
  if (!app) return c.json({ error: 'Application not found.' }, 404);

  await c.env.DB.prepare(`
    UPDATE club_applications
    SET status = 'PENDING', admin_note = NULL
    WHERE id = ?
  `).bind(id).run();

  await logAudit(c.env.DB, admin.email, 'REVERT_CLUB_APP', 'club_app', String(id), 'Reverted to PENDING');
  return c.json({ status: 'SUCCESS' });
});

// ── Exhibitions ───────────────────────────────────────────────────────────────
async function getCurrentCycle(db: D1Database): Promise<string> {
  const active = await db.prepare('SELECT title FROM exhibitions_list WHERE is_active = 1 LIMIT 1').first<{ title: string }>();
  return active ? active.title : '';
}

adminRouter.post('/exhibitions/create', async (c) => {
  const admin = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const title = (body.title || '').trim();
  const date_text = (body.date_text || 'Dates TBD').trim();
  const venue = (body.venue || 'Venue TBD').trim();
  const about_text = (body.about_text || 'Details regarding the exhibition...').trim();
  const tnc_pdf_url = body.tnc_pdf_url || null;
  const registration_fee = (body.registration_fee || '').trim();
  const payment_instructions = (body.payment_instructions || '').trim();
  const payment_qr_url = body.payment_qr_url || null;

  if (!title) return c.json({ error: 'Title is required' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO exhibitions_list (
      title, date_text, venue, about_text, tnc_pdf_url, registration_fee,
      payment_instructions, payment_qr_url, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(title, date_text, venue, about_text, tnc_pdf_url, registration_fee, payment_instructions, payment_qr_url).run();

  await logAudit(c.env.DB, admin.email, 'CREATE_EXHIBITION', 'exhibition', title, `Created exhibition cycle ${title}`);
  return c.json({ status: 'SUCCESS' });
});

adminRouter.get('/exhibitions/list', async (c) => {
  const list = await c.env.DB.prepare(`
    SELECT id, title, date_text, is_active
    FROM exhibitions_list
    ORDER BY created_at DESC
  `).all();

  return c.json((list.results || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    date_text: e.date_text,
    is_active: Boolean(e.is_active)
  })));
});

adminRouter.patch('/exhibitions/:id/activate', async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid exhibition ID' }, 400);

  const target = await c.env.DB.prepare('SELECT id, title FROM exhibitions_list WHERE id = ?').bind(id).first<{ id: number; title: string }>();
  if (!target) return c.json({ error: 'Exhibition not found' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE exhibitions_list SET is_active = 0'),
    c.env.DB.prepare('UPDATE exhibitions_list SET is_active = 1 WHERE id = ?').bind(id)
  ]);

  await logAudit(c.env.DB, admin.email, 'ACTIVATE_EXHIBITION', 'exhibition', String(id), `Activated cycle ${target.title}`);
  return c.json({ status: 'SUCCESS', title: target.title });
});

adminRouter.patch('/exhibitions/deactivate-all', async (c) => {
  const admin = c.get('user');
  await c.env.DB.prepare('UPDATE exhibitions_list SET is_active = 0').run();
  await logAudit(c.env.DB, admin.email, 'DEACTIVATE_EXHIBITIONS', 'exhibition', null, 'Deactivated all exhibition cycles');
  return c.json({ status: 'SUCCESS' });
});

adminRouter.get('/exhibitions', async (c) => {
  const cycleParam = c.req.query('cycle');
  let targetCycle: string | null = null;

  if (cycleParam && cycleParam.toUpperCase() === 'ALL') {
    targetCycle = null; // show all
  } else if (cycleParam) {
    targetCycle = cycleParam;
  } else {
    targetCycle = await getCurrentCycle(c.env.DB);
  }

  let stmt: D1PreparedStatement;
  if (targetCycle) {
    stmt = c.env.DB.prepare(`
      SELECT id, user_email, full_name, exhibition_cycle, genre, medium,
             portfolio_url, status, registration_status, payment_proof_url
      FROM exhibition_applications
      WHERE exhibition_cycle = ?
      ORDER BY created_at DESC
    `).bind(targetCycle);
  } else {
    stmt = c.env.DB.prepare(`
      SELECT id, user_email, full_name, exhibition_cycle, genre, medium,
             portfolio_url, status, registration_status, payment_proof_url
      FROM exhibition_applications
      ORDER BY created_at DESC
    `);
  }

  const apps = await stmt.all();
  return c.json((apps.results || []).map((a: any) => ({
    id: a.id,
    user_email: a.user_email,
    full_name: a.full_name,
    exhibition_cycle: a.exhibition_cycle,
    genre: a.genre,
    medium: a.medium,
    portfolio_url: a.portfolio_url,
    status: a.status,
    registration_status: a.registration_status,
    payment_proof_url: a.payment_proof_url
  })));
});

adminRouter.get('/exhibitions/cycles', async (c) => {
  const master = await c.env.DB.prepare('SELECT title FROM exhibitions_list ORDER BY created_at DESC').all<{ title: string }>();
  const cycles = (master.results || []).map(r => r.title);

  const legacy = await c.env.DB.prepare('SELECT DISTINCT exhibition_cycle FROM exhibition_applications WHERE exhibition_cycle IS NOT NULL').all<{ exhibition_cycle: string }>();
  for (const r of (legacy.results || [])) {
    if (r.exhibition_cycle && !cycles.includes(r.exhibition_cycle)) {
      cycles.push(r.exhibition_cycle);
    }
  }

  const current = await getCurrentCycle(c.env.DB);
  return c.json({ cycles, current });
});

adminRouter.post('/exhibitions/review', async (c) => {
  const admin = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const applicationId = parseInt(body.application_id, 10);
  const status = (body.status || '').trim().toUpperCase();
  const curatorNote = body.curator_note !== undefined ? body.curator_note : null;

  if (isNaN(applicationId) || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return c.json({ error: 'Valid application_id and status are required' }, 400);
  }

  const app = await c.env.DB.prepare('SELECT id, user_email, full_name, exhibition_cycle FROM exhibition_applications WHERE id = ?').bind(applicationId).first<{
    id: number; user_email: string; full_name: string; exhibition_cycle: string;
  }>();

  if (!app) return c.json({ error: 'Application not found.' }, 404);

  await c.env.DB.prepare(`
    UPDATE exhibition_applications
    SET status = ?, curator_note = ?
    WHERE id = ?
  `).bind(status, curatorNote, applicationId).run();

  await logAudit(c.env.DB, admin.email, 'REVIEW_EXHIBITION', 'exhibition_app', String(applicationId), `Status: ${status}`);

  const emailProvider = getEmailProvider(c.env);
  if (status === 'APPROVED') {
    await emailProvider.sendEmail(
      app.user_email,
      'ALFAAZ — Exhibition Clearance Granted',
      `Greetings ${app.full_name},\n\nYour artwork has cleared the screening process for ${app.exhibition_cycle}.\n\nPlease log into your Alfaaz dashboard to review the Terms & Conditions and finalize your spot.\n\n— The Curator`
    );
  } else if (status === 'REJECTED') {
    await emailProvider.sendEmail(
      app.user_email,
      'ALFAAZ — Exhibition Update',
      `Greetings ${app.full_name},\n\nWe appreciate you sharing your portfolio with us. Unfortunately, we cannot accommodate your submission for ${app.exhibition_cycle}.\n\n— The Curator`
    );
  }

  return c.json({ status: 'SUCCESS', message: `Applicant ${status.toLowerCase()} and notified.` });
});

adminRouter.patch('/exhibitions/:id/confirm-payment', async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid application ID' }, 400);

  const app = await c.env.DB.prepare('SELECT id, user_email, full_name, exhibition_cycle, registration_status FROM exhibition_applications WHERE id = ?').bind(id).first<{
    id: number; user_email: string; full_name: string; exhibition_cycle: string; registration_status: string;
  }>();

  if (!app) return c.json({ error: 'Application not found.' }, 404);
  if (app.registration_status !== 'SUBMITTED') {
    return c.json({ error: 'Cannot confirm. The artist has not submitted payment proof yet.' }, 400);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE exhibition_applications
    SET registration_status = 'CONFIRMED', payment_confirmed_at = ?
    WHERE id = ?
  `).bind(now, id).run();

  await logAudit(c.env.DB, admin.email, 'CONFIRM_PAYMENT', 'exhibition_app', String(id), `Confirmed payment for ${app.user_email}`);

  const emailProvider = getEmailProvider(c.env);
  await emailProvider.sendEmail(
    app.user_email,
    'ALFAAZ — Your Spot is Confirmed!',
    `Greetings ${app.full_name},\n\nYour payment for ${app.exhibition_cycle} has been verified and your exhibition spot is officially confirmed.\n\nWelcome to the collective.\n\n— The Curator`
  );

  return c.json({ status: 'CONFIRMED' });
});

adminRouter.patch('/exhibitions/:id/revert', async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid application ID' }, 400);

  const app = await c.env.DB.prepare('SELECT id FROM exhibition_applications WHERE id = ?').bind(id).first();
  if (!app) return c.json({ error: 'Application not found.' }, 404);

  await c.env.DB.prepare(`
    UPDATE exhibition_applications
    SET status = 'PENDING', curator_note = NULL
    WHERE id = ?
  `).bind(id).run();

  await logAudit(c.env.DB, admin.email, 'REVERT_EXHIBITION_STATUS', 'exhibition_app', String(id), 'Reverted to PENDING');
  return c.json({ status: 'SUCCESS' });
});

adminRouter.get('/exhibitions/:id/registration', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid application ID' }, 400);

  const app = await c.env.DB.prepare(`
    SELECT id, user_email, full_name, exhibition_cycle, status, registration_status,
           agreed_to_tnc, payment_proof_url, participant_note_reg, payment_confirmed_at
    FROM exhibition_applications
    WHERE id = ?
  `).bind(id).first<{
    id: number; user_email: string; full_name: string; exhibition_cycle: string;
    status: string; registration_status: string; agreed_to_tnc: number;
    payment_proof_url: string | null; participant_note_reg: string | null;
    payment_confirmed_at: string | null;
  }>();

  if (!app) return c.json({ error: 'Application not found.' }, 404);

  return c.json({
    id: app.id,
    user_email: app.user_email,
    full_name: app.full_name,
    exhibition_cycle: app.exhibition_cycle,
    status: app.status,
    registration_status: app.registration_status || 'NONE',
    agreed_to_tnc: Boolean(app.agreed_to_tnc),
    payment_proof_url: app.payment_proof_url,
    participant_note_reg: app.participant_note_reg,
    payment_confirmed_at: app.payment_confirmed_at ? String(app.payment_confirmed_at) : null
  });
});

// ── Users & Submissions ───────────────────────────────────────────────────────
adminRouter.get('/users', async (c) => {
  // 1. Fetch all users
  const users = await c.env.DB.prepare(`
    SELECT id, email, full_name, status, phone, auth_provider, email_verified, phone_verified, created_at 
    FROM users 
    ORDER BY id ASC
  `).all();

  // 2. Fetch all club applications
  const clubs = await c.env.DB.prepare(`
    SELECT id, user_email, club_name, status, created_at
    FROM club_applications
    ORDER BY created_at DESC
  `).all();

  // 3. Fetch all event registrations with joined event details
  const events = await c.env.DB.prepare(`
    SELECT r.id, r.user_email, r.event_id, r.created_at,
           e.name as event_name, e.event_date as event_date
    FROM event_registrations r
    LEFT JOIN events e ON r.event_id = e.id
    ORDER BY r.created_at DESC
  `).all();

  // 4. Fetch all exhibition applications (past & present) with fee details
  const exhibitions = await c.env.DB.prepare(`
    SELECT a.id, a.user_email, a.exhibition_cycle, a.status, a.registration_status,
           a.payment_proof_url, a.payment_confirmed_at, a.created_at,
           e.registration_fee
    FROM exhibition_applications a
    LEFT JOIN exhibitions_list e ON a.exhibition_cycle = e.title
    ORDER BY a.created_at DESC
  `).all();

  // 5. Aggregate by user email (and phone fallback) into full activity ledger
  const roster = (users.results || []).map((u: any) => {
    const uEmail = (u.email || '').toLowerCase();
    const uPhone = u.phone || '';

    const userClubs = (clubs.results || []).filter((c: any) =>
      (c.user_email && c.user_email.toLowerCase() === uEmail) || (uPhone && c.user_email === uPhone)
    );

    const userEvents = (events.results || []).filter((e: any) =>
      (e.user_email && e.user_email.toLowerCase() === uEmail) || (uPhone && e.user_email === uPhone)
    );

    const userExhibitions = (exhibitions.results || []).filter((x: any) =>
      (x.user_email && x.user_email.toLowerCase() === uEmail) || (uPhone && x.user_email === uPhone)
    );

    const userFees = userExhibitions
      .filter((x: any) => x.registration_status && x.registration_status !== 'NONE')
      .map((x: any) => ({
        exhibition_cycle: x.exhibition_cycle,
        registration_status: x.registration_status,
        registration_fee: x.registration_fee || 'Standard Fee',
        payment_proof_url: x.payment_proof_url,
        payment_confirmed_at: x.payment_confirmed_at
      }));

    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      status: u.status,
      phone: u.phone,
      auth_provider: u.auth_provider,
      email_verified: u.email_verified ?? 0,
      phone_verified: u.phone_verified ?? 0,
      created_at: u.created_at,
      clubs: userClubs.map((c: any) => ({
        id: c.id,
        club_name: c.club_name,
        status: c.status,
        created_at: c.created_at
      })),
      events: userEvents.map((e: any) => ({
        id: e.id,
        event_name: e.event_name || 'Community Event',
        event_date: e.event_date,
        created_at: e.created_at
      })),
      exhibitions: userExhibitions.map((x: any) => ({
        id: x.id,
        exhibition_cycle: x.exhibition_cycle,
        status: x.status,
        registration_status: x.registration_status,
        payment_confirmed_at: x.payment_confirmed_at,
        created_at: x.created_at
      })),
      fees: userFees
    };
  });

  return c.json(roster);
});

adminRouter.delete('/users/:email', async (c) => {
  const admin = c.get('user');
  const targetEmail = decodeURIComponent(c.req.param('email')).trim().toLowerCase();

  if (targetEmail === admin.email.toLowerCase()) {
    return c.json({ error: 'Cannot purge your own administrator account.' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT email, status FROM users WHERE LOWER(email) = LOWER(?)').bind(targetEmail).first<{ email: string; status: string }>();
  if (!user) return c.json({ error: 'User not found.' }, 404);
  if (user.status === 'ADMIN') {
    return c.json({ error: 'Cannot delete an admin account.' }, 403);
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM submissions WHERE LOWER(author_email) = LOWER(?)').bind(targetEmail),
    c.env.DB.prepare('DELETE FROM club_applications WHERE LOWER(user_email) = LOWER(?)').bind(targetEmail),
    c.env.DB.prepare('DELETE FROM event_registrations WHERE LOWER(user_email) = LOWER(?)').bind(targetEmail),
    c.env.DB.prepare('DELETE FROM exhibition_applications WHERE LOWER(user_email) = LOWER(?)').bind(targetEmail),
    c.env.DB.prepare('DELETE FROM users WHERE LOWER(email) = LOWER(?)').bind(targetEmail)
  ]);

  await logAudit(c.env.DB, admin.email, 'PURGE_USER', 'user', targetEmail, `User ${targetEmail} deleted`);
  return c.json({ status: 'SUCCESS', message: `User ${targetEmail} purged.` });
});

adminRouter.post('/update_status', async (c) => {
  const admin = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const nextStatus = (body.status || '').trim().toUpperCase();

  if (!email || !['ADMIN', 'PARTICIPANT'].includes(nextStatus)) {
    return c.json({ error: 'Valid email and status are required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT email, status FROM users WHERE LOWER(email) = LOWER(?)').bind(email).first<{ email: string; status: string }>();
  if (!user) return c.json({ error: 'User not found.' }, 404);

  if (user.status === 'ADMIN' && nextStatus !== 'ADMIN') {
    const adminCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'ADMIN'").first<{ count: number }>();
    if ((adminCount?.count || 0) <= 1) {
      return c.json({ error: 'Cannot demote the last administrator account.' }, 400);
    }
  }

  await c.env.DB.prepare('UPDATE users SET status = ? WHERE LOWER(email) = LOWER(?)').bind(nextStatus, email).run();
  await logAudit(c.env.DB, admin.email, 'UPDATE_ROLE', 'user', email, `Role set to ${nextStatus}`);

  return c.json({ status: 'SUCCESS' });
});

adminRouter.get('/submissions', async (c) => {
  const subs = await c.env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();
  return c.json(subs.results || []);
});

adminRouter.get('/audit-logs', async (c) => {
  const logs = await c.env.DB.prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100').all();
  return c.json(logs.results || []);
});

// ── Email Diagnostics ────────────────────────────────────────────────────────
adminRouter.post('/email/test', async (c) => {
  const admin = c.get('user');
  const emailProvider = getEmailProvider(c.env);
  const sent = await emailProvider.sendEmail(
    admin.email,
    'ALFAAZ — Email Test',
    'This is a test email from the Alfaaz Cloudflare-native backend.'
  );
  return c.json({ status: sent ? 'SENT' : 'FAILED' });
});

adminRouter.get('/email/status', async (c) => {
  return c.json({
    provider: c.env.MAKE_WEBHOOK_URL ? 'make' : (c.env.CF_EMAIL_ROUTING ? 'cloudflare_email' : 'dev'),
    make_webhook_configured: Boolean(c.env.MAKE_WEBHOOK_URL),
    cloudflare_email_configured: Boolean(c.env.CF_EMAIL_ROUTING)
  });
});

export default adminRouter;
