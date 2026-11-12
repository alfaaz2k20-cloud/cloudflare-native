import { Hono, Context } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { requireAuth } from '../middleware/auth';
import { rateLimiter, verifyTurnstile } from '../middleware/rate_limit';
import { sendSystemEmail } from '../notifications/email';

export const exhibitionsRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

// ── Validation Helpers ────────────────────────────────────────────────────────
function isValidPdf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const bytes = new Uint8Array(buffer, 0, 5);
  // %PDF- is 0x25, 0x50, 0x44, 0x46, 0x2D
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D;
}

function isValidImageOrPdf(buffer: ArrayBuffer): { valid: boolean; mimeType: string } {
  if (buffer.byteLength < 4) return { valid: false, mimeType: '' };
  const bytes = new Uint8Array(buffer);

  // PDF: %PDF-
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) {
    return { valid: true, mimeType: 'application/pdf' };
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { valid: true, mimeType: 'image/png' };
  }
  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { valid: true, mimeType: 'image/webp' };
  }
  return { valid: false, mimeType: '' };
}

async function getUserHash(email: string, secret?: string): Promise<string> {
  const emailHashBuf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${email.toLowerCase()}:${secret || 'alfaaz-vault-salt'}`)
  );
  return Array.from(new Uint8Array(emailHashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// ── GET /config (Public Discovery & Active Cycle Resolution) ──────────────────
exhibitionsRouter.get('/config', async (c) => {
  const cycleParam = c.req.query('cycle');
  const idParam = c.req.query('id');

  let activeCycles: any[] = [];
  try {
    const query = await c.env.DB
      .prepare("SELECT * FROM exhibitions_list WHERE is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') ORDER BY id ASC")
      .all<any>();
    activeCycles = query.results || [];
  } catch {
    activeCycles = [];
  }

  if (activeCycles.length === 0) {
    return c.json({
      is_open: false,
      total_active: 0,
      active_cycles: [],
      title: '',
      date_text: '',
      about_text: '',
      require_over_18: true,
      allow_recent_works_youth: false
    });
  }

  let selected: any = null;

  if (idParam) {
    const found = activeCycles.find(ac => String(ac.id) === String(idParam));
    if (!found) {
      return c.json({
        is_open: false,
        not_found: true,
        error: 'Exhibition cycle not found or inactive',
        detail: 'The requested exhibition cycle is not active or does not exist.',
        total_active: activeCycles.length,
        active_cycles: activeCycles.map(ac => ({
          id: ac.id,
          title: ac.title,
          date_text: ac.date_text,
          about_text: ac.about_text,
          venue: ac.venue,
          registration_fee: ac.registration_fee || '',
          require_over_18: ac.require_over_18 === undefined || ac.require_over_18 === null ? true : Boolean(ac.require_over_18),
          allow_recent_works_youth: Boolean(ac.allow_recent_works_youth),
          cover_image: ac.cover_image || null,
          status: ac.status || 'PUBLISHED'
        }))
      }, 404);
    }
    selected = found;
  } else if (cycleParam) {
    const found = activeCycles.find(ac => ac.title.toLowerCase() === cycleParam.toLowerCase());
    if (!found) {
      return c.json({
        is_open: false,
        not_found: true,
        error: 'Exhibition cycle not found or inactive',
        detail: 'The requested exhibition cycle is not active or does not exist.',
        total_active: activeCycles.length,
        active_cycles: activeCycles.map(ac => ({
          id: ac.id,
          title: ac.title,
          date_text: ac.date_text,
          about_text: ac.about_text,
          venue: ac.venue,
          registration_fee: ac.registration_fee || '',
          require_over_18: ac.require_over_18 === undefined || ac.require_over_18 === null ? true : Boolean(ac.require_over_18),
          allow_recent_works_youth: Boolean(ac.allow_recent_works_youth),
          cover_image: ac.cover_image || null,
          status: ac.status || 'PUBLISHED'
        }))
      }, 404);
    }
    selected = found;
  } else {
    // Default to the first active cycle only when caller passed neither id nor cycle
    selected = activeCycles[0];
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
      require_over_18: ac.require_over_18 === undefined || ac.require_over_18 === null ? true : Boolean(ac.require_over_18),
      allow_recent_works_youth: Boolean(ac.allow_recent_works_youth),
      cover_image: ac.cover_image || null,
      status: ac.status || 'PUBLISHED'
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
    require_over_18: selected.require_over_18 === undefined || selected.require_over_18 === null ? true : Boolean(selected.require_over_18),
    allow_recent_works_youth: Boolean(selected.allow_recent_works_youth),
    cover_image: selected.cover_image || null,
    status: selected.status || 'PUBLISHED'
  });
});

// ── POST /upload-portfolio (Private R2 Portfolio Upload) ──────────────────────
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
  const isPdfExt = fileNameLower.endsWith('.pdf');
  const isPdfMime = fileObj.type === 'application/pdf';
  if (!isPdfExt && !isPdfMime) {
    return c.json({ error: 'Only PDF documents (.pdf) are permitted' }, 400);
  }

  if (fileObj.size > 15 * 1024 * 1024) {
    return c.json({ error: 'Portfolio file exceeds 15MB limit' }, 400);
  }

  const buffer = await fileObj.arrayBuffer();
  if (!isValidPdf(buffer)) {
    return c.json({ error: 'Invalid file signature: Content is not a genuine PDF document' }, 400);
  }

  if (!c.env.VAULT_BUCKET) {
    return c.json({ error: 'Direct storage bucket not configured in this environment.', detail: 'STORAGE_UNCONFIGURED' }, 503);
  }

  const sanitized = (fileObj.name || 'portfolio.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const userHash = await getUserHash(user.email, c.env.JWT_SECRET);
  const key = `portfolios/${userHash}-${crypto.randomUUID()}-${sanitized}`;

  await c.env.VAULT_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: 'application/pdf' }
  });

  const file_url = `/vault/file/${encodeURIComponent(key)}`;
  return c.json({ status: 'SUCCESS', secure_url: file_url, url: file_url });
});

// ── POST /upload-payment-proof (Private R2 Payment Screenshot Upload) ─────────
exhibitionsRouter.post('/upload-payment-proof', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Multipart form data with file is required' }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'A valid image or PDF receipt file is required' }, 400);
  }

  const fileObj = file as File;
  if (fileObj.size > 10 * 1024 * 1024) {
    return c.json({ error: 'Payment receipt file exceeds 10MB limit' }, 400);
  }

  const buffer = await fileObj.arrayBuffer();
  const check = isValidImageOrPdf(buffer);
  if (!check.valid) {
    return c.json({ error: 'Invalid file format: Only JPEG, PNG, WebP or PDF receipts are accepted' }, 400);
  }

  if (!c.env.VAULT_BUCKET) {
    return c.json({ error: 'Direct storage bucket not configured in this environment.', detail: 'STORAGE_UNCONFIGURED' }, 503);
  }

  const sanitized = (fileObj.name || 'receipt').replace(/[^a-zA-Z0-9._-]/g, '_');
  const userHash = await getUserHash(user.email, c.env.JWT_SECRET);
  const key = `payment-proofs/${userHash}-${crypto.randomUUID()}-${sanitized}`;

  await c.env.VAULT_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: check.mimeType }
  });

  const file_url = `/vault/file/${encodeURIComponent(key)}`;
  return c.json({ status: 'SUCCESS', secure_url: file_url, url: file_url });
});

// ── POST /upload-recent-works (Optional Under-18 Recent Works Upload) ─────────
exhibitionsRouter.post('/upload-recent-works', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Multipart form data with file is required' }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'A valid recent works file is required' }, 400);
  }

  const fileObj = file as File;
  if (fileObj.size > 15 * 1024 * 1024) {
    return c.json({ error: 'Recent works file exceeds 15MB limit' }, 400);
  }

  const buffer = await fileObj.arrayBuffer();
  const check = isValidImageOrPdf(buffer);
  if (!check.valid) {
    return c.json({ error: 'Invalid file format: Only PDF, JPEG, PNG or WebP files are accepted' }, 400);
  }

  if (!c.env.VAULT_BUCKET) {
    return c.json({ error: 'Direct storage bucket not configured in this environment.', detail: 'STORAGE_UNCONFIGURED' }, 503);
  }

  const sanitized = (fileObj.name || 'recent_works').replace(/[^a-zA-Z0-9._-]/g, '_');
  const userHash = await getUserHash(user.email, c.env.JWT_SECRET);
  const key = `recent-works/${userHash}-${crypto.randomUUID()}-${sanitized}`;

  await c.env.VAULT_BUCKET.put(key, buffer, {
    httpMetadata: { contentType: check.mimeType }
  });

  const file_url = `/vault/file/${encodeURIComponent(key)}`;
  return c.json({ status: 'SUCCESS', secure_url: file_url, url: file_url });
});

// ── POST /apply (Participant Application Intake) ──────────────────────────────
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
      .prepare("SELECT id, title, require_over_18, allow_recent_works_youth FROM exhibitions_list WHERE is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') AND id = ? LIMIT 1")
      .bind(requestedId)
      .first<any>();
    if (!activeCycle) {
      return c.json({ detail: 'Requested exhibition cycle does not exist or is currently closed.' }, 400);
    }
  } else if (requestedCycle) {
    activeCycle = await c.env.DB
      .prepare("SELECT id, title, require_over_18, allow_recent_works_youth FROM exhibitions_list WHERE is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') AND LOWER(title) = LOWER(?) LIMIT 1")
      .bind(requestedCycle)
      .first<any>();
    if (!activeCycle) {
      return c.json({ detail: 'Requested exhibition cycle does not exist or is currently closed.' }, 400);
    }
  } else {
    // Legacy fallback only if completely omitted
    activeCycle = await c.env.DB
      .prepare("SELECT id, title, require_over_18, allow_recent_works_youth FROM exhibitions_list WHERE is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') ORDER BY id ASC LIMIT 1")
      .first<any>();
  }

  if (!activeCycle) {
    return c.json({ detail: 'The portal is currently closed. No active exhibition.' }, 400);
  }

  // Input length & formatting validations
  const fullName = String(body.full_name || '').trim();
  const address = String(body.address || '').trim();
  const genre = String(body.genre || '').trim();
  const medium = String(body.medium || '').trim();
  const portfolioUrl = String(body.portfolio_url || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  const applicantNote = body.applicant_note ? String(body.applicant_note).trim() : null;
  const recentWorksUrl = body.recent_works_url ? String(body.recent_works_url).trim() : null;

  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    return c.json({ detail: 'Full name must be between 2 and 120 characters.' }, 400);
  }
  if (!address || address.length < 2 || address.length > 250) {
    return c.json({ detail: 'Location / address must be between 2 and 250 characters.' }, 400);
  }
  if (!genre || genre.length < 1 || genre.length > 60) {
    return c.json({ detail: 'Artistic discipline / genre is required (max 60 characters).' }, 400);
  }
  if (!medium || medium.length < 1 || medium.length > 60) {
    return c.json({ detail: 'Artwork medium is required (max 60 characters).' }, 400);
  }
  if (applicantNote && applicantNote.length > 1000) {
    return c.json({ detail: 'Artist note must not exceed 1000 characters.' }, 400);
  }

  // Portfolio URL ownership & domain validation
  const userHash = await getUserHash(user.email, c.env.JWT_SECRET);
  const isValidVaultPortfolio = portfolioUrl.startsWith(`/vault/file/portfolios/${userHash}-`) ||
    portfolioUrl.startsWith(`/vault/file/portfolios%2F${userHash}-`) ||
    portfolioUrl.startsWith('/vault/file/');
  const isTrustedStorage = portfolioUrl.startsWith('https://res.cloudinary.com/') ||
    portfolioUrl.startsWith('https://alfaazcollective.org/') ||
    portfolioUrl.startsWith('https://www.alfaazcollective.org/') ||
    (c.env.ENV !== 'production' && (
      portfolioUrl.startsWith('http://localhost') ||
      portfolioUrl.startsWith('https://example.com') ||
      portfolioUrl.includes('alfaaz.local') ||
      portfolioUrl.startsWith('https://') ||
      portfolioUrl.startsWith('http://')
    ));

  if (!portfolioUrl || (!isValidVaultPortfolio && !isTrustedStorage)) {
    return c.json({ detail: 'A valid uploaded portfolio document is required.' }, 400);
  }

  // Age criteria & Child Safeguarding
  const requireOver18 = activeCycle.require_over_18 === undefined || activeCycle.require_over_18 === null
    ? 1
    : Number(activeCycle.require_over_18);
  const isConfirmedOver18 = Boolean(body.over_18 ?? body.over_19);

  let guardianName: string | null = null;
  let guardianRelationship: string | null = null;
  let guardianContact: string | null = null;
  let guardianConsentGranted = 0;
  let guardianConsentVersion: string | null = null;
  let guardianConsentTimestamp: string | null = null;
  let participantAssentGranted = 0;
  let guardianVerificationStatus = 'NONE';

  if (requireOver18 === 1) {
    if (age < 18) {
      return c.json({ detail: 'You must be 18 years of age or older to participate in this exhibition cycle.' }, 400);
    }
    if (!isConfirmedOver18) {
      return c.json({ detail: 'You must confirm that you are 18 years of age or older to participate in this exhibition cycle.' }, 400);
    }
    if (!whatsapp || whatsapp.length < 7 || whatsapp.length > 25) {
      return c.json({ detail: 'A valid WhatsApp or contact phone number is required.' }, 400);
    }
  } else {
    // Under-18 / Youth Cycle
    if (age >= 18) {
      return c.json({ detail: 'This exhibition is specifically for children and youth under 18 years of age.' }, 400);
    }

    const hasGuardianFields = Boolean(body.guardian_name || body.guardian_contact || body.guardian_consent_granted !== undefined);
    const isProd = c.env.ENV === 'production';

    if (hasGuardianFields || isProd) {
      // Youth Safeguarding: enforce parent/guardian identity, relationship, contact and explicit consent
      guardianName = String(body.guardian_name || '').trim();
      guardianRelationship = String(body.guardian_relationship || '').trim();
      guardianContact = String(body.guardian_contact || body.whatsapp || '').trim();
      const consentGiven = Boolean(body.guardian_consent_granted);
      const assentGiven = Boolean(body.participant_assent_granted ?? true);

      if (!guardianName || guardianName.length < 2 || guardianName.length > 120) {
        return c.json({ detail: 'Parent or legal guardian name is required for youth applications.' }, 400);
      }
      if (!guardianRelationship || guardianRelationship.length < 2 || guardianRelationship.length > 60) {
        return c.json({ detail: 'Relationship to participant (e.g. Mother, Father, Guardian) is required.' }, 400);
      }
      if (!guardianContact || guardianContact.length < 5 || guardianContact.length > 100) {
        return c.json({ detail: 'Parent or legal guardian phone number or email is required.' }, 400);
      }
      if (!consentGiven) {
        return c.json({ detail: 'Explicit parent or guardian consent is required for participants under 18.' }, 400);
      }
      if (!assentGiven) {
        return c.json({ detail: 'Participant assent is required.' }, 400);
      }

      guardianConsentGranted = 1;
      guardianConsentVersion = '2026-v1';
      guardianConsentTimestamp = new Date().toISOString();
      participantAssentGranted = 1;
      guardianVerificationStatus = 'PENDING';
    } else {
      guardianVerificationStatus = 'PENDING';
    }
  }

  // Duplicate submission check
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
          genre, medium, portfolio_url, recent_works_url, over_19, agreed_to_screening, applicant_note,
          guardian_name, guardian_relationship, guardian_contact,
          guardian_consent_granted, guardian_consent_version, guardian_consent_timestamp,
          participant_assent_granted, guardian_verification_status,
          status, registration_status, agreed_to_tnc
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 1, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          'PENDING', 'NONE', 0
        )
      `)
      .bind(
        user.email, activeCycle.title, fullName,
        age, address, whatsapp || guardianContact || '—',
        genre, medium, portfolioUrl, recentWorksUrl, over19Val, applicantNote,
        guardianName, guardianRelationship, guardianContact,
        guardianConsentGranted, guardianConsentVersion, guardianConsentTimestamp,
        participantAssentGranted, guardianVerificationStatus
      )
      .run();
  } catch (err: any) {
    if (err?.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
      return c.json({ detail: 'You have already submitted an application for this exhibition cycle.' }, 400);
    }
    throw err;
  }

  try {
    const appUrl = c.env.FRONTEND_URL || 'https://alfaazcollective.org';
    const recipientName = fullName || 'Artist';
    await sendSystemEmail(
      c.env,
      user.email,
      `Alfaaz Collective — Artwork Received: ${activeCycle.title}`,
      `Hello ${recipientName},\n\nThank you for sharing your artwork with us for ${activeCycle.title}!\n\nWe have received your submission safely. Our curatorial team will review every piece of art with care, fairness, and respect.\n\nWhat happens next:\n1. Our curatorial team will review your submitted artwork.\n2. Once the review is complete, your status will update on your dashboard.\n3. You can check your progress anytime by visiting:\n${appUrl}/dashboard.html\n\nThank you for sharing your creativity with our collective community!\n\nWarm regards,\nAlfaaz Collective`
    );
  } catch (err) {
    console.warn('[EXHIBITIONS] Application email notice:', err);
  }

  return c.json({ status: 'SUCCESS', message: 'Application submitted successfully.' });
});

// ── GET /my-status (Multi-Cycle Activity Retrieval) ───────────────────────────
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
      registration_status: a.registration_status || 'NONE',
      guardian_verification_status: a.guardian_verification_status || 'NONE'
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
      statuses_by_cycle: statusesByCycle,
      guardian_verification_status: app.guardian_verification_status || 'NONE'
    };

    if (app.status === 'APPROVED') {
      base.full_name = app.full_name;
      base.age = app.age;
      base.address = app.address;
      base.whatsapp = app.whatsapp;
      base.genre = app.genre;
      base.medium = app.medium;
      base.portfolio_url = app.portfolio_url;
      base.recent_works_url = app.recent_works_url;
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
    statuses_by_cycle: statusesByCycle,
    guardian_verification_status: app.guardian_verification_status || 'NONE'
  };

  if (app.status === 'APPROVED') {
    base.full_name = app.full_name;
    base.age = app.age;
    base.address = app.address;
    base.whatsapp = app.whatsapp;
    base.genre = app.genre;
    base.medium = app.medium;
    base.portfolio_url = app.portfolio_url;
    base.recent_works_url = app.recent_works_url;
    base.registration_status = app.registration_status || 'NONE';
    base.payment_confirmed_at = app.payment_confirmed_at;
  }

  return c.json(base);
});

// ── Registration Finalization (Cycle-Specific with Exhibition ID) ─────────────
async function handleCompleteRegistration(c: Context<{ Bindings: Env; Variables: { user: JwtUserPayload } }>) {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const exhibitionId = body.exhibition_id ? Number(body.exhibition_id) : null;
  const exhibitionCycle = (body.exhibition_cycle || '').trim();

  let targetCycle: { id: number; title: string } | null = null;
  if (exhibitionId) {
    targetCycle = await c.env.DB
      .prepare("SELECT id, title FROM exhibitions_list WHERE id = ? AND is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') LIMIT 1")
      .bind(exhibitionId)
      .first<any>();
    if (!targetCycle) {
      return c.json({ detail: 'Specified exhibition cycle was not found or is closed.' }, 400);
    }
  } else if (exhibitionCycle) {
    targetCycle = await c.env.DB
      .prepare("SELECT id, title FROM exhibitions_list WHERE LOWER(title) = LOWER(?) AND is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') LIMIT 1")
      .bind(exhibitionCycle)
      .first<any>();
    if (!targetCycle) {
      return c.json({ detail: 'Specified exhibition cycle was not found or is closed.' }, 400);
    }
  } else {
    // If neither is supplied, check the first active cycle
    targetCycle = await c.env.DB
      .prepare("SELECT id, title FROM exhibitions_list WHERE is_active = 1 AND (status IS NULL OR status = 'PUBLISHED') ORDER BY id ASC LIMIT 1")
      .first<any>();
  }

  if (!targetCycle) {
    return c.json({ detail: 'The exhibition portal is currently closed.' }, 400);
  }

  const app = await c.env.DB
    .prepare("SELECT * FROM exhibition_applications WHERE user_email = ? AND exhibition_cycle = ? AND status = 'APPROVED'")
    .bind(user.email, targetCycle.title)
    .first<any>();

  if (!app) {
    return c.json({ detail: 'No approved application found for this specific exhibition cycle.' }, 404);
  }

  const isMinor = (app.age !== null && app.age !== undefined && app.age < 18) || Boolean(app.guardian_name) || (app.over_19 === 0);
  if (isMinor && app.guardian_verification_status !== 'VERIFIED') {
    const detail = app.guardian_verification_status === 'REJECTED'
      ? 'Parent/Guardian consent was rejected by administration. Registration cannot proceed.'
      : 'Parent/Guardian consent must be verified by administration before registration can be finalized.';
    return c.json({
      detail,
      code: 'GUARDIAN_CONSENT_UNVERIFIED'
    }, 403);
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

  const paymentProofUrl = String(body.payment_proof_url).trim();
  const userHash = await getUserHash(user.email, c.env.JWT_SECRET);
  const isValidProof = paymentProofUrl.startsWith(`/vault/file/payment-proofs/${userHash}-`) ||
    paymentProofUrl.startsWith(`/vault/file/payment-proofs%2F${userHash}-`) ||
    paymentProofUrl.startsWith('/vault/file/') ||
    paymentProofUrl.startsWith('https://res.cloudinary.com/') ||
    (c.env.ENV !== 'production' && (paymentProofUrl.startsWith('http://localhost') || paymentProofUrl.startsWith('https://example.com')));

  if (!isValidProof) {
    return c.json({ detail: 'Invalid payment proof URL. Please upload your receipt directly.' }, 400);
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
      paymentProofUrl,
      body.participant_note_reg ? String(body.participant_note_reg).trim() : null,
      app.id
    )
    .run();

  try {
    const appUrl = c.env.FRONTEND_URL || 'https://alfaazcollective.org';
    await sendSystemEmail(
      c.env,
      user.email,
      `Alfaaz Collective — Registration Received: ${app.exhibition_cycle}`,
      `Hello ${app.full_name},\n\nThank you for submitting your exhibition registration and payment proof for ${app.exhibition_cycle}!\n\nOur team is verifying the details and will confirm your gallery spot shortly. You can check your confirmation status anytime on your dashboard:\n${appUrl}/dashboard.html\n\nThank you for your cooperation and excitement!\n\nWarm regards,\nAlfaaz Collective`
    );
  } catch (err) {
    console.warn('[EXHIBITIONS] Registration submission email notice:', err);
  }

  return c.json({ status: 'SUBMITTED', message: 'Registration submitted. Awaiting payment confirmation.' });
}

exhibitionsRouter.post('/complete-registration', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), handleCompleteRegistration);
exhibitionsRouter.post('/finalize', requireAuth, rateLimiter({ limit: 10, windowMs: 60000 }), handleCompleteRegistration);

export default exhibitionsRouter;
