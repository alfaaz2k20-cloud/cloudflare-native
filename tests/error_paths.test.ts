import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, hashPassword, verifyToken } from '../backend/src/auth/crypto';

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

      // Authenticated owner: succeeds with private cache control
      await mockDb.prepare(
        'INSERT INTO submissions (submission_type, title, file_url, author_email) VALUES (?, ?, ?, ?)'
      ).bind('image', 'Private receipt', `/vault/file/${encodeURIComponent(key)}`, 'artist@alfaaz.local').run();

      const token = await createToken('artist@alfaaz.local', 'PARTICIPANT', jwtSecret);
      const authRes = await app.request(`/vault/file/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` }
      }, getTestEnv());
      expect(authRes.status).toBe(200);
      expect(authRes.headers.get('cache-control')).toContain('private');

      // A different authenticated participant must not read someone else's vault object
      const intruderToken = await createToken('attacker@alfaaz.local', 'PARTICIPANT', jwtSecret);
      const intruderRes = await app.request(`/vault/file/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${intruderToken}` }
      }, getTestEnv());
      expect(intruderRes.status).toBe(404);

      // Administrators retain access for review
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);
      const adminRes = await app.request(`/vault/file/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(adminRes.status).toBe(200);
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

  describe('6. Cryptographic Hardening: JWT Algorithm Confusion & Malformed Token Defense', () => {
    it('strictly rejects tokens with alg !== HS256 (e.g. alg: none or RS256)', async () => {
      // Craft a token with alg: 'none'
      const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'attacker@alfaaz.local', email: 'attacker@alfaaz.local', status: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const noneToken = `${headerNone}.${payload}.`;

      const resultNone = await verifyToken(noneToken, jwtSecret);
      expect(resultNone).toBeNull();

      // Craft a token with alg: 'RS256'
      const headerRs = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const rsToken = `${headerRs}.${payload}.dummysignature`;

      const resultRs = await verifyToken(rsToken, jwtSecret);
      expect(resultRs).toBeNull();
    });

    it('strictly rejects tokens with invalid signature or corrupted base64', async () => {
      const validToken = await createToken('user@alfaaz.local', 'PARTICIPANT', jwtSecret);
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.badsignaturecharacters!`;

      const result = await verifyToken(tamperedToken, jwtSecret);
      expect(result).toBeNull();
    });
  });

  describe('7. PWA Service Worker Invariant & Destination Integrity', () => {
    it('verifies sw.js defines NETWORK_FIRST_DESTINATIONS and handles same-origin vs third-party fetches without ReferenceError', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const vm = await import('node:vm');

      const swPath = path.resolve(process.cwd(), 'frontend/public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swCode = fs.readFileSync(swPath, 'utf8');

      // 1. Verify critical constants exist in source code
      expect(swCode).toContain('NETWORK_FIRST_DESTINATIONS');
      expect(swCode).toContain('THIRD_PARTY_STATIC_HOSTS');
      expect(swCode).toContain('cdn.tailwindcss.com');
      expect(swCode).toContain('fonts.googleapis.com');

      // 2. Execute sw.js in sandbox to verify execution and listeners
      const listeners: Record<string, Function> = {};
      const sandbox = {
        self: {
          location: { origin: 'https://alfaazcollective.org' },
          addEventListener: (type: string, fn: Function) => { listeners[type] = fn; },
          skipWaiting: () => {},
          clients: { claim: () => {} }
        },
        caches: {
          open: async () => ({
            addAll: async () => {},
            match: async () => null,
            put: async () => {}
          }),
          keys: async () => [],
          delete: async () => true,
          match: async () => null
        },
        Request: class {},
        Response: class {},
        URL,
        Set
      };

      vm.createContext(sandbox);
      expect(() => vm.runInContext(swCode, sandbox)).not.toThrow();

      expect(typeof listeners['fetch']).toBe('function');

      // 3. Simulate same-origin script fetch (which previously threw ReferenceError)
      let respondedWith: any = null;
      const scriptEvent = {
        request: {
          method: 'GET',
          mode: 'no-cors',
          destination: 'script',
          url: 'https://alfaazcollective.org/assets/main.js'
        },
        respondWith: (promise: any) => { respondedWith = promise; }
      };

      expect(() => listeners['fetch'](scriptEvent)).not.toThrow();
      expect(respondedWith).not.toBeNull();
    });
  });

  describe('8. Credential Type Separation & Input Boundary Validation', () => {
    it('rejects a password-reset token presented as a session credential with 401', async () => {
      const userEmail = 'reset_target@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind(userEmail, await hashPassword('InitialPass123!'), 'Reset Target', 'PARTICIPANT')
        .run();

      const resetToken = await createToken(userEmail, 'reset', jwtSecret, 900);
      const res = await app.request('/exhibitions/my-status', {
        headers: { Authorization: `Bearer ${resetToken}` }
      }, getTestEnv());

      expect(res.status).toBe(401);

      const sessionToken = await createToken(userEmail, 'PARTICIPANT', jwtSecret);
      const okRes = await app.request('/exhibitions/my-status', {
        headers: { Authorization: `Bearer ${sessionToken}` }
      }, getTestEnv());
      expect(okRes.status).toBe(200);
    });

    it('rejects registration with a malformed email address', async () => {
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'ValidPass123!', full_name: 'Bad Email' })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('valid email');
    });

    it('rejects exhibition applications with a non-integer or out-of-range age', async () => {
      const token = await createToken('artist@alfaaz.local', 'PARTICIPANT', jwtSecret);

      for (const badAge of [null, 'unknown', -5, 4000, 28.5]) {
        const res = await app.request('/exhibitions/apply', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: 'Amrita Sher-Gil',
            age: badAge,
            over_19: true,
            agreed_to_screening: true
          })
        }, getTestEnv());

        expect(res.status).toBe(400);
      }

      const stored: any = await mockDb.prepare('SELECT COUNT(*) as n FROM exhibition_applications').first();
      expect(stored.n).toBe(0);
    });

    it('refuses to create a recruitment session when the 18+ attestation is omitted', async () => {
      const omitted = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choices: { research_telemetry: true } })
      }, getTestEnv());
      expect(omitted.status).toBe(400);

      const falsy = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: 'yes', choices: { research_telemetry: true } })
      }, getTestEnv());
      expect(falsy.status).toBe(400);

      const telemetryOmitted = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: {} })
      }, getTestEnv());
      expect(telemetryOmitted.status).toBe(400);

      const sessions: any = await mockDb.prepare('SELECT COUNT(*) as n FROM recruit_sessions').first();
      expect(sessions.n).toBe(0);
      const consents: any = await mockDb.prepare('SELECT COUNT(*) as n FROM consent_records').first();
      expect(consents.n).toBe(0);
    });

    it('does not disclose secret configuration state on /blogs/generate', async () => {      const unconfigured = await app.request('/blogs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }, getTestEnv());

      expect(unconfigured.status).toBe(503);
      const unconfiguredBody: any = await unconfigured.json();
      expect(JSON.stringify(unconfiguredBody)).not.toContain('PHANTOM_SECRET_TOKEN');

      const envWithToken = { ...getTestEnv(), PHANTOM_SECRET_TOKEN: 'correct-horse-battery-staple' };
      const wrongToken = await app.request('/blogs/generate', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }, envWithToken as any);

      expect(wrongToken.status).toBe(403);
    });
  });
});
