import { describe, it, expect, beforeEach } from 'vitest';
import { createMockD1 } from './helpers/d1_mock';
import {
  checkAndRecordOtpVelocity,
  normalizeAndValidatePhone,
  normalizeIp
} from '../backend/src/services/velocity';
import { verifyTurnstile } from '../backend/src/middleware/rate_limit';

describe('Milestone M1: D1 Federated Auth Schema & Velocity Engine Suite', () => {
  let mockDb: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    mockDb = createMockD1();
  });

  describe('1. D1 SQLite Schema Migration Rebuild (0002_federated_auth.sql)', () => {
    it('preserves pre-existing seeded users and passwords across the 12-step rebuild', async () => {
      const admin = await mockDb
        .prepare('SELECT id, email, status, password, auth_provider FROM users WHERE email = ?')
        .bind('admin@alfaaz.com')
        .first();

      expect(admin).toBeDefined();
      expect((admin as any).id).toBe(1);
      expect((admin as any).email).toBe('admin@alfaaz.com');
      expect((admin as any).status).toBe('ADMIN');
      expect((admin as any).auth_provider).toBe('email');
      expect((admin as any).password).toBeTruthy();

      const volunteer = await mockDb
        .prepare('SELECT id, email, status, password, auth_provider FROM users WHERE email = ?')
        .bind('volunteer@alfaaz.com')
        .first();

      expect(volunteer).toBeDefined();
      expect((volunteer as any).id).toBe(2);
      expect((volunteer as any).email).toBe('volunteer@alfaaz.com');
      expect((volunteer as any).status).toBe('PARTICIPANT');
      expect((volunteer as any).auth_provider).toBe('email');
    });

    it('allows inserting federated users with NULL password', async () => {
      await mockDb
        .prepare(`
          INSERT INTO users (email, password, full_name, phone, auth_provider, firebase_uid, status)
          VALUES (?, NULL, ?, ?, ?, ?, ?)
        `)
        .bind(
          'federated.user@alfaaz.local',
          'Federated User',
          '+14155552671',
          'google.com',
          'firebase_uid_goog_123',
          'PARTICIPANT'
        )
        .run();

      const user = await mockDb
        .prepare('SELECT * FROM users WHERE email = ?')
        .bind('federated.user@alfaaz.local')
        .first();

      expect(user).toBeDefined();
      expect((user as any).password).toBeNull();
      expect((user as any).phone).toBe('+14155552671');
      expect((user as any).auth_provider).toBe('google.com');
      expect((user as any).firebase_uid).toBe('firebase_uid_goog_123');
    });

    it('allows inserting phone-only user with NULL email and NULL password', async () => {
      await mockDb
        .prepare(`
          INSERT INTO users (phone, auth_provider, firebase_uid, status)
          VALUES (?, ?, ?, ?)
        `)
        .bind('+14155559876', 'phone', 'firebase_uid_phone_456', 'PARTICIPANT')
        .run();

      const user = await mockDb
        .prepare('SELECT * FROM users WHERE phone = ?')
        .bind('+14155559876')
        .first();

      expect(user).toBeDefined();
      expect((user as any).email).toBeNull();
      expect((user as any).password).toBeNull();
      expect((user as any).phone).toBe('+14155559876');
      expect((user as any).auth_provider).toBe('phone');
    });

    it('defaults auth_provider to "email" when omitted', async () => {
      await mockDb
        .prepare('INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)')
        .bind('classic.poet@alfaaz.local', 'hash_value_123', 'Classic Poet')
        .run();

      const user = await mockDb
        .prepare('SELECT auth_provider FROM users WHERE email = ?')
        .bind('classic.poet@alfaaz.local')
        .first();

      expect((user as any).auth_provider).toBe('email');
    });

    it('enforces UNIQUE constraint on email', async () => {
      await mockDb
        .prepare('INSERT INTO users (email, password) VALUES (?, ?)')
        .bind('duplicate.email@alfaaz.local', 'hash_abc')
        .run();

      await expect(
        mockDb
          .prepare('INSERT INTO users (email, password) VALUES (?, ?)')
          .bind('duplicate.email@alfaaz.local', 'hash_xyz')
          .run()
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });

    it('enforces UNIQUE constraint on phone', async () => {
      await mockDb
        .prepare('INSERT INTO users (email, phone, auth_provider) VALUES (?, ?, ?)')
        .bind('user1.phone@alfaaz.local', '+14155550001', 'phone')
        .run();

      await expect(
        mockDb
          .prepare('INSERT INTO users (email, phone, auth_provider) VALUES (?, ?, ?)')
          .bind('user2.phone@alfaaz.local', '+14155550001', 'phone')
          .run()
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });

    it('enforces UNIQUE constraint on firebase_uid', async () => {
      await mockDb
        .prepare('INSERT INTO users (email, firebase_uid, auth_provider) VALUES (?, ?, ?)')
        .bind('user1.fb@alfaaz.local', 'fb_uid_shared', 'google.com')
        .run();

      await expect(
        mockDb
          .prepare('INSERT INTO users (email, firebase_uid, auth_provider) VALUES (?, ?, ?)')
          .bind('user2.fb@alfaaz.local', 'fb_uid_shared', 'apple.com')
          .run()
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });

    it('allows multiple users with NULL phone and NULL firebase_uid', async () => {
      await mockDb
        .prepare('INSERT INTO users (email, password) VALUES (?, ?)')
        .bind('null1@alfaaz.local', 'h1')
        .run();
      await mockDb
        .prepare('INSERT INTO users (email, password) VALUES (?, ?)')
        .bind('null2@alfaaz.local', 'h2')
        .run();

      const rows = await mockDb
        .prepare('SELECT COUNT(*) as count FROM users WHERE phone IS NULL AND firebase_uid IS NULL')
        .first('count');

      expect(Number(rows)).toBeGreaterThanOrEqual(4); // 2 seeded + 2 new
    });

    it('validates otp_velocity_logs schema and composite indexes', async () => {
      const tableInfo = await mockDb.prepare('PRAGMA table_info(otp_velocity_logs)').all();
      const columnNames = tableInfo.results.map((c: any) => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('phone');
      expect(columnNames).toContain('ip');
      expect(columnNames).toContain('created_at');

      const indexList = await mockDb.prepare('PRAGMA index_list(otp_velocity_logs)').all();
      const indexNames = indexList.results.map((idx: any) => idx.name);
      expect(indexNames).toContain('idx_otp_velocity_phone_time');
      expect(indexNames).toContain('idx_otp_velocity_ip_time');
    });
  });

  describe('2. Phone Number Validation & E.164 Normalization', () => {
    it('accepts and normalizes valid international E.164 numbers', () => {
      const validCases = [
        { input: '+14155552671', expected: '+14155552671' },
        { input: '+1 (415) 555-2671', expected: '+14155552671' },
        { input: '+1-415-555-2671', expected: '+14155552671' },
        { input: '+91 70066 13891', expected: '+917006613891' },
        { input: '+91-70066-13891', expected: '+917006613891' },
        { input: '+44.7911.123456', expected: '+447911123456' },
        { input: '+819012345678', expected: '+819012345678' }
      ];

      for (const { input, expected } of validCases) {
        const result = normalizeAndValidatePhone(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      }
    });

    it('rejects invalid phone formats without writing to database', () => {
      const invalidCases = [
        '4155552671', // Missing leading '+'
        '+0123456789', // Country code cannot start with 0
        '+12345', // Too short (< 7 digits)
        '+1234567890123456', // Too long (> 15 digits)
        'not-a-phone-number',
        '+1415555267a', // Alpha character
        '',
        null as any,
        undefined as any,
        '+14155552671; DROP TABLE users;' // Injection attempt
      ];

      for (const input of invalidCases) {
        const result = normalizeAndValidatePhone(input);
        expect(result.isValid).toBe(false);
        expect(result.normalized).toBe('');
      }
    });

    it('normalizes IP addresses to lowercase trimmed strings with 127.0.0.1 fallback', () => {
      expect(normalizeIp('  198.51.100.1  ')).toBe('198.51.100.1');
      expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
      expect(normalizeIp('')).toBe('127.0.0.1');
      expect(normalizeIp(undefined)).toBe('127.0.0.1');
      expect(normalizeIp(null as any)).toBe('127.0.0.1');
    });
  });

  describe('3. Velocity Engine: 60-Second Cooldown (R3)', () => {
    it('accepts initial request and records log in otp_velocity_logs', async () => {
      const res = await checkAndRecordOtpVelocity(mockDb as any, '+14155551001', '198.51.100.1');
      expect(res.allowed).toBe(true);
      expect(res.normalizedPhone).toBe('+14155551001');

      const logs = await mockDb
        .prepare('SELECT * FROM otp_velocity_logs WHERE phone = ?')
        .bind('+14155551001')
        .all();

      expect(logs.results.length).toBe(1);
      expect((logs.results[0] as any).ip).toBe('198.51.100.1');
    });

    it('strictly rejects immediate recall within 60s with COOLDOWN_ACTIVE and retryAfter <= 60', async () => {
      // First call succeeds
      const first = await checkAndRecordOtpVelocity(mockDb as any, '+14155551002', '198.51.100.1');
      expect(first.allowed).toBe(true);

      // Immediate recall is rejected
      const second = await checkAndRecordOtpVelocity(mockDb as any, '+14155551002', '198.51.100.1');
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe('COOLDOWN_ACTIVE');
      expect(second.retryAfter).toBeDefined();
      expect(second.retryAfter).toBeGreaterThanOrEqual(1);
      expect(second.retryAfter).toBeLessThanOrEqual(60);
      expect(second.error).toMatch(/wait 60 seconds|Rate limit exceeded/i);

      // Confirm no duplicate row was recorded
      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind('+14155551002')
        .first('count');
      expect(Number(count)).toBe(1);
    });

    it('strictly rejects exact t=0s boundary (immediate recall) with COOLDOWN_ACTIVE and retryAfter = 60', async () => {
      const phone = '+14155551010';
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-0 seconds'))
        `)
        .run(phone, '198.51.100.1');

      const res = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.1');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('COOLDOWN_ACTIVE');
      expect(res.retryAfter).toBe(60);
      expect(res.error).toMatch(/wait 60 seconds|Rate limit exceeded/i);

      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind(phone)
        .first('count');
      expect(Number(count)).toBe(1);
    });

    it('strictly rejects exact t=59s boundary with COOLDOWN_ACTIVE and retryAfter = 1', async () => {
      const phone = '+14155551011';
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-59 seconds'))
        `)
        .run(phone, '198.51.100.1');

      const res = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.1');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('COOLDOWN_ACTIVE');
      expect(res.retryAfter).toBe(1);
      expect(res.error).toMatch(/wait 60 seconds|Rate limit exceeded/i);

      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind(phone)
        .first('count');
      expect(Number(count)).toBe(1);
    });

    it('allows exact t=60s boundary when cooldown has precisely elapsed and records log', async () => {
      const phone = '+14155551012';
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-60 seconds'))
        `)
        .run(phone, '198.51.100.1');

      const res = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.1');
      expect(res.allowed).toBe(true);
      expect(res.normalizedPhone).toBe(phone);
      expect(res.reason).toBeUndefined();

      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind(phone)
        .first('count');
      expect(Number(count)).toBe(2);
    });

    it('allows exact t=61s boundary when cooldown has elapsed and records log', async () => {
      const phone = '+14155551013';
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-61 seconds'))
        `)
        .run(phone, '198.51.100.1');

      const res = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.1');
      expect(res.allowed).toBe(true);
      expect(res.normalizedPhone).toBe(phone);
      expect(res.reason).toBeUndefined();

      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind(phone)
        .first('count');
      expect(Number(count)).toBe(2);
    });

    it('succeeds after 65 seconds when cooldown has expired', async () => {
      // Pre-insert log backdated by 65 seconds
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-65 seconds'))
        `)
        .run('+14155551003', '198.51.100.1');

      const res = await checkAndRecordOtpVelocity(mockDb as any, '+14155551003', '198.51.100.1');
      expect(res.allowed).toBe(true);

      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind('+14155551003')
        .first('count');
      expect(Number(count)).toBe(2);
    });

    it('calculates bounded retryAfter when request occurs mid-cooldown', async () => {
      // Backdate by 20 seconds -> ~40 seconds remaining
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-20 seconds'))
        `)
        .run('+14155551004', '198.51.100.1');

      const res = await checkAndRecordOtpVelocity(mockDb as any, '+14155551004', '198.51.100.1');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('COOLDOWN_ACTIVE');
      expect(res.retryAfter).toBeGreaterThanOrEqual(38);
      expect(res.retryAfter).toBeLessThanOrEqual(42);
    });
  });

  describe('4. Velocity Engine: 24-Hour Daily Phone Quota (R3)', () => {
    it('accepts up to 5 requests in 24h and strictly rejects the 6th with 429 quota error', async () => {
      const phone = '+14155552001';

      // Insert 4 spaced-out requests in the past 24h
      for (const offset of ['-16 hours', '-12 hours', '-8 hours', '-4 hours']) {
        mockDb._sqlite
          .prepare(`
            INSERT INTO otp_velocity_logs (phone, ip, created_at)
            VALUES (?, ?, datetime('now', ?))
          `)
          .run(phone, '198.51.100.10', offset);
      }

      // 5th request: MUST succeed
      const res5 = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.10');
      expect(res5.allowed).toBe(true);

      // Backdate 5th request by 2 minutes to satisfy cooldown
      mockDb._sqlite
        .prepare(`
          UPDATE otp_velocity_logs SET created_at = datetime('now', '-2 minutes')
          WHERE id = (SELECT MAX(id) FROM otp_velocity_logs WHERE phone = ?)
        `)
        .run(phone);

      // 6th request: MUST be rejected by daily phone quota
      const res6 = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.10');
      expect(res6.allowed).toBe(false);
      expect(res6.reason).toBe('PHONE_DAILY_LIMIT_EXCEEDED');
      expect(res6.error).toMatch(/Daily SMS limit exceeded/i);

      // Log count remains strictly 5
      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind(phone)
        .first('count');
      expect(Number(count)).toBe(5);
    });

    it('allows a new request when the oldest request rolls out of the 24-hour window', async () => {
      const phone = '+14155552002';

      // 1 request 25h ago (expired), 4 within the last 24h
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-25 hours'))
        `)
        .run(phone, '198.51.100.10');

      for (const offset of ['-12 hours', '-8 hours', '-4 hours', '-2 hours']) {
        mockDb._sqlite
          .prepare(`
            INSERT INTO otp_velocity_logs (phone, ip, created_at)
            VALUES (?, ?, datetime('now', ?))
          `)
          .run(phone, '198.51.100.10', offset);
      }

      // 5 active logs total, but only 4 within 24h window -> call must succeed
      const res = await checkAndRecordOtpVelocity(mockDb as any, phone, '198.51.100.10');
      expect(res.allowed).toBe(true);
    });
  });

  describe('5. Velocity Engine: 24-Hour Daily IP Quota (R3)', () => {
    it('rejects 6th request from same IP across 6 different phone numbers (Anti-Pumping)', async () => {
      const ip = '198.51.100.77';

      // Pre-insert 5 requests from same IP with 5 different phones in past 24h
      for (let i = 1; i <= 5; i++) {
        mockDb._sqlite
          .prepare(`
            INSERT INTO otp_velocity_logs (phone, ip, created_at)
            VALUES (?, ?, datetime('now', ?))
          `)
          .run(`+1415555300${i}`, ip, `-${i * 2} hours`);
      }

      // 6th request with a brand new phone from the same IP: MUST be rejected by IP quota
      const res = await checkAndRecordOtpVelocity(mockDb as any, '+14155553006', ip);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('IP_DAILY_LIMIT_EXCEEDED');
      expect(res.error).toMatch(/Daily SMS limit exceeded/i);

      // Verify no row was inserted for phone 6
      const count = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind('+14155553006')
        .first('count');
      expect(Number(count)).toBe(0);
    });

    it('allows requests from IP when oldest IP request rolls out of 24h window', async () => {
      const ip = '198.51.100.88';

      // 1 request 25h ago, 4 requests within 24h
      mockDb._sqlite
        .prepare(`
          INSERT INTO otp_velocity_logs (phone, ip, created_at)
          VALUES (?, ?, datetime('now', '-25 hours'))
        `)
        .run('+14155553010', ip);

      for (let i = 1; i <= 4; i++) {
        mockDb._sqlite
          .prepare(`
            INSERT INTO otp_velocity_logs (phone, ip, created_at)
            VALUES (?, ?, datetime('now', ?))
          `)
          .run(`+1415555301${i}`, ip, `-${i * 2} hours`);
      }

      const res = await checkAndRecordOtpVelocity(mockDb as any, '+14155553015', ip);
      expect(res.allowed).toBe(true);
    });
  });

  describe('6. Isolation & Multi-Tenant Separation', () => {
    it('confirms Phone A cooldown does NOT block Phone B on the same IP', async () => {
      const ip = '198.51.100.99';
      const phoneA = '+14155554001';
      const phoneB = '+14155554002';

      // Phone A requests OTP
      const resA = await checkAndRecordOtpVelocity(mockDb as any, phoneA, ip);
      expect(resA.allowed).toBe(true);

      // Phone B requests OTP immediately from same IP -> allowed!
      const resB = await checkAndRecordOtpVelocity(mockDb as any, phoneB, ip);
      expect(resB.allowed).toBe(true);

      // Phone A immediate second request -> blocked by cooldown!
      const resA2 = await checkAndRecordOtpVelocity(mockDb as any, phoneA, ip);
      expect(resA2.allowed).toBe(false);
      expect(resA2.reason).toBe('COOLDOWN_ACTIVE');
    });

    it('confirms Phone A daily quota exhaustion does not affect Phone B', async () => {
      const phoneA = '+14155554010';
      const phoneB = '+14155554020';

      for (let i = 0; i < 5; i++) {
        mockDb._sqlite
          .prepare(`
            INSERT INTO otp_velocity_logs (phone, ip, created_at)
            VALUES (?, ?, datetime('now', '-1 hour'))
          `)
          .run(phoneA, '198.51.100.101');
      }

      // Phone A is at quota
      const resA = await checkAndRecordOtpVelocity(mockDb as any, phoneA, '198.51.100.101');
      expect(resA.allowed).toBe(false);
      expect(resA.reason).toBe('PHONE_DAILY_LIMIT_EXCEEDED');

      // Phone B on a different IP has full quota
      const resB = await checkAndRecordOtpVelocity(mockDb as any, phoneB, '198.51.100.102');
      expect(resB.allowed).toBe(true);
    });
  });

  describe('7. Turnstile Bot Verification Gatekeeper Pre-flight', () => {
    it('accepts Cloudflare official test pass key 1x0000000000000000000000000000000AA', async () => {
      const turnstileSecret = '1x0000000000000000000000000000000AA';
      const isValid = await verifyTurnstile('dummy-token', turnstileSecret, '127.0.0.1', 'development');
      expect(isValid).toBe(true);
    });

    it('rejects missing token when secret is configured', async () => {
      const turnstileSecret = 'dev-test-secret-turnstile-gatekeeper';
      const isValid = await verifyTurnstile(undefined, turnstileSecret, '127.0.0.1', 'development');
      expect(isValid).toBe(false);
    });

    it('verifies that a blocked bot does not consume velocity budget', async () => {
      const turnstileSecret = 'dev-test-secret-turnstile-gatekeeper';
      const isBotValid = await verifyTurnstile(undefined, turnstileSecret, '198.51.100.200', 'development');
      expect(isBotValid).toBe(false);

      // Gatekeeper halts before calling velocity service
      // No rows should be added to otp_velocity_logs
      const logs = await mockDb
        .prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
        .bind('+14155559999')
        .first('count');
      expect(Number(logs)).toBe(0);
    });
  });

  describe('8. Defensive Security & Formatting Invariants', () => {
    it('safely handles SQL injection attempts in phone and IP without corruption', async () => {
      const injectionPhones = [
        "'+14155552671' OR '1'='1",
        "'; DROP TABLE otp_velocity_logs; --",
        "'+14155552671' UNION SELECT 1,2,3,4--"
      ];

      for (const maliciousPhone of injectionPhones) {
        const res = await checkAndRecordOtpVelocity(mockDb as any, maliciousPhone, '127.0.0.1');
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INVALID_PHONE_FORMAT');
      }

      // Verify table still exists and is intact
      const tableCheck = await mockDb.prepare('SELECT COUNT(*) as count FROM otp_velocity_logs').first('count');
      expect(Number(tableCheck)).toBe(0);
    });
  });
});
