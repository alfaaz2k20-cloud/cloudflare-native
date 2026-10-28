import { Context, Next } from 'hono';
import { Env } from '../types';

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

export function rateLimiter(config: RateLimitConfig) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const key = `${c.req.path}:${ip}`;

    const record = memoryStore.get(key);
    if (!record || now > record.expiresAt) {
      memoryStore.set(key, { count: 1, expiresAt: now + config.windowMs });
    } else {
      if (record.count >= config.limit) {
        return c.json({ detail: 'Rate limit exceeded. Please pause momentarily.' }, 429);
      }
      record.count += 1;
    }

    // Prune stale records if memoryStore grows large
    if (memoryStore.size > 1000) {
      for (const [k, v] of memoryStore.entries()) {
        if (now > v.expiresAt) memoryStore.delete(k);
      }
    }

    await next();
  };
}

export function slidingWindowRateLimit(options: { windowSeconds: number; maxRequests: number; keyPrefix?: string }) {
  return rateLimiter({
    limit: options.maxRequests,
    windowMs: options.windowSeconds * 1000
  });
}

export async function verifyTurnstile(
  token: string | undefined,
  secretKey: string | undefined,
  remoteIp?: string
): Promise<boolean> {
  // If secret key is omitted or dummy development key, allow in development
  if (!secretKey || secretKey.startsWith('1x0000000000000000000000000000000AA')) {
    return true;
  }
  if (!token) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) formData.append('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const data: any = await res.json();
    return !!data.success;
  } catch (err) {
    console.warn('[TURNSTILE] Verification network error:', err);
    return false;
  }
}
