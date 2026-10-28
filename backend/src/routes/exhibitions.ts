import { Hono, Context } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { requireAuth } from '../middleware/auth';
import { rateLimiter, verifyTurnstile } from '../middleware/rate_limit';
import { sendSystemEmail } from '../notifications/email';

export const exhibitionsRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

exhibitionsRouter.get('/config', async (c) => {
  const config = await c.env.DB
    .prepare('SELECT * FROM exhibitions_list WHERE is_active = 1 LIMIT 1')
    .first<any>();

  if (!config) {
    return c.json({ is_open: false, title: '', date_text: '', about_text: '' });
  }

  return c.json({
    is_open: true,
    title: config.title,
    date_text: config.date_text,
    about_text: config.about_text,
    venue: config.venue,
    tnc_pdf_url: config.tnc_pdf_url,
    registration_fee: config.registration_fee || '',
    payment_instructions: config.payment_instructions || '',
    payment_qr_url: config.payment_qr_url
  });
});

exhibitionsRouter.post('/apply', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined;
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  if (!body.over_19 || !body.agreed_to_screening) {
    return c.json({ detail: 'You must agree to the terms to proceed.' }, 400);
  }

  const activeCycle = await c.env.DB
    .prepare('SELECT title FROM exhibitions_list WHERE is_active = 1 LIMIT 1')
    .first<{ title: string }>();

  if (!activeCycle) {
    return c.json({ detail: 'The portal is currently closed. No active exhibition.' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT id FROM exhibition_applications WHERE user_email = ? AND exhibition_cycle = ?')
    .bind(user.email, activeCycle.title)
    .first();

  if (existing) {
    return c.json({ detail: 'You have already submitted an application for this exhibition cycle.' }, 400);
  }

  await c.env.DB
    .prepare(`
      INSERT INTO exhibition_applications (
        user_email, exhibition_cycle, full_name, age, address, whatsapp,
        genre, medium, portfolio_url, over_19, agreed_to_screening, applicant_note,
        status, registration_status, agreed_to_tnc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 'PENDING', 'NONE', 0)
    `)
    .bind(
      user.email, activeCycle.title, String(body.full_name || '').trim(),
      Number(body.age || 20), String(body.address || '').trim(), String(body.whatsapp || '').trim(),
      String(body.genre || '').trim(), String(body.medium || '').trim(), String(body.portfolio_url || '').trim(),
      body.applicant_note ? String(body.applicant_note).trim() : null
    )
    .run();

  try {
    await sendSystemEmail(
      c.env,
      user.email,
      'ALFAAZ — Application Received',
      `Greetings ${body.full_name},\n\nYour portfolio has successfully entered our Storage. This secure space is used to safely hold your work and protect your assets while they are under review by the Curator for the upcoming exhibition.\n\nYou will receive an update regarding your status soon.\n\n— The Alfaaz Collective`
    );
  } catch (err) {
    console.warn('[EXHIBITIONS] Application email notice:', err);
  }

  return c.json({ status: 'SUCCESS', message: 'Application submitted successfully.' });
});

exhibitionsRouter.get('/my-status', requireAuth, async (c) => {
  const user = c.get('user');
  const activeEx = await c.env.DB
    .prepare('SELECT title FROM exhibitions_list WHERE is_active = 1 LIMIT 1')
    .first<{ title: string }>();

  if (!activeEx) {
    return c.json({ status: 'NONE' });
  }

  const app = await c.env.DB
    .prepare('SELECT * FROM exhibition_applications WHERE user_email = ? AND exhibition_cycle = ?')
    .bind(user.email, activeEx.title)
    .first<any>();

  if (!app) {
    return c.json({ status: 'NONE' });
  }

  const base: any = {
    status: app.status,
    curator_note: app.curator_note,
    application_id: app.id,
    exhibition_cycle: app.exhibition_cycle
  };

  if (app.status === 'APPROVED') {
    base.full_name = app.full_name;
    base.age = app.age;
    base.address = app.address;
    base.whatsapp = app.whatsapp;
    base.genre = app.genre;
    base.medium = app.medium;
    base.portfolio_url = app.portfolio_url;
    base.registration_status = app.registration_status || 'NONE';
    base.payment_confirmed_at = app.payment_confirmed_at;
  }

  return c.json(base);
});

async function handleCompleteRegistration(c: Context<{ Bindings: Env; Variables: { user: JwtUserPayload } }>) {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const activeEx = await c.env.DB
    .prepare('SELECT title FROM exhibitions_list WHERE is_active = 1 LIMIT 1')
    .first<{ title: string }>();

  if (!activeEx) {
    return c.json({ detail: 'The exhibition portal is currently closed.' }, 400);
  }

  const app = await c.env.DB
    .prepare("SELECT * FROM exhibition_applications WHERE user_email = ? AND exhibition_cycle = ? AND status = 'APPROVED'")
    .bind(user.email, activeEx.title)
    .first<any>();

  if (!app) {
    return c.json({ detail: 'No approved application found for the current cycle.' }, 404);
  }
  if (app.registration_status === 'CONFIRMED') {
    return c.json({ detail: 'Registration already confirmed.' }, 400);
  }
  if (!body.agreed_to_tnc) {
    return c.json({ detail: 'You must agree to the Terms & Conditions.' }, 400);
  }
  if (!body.payment_proof_url) {
    return c.json({ detail: 'Payment proof is required.' }, 400);
  }

  await c.env.DB
    .prepare(`
      UPDATE exhibition_applications
      SET agreed_to_tnc = 1,
          payment_proof_url = ?,
          participant_note_reg = ?,
          registration_status = 'SUBMITTED'
      WHERE id = ?
    `)
    .bind(
      String(body.payment_proof_url).trim(),
      body.participant_note_reg ? String(body.participant_note_reg).trim() : null,
      app.id
    )
    .run();

  try {
    await sendSystemEmail(
      c.env,
      user.email,
      'ALFAAZ — Registration Submitted',
      `Greetings ${app.full_name},\n\nYour registration form and payment proof have been received. The Curator will verify your payment and confirm your spot shortly.\n\n— The Alfaaz Collective`
    );
  } catch (err) {
    console.warn('[EXHIBITIONS] Registration submission email notice:', err);
  }

  return c.json({ status: 'SUBMITTED', message: 'Registration submitted. Awaiting payment confirmation.' });
}

exhibitionsRouter.post('/complete-registration', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), handleCompleteRegistration);
exhibitionsRouter.post('/finalize', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), handleCompleteRegistration);

export default exhibitionsRouter;
