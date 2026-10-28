import { Hono } from 'hono';
import { Env, JwtUserPayload } from '../types';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../auth/crypto';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate_limit';
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

  if (!email || !password) {
    return c.json({ detail: 'Email and password required' }, 400);
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
  await c.env.DB
    .prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
    .bind(email, hashedPassword, fullName || null, 'PARTICIPANT')
    .run();

  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
  const token = await createToken(email, 'PARTICIPANT', secret);

  return c.json({
    user: { email, status: 'PARTICIPANT' },
    token
  });
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;

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

  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
  const token = await createToken(user.email, user.status, secret);

  return c.json({
    user: { email: user.email, status: user.status },
    token
  });
});

authRouter.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  const user = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?')
    .bind(email)
    .first<{ email: string }>();

  if (!user) {
    return c.json({ message: 'If the email is registered, your reset link has been dispatched to your email.' });
  }

  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
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

  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';
  try {
    const payload = await verifyToken(token, secret);
    if (!payload || payload.status !== 'reset') {
      return c.json({ detail: 'Invalid or expired reset link.' }, 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    const res = await c.env.DB
      .prepare('UPDATE users SET password = ? WHERE email = ?')
      .bind(hashedPassword, payload.sub)
      .run();

    if (res.meta.changes === 0) {
      return c.json({ detail: 'Account not found.' }, 404);
    }

    return c.json({ message: 'Password reset successfully.' });
  } catch (err: any) {
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
