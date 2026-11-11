import { Hono, Context } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { requireAuth } from '../middleware/auth';
import { rateLimiter, verifyTurnstile } from '../middleware/rate_limit';
import { sendSystemEmail } from '../notifications/email';

export const exhibitionsRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

exhibitionsRouter.get('/config', async (c) => {
  const cycleParam = c.req.query('cycle');
  const idParam = c.req.query('id');

  let activeCycles: any[] = [];
  try {
    const query = await c.env.DB
      .prepare('SELECT * FROM exhibitions_list WHERE is_active = 1 ORDER BY id ASC')
      .all<any>();
    activeCycles = query.results || [];
  } catch {
    activeCycles = [];
  }

  if (activeCycles.length === 0) {
    return c.json({ is_open: false, active_cycles: [], title: '', date_text: '', about_text: '', require_over_18: true });
  }

  let selected = activeCycles[0];
  if (idParam) {
    const found = activeCycles.find(ac => String(ac.id) === String(idParam));
    if (found) selected = found;
  } else if (cycleParam) {
    const found = activeCycles.find(ac => ac.title.toLowerCase() === cycleParam.toLowerCase());
    if (found) selected = found;
  }

  return c.json({
    is_open: true,
    total_active: activeCycles.length,
    active_cycles: activeCycles.map(ac => ({
      id: ac.id,
      title: ac.title,
      date_text: ac.date_text,
      about_text: ac.about_text,
      venue: ac.venue,
      registration_fee: ac.registration_fee || '',
      require_over_18: ac.require_over_18 === undefined || ac.require_over_18 === null ? true : Boolean(ac.require_over_18)
    })),
    id: selected.id,
    title: selected.title,
    date_text: selected.date_text,
    about_text: selected.about_text,
    venue: selected.venue,
    tnc_pdf_url: selected.tnc_pdf_url,
    registration_fee: selected.registration_fee || '',
    payment_instructions: selected.payment_instructions || '',
    payment_qr_url: selected.payment_qr_url,
    require_over_18: selected.require_over_18 === undefined || selected.require_over_18 === null ? true : Boolean(selected.require_over_18)
  });
});

exhibitionsRouter.post('/upload-portfolio', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Multipart form data with file is required' }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'A valid PDF file is required' }, 400);
  }

  const fileObj = file as File;
  const fileNameLower = (fileObj.name || '').toLowerCase();
  const isPdf = fileObj.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
  if (!isPdf) {
    return c.json({ error: 'Only PDF documents (.pdf) are permitted' }, 400);
  }

  if (fileObj.size > 15 * 1024 * 1024) {
    return c.json({ error: 'Portfolio file exceeds 15MB limit' }, 400);
  }

  if (!c.env.VAULT_BUCKET) {
    return c.json({ error: 'Direct storage bucket not configured in this environment.', detail: 'STORAGE_UNCONFIGURED' }, 503);
  }

  const sanitized = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const emailHashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${user.email.toLowerCase()}:${c.env.JWT_SECRET || 'alfaaz-vault-salt'}`)
  );
  const userHash = Array.from(new Uint8Array(emailHashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
  const key = `portfolios/${userHash}-${Date.now()}-${sanitized}`;
  const buffer = await fileObj.arrayBuffer();
  await c.env.VAULT_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: 'application/pdf' }
  });

  const file_url = `/vault/file/${encodeURIComponent(key)}`;
  return c.json({ status: 'SUCCESS', secure_url: file_url, url: file_url });
});

exhibitionsRouter.post('/apply', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || (c.env.ENV === 'test' ? (c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1') : undefined);
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip, c.env.ENV);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  if (!body.agreed_to_screening) {
    return c.json({ detail: 'You must agree to the screening terms to proceed.' }, 400);
  }

  const age = Number(body.age);
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    return c.json({ detail: 'A valid age is required.' }, 400);
  }

  const requestedCycle = (body.exhibition_cycle || '').trim();
  const requestedId = body.exhibition_id ? Number(body.exhibition_id) : null;

  let activeCycle: any = null;
  if (requestedId) {
    activeCycle = await c.env.DB
      .prepare('SELECT id, title, require_over_18 FROM exhibitions_list WHERE is_active = 1 AND id = ? LIMIT 1')
      .bind(requestedId)
      .first<any>();
  } else if (requestedCycle) {
    activeCycle = await c.env.DB
      .prepare('SELECT id, title, require_over_18 FROM exhibitions_list WHERE is_active = 1 AND LOWER(title) = LOWER(?) LIMIT 1')
      .bind(requestedCycle)
      .first<any>();
  }

  if (!activeCycle) {
    try {
      activeCycle = await c.env.DB
        .prepare('SELECT id, title, require_over_18 FROM exhibitions_list WHERE is_active = 1 ORDER BY id ASC LIMIT 1')
        .first<any>();
    } catch {
      activeCycle = await c.env.DB
        .prepare('SELECT id, title FROM exhibitions_list WHERE is_active = 1 ORDER BY id ASC LIMIT 1')
        .first<any>();
    }
  }

  if (!activeCycle) {
    return c.json({ detail: 'The portal is currently closed. No active exhibition.' }, 400);
  }

  const requireOver18 = activeCycle.require_over_18 === undefined || activeCycle.require_over_18 === null
    ? 1
    : Number(activeCycle.require_over_18);

  const isConfirmedOver18 = Boolean(body.over_18 ?? body.over_19);

  if (requireOver18 === 1) {
    if (age < 18) {
      return c.json({ detail: 'You must be 18 years of age or older to participate in this exhibition cycle.' }, 400);
    }
    if (!isConfirmedOver18) {
      return c.json({ detail: 'You must confirm that you are 18 years of age or older to participate in this exhibition cycle.' }, 400);
    }
  } else {
    if (age >= 18) {
      return c.json({ detail: 'This exhibition is specifically for children and youth under 18 years of age.' }, 400);
    }
  }

  const existing = await c.env.DB
    .prepare('SELECT id FROM exhibition_applications WHERE user_email = ? AND exhibition_cycle = ?')
    .bind(user.email, activeCycle.title)
    .first();

  if (existing) {
    return c.json({ detail: 'You have already submitted an application for this exhibition cycle.' }, 400);
  }

  try {
    const over19Val = isConfirmedOver18 ? 1 : 0;
    await c.env.DB
      .prepare(`
        INSERT INTO exhibition_applications (
          user_email, exhibition_cycle, full_name, age, address, whatsapp,
          genre, medium, portfolio_url, over_19, agreed_to_screening, applicant_note,
          status, registration_status, agreed_to_tnc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'PENDING', 'NONE', 0)
      `)
      .bind(
        user.email, activeCycle.title, String(body.full_name || '').trim(),
        age, String(body.address || '').trim(), String(body.whatsapp || '').trim(),
        String(body.genre || '').trim(), String(body.medium || '').trim(), String(body.portfolio_url || '').trim(),
        over19Val,
        body.applicant_note ? String(body.applicant_note).trim() : null
      )
      .run();
  } catch (err: any) {
    if (err?.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
      return c.json({ detail: 'You have already submitted an application for this exhibition cycle.' }, 400);
    }
    throw err;
  }

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
  const cycleParam = (c.req.query('cycle') || '').trim();
  const idParam = c.req.query('id');

  // Fetch all user applications across cycles to construct full status map
  const userApps = await c.env.DB
    .prepare('SELECT * FROM exhibition_applications WHERE user_email = ? ORDER BY created_at DESC')
    .bind(user.email)
    .all<any>();

  const statusesByCycle: Record<string, any> = {};
  for (const a of (userApps.results || [])) {
    statusesByCycle[a.exhibition_cycle] = {
      status: a.status,
      curator_note: a.curator_note,
      application_id: a.id,
      registration_status: a.registration_status || 'NONE'
    };
  }

  // Determine target cycle title if specifically queried
  let targetTitle: string | null = null;
  if (idParam) {
    const ex = await c.env.DB.prepare('SELECT title FROM exhibitions_list WHERE id = ?').bind(idParam).first<{ title: string }>();
    if (ex) targetTitle = ex.title;
  } else if (cycleParam) {
    targetTitle = cycleParam;
  }

  if (targetTitle) {
    const app = (userApps.results || []).find((a: any) => a.exhibition_cycle?.toLowerCase() === targetTitle?.toLowerCase());
    if (!app) {
      return c.json({ status: 'NONE', exhibition_cycle: targetTitle, statuses_by_cycle: statusesByCycle });
    }

    const base: any = {
      status: app.status,
      curator_note: app.curator_note,
      application_id: app.id,
      exhibition_cycle: app.exhibition_cycle,
      statuses_by_cycle: statusesByCycle
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
  }

  // Otherwise, default to the first active cycle
  const activeEx = await c.env.DB
    .prepare('SELECT title FROM exhibitions_list WHERE is_active = 1 ORDER BY id ASC LIMIT 1')
    .first<{ title: string }>();

  if (!activeEx) {
    return c.json({ status: 'NONE', statuses_by_cycle: statusesByCycle });
  }

  const app = (userApps.results || []).find((a: any) => a.exhibition_cycle === activeEx.title) || (userApps.results?.[0] || null);

  if (!app) {
    return c.json({ status: 'NONE', exhibition_cycle: activeEx.title, statuses_by_cycle: statusesByCycle });
  }

  const base: any = {
    status: app.status,
    curator_note: app.curator_note,
    application_id: app.id,
    exhibition_cycle: app.exhibition_cycle,
    statuses_by_cycle: statusesByCycle
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
