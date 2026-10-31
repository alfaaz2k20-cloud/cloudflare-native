export type VelocityDenialReason =
  | 'INVALID_PHONE_FORMAT'
  | 'COOLDOWN_ACTIVE'
  | 'PHONE_DAILY_LIMIT_EXCEEDED'
  | 'IP_DAILY_LIMIT_EXCEEDED';

export interface VelocityCheckResult {
  allowed: boolean;
  reason?: VelocityDenialReason;
  retryAfter?: number;
  error?: string;
  normalizedPhone?: string;
}

/**
 * Normalizes a phone number by trimming and stripping common separators
 * (spaces, hyphens, parentheses, dots), then validates against ITU E.164
 * international standard format (+[1-9]\d{6,14}).
 */
export function normalizeAndValidatePhone(phone: string): { isValid: boolean; normalized: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '' };
  }

  const cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  const E164_REGEX = /^\+[1-9]\d{6,14}$/;
  const isValid = E164_REGEX.test(cleaned);

  return {
    isValid,
    normalized: isValid ? cleaned : ''
  };
}

/**
 * Normalizes client IP address to a lowercase trimmed string, falling back to 127.0.0.1.
 */
export function normalizeIp(ip?: string): string {
  if (!ip || typeof ip !== 'string') return '127.0.0.1';
  const clean = ip.trim().toLowerCase();
  return clean || '127.0.0.1';
}

interface VelocityStateRow {
  phone_elapsed_seconds: number | null;
  phone_daily_count: number;
  ip_daily_count: number;
}

/**
 * Evaluates multi-dimensional velocity rate limits in Cloudflare D1 SQLite
 * and atomically records the OTP dispatch attempt if within limits.
 *
 * Enforces R3 limits:
 * - 60-second cooldown per phone number (max 1 SMS/60s)
 * - Max 5 SMS per 24 hours per phone number
 * - Max 5 SMS per 24 hours per client IP
 */
export async function checkAndRecordOtpVelocity(
  db: D1Database,
  phone: string,
  ip: string
): Promise<VelocityCheckResult> {
  // 1. Phone validation & normalization
  const phoneCheck = normalizeAndValidatePhone(phone);
  if (!phoneCheck.isValid) {
    return {
      allowed: false,
      reason: 'INVALID_PHONE_FORMAT',
      error: 'Invalid phone number format. Must be E.164.'
    };
  }
  const cleanPhone = phoneCheck.normalized;
  const cleanIp = normalizeIp(ip);

  // 2. Query diagnostic state across cooldown and daily quotas in a single round-trip
  const checkSql = `
    SELECT
      (SELECT CAST(strftime('%s', 'now') - strftime('%s', created_at) AS INTEGER)
       FROM otp_velocity_logs WHERE phone = ? ORDER BY created_at DESC LIMIT 1) AS phone_elapsed_seconds,
      (SELECT COUNT(*) FROM otp_velocity_logs
       WHERE phone = ? AND created_at >= datetime('now', '-24 hours')) AS phone_daily_count,
      (SELECT COUNT(*) FROM otp_velocity_logs
       WHERE ip = ? AND created_at >= datetime('now', '-24 hours')) AS ip_daily_count;
  `;

  const state = await db
    .prepare(checkSql)
    .bind(cleanPhone, cleanPhone, cleanIp)
    .first<VelocityStateRow>();

  if (state) {
    // Check 60-second cooldown per phone
    if (state.phone_elapsed_seconds !== null && state.phone_elapsed_seconds < 60) {
      const retryAfter = Math.min(60, Math.max(1, 60 - state.phone_elapsed_seconds));
      return {
        allowed: false,
        reason: 'COOLDOWN_ACTIVE',
        retryAfter,
        error: 'Rate limit exceeded. Please wait 60 seconds before requesting another SMS.',
        normalizedPhone: cleanPhone
      };
    }

    // Check 24-hour phone quota (max 5)
    if (state.phone_daily_count >= 5) {
      return {
        allowed: false,
        reason: 'PHONE_DAILY_LIMIT_EXCEEDED',
        error: 'Daily SMS limit exceeded (max 5 per day).',
        normalizedPhone: cleanPhone
      };
    }

    // Check 24-hour IP quota (max 5)
    if (state.ip_daily_count >= 5) {
      return {
        allowed: false,
        reason: 'IP_DAILY_LIMIT_EXCEEDED',
        error: 'Daily SMS limit exceeded (max 5 per day).',
        normalizedPhone: cleanPhone
      };
    }
  }

  // 3. Atomic conditional insert to prevent race conditions during concurrent bursts
  const insertSql = `
    INSERT INTO otp_velocity_logs (phone, ip, created_at)
    SELECT ?, ?, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (
      SELECT 1 FROM otp_velocity_logs
      WHERE phone = ? AND created_at > datetime('now', '-60 seconds')
    )
    AND (
      SELECT COUNT(*) FROM otp_velocity_logs
      WHERE phone = ? AND created_at >= datetime('now', '-24 hours')
    ) < 5
    AND (
      SELECT COUNT(*) FROM otp_velocity_logs
      WHERE ip = ? AND created_at >= datetime('now', '-24 hours')
    ) < 5;
  `;

  const info = await db
    .prepare(insertSql)
    .bind(cleanPhone, cleanIp, cleanPhone, cleanPhone, cleanIp)
    .run();

  const changes = info?.meta?.changes ?? (info as any)?.changes ?? 0;
  if (changes === 0) {
    // Concurrent race condition prevented by atomic conditional insert
    return {
      allowed: false,
      reason: 'COOLDOWN_ACTIVE',
      retryAfter: 60,
      error: 'Rate limit exceeded. Please wait 60 seconds before requesting another SMS.',
      normalizedPhone: cleanPhone
    };
  }

  return {
    allowed: true,
    normalizedPhone: cleanPhone
  };
}

export const checkAndRecordVelocity = checkAndRecordOtpVelocity;
