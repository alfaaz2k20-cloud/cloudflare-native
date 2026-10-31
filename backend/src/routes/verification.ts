import { Hono } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { requireAuth } from '../middleware/auth';
import { sendSystemEmail } from '../notifications/email';
import { sendSms } from '../notifications/sms';

const verificationRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return String(code);
}

async function hashCode(code: string): Promise<string> {
  const buffer = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseSqliteUtc(dateStr: string): number {
  if (!dateStr) return 0;
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z');
  return new Date(iso).getTime();
}

async function getUserRow(db: D1Database, identifier: string) {
  return await db
    .prepare('SELECT id, email, full_name, status, phone, email_verified, phone_verified FROM users WHERE email = ? OR phone = ?')
    .bind(identifier, identifier)
    .first<{
      id: number;
      email: string | null;
      full_name: string | null;
      status: string;
      phone: string | null;
      email_verified: number;
      phone_verified: number;
    }>();
}

// -----------------------------------------------------------------------------
// POST /verification/email/send
// -----------------------------------------------------------------------------
verificationRouter.post('/email/send', requireAuth, async (c) => {
  const authUser = c.get('user');
  const userRow = await getUserRow(c.env.DB, authUser.email);
  if (!userRow) {
    return c.json({ error: 'User account not found.' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const targetEmail = (body.email ? String(body.email).trim().toLowerCase() : userRow.email?.trim().toLowerCase()) || '';

  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail) || targetEmail.length > 254) {
    return c.json({ error: 'A valid email address is required.' }, 400);
  }

  // If email differs from current user's email, ensure it's not taken by another user
  if (userRow.email && userRow.email.toLowerCase() !== targetEmail) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .bind(targetEmail, userRow.id)
      .first();
    if (existing) {
      return c.json({ error: 'Email address is already in use by another account.' }, 409);
    }
  }

  // Cooldown check: max 1 per 60 seconds
  const recent = await c.env.DB
    .prepare('SELECT created_at FROM verification_codes WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1')
    .bind(userRow.id, 'email')
    .first<{ created_at: string }>();

  if (recent && recent.created_at) {
    const elapsedSec = (Date.now() - parseSqliteUtc(recent.created_at)) / 1000;
    if (elapsedSec < 60) {
      const retryAfter = Math.ceil(60 - elapsedSec);
      c.header('Retry-After', String(retryAfter));
      return c.json({
        error: `Please wait ${retryAfter} seconds before requesting another code.`,
        retry_after: retryAfter
      }, 429);
    }
  }

  const code = generateVerificationCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await c.env.DB
    .prepare(`
      INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at)
      VALUES (?, 'email', ?, ?, ?)
    `)
    .bind(userRow.id, targetEmail, codeHash, expiresAt)
    .run();

  await sendSystemEmail(
    c.env,
    targetEmail,
    'Alfaaz Collective — Verification Code',
    `Greetings,\n\nYour Alfaaz email verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\n— Alfaaz Collective Curators`,
    false
  );

  return c.json({
    success: true,
    message: 'Verification code dispatched to your email.'
  });
});

// -----------------------------------------------------------------------------
// POST /verification/email/confirm
// -----------------------------------------------------------------------------
verificationRouter.post('/email/confirm', requireAuth, async (c) => {
  const authUser = c.get('user');
  const userRow = await getUserRow(c.env.DB, authUser.email);
  if (!userRow) {
    return c.json({ error: 'User account not found.' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return c.json({ error: 'A valid 6-digit verification code is required.' }, 400);
  }

  const active = await c.env.DB
    .prepare(`
      SELECT id, target, code_hash, attempts, expires_at 
      FROM verification_codes 
      WHERE user_id = ? AND purpose = 'email' AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `)
    .bind(userRow.id)
    .first<{ id: number; target: string; code_hash: string; attempts: number; expires_at: string }>();

  if (!active) {
    return c.json({ error: 'No active verification code found. Please request a new one.' }, 400);
  }

  if (parseSqliteUtc(active.expires_at) < Date.now()) {
    return c.json({ error: 'Verification code has expired. Please request a new one.' }, 400);
  }

  if (active.attempts >= 5) {
    return c.json({ error: 'Maximum verification attempts exceeded. Please request a new code.' }, 429);
  }

  // Increment attempts counter
  await c.env.DB
    .prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?')
    .bind(active.id)
    .run();

  const inputHash = await hashCode(code);
  if (inputHash !== active.code_hash) {
    return c.json({ error: 'Invalid verification code.' }, 400);
  }

  // Mark code as consumed and update user's email verification status
  const nowIso = new Date().toISOString();
  await c.env.DB
    .prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?')
    .bind(nowIso, active.id)
    .run();

  await c.env.DB
    .prepare(`
      UPDATE users 
      SET email = COALESCE(email, ?),
          email_verified = 1,
          email_verified_at = ?
      WHERE id = ?
    `)
    .bind(active.target, nowIso, userRow.id)
    .run();

  return c.json({
    success: true,
    message: 'Email address verified successfully.',
    email: active.target,
    email_verified: 1
  });
});

// -----------------------------------------------------------------------------
// POST /verification/phone/send
// -----------------------------------------------------------------------------
verificationRouter.post('/phone/send', requireAuth, async (c) => {
  const authUser = c.get('user');
  const userRow = await getUserRow(c.env.DB, authUser.email);
  if (!userRow) {
    return c.json({ error: 'User account not found.' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const targetPhone = (body.phone ? String(body.phone).trim() : userRow.phone?.trim()) || '';

  if (!targetPhone || !/^\+[1-9]\d{6,14}$/.test(targetPhone)) {
    return c.json({ error: 'Invalid phone number format. Must be in E.164 format (e.g., +14155552671).' }, 400);
  }

  // If phone differs, check whether already claimed
  if (userRow.phone && userRow.phone !== targetPhone) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM users WHERE phone = ? AND id != ?')
      .bind(targetPhone, userRow.id)
      .first();
    if (existing) {
      return c.json({ error: 'Phone number is already associated with another account.' }, 409);
    }
  }

  // Cooldown check: max 1 per 60 seconds
  const recent = await c.env.DB
    .prepare('SELECT created_at FROM verification_codes WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1')
    .bind(userRow.id, 'phone')
    .first<{ created_at: string }>();

  if (recent && recent.created_at) {
    const elapsedSec = (Date.now() - parseSqliteUtc(recent.created_at)) / 1000;
    if (elapsedSec < 60) {
      const retryAfter = Math.ceil(60 - elapsedSec);
      c.header('Retry-After', String(retryAfter));
      return c.json({
        error: `Please wait ${retryAfter} seconds before requesting another code.`,
        retry_after: retryAfter
      }, 429);
    }
  }

  const code = generateVerificationCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await c.env.DB
    .prepare(`
      INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at)
      VALUES (?, 'phone', ?, ?, ?)
    `)
    .bind(userRow.id, targetPhone, codeHash, expiresAt)
    .run();

  const smsResult = await sendSms(
    c.env,
    targetPhone,
    `Your Alfaaz verification code is: ${code}`
  );

  if (!smsResult.success) {
    return c.json({ error: smsResult.error || 'Failed to dispatch verification SMS.' }, 503);
  }

  return c.json({
    success: true,
    message: 'Verification code dispatched via SMS.'
  });
});

// -----------------------------------------------------------------------------
// POST /verification/phone/confirm
// -----------------------------------------------------------------------------
verificationRouter.post('/phone/confirm', requireAuth, async (c) => {
  const authUser = c.get('user');
  const userRow = await getUserRow(c.env.DB, authUser.email);
  if (!userRow) {
    return c.json({ error: 'User account not found.' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return c.json({ error: 'A valid 6-digit verification code is required.' }, 400);
  }

  const active = await c.env.DB
    .prepare(`
      SELECT id, target, code_hash, attempts, expires_at 
      FROM verification_codes 
      WHERE user_id = ? AND purpose = 'phone' AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `)
    .bind(userRow.id)
    .first<{ id: number; target: string; code_hash: string; attempts: number; expires_at: string }>();

  if (!active) {
    return c.json({ error: 'No active verification code found. Please request a new one.' }, 400);
  }

  if (parseSqliteUtc(active.expires_at) < Date.now()) {
    return c.json({ error: 'Verification code has expired. Please request a new one.' }, 400);
  }

  if (active.attempts >= 5) {
    return c.json({ error: 'Maximum verification attempts exceeded. Please request a new code.' }, 429);
  }

  // Increment attempts counter
  await c.env.DB
    .prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?')
    .bind(active.id)
    .run();

  const inputHash = await hashCode(code);
  if (inputHash !== active.code_hash) {
    return c.json({ error: 'Invalid verification code.' }, 400);
  }

  // Mark code as consumed and update user's phone verification status
  const nowIso = new Date().toISOString();
  await c.env.DB
    .prepare('UPDATE verification_codes SET consumed_at = ? WHERE id = ?')
    .bind(nowIso, active.id)
    .run();

  await c.env.DB
    .prepare(`
      UPDATE users 
      SET phone = COALESCE(phone, ?),
          phone_verified = 1,
          phone_verified_at = ?
      WHERE id = ?
    `)
    .bind(active.target, nowIso, userRow.id)
    .run();

  return c.json({
    success: true,
    message: 'Phone number verified successfully.',
    phone: active.target,
    phone_verified: 1
  });
});

export default verificationRouter;
