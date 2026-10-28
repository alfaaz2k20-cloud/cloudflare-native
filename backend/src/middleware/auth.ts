import { Context, Next } from 'hono';
import { verifyToken } from '../auth/crypto';
import { Env, JwtUserPayload } from '../types';

export async function requireAuth(c: Context<{ Bindings: Env; Variables: { user: JwtUserPayload } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ detail: 'Authentication required' }, 401);
  }

  const token = authHeader.substring(7).trim();
  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';

  try {
    const payload = await verifyToken(token, secret);
    if (!payload || !payload.email) {
      return c.json({ detail: 'Invalid or expired token' }, 401);
    }
    c.set('user', payload as JwtUserPayload);
    await next();
  } catch (err: any) {
    return c.json({ detail: 'Invalid or expired token' }, 401);
  }
}

export async function requireAdmin(c: Context<{ Bindings: Env; Variables: { user: JwtUserPayload } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ detail: 'Administrator access required' }, 401);
  }

  const token = authHeader.substring(7).trim();
  const secret = c.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed-in-production-at-least-32-chars';

  try {
    const payload = await verifyToken(token, secret) as JwtUserPayload;
    if (!payload || !payload.email) {
      return c.json({ detail: 'Invalid or expired administrator token' }, 401);
    }
    if (payload.status !== 'ADMIN') {
      return c.json({ detail: 'Administrator access required' }, 403);
    }
    c.set('user', payload);
    await next();
  } catch (err: any) {
    return c.json({ detail: 'Invalid or expired administrator token' }, 401);
  }
}
