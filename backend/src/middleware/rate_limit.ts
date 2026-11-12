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
      // In production, never collapse unknown traffic into a single IP. Isolate into an ephemeral key.
      const fwd = c.req.header('x-forwarded-for')?.split(',')[0].trim();
      rawIp = `unverified:${fwd || crypto.randomUUID()}`;
    }
    const now = Date.now();
    // Normalize path to prevent route-alias double-budgeting (/api/xyz vs /xyz)
    const normalizedPath = c.req.path.replace(/^\/api(?=\/|$)/, '') || '/';
    const key = `${normalizedPath}:${rawIp}`;

    const kv = c.env.CACHE_KV;
    const kvKey = `ratelimit:${key}`;
    let record: WindowRecord | null = null;

    if (kv) {
      try {
        const stored = await kv.get(kvKey, 'json');
        if (stored && typeof stored === 'object') {
          record = stored as WindowRecord;
        }
      } catch {}
    }

    if (!record) {
      record = memoryStore.get(key) || null;
    }

    if (!record) {
      record = { prevCount: 0, curCount: 1, curWindowStart: now };
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

    // Save to memory store
    memoryStore.set(key, record);

    // Save to KV with TTL if available
    if (kv) {
      try {
        const ttlSeconds = Math.max(60, Math.ceil((config.windowMs * 2) / 1000));
        await kv.put(kvKey, JSON.stringify(record), { expirationTtl: ttlSeconds });
      } catch {}
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
    return true;
  }

  // When secretKey is provisioned, enforce strict token requirement (token must be non-empty)
  const trimmedToken = (token || '').trim();
  if (!trimmedToken) {
    return false;
  }

  // In non-production environments (development / test), permit local dummy pass tokens
  if (env !== 'production') {
    if (trimmedToken === 'dummy-local-pass-token' || trimmedToken === 'dummy-token' || trimmedToken === '0x4AAAAAAtestdummytoken' || trimmedToken === 'TEST_PASS_TOKEN' || trimmedToken === 'XXXX.DUMMY.TOKEN.XXXX') {
      return true;
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', trimmedToken);

    // Only forward client IP if it is a valid public IP
    const isPublicIp = remoteIp &&
      !remoteIp.startsWith('127.') &&
      remoteIp !== 'localhost' &&
      remoteIp !== '::1' &&
      !remoteIp.startsWith('10.') &&
      !remoteIp.startsWith('192.168.') &&
      !remoteIp.startsWith('172.16.');

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
