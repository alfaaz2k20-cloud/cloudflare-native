import { Hono } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { hashPassword, verifyPassword, createToken, verifyToken, getJwtSecret } from '../auth/crypto';
import { requireAuth } from '../middleware/auth';
import { rateLimiter, verifyTurnstile } from '../middleware/rate_limit';
import { sendSystemEmail } from '../notifications/email';

export const authRouter = new Hono<{ Bindings: Env; Variables: { user: JwtUserPayload } }>();

// Rate limit: 20 attempts per minute
authRouter.use('/register', rateLimiter({ limit: 20, windowMs: 60000 }));
authRouter.use('/login', rateLimiter({ limit: 20, windowMs: 60000 }));
authRouter.use('/forgot-password', rateLimiter({ limit: 10, windowMs: 60000 }));
authRouter.use('/reset-password', rateLimiter({ limit: 10, windowMs: 60000 }));

authRouter.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;
  const fullName = (body.full_name || '').trim();

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined;
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip, c.env.ENV);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  if (!email || !password) {
    return c.json({ detail: 'Email and password required' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return c.json({ detail: 'A valid email address is required.' }, 400);
  }
  if (fullName.length > 80) {
    return c.json({ detail: 'Name must be under 80 characters.' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (existing) {
    return c.json({ detail: 'User already registered.' }, 400);
  }

  const hashedPassword = await hashPassword(password);
  try {
    await c.env.DB
      .prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
      .bind(email, hashedPassword, fullName || null, 'PARTICIPANT')
      .run();
  } catch (err: any) {
    if (err?.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
      return c.json({ detail: 'User already registered.' }, 400);
    }
    throw err;
  }

  const secret = getJwtSecret(c.env);
  const token = await createToken(email, 'PARTICIPANT', secret);

  try {
    const appUrl = c.env.FRONTEND_URL || 'https://alfaazcollective.org';
    await sendSystemEmail(
      c.env,
      email,
      'Welcome to Alfaaz Collective',
      `Greetings${fullName ? ' ' + fullName : ''},\n\nYour account at Alfaaz Collective has been registered successfully.\n\nYou can access your portfolio, events, and collective circles at:\n${appUrl}/dashboard.html\n\n— Alfaaz Collective`
    );
  } catch (emailErr) {
    console.warn('[EMAIL WARNING] Welcome email dispatch failed:', emailErr);
  }

  return c.json({
    user: { email, status: 'PARTICIPANT' },
    token
  });
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined;
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip, c.env.ENV);
  if (!turnstileValid) {
    return c.json({ detail: 'Turnstile verification failed. Please complete the security challenge.' }, 403);
  }

  if (!email || !password) {
    return c.json({ detail: 'Invalid credentials' }, 401);
  }

  const user = await c.env.DB
    .prepare('SELECT email, password, status, full_name FROM users WHERE email = ?')
    .bind(email)
    .first<{ email: string; password: string; status: string; full_name: string }>();

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
    user: { email: user.email, status: user.status },
    token
  });
});

authRouter.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined;
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
      'ALFAAZ — Password Reset',
      `Greetings,\n\nA password reset was requested for your account: ${user.email}.\nThis link expires in 15 minutes.\n\n${resetLink}\n\nIf you did not request this, please ignore this message.\n\n— The Curator`,
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

    // Check if token was already consumed in consumed_tokens table
    try {
      const consumed = await c.env.DB
        .prepare('SELECT token_hash FROM consumed_tokens WHERE token_hash = ?')
        .bind(tokenHash)
        .first();

      if (consumed) {
        return c.json({ detail: 'Invalid or expired reset link.' }, 400);
      }
    } catch {
      // Table may not exist yet in unmigrated environments; fallback to timestamp check
    }

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

    const hashedPassword = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    const res = await c.env.DB
      .prepare('UPDATE users SET password = ?, password_reset_at = ? WHERE email = ?')
      .bind(hashedPassword, nowIso, payload.sub)
      .run();

    if (res.meta.changes === 0) {
      return c.json({ detail: 'Account not found.' }, 404);
    }

    // Record token in consumed_tokens table
    try {
      await c.env.DB
        .prepare('INSERT INTO consumed_tokens (token_hash, consumed_at, expires_at) VALUES (?, ?, ?)')
        .bind(tokenHash, nowIso, payload.exp || (Math.floor(Date.now() / 1000) + 900))
        .run();
    } catch {
      // Table insert is auxiliary; timestamp check already invalidates the token
    }

    try {
      await sendSystemEmail(
        c.env,
        payload.sub,
        'ALFAAZ — Security Alert: Password Updated',
        `Greetings,\n\nYour password for Alfaaz Collective was successfully updated.\n\nIf you initiated this change, no further action is required.\nIf you did not make this change, please contact us immediately at curator@alfaazcollective.org.\n\n— Alfaaz Security`
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
    .prepare('SELECT email, full_name, status FROM users WHERE email = ?')
    .bind(user.email)
    .first<{ email: string; full_name: string; status: string }>();

  if (!row) {
    return c.json({ detail: 'User not found.' }, 404);
  }
  return c.json(row);
});

authRouter.patch('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  if (body.full_name !== undefined) {
    const name = String(body.full_name || '').trim();
    if (name.length > 80) {
      return c.json({ detail: 'Name too long.' }, 400);
    }
    await c.env.DB
      .prepare('UPDATE users SET full_name = ? WHERE email = ?')
      .bind(name || null, user.email)
      .run();
    return c.json({ status: 'SUCCESS', full_name: name });
  }

  return c.json({ status: 'SUCCESS' });
});

export default authRouter;
