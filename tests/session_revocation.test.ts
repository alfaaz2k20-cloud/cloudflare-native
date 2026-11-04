import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1 } from './helpers/d1_mock';
import { createToken, hashPassword } from '../backend/src/auth/crypto';

describe('Sprint 2: Session Revocation & Email Verification Unwind Suite', () => {
  let mockDb: any;
  const jwtSecret = 'test-jwt-secret-key-32-chars-minimum-safe';

  function getTestEnv() {
    return {
      DB: mockDb,
      JWT_SECRET: jwtSecret,
      ENV: 'test'
    };
  }

  beforeEach(async () => {
    mockDb = createMockD1();
  });

  describe('1. Live Role Verification & Demoted Admin Revocation', () => {
    it('demoted admin token (bearing ADMIN claim) returns 403 when D1 status is PARTICIPANT', async () => {
      const email = 'temp_admin@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, full_name, status) VALUES (?, ?, ?)')
        .bind(email, 'Temporary Admin', 'ADMIN')
        .run();

      // Mint token with ADMIN claim
      const adminToken = await createToken({ email, status: 'ADMIN' }, jwtSecret);

      // Verify access granted initially
      const resInitial = await app.request('/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(resInitial.status).toBe(200);

      // Demote admin to PARTICIPANT in D1
      await mockDb.prepare('UPDATE users SET status = ? WHERE email = ?')
        .bind('PARTICIPANT', email)
        .run();

      // Same token must now be rejected with 403 by requireAdmin
      const resDemoted = await app.request('/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(resDemoted.status).toBe(403);
      const data = await resDemoted.json();
      expect(data.detail).toMatch(/administrator access required/i);
    });
  });

  describe('2. Password Reset Invalidation (Pre-Reset Token Revocation)', () => {
    it('rejects pre-reset tokens with 401 while permitting post-reset tokens', async () => {
      const email = 'password_reset_user@alfaaz.local';
      const initialPassword = await hashPassword('InitialPass123!');
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind(email, initialPassword, 'Reset User', 'PARTICIPANT')
        .run();

      // Mint pre-reset token with iat = now - 60s
      const pastIat = Math.floor(Date.now() / 1000) - 60;
      const oldToken = await createToken({ email, status: 'PARTICIPANT', iat: pastIat }, jwtSecret);

      // Verify old token works before reset
      const resBefore = await app.request('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${oldToken}` }
      }, getTestEnv());
      expect(resBefore.status).toBe(200);

      // Perform password reset: sets password_reset_at in D1
      const resetIso = new Date().toISOString();
      await mockDb.prepare('UPDATE users SET password_reset_at = ? WHERE email = ?')
        .bind(resetIso, email)
        .run();

      // Old token must now be rejected with 401
      const resAfter = await app.request('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${oldToken}` }
      }, getTestEnv());
      expect(resAfter.status).toBe(401);
      const dataAfter = await resAfter.json();
      expect(dataAfter.detail).toMatch(/invalid or expired token/i);

      // Newly issued token (iat = now) must succeed
      const freshToken = await createToken({ email, status: 'PARTICIPANT' }, jwtSecret);
      const resFresh = await app.request('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${freshToken}` }
      }, getTestEnv());
      expect(resFresh.status).toBe(200);
      const freshData = await resFresh.json();
      expect(freshData.email).toBe(email);
    });
  });

  describe('3. Deleted User Account Invalidation', () => {
    it('rejects tokens for purged users with 401', async () => {
      const email = 'purge_target@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, full_name, status) VALUES (?, ?, ?)')
        .bind(email, 'Purge Target', 'PARTICIPANT')
        .run();

      const userToken = await createToken({ email, status: 'PARTICIPANT' }, jwtSecret);

      // Token works before deletion
      const resBefore = await app.request('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${userToken}` }
      }, getTestEnv());
      expect(resBefore.status).toBe(200);

      // Admin deletes user via DELETE /admin/users/:email
      const adminToken = await createToken({ email: 'admin@alfaaz.com', status: 'ADMIN' }, jwtSecret);
      const resDelete = await app.request(`/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(resDelete.status).toBe(200);

      // Purged user's token is immediately rejected with 401
      const resAfter = await app.request('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${userToken}` }
      }, getTestEnv());
      expect(resAfter.status).toBe(401);
    });
  });

  describe('4. Migration 0006: Unwind Migration 0003 False Email Verification', () => {
    it('unwinds email_verified for password accounts without consumed verification records', async () => {
      // Simulate historical migration 0003 backfill:
      // Insert user with password and email_verified = 1, but NO consumed code
      await mockDb.prepare(`
        INSERT INTO users (email, password, full_name, status, auth_provider, email_verified, email_verified_at)
        VALUES ('historical@alfaaz.local', 'hash_pass', 'Historical User', 'PARTICIPANT', 'email', 1, '2026-10-31 03:25:00')
      `).run();

      // Insert user with password and genuine consumed verification code
      await mockDb.prepare(`
        INSERT INTO users (id, email, password, full_name, status, auth_provider, email_verified, email_verified_at)
        VALUES (888, 'verified@alfaaz.local', 'hash_pass', 'Verified User', 'PARTICIPANT', 'email', 1, '2026-10-31 04:00:00')
      `).run();
      await mockDb.prepare(`
        INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at, consumed_at)
        VALUES (888, 'email', 'verified@alfaaz.local', 'hash123', '2026-10-31 04:10:00', '2026-10-31 04:00:00')
      `).run();

      // Run migration 0006 remediation query
      await mockDb.prepare(`
        UPDATE users
        SET email_verified = 0, email_verified_at = NULL
        WHERE password IS NOT NULL
          AND auth_provider = 'email'
          AND id NOT IN (
            SELECT user_id FROM verification_codes
            WHERE purpose = 'email' AND consumed_at IS NOT NULL
          )
      `).run();

      // Historical user without consumed code must be unwound to email_verified = 0
      const historical = await mockDb.prepare('SELECT email_verified, email_verified_at FROM users WHERE email = ?')
        .bind('historical@alfaaz.local')
        .first();
      expect(historical.email_verified).toBe(0);
      expect(historical.email_verified_at).toBeNull();

      // Verified user with consumed code must remain email_verified = 1
      const genuine = await mockDb.prepare('SELECT email_verified, email_verified_at FROM users WHERE email = ?')
        .bind('verified@alfaaz.local')
        .first();
      expect(genuine.email_verified).toBe(1);
      expect(genuine.email_verified_at).not.toBeNull();
    });
  });

  describe('5. Recruitment Consent Honesty & Transparency Safeguards', () => {
    it('enforces 11–14 minute duration and eliminates false pseudonymous claims', async () => {
      const fs = await import('node:fs');
      const recruitJs = fs.readFileSync('frontend/src/recruit.js', 'utf8');
      const recruitHtml = fs.readFileSync('frontend/recruit.html', 'utf8');

      // Duration honesty: No contradictory 20-25 minute statements
      expect(recruitJs).not.toContain('20-25 minute');
      expect(recruitJs).toContain('11–14 minute');
      expect(recruitHtml).toContain('11–14 minutes');

      // Privacy honesty: No false pseudonymous assertions
      expect(recruitJs).not.toContain('pseudonymous');
      expect(recruitJs).toContain('strictly confidential');
    });
  });
});
