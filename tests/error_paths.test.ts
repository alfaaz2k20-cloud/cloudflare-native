import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, hashPassword } from '../backend/src/auth/crypto';

describe('Error Paths & Defensive Security Integration Test Suite', () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let mockR2: ReturnType<typeof createMockR2>;
  let mockKv: ReturnType<typeof createMockKV>;
  const jwtSecret = 'test-suite-super-secret-key-32-chars-long';

  function getTestEnv() {
    return {
      DB: mockDb as any,
      VAULT_BUCKET: mockR2 as any,
      CACHE_KV: mockKv as any,
      JWT_SECRET: jwtSecret,
      ADMIN_PASSWORD: 'curator2026!',
      EMAIL_PROVIDER: 'dev' as const
    };
  }

  beforeEach(() => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();
  });

  describe('1. Password Reset Token Replay Protection', () => {
    it('successfully resets password on first attempt, but strictly rejects replay of already-used token with 400', async () => {
      // 1. Create a user
      const userEmail = 'reset_target@alfaaz.local';
      const initialHash = await hashPassword('InitialPass123!');
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind(userEmail, initialHash, 'Reset Target', 'PARTICIPANT')
        .run();

      // 2. Issue a valid reset token
      const resetToken = await createToken(userEmail, 'reset', jwtSecret, 900);

      // 3. First reset attempt: MUST succeed
      const firstRes = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          new_password: 'NewSecurePassword123!'
        })
      }, getTestEnv());

      expect(firstRes.status).toBe(200);
      const firstData: any = await firstRes.json();
      expect(firstData.message).toContain('Password reset successfully');

      // 4. Second reset attempt (replay attack within the 15-min window): MUST be rejected with 400
      const replayRes = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          new_password: 'AttackerHijackedPassword456!'
        })
      }, getTestEnv());

      expect(replayRes.status).toBe(400);
      const replayData: any = await replayRes.json();
      expect(replayData.detail).toContain('Invalid or');
    });
  });

  describe('2. Duplicate Event Registration Rejection', () => {
    it('rejects duplicate event registration with 400', async () => {
      const userToken = await createToken('attendee@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // First registration for Event 2
      const firstRes = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 2 })
      }, getTestEnv());

      expect(firstRes.status).toBe(200);

      // Second duplicate registration for same event
      const secondRes = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 2 })
      }, getTestEnv());

      expect(secondRes.status).toBe(400);
      const data: any = await secondRes.json();
      expect(data.detail).toContain('Already registered');
    });
  });

  describe('3. Conflicting Interview Booking Rejection', () => {
    it('rejects double-booking the exact same interview date and time slot with 409', async () => {
      // Create session 1
      const c1Res = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const s1Data: any = await c1Res.json();
      const s1 = s1Data.session_id;

      // Book slot for candidate 1
      const book1Res = await app.request('/recruit/schedule-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: s1,
          candidate_name: 'Habba Khatoon',
          candidate_email: 'habba@alfaaz.local',
          slot_date: '2026-11-25',
          slot_time: '03:00 PM'
        })
      }, getTestEnv());

      expect(book1Res.status).toBe(200);

      // Create session 2
      const c2Res = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const s2Data: any = await c2Res.json();
      const s2 = s2Data.session_id;

      // Attempt to book the EXACT SAME slot for candidate 2: MUST fail with 409
      const book2Res = await app.request('/recruit/schedule-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: s2,
          candidate_name: 'Mahjoor',
          candidate_email: 'mahjoor@alfaaz.local',
          slot_date: '2026-11-25',
          slot_time: '03:00 PM'
        })
      }, getTestEnv());

      expect(book2Res.status).toBe(409);
      const errData: any = await book2Res.json();
      expect(errData.detail).toContain('just taken');
    });
  });

  describe('4. Unauthenticated R2 Vault Access Rejection', () => {
    it('returns 401 Unauthorized for unauthenticated requests to /vault/file/:key', async () => {
      // Put a mock file into R2
      const key = 'vault/private_payment_receipt.png';
      await mockR2.put(key, new TextEncoder().encode('CONFIDENTIAL_BANKING_PROOF_DATA'), {
        httpMetadata: { contentType: 'image/png' }
      });

      // Anonymous unauthenticated request
      const unauthRes = await app.request(`/vault/file/${encodeURIComponent(key)}`, {}, getTestEnv());
      expect(unauthRes.status).toBe(401);
      const data: any = await unauthRes.json();
      expect(data.detail).toContain('Authentication required');

      // Authenticated request: succeeds with private cache control
      const token = await createToken('artist@alfaaz.local', 'PARTICIPANT', jwtSecret);
      const authRes = await app.request(`/vault/file/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }, getTestEnv());
      expect(authRes.status).toBe(200);
      expect(authRes.headers.get('cache-control')).toContain('private');
    });
  });

  describe('5. Invalid SJT Inputs Rejection', () => {
    it('rejects SJT submission without valid consented session with 404', async () => {
      const res = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'non-existent-uuid',
          responses: { s1: 'o1' }
        })
      }, getTestEnv());

      expect(res.status).toBe(404);
    });

    it('rejects invalid SJT scenario options with 400', async () => {
      // Consent a real session
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const cData: any = await consentRes.json();
      const sId = cData.session_id;

      // Submit invalid scenario ID
      const res = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          responses: {
            'invalid_scenario_id_xyz': 'option_1'
          }
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
    });
  });
});
