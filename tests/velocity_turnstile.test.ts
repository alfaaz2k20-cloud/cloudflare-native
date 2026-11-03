import { describe, it, expect, beforeEach } from 'vitest';
import { createMockD1 } from './helpers/d1_mock';
import { verifyTurnstile } from '../backend/src/middleware/rate_limit';
import app from '../backend/src/index';

describe('Milestone M1: D1 Federated Auth Schema & Turnstile Security Suite', () => {
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
      expect((user as any).auth_provider).toBe('google.com');
    });

    it('enforces UNIQUE constraint on email across traditional and federated accounts', async () => {
      let threw = false;
      try {
        await mockDb
          .prepare(`
            INSERT INTO users (email, password, full_name, auth_provider)
            VALUES (?, NULL, ?, ?)
          `)
          .bind('admin@alfaaz.com', 'Admin Imposter', 'google.com')
          .run();
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/UNIQUE constraint failed: users.email/);
      }
      expect(threw).toBe(true);
    });

    it('enforces UNIQUE constraint on firebase_uid while permitting multiple NULLs', async () => {
      await mockDb
        .prepare(`
          INSERT INTO users (email, password, full_name, firebase_uid)
          VALUES (?, NULL, ?, ?)
        `)
        .bind('fb1@alfaaz.local', 'User 1', 'uid_shared_999')
        .run();

      let threw = false;
      try {
        await mockDb
          .prepare(`
            INSERT INTO users (email, password, full_name, firebase_uid)
            VALUES (?, NULL, ?, ?)
          `)
          .bind('fb2@alfaaz.local', 'User 2', 'uid_shared_999')
          .run();
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/UNIQUE constraint failed: users.firebase_uid/);
      }
      expect(threw).toBe(true);

      // Multiple NULLs allowed
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

      expect(Number(rows)).toBeGreaterThanOrEqual(4);
    });
  });

  describe('2. Turnstile Bot Verification Gatekeeper Pre-flight', () => {
    it('accepts Cloudflare official test pass key 1x0000000000000000000000000000000AA in development', async () => {
      const turnstileSecret = '1x0000000000000000000000000000000AA';
      const isValid = await verifyTurnstile('dummy-token', turnstileSecret, '127.0.0.1', 'development');
      expect(isValid).toBe(true);
    });

    it('strictly rejects Cloudflare dummy pass key in production (fails closed)', async () => {
      const turnstileSecret = '1x0000000000000000000000000000000AA';
      const isValid = await verifyTurnstile('dummy-token', turnstileSecret, '127.0.0.1', 'production');
      expect(isValid).toBe(false);
    });

    it('rejects missing token when secret is configured', async () => {
      const turnstileSecret = 'dev-test-secret-turnstile-gatekeeper';
      const isValid = await verifyTurnstile(undefined, turnstileSecret, '127.0.0.1', 'development');
      expect(isValid).toBe(false);
    });

    it('rejects empty string or whitespace token when secret is configured', async () => {
      const turnstileSecret = 'dev-test-secret-turnstile-gatekeeper';
      expect(await verifyTurnstile('', turnstileSecret, '127.0.0.1', 'development')).toBe(false);
      expect(await verifyTurnstile('   ', turnstileSecret, '127.0.0.1', 'development')).toBe(false);
    });

    it('fails closed when TURNSTILE_SECRET_KEY is unconfigured in production', async () => {
      const isValid = await verifyTurnstile('any-token', undefined, '127.0.0.1', 'production');
      expect(isValid).toBe(false);
    });
  });

  describe('3. Route-Scoped Content Security Policy (CSP)', () => {
    it('editorial / core routes strictly exclude unsafe-eval and cdn.tailwindcss.com', async () => {
      const res = await app.request('/ping', { method: 'GET' });
      const csp = res.headers.get('content-security-policy') || '';

      expect(csp).toBeTruthy();
      expect(csp).not.toContain('cdn.tailwindcss.com');
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' https://unpkg.com");
    });

    it('/recruit routes include cdn.tailwindcss.com and unsafe-eval for JIT script', async () => {
      const res = await app.request('/recruit/active-role', { method: 'GET' });
      const csp = res.headers.get('content-security-policy') || '';

      expect(csp).toBeTruthy();
      expect(csp).toContain('cdn.tailwindcss.com');
      expect(csp).toContain("'unsafe-eval'");
    });

    it('/research routes include cdn.tailwindcss.com and unsafe-eval for JIT script', async () => {
      const res = await app.request('/research/summary', { method: 'GET' });
      const csp = res.headers.get('content-security-policy') || '';

      expect(csp).toBeTruthy();
      expect(csp).toContain('cdn.tailwindcss.com');
      expect(csp).toContain("'unsafe-eval'");
    });
  });
});
