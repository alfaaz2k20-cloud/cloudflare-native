import { Context, Next } from 'hono';
import { Env } from '../types';

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

interface WindowRecord {
  prevCount: number;
  curCount: number;
  curWindowStart: number;
}

const memoryStore = new Map<string, WindowRecord>();

export function rateLimiter(config: RateLimitConfig) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Never rate limit CORS preflight OPTIONS requests
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    // Trust cf-connecting-ip from the Cloudflare edge; fall back to client-supplied
    // x-forwarded-for in test/development environments (AGENTS.md §3).
    // In production, prevent unverified edge clients from collapsing into a single
    // shared 127.0.0.1 bucket by isolating unverified traffic or failing closed when enforced.
    const cfIp = c.req.header('cf-connecting-ip');
    let rawIp: string;

    if (cfIp) {
      rawIp = cfIp.trim();
    } else if (c.env.ENV === 'test' || c.env.ENV === 'development') {
      rawIp = c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    } else {
      if ((c.env as any).FAIL_CLOSED_EDGE_IP) {
        return c.json({ detail: 'Edge client IP verification required.' }, 403);
      }
      // Fallback: isolate into an ephemeral client identifier rather than a shared 127.0.0.1 bucket
      const fwd = c.req.header('x-forwarded-for')?.split(',')[0].trim();
      rawIp = `unverified:${fwd || crypto.randomUUID()}`;
    }
    const now = Date.now();
    // Normalize path to prevent route-alias double-budgeting (/api/xyz vs /xyz)
    const normalizedPath = c.req.path.replace(/^\/api(?=\/|$)/, '') || '/';
    const key = `${normalizedPath}:${rawIp}`;

    let record = memoryStore.get(key);
    if (!record) {
      record = { prevCount: 0, curCount: 1, curWindowStart: now };
      memoryStore.set(key, record);
    } else {
      // Advance sliding window if needed
      if (now >= record.curWindowStart + config.windowMs) {
        if (now < record.curWindowStart + 2 * config.windowMs) {
          record.prevCount = record.curCount;
          record.curCount = 0;
          record.curWindowStart += config.windowMs;
        } else {
          record.prevCount = 0;
          record.curCount = 0;
          record.curWindowStart = now;
        }
      }

      // Compute weighted rate within sliding window
      const timeIntoCurWindow = now - record.curWindowStart;
      const weight = Math.max(0, (config.windowMs - timeIntoCurWindow) / config.windowMs);
      const effectiveCount = Math.floor(record.prevCount * weight) + record.curCount;

      if (effectiveCount >= config.limit) {
        return c.json({ detail: 'Rate limit exceeded. Please pause momentarily.' }, 429);
      }
      record.curCount += 1;
    }

    // Prune stale records if memoryStore grows large (> 1000 entries)
    if (memoryStore.size > 1000) {
      for (const [k, v] of memoryStore.entries()) {
        if (now > v.curWindowStart + 2 * config.windowMs) memoryStore.delete(k);
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
  // Cloudflare official dummy fail secret key always fails
  if (secretKey && secretKey.startsWith('2x0000000000000000000000000000000AA')) {
    return false;
  }

  // Cloudflare official dummy pass secret key is strictly rejected in production (fail-closed)
  if (secretKey && secretKey.startsWith('1x0000000000000000000000000000000AA')) {
    if (env === 'production') {
      console.warn('[TURNSTILE] Security Alert: Dummy pass secret rejected in production environment; failing closed.');
      return false;
    }
    return true;
  }

  // In production, strictly fail closed if TURNSTILE_SECRET_KEY is unconfigured to prevent silent bot drop
  if (!secretKey) {
    if (env === 'production') {
      console.error('[TURNSTILE] Critical: TURNSTILE_SECRET_KEY not configured in production environment; failing closed.');
      return false;
    }
    // In development and test environments without secret key, bypass with a warning
    return true;
  }

  // When secretKey is provisioned, enforce strict token requirement (token must be non-empty)
  const trimmedToken = (token || '').trim();
  if (!trimmedToken) {
    return false;
  }

  // In non-production environments (development / test), permit local dummy pass tokens
  if (env !== 'production') {
    if (trimmedToken === 'dummy-local-pass-token' || trimmedToken === 'dummy-token' || trimmedToken === '0x4AAAAAAtestdummytoken') {
      return true;
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', trimmedToken);

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
