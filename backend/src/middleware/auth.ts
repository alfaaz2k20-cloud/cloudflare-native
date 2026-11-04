import { Context, Next } from 'hono';
import { verifyToken, getJwtSecret } from '../auth/crypto';
import { Env, JwtUserPayload } from '../types';

export async function requireAuth(c: Context<{ Bindings: Env; Variables: { user: JwtUserPayload } }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ detail: 'Authentication required' }, 401);
  }

  const token = authHeader.substring(7).trim();
  const secret = getJwtSecret(c.env);

  try {
    const payload = await verifyToken(token, secret);
    if (!payload || !payload.email) {
      return c.json({ detail: 'Invalid or expired token' }, 401);
    }
    // Password-reset tokens are single-purpose credentials and must never authenticate a session.
    if (payload.status === 'reset') {
      return c.json({ detail: 'Invalid or expired token' }, 401);
    }

    if (c.env?.DB) {
      const email = payload.email.toLowerCase();
      const sub = payload.sub || email;
      const row = await c.env.DB
        .prepare('SELECT id, email, status, password_reset_at FROM users WHERE LOWER(email) = ? OR LOWER(phone) = ? OR firebase_uid = ?')
        .bind(email, email, sub)
        .first<{ id: number; email: string; status: string; password_reset_at: string | null }>();

      if (row) {
        if (row.password_reset_at) {
          const resetSec = Math.floor(new Date(row.password_reset_at).getTime() / 1000);
          if (payload.iat && payload.iat < resetSec) {
            return c.json({ detail: 'Invalid or expired token' }, 401);
          }
        }
        c.set('user', { ...payload, status: row.status as any });
      } else {
        // User row not found in D1.
        // Check if user was explicitly purged (audit log check)
        const purged = await c.env.DB
          .prepare("SELECT id FROM admin_audit_logs WHERE action = 'PURGE_USER' AND LOWER(target_id) = ?")
          .bind(email)
          .first();
        if (purged) {
          return c.json({ detail: 'User account has been deactivated or deleted' }, 401);
        }

        // In production, reject unrecorded users
        if (c.env.ENV === 'production') {
          return c.json({ detail: 'Invalid or expired token' }, 401);
        }

        // In test/development environment, permit synthetic unseeded tokens for ad-hoc unit tests
        c.set('user', payload as JwtUserPayload);
      }
    } else {
      c.set('user', payload as JwtUserPayload);
    }

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
  const secret = getJwtSecret(c.env);

  try {
    const payload = await verifyToken(token, secret) as JwtUserPayload;
    if (!payload || !payload.email) {
      return c.json({ detail: 'Invalid or expired administrator token' }, 401);
    }
    if (payload.status !== 'ADMIN') {
      return c.json({ detail: 'Administrator access required' }, 403);
    }

    if (c.env?.DB) {
      const email = payload.email.toLowerCase();
      const sub = payload.sub || email;
      const row = await c.env.DB
        .prepare('SELECT id, email, status, password_reset_at FROM users WHERE LOWER(email) = ? OR LOWER(phone) = ? OR firebase_uid = ?')
        .bind(email, email, sub)
        .first<{ id: number; email: string; status: string; password_reset_at: string | null }>();

      if (!row) {
        return c.json({ detail: 'Administrator account not found or deactivated' }, 401);
      }
      if (row.status !== 'ADMIN') {
        return c.json({ detail: 'Administrator access required' }, 403);
      }
      if (row.password_reset_at) {
        const resetSec = Math.floor(new Date(row.password_reset_at).getTime() / 1000);
        if (payload.iat && payload.iat < resetSec) {
          return c.json({ detail: 'Invalid or expired administrator token' }, 401);
        }
      }
      c.set('user', { ...payload, status: row.status as any });
    } else {
      c.set('user', payload);
    }

    await next();
  } catch (err: any) {
    return c.json({ detail: 'Invalid or expired administrator token' }, 401);
  }
}
