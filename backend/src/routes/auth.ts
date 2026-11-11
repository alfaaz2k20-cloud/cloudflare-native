import { Hono } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { hashPassword, verifyPassword, createToken, verifyToken, getJwtSecret } from '../auth/crypto';
import { requireAuth } from '../middleware/auth';
import { rateLimiter, verifyTurnstile } from '../middleware/rate_limit';
import { sendSystemEmail } from '../notifications/email';
import { verifyFederatedToken } from '../auth/federated';

export const authRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

// Rate limit: 20 attempts per minute
authRouter.use('/register', rateLimiter({ limit: 20, windowMs: 60000 }));
authRouter.use('/login', rateLimiter({ limit: 20, windowMs: 60000 }));
authRouter.use('/forgot-password', rateLimiter({ limit: 10, windowMs: 60000 }));
authRouter.use('/reset-password', rateLimiter({ limit: 10, windowMs: 60000 }));
authRouter.use('/federated-login', rateLimiter({ limit: 30, windowMs: 60000 }));

authRouter.post('/federated-login', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed JSON payload.' }, 400);
  }

  const idToken = body?.id_token || body?.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return c.json({ error: 'ID token is required.' }, 400);
  }

  // Fail closed when no OAuth client ID is configured: without it the audience claim cannot be
  // checked, so no token can be proven to have been issued for this deployment.
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const verified = await verifyFederatedToken(idToken, clientId, c.env.ENV);
  if (!verified) {
    return c.json({ error: 'Invalid or expired authentication token.' }, 401);
  }

  const uid = verified.user_id || verified.sub;
  const email = verified.email ? verified.email.toLowerCase().trim() : null;
  const emailVerified = Boolean(verified.email_verified);
  const fullName = verified.name ? String(verified.name).slice(0, 80).trim() : null;

  // Provider derives exclusively from cryptographically verified token claims, never the client
  // body. The verifier pins this to google.com once it has confirmed the Google issuer.
  const provider = verified.sign_in_provider || 'google.com';

  // Priority 1: Match existing user by sovereign firebase_uid
  let userRow: any = null;
  if (uid) {
    userRow = await c.env.DB
      .prepare('SELECT id, email, full_name, status, phone, auth_provider, firebase_uid FROM users WHERE firebase_uid = ?')
      .bind(uid)
      .first();
  }

  // Priority 2: Match existing user by email
  // CRITICAL P0 INVARIANT: An existing account MUST NEVER be matched or linked to a federated token
  // unless the email address has been explicitly verified (email_verified === true).
  // Without this check, an attacker can create an unverified federated account using a victim's email and hijack it.
  if (!userRow && email) {
    const existingByEmail = await c.env.DB
      .prepare('SELECT id, email, full_name, status, phone, auth_provider, firebase_uid FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingByEmail) {
      if (!emailVerified) {
        return c.json({ error: 'Email address is not verified by authentication provider.' }, 401);
      }
      userRow = existingByEmail;
    }
  }

  if (userRow) {
    // Preserve existing role / status (e.g. 'ADMIN' or 'PARTICIPANT')
    const nowIso = new Date().toISOString();
    await c.env.DB
      .prepare(`
        UPDATE users 
        SET firebase_uid = COALESCE(firebase_uid, ?),
            auth_provider = COALESCE(auth_provider, ?),
            full_name = COALESCE(full_name, ?),
            email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
            email_verified_at = CASE WHEN ? = 1 THEN COALESCE(email_verified_at, ?) ELSE email_verified_at END
        WHERE id = ?
      `)
      .bind(
        uid, provider, fullName,
        emailVerified ? 1 : 0, emailVerified ? 1 : 0, nowIso,
        userRow.id
      )
      .run();

    userRow = await c.env.DB
      .prepare('SELECT id, email, full_name, status, phone, auth_provider, firebase_uid, email_verified, phone_verified FROM users WHERE id = ?')
      .bind(userRow.id)
      .first();
  } else {
    // If client is in 'login' mode, do not auto-create an account: prompt them to register
    const mode = body.mode;
    if (mode === 'login') {
      return c.json({
        error: 'No account found with this Google email. Please register to join Alfaaz Collective.',
        code: 'ACCOUNT_NOT_FOUND'
      }, 404);
    }

    // Defense in depth behind the verifier's own email gate: this P0 account-takeover guard
    // must not rely on a single upstream check remaining intact.
    if (!emailVerified) {
      return c.json({ error: 'Email address is not verified by authentication provider.' }, 401);
    }

    const nowIso = new Date().toISOString();
    // Insert new federated user with race condition protection
    try {
      await c.env.DB
        .prepare(`
          INSERT INTO users (email, password, full_name, status, auth_provider, firebase_uid, email_verified, email_verified_at)
          VALUES (?, NULL, ?, 'PARTICIPANT', ?, ?, ?, CASE WHEN ? = 1 THEN ? ELSE NULL END)
        `)
        .bind(
          email, fullName, provider, uid,
          emailVerified ? 1 : 0,
          emailVerified ? 1 : 0, nowIso
        )
        .run();

      userRow = await c.env.DB
        .prepare('SELECT id, email, full_name, status, phone, auth_provider, firebase_uid, email_verified, phone_verified FROM users WHERE firebase_uid = ?')
        .bind(uid)
        .first();
    } catch (err: any) {
      if (err?.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
        // Handle concurrent insert race condition gracefully
        userRow = await c.env.DB
          .prepare('SELECT id, email, full_name, status, phone, auth_provider, firebase_uid, email_verified, phone_verified FROM users WHERE firebase_uid = ? OR (email IS NOT NULL AND email = ?)')
          .bind(uid, email)
          .first();
        if (!userRow) {
          return c.json({ error: 'Account conflict occurred during registration.' }, 409);
        }
      } else {
        throw err;
      }
    }
  }

  const secret = getJwtSecret(c.env);
  const token = await createToken(
    { email: userRow.email || userRow.phone || uid, status: userRow.status },
    secret,
    undefined,
    7 * 86400
  );

  return c.json({
    token,
    user: {
      id: userRow.id,
      email: userRow.email || undefined,
      phone: userRow.phone || undefined,
      full_name: userRow.full_name || undefined,
      status: userRow.status,
      auth_provider: userRow.auth_provider || provider,
      email_verified: userRow.email_verified ?? 0,
      phone_verified: userRow.phone_verified ?? 0
    }
  });
});

authRouter.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;
  const fullName = (body.full_name || '').trim();
  const phone = (body.phone || body.whatsapp || '').trim();

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || (c.env.ENV === 'test' ? (c.req.header('x-forwarded-for') || '127.0.0.1') : '127.0.0.1');
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip, c.env.ENV);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  if (!email || !password) {
    return c.json({ detail: 'Email and password required' }, 400);
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || password.trim().length === 0) {
    return c.json({ detail: 'Password must be between 8 and 128 characters long and cannot be only whitespace.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return c.json({ detail: 'A valid email address is required.' }, 400);
  }

  const existingEmail = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (existingEmail) {
    return c.json({ detail: 'User already registered.' }, 400);
  }

  if (!fullName || fullName.length < 2) {
    return c.json({ detail: 'Full name is required (at least 2 characters).' }, 400);
  }
  if (fullName.length > 80) {
    return c.json({ detail: 'Name must be under 80 characters.' }, 400);
  }
  if (!phone || !/^\+[1-9]\d{6,14}$/.test(phone)) {
    return c.json({ detail: 'A valid WhatsApp mobile number in E.164 format (e.g., +919876543210) is required.' }, 400);
  }

  const existingPhone = await c.env.DB
    .prepare('SELECT id FROM users WHERE phone = ?')
    .bind(phone)
    .first();

  if (existingPhone) {
    return c.json({ detail: 'This WhatsApp number is already registered. Please log in.' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  let createdId: number | null = null;
  try {
    // Password registration does NOT prove ownership of the inbox or the handset.
    // Start unverified and let /verification/email|phone/* establish it honestly.
    const insertRes = await c.env.DB
      .prepare('INSERT INTO users (email, password, full_name, phone, status, auth_provider, email_verified, phone_verified) VALUES (?, ?, ?, ?, ?, ?, 0, 0)')
      .bind(email, hashedPassword, fullName, phone, 'PARTICIPANT', 'email')
      .run();
    createdId = insertRes.meta.last_row_id || null;
  } catch (err: any) {
    if (err?.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
      return c.json({ detail: 'User already registered with this email or WhatsApp number.' }, 400);
    }
    throw err;
  }

  const secret = getJwtSecret(c.env);
  const token = await createToken(email, 'PARTICIPANT', secret);

  try {
    const appUrl = c.env.FRONTEND_URL || 'https://alfaazcollective.org';
    const recipientName = fullName || 'Friend';
    await sendSystemEmail(
      c.env,
      email,
      'Alfaaz Collective — Welcome to the Collective',
      `Hello ${recipientName},\n\nWelcome to Alfaaz Collective! We are happy to have you join our creative community.\n\nYou can now explore exhibitions, join creative circles, and register for community events from your dashboard:\n${appUrl}/dashboard.html\n\nIf you ever need help or have questions, feel free to reach out to us.\n\nWarm regards,\nAlfaaz Collective`
    );
  } catch (emailErr) {
    console.warn('[EMAIL WARNING] Welcome email dispatch failed:', emailErr);
  }

  return c.json({
    user: { id: createdId || undefined, email, full_name: fullName, phone, auth_provider: 'email', status: 'PARTICIPANT', email_verified: 0, phone_verified: 0 },
    token
  });
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || (c.env.ENV === 'test' ? (c.req.header('x-forwarded-for') || '127.0.0.1') : '127.0.0.1');
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip, c.env.ENV);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  if (!email || !password) {
    return c.json({ detail: 'Invalid credentials' }, 401);
  }

  const user = await c.env.DB
    .prepare('SELECT id, email, password, status, full_name, phone, auth_provider, email_verified, phone_verified FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; email: string; password: string; status: string; full_name: string; phone: string | null; auth_provider: string | null; email_verified?: number; phone_verified?: number }>();

  if (!user) {
    return c.json({ detail: 'Invalid credentials' }, 401);
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return c.json({ detail: 'Invalid credentials' }, 401);
  }

  const secret = getJwtSecret(c.env);
  const token = await createToken(user.email, user.status, secret);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name || undefined,
      phone: user.phone || undefined,
      auth_provider: user.auth_provider || 'email',
      status: user.status,
      email_verified: user.email_verified ?? 0,
      phone_verified: user.phone_verified ?? 0
    },
    token
  });
});

authRouter.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || (c.env.ENV === 'test' ? (c.req.header('x-forwarded-for') || '127.0.0.1') : '127.0.0.1');
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip, c.env.ENV);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  const user = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?')
    .bind(email)
    .first<{ email: string }>();

  if (!user) {
    return c.json({ message: 'If the email is registered, your reset link has been dispatched to your email.' });
  }

  const secret = getJwtSecret(c.env);
  const resetToken = await createToken(user.email, 'reset', secret, 900); // 15 mins
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:8787';
  const resetLink = `${frontendUrl}/reset.html?token=${resetToken}`;

  try {
    await sendSystemEmail(
      c.env,
      user.email,
      'Alfaaz Collective — Password Reset Request',
      `Hello,\n\nWe received a request to reset the password for your Alfaaz Collective account (${user.email}).\n\nYou can set a new password by clicking the link below:\n${resetLink}\n\nThis link is valid for 15 minutes. If you did not ask to reset your password, you can safely disregard this email—your account remains secure.\n\nWarm regards,\nAlfaaz Collective`,
      false
    );
  } catch (err) {
    console.warn('[AUTH] Reset email notice:', err);
  }

  return c.json({ message: 'If the email is registered, your reset link has been dispatched to your email.' });
});

authRouter.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = body.token;
  const newPassword = body.new_password;

  if (!token || !newPassword) {
    return c.json({ detail: 'Token and new password required' }, 400);
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || newPassword.trim().length === 0) {
    return c.json({ detail: 'Password must be between 8 and 128 characters long and cannot be only whitespace.' }, 400);
  }

  const secret = getJwtSecret(c.env);
  try {
    const payload = await verifyToken(token, secret);
    if (!payload || payload.status !== 'reset') {
      return c.json({ detail: 'Invalid or expired reset link.' }, 400);
    }

    // Compute SHA-256 token hash for replay protection
    const tokenBuffer = new TextEncoder().encode(token);
    const tokenHashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Fetch user and check password_reset_at timestamp
    const userRow = await c.env.DB
      .prepare('SELECT email, password_reset_at FROM users WHERE email = ?')
      .bind(payload.sub)
      .first<{ email: string; password_reset_at: string | null }>();

    if (!userRow) {
      return c.json({ detail: 'Account not found.' }, 404);
    }

    if (userRow.password_reset_at) {
      const resetTime = new Date(userRow.password_reset_at).getTime();
      if (payload.iat && (payload.iat * 1000) <= resetTime) {
        return c.json({ detail: 'Invalid or expired reset link.' }, 400);
      }
    }

    const nowIso = new Date().toISOString();

    // Race-free token consumption: INSERT into consumed_tokens FIRST on the PRIMARY KEY
    // If concurrent requests arrive with the same reset token, SQLite's UNIQUE constraint
    // failure guarantees that exactly one request consumes the token.
    try {
      await c.env.DB
        .prepare('INSERT INTO consumed_tokens (token_hash, consumed_at, expires_at) VALUES (?, ?, ?)')
        .bind(tokenHash, nowIso, payload.exp || (Math.floor(Date.now() / 1000) + 900))
        .run();
    } catch (err: any) {
      return c.json({ detail: 'Invalid or expired reset link.' }, 400);
    }

    // Only the winning request updates the password
    const hashedPassword = await hashPassword(newPassword);
    const res = await c.env.DB
      .prepare('UPDATE users SET password = ?, password_reset_at = ? WHERE email = ?')
      .bind(hashedPassword, nowIso, payload.sub)
      .run();

    if (res.meta.changes === 0) {
      return c.json({ detail: 'Account not found.' }, 404);
    }

    try {
      await sendSystemEmail(
        c.env,
        payload.sub,
        'Alfaaz Collective — Your Password Has Been Updated',
        `Hello,\n\nThis is a quick confirmation that the password for your Alfaaz Collective account was successfully updated.\n\nIf you made this change, no further action is needed.\n\nIf you did not make this change, please contact us right away at curator@alfaazcollective.org so we can help protect your account.\n\nWarm regards,\nAlfaaz Collective`
      );
    } catch (emailErr) {
      console.warn('[EMAIL WARNING] Password reset security alert failed:', emailErr);
    }

    return c.json({ message: 'Password reset successfully.' });
  } catch (err: any) {
    if (err?.message?.includes('FATAL SECURITY ERROR')) {
      throw err;
    }
    return c.json({ detail: 'Invalid or expired reset link.' }, 401);
  }
});

authRouter.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const row = await c.env.DB
    .prepare('SELECT email, full_name, status, phone, auth_provider, email_verified, phone_verified FROM users WHERE email = ? OR phone = ?')
    .bind(user.email, user.email)
    .first<{ email: string; full_name: string; status: string; phone?: string; auth_provider?: string; email_verified?: number; phone_verified?: number }>();

  if (!row) {
    return c.json({ detail: 'User not found.' }, 404);
  }
  return c.json(row);
});

authRouter.patch('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  let updatedName: string | undefined;
  let updatedPhone: string | undefined;

  if (body.full_name !== undefined) {
    const name = String(body.full_name || '').trim();
    if (name.length > 80) {
      return c.json({ detail: 'Name too long.' }, 400);
    }
    await c.env.DB
      .prepare('UPDATE users SET full_name = ? WHERE email = ? OR phone = ?')
      .bind(name || null, user.email, user.email)
      .run();
    updatedName = name;
  }

  if (body.phone !== undefined || body.whatsapp !== undefined) {
    const rawPhone = String(body.phone || body.whatsapp || '').trim();
    if (!rawPhone || !/^\+[1-9]\d{6,14}$/.test(rawPhone)) {
      return c.json({ detail: 'A valid WhatsApp mobile number in E.164 format (e.g., +919876543210) is required.' }, 400);
    }
    const existing = await c.env.DB
      .prepare('SELECT id FROM users WHERE phone = ? AND (email != ? OR email IS NULL)')
      .bind(rawPhone, user.email || '')
      .first();
    if (existing) {
      return c.json({ detail: 'This WhatsApp number is already in use by another account.' }, 409);
    }
    await c.env.DB
      .prepare('UPDATE users SET phone = ?, phone_verified = 0, phone_verified_at = NULL WHERE email = ? OR phone = ?')
      .bind(rawPhone, user.email, user.email)
      .run();
    updatedPhone = rawPhone;
  }

  return c.json({
    status: 'SUCCESS',
    ...(updatedName !== undefined ? { full_name: updatedName } : {}),
    ...(updatedPhone !== undefined ? { phone: updatedPhone, phone_verified: 0 } : {})
  });
});

export default authRouter;
