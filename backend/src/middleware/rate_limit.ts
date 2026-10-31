import { Context, Next } from 'hono';
import { Env } from '../types';

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const memoryStore = new Map<string, { count: number; expiresAt: number }>();

export function rateLimiter(config: RateLimitConfig) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const rawIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const now = Date.now();
    // Normalize path to prevent route-alias double-budgeting (/api/xyz vs /xyz)
    const normalizedPath = c.req.path.replace(/^\/api(?=\/|$)/, '') || '/';
    const key = `${normalizedPath}:${rawIp}`;

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
  remoteIp?: string,
  env?: string
): Promise<boolean> {
  // Cloudflare always-pass dummy development key
  if (secretKey && secretKey.startsWith('1x0000000000000000000000000000000AA')) {
    return true;
  }
  // In production, strictly fail closed if TURNSTILE_SECRET_KEY is unconfigured to prevent silent bot drop
  if (!secretKey) {
    if (env === 'production') {
      console.error('[TURNSTILE] Critical: TURNSTILE_SECRET_KEY not configured in production environment; failing closed.');
      return false;
    }
    // In development and test environments, bypass with a warning
    return true;
  }
  // When secretKey is provisioned, enforce strict token requirement
  if (!token) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);

    // Only forward client IP if it is a valid public IP (never pass loopback or private ranges to Cloudflare siteverify)
    const isPublicIp = remoteIp &&
      !remoteIp.startsWith('127.') &&
      remoteIp !== 'localhost' &&
      remoteIp !== '::1' &&
      !remoteIp.startsWith('10.') &&
      !remoteIp.startsWith('192.168.') &&
      !remoteIp.startsWith('172.16.') &&
      !remoteIp.startsWith('172.17.') &&
      !remoteIp.startsWith('172.18.') &&
      !remoteIp.startsWith('172.19.') &&
      !remoteIp.startsWith('172.20.') &&
      !remoteIp.startsWith('172.21.') &&
      !remoteIp.startsWith('172.22.') &&
      !remoteIp.startsWith('172.23.') &&
      !remoteIp.startsWith('172.24.') &&
      !remoteIp.startsWith('172.25.') &&
      !remoteIp.startsWith('172.26.') &&
      !remoteIp.startsWith('172.27.') &&
      !remoteIp.startsWith('172.28.') &&
      !remoteIp.startsWith('172.29.') &&
      !remoteIp.startsWith('172.30.') &&
      !remoteIp.startsWith('172.31.');

    if (isPublicIp) {
      formData.append('remoteip', remoteIp);
    }

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
