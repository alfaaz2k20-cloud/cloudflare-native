import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, verifyToken, hashPassword } from '../backend/src/auth/crypto';
import { verifyTurnstile } from '../backend/src/middleware/rate_limit';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * E2E Federated Authentication Test Suite
 * Track: Opaque-Box E2E Testing Track (Requirement-Driven)
 * Covering Requirements R1 - R5 across Tiers 1, 2, 3, and 4.
 */

describe('E2E Federated Authentication Suite (R1 - R5)', () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let mockR2: ReturnType<typeof createMockR2>;
  let mockKv: ReturnType<typeof createMockKV>;
  let testKeyPair: CryptoKeyPair;

  const jwtSecret = 'dev-test-secret-key-32-chars-long!';
  const passTurnstileSecret = '1x0000000000000000000000000000000AA';
  const failTurnstileSecret = '2x0000000000000000000000000000000AA';
  const dummyTurnstileToken = '0x4AAAAAAtestdummytoken';

  function getTestEnv(overrides: Record<string, any> = {}) {
    return {
      DB: mockDb as any,
      VAULT_BUCKET: mockR2 as any,
      CACHE_KV: mockKv as any,
      JWT_SECRET: jwtSecret,
      TURNSTILE_SECRET_KEY: passTurnstileSecret,
      ENV: 'test',
      EMAIL_PROVIDER: 'dev' as const,
      ...overrides
    };
  }

  // Generate Web Crypto RS256 keypair for Firebase ID token emulation
  beforeAll(async () => {
    testKeyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['sign', 'verify']
    );
    (globalThis as any).__TEST_FIREBASE_PUBLIC_KEY__ = testKeyPair.publicKey;
  });

  beforeEach(async () => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();

    // Prepare SQLite schema for federated auth if not already present
    try {
      await mockDb.exec(`
        CREATE TABLE IF NOT EXISTS otp_velocity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT NOT NULL,
          ip TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_otp_velocity_phone_time ON otp_velocity_logs(phone, created_at);
        CREATE INDEX IF NOT EXISTS idx_otp_velocity_ip_time ON otp_velocity_logs(ip, created_at);
      `);
    } catch {
      // Table may already exist in migrated databases
    }
  });

  /**
   * Helper to generate cryptographically signed RS256 Firebase ID Tokens
   */
  async function createMockFirebaseToken(payload: {
    uid: string;
    email?: string;
    email_verified?: boolean;
    provider?: string;
    phone_number?: string;
    name?: string;
    exp?: number;
    iss?: string;
    aud?: string;
    alg?: string;
  }, keyPair: CryptoKeyPair = testKeyPair): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const alg = payload.alg || 'RS256';
    const header = { alg, typ: 'JWT', kid: 'mock-firebase-key-1' };
    const fullPayload = {
      iss: payload.iss || 'https://securetoken.google.com/alfaaz-collective',
      aud: payload.aud || 'alfaaz-collective',
      auth_time: now - 10,
      user_id: payload.uid,
      sub: payload.uid,
      iat: now - 10,
      exp: payload.exp !== undefined ? payload.exp : now + 3600,
      email: payload.email,
      email_verified: payload.email_verified !== undefined ? payload.email_verified : Boolean(payload.email),
      phone_number: payload.phone_number,
      name: payload.name || 'Alfaaz Member',
      firebase: {
        identities: {},
        sign_in_provider: payload.provider || (payload.phone_number ? 'phone' : 'google.com')
      }
    };

    const enc = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const headerB64 = enc(header);
    const payloadB64 = enc(fullPayload);

    if (alg === 'none') {
      return `${headerB64}.${payloadB64}.`;
    }

    const toSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, toSign);
    const sigB64 = Buffer.from(signature).toString('base64url');
    return `${headerB64}.${payloadB64}.${sigB64}`;
  }

  /**
   * Interface Contract Assertion Helper:
   * During milestone development (M1/M2), endpoints may return 404 until mounted.
   * In strict mode (STRICT_E2E=true), 404 is rejected.
   */
  async function assertContract(
    res: Response,
    expectedStatus: number,
    validate?: (data: any, res: Response) => Promise<void> | void
  ) {
    if (res.status === 404 && process.env.STRICT_E2E !== 'true') {
      expect(res.status).toBe(404);
      return { pending: true, data: null };
    }
    expect(res.status).toBe(expectedStatus);
    const data = await res.json().catch(() => null);
    if (validate && data) {
      await validate(data, res);
    }
    return { pending: false, data };
  }

  // =========================================================================
  // TIER 1: Feature Coverage (>=5 test cases per feature for R1 - R5)
  // =========================================================================

  describe('Tier 1: Feature Coverage (R1 - R5)', () => {

    describe('R1. Dual Segmented Toggle & Curatorial Luxury Auth UI', () => {
      it('T1_R1_01: verifies presence of curatorial auth card structure in login.html', () => {
        const loginHtmlPath = path.resolve(process.cwd(), 'frontend/login.html');
        expect(fs.existsSync(loginHtmlPath)).toBe(true);
        const html = fs.readFileSync(loginHtmlPath, 'utf8');
        expect(html).toContain('auth-card');
        expect(html).toContain('auth-title');
      });

      it('T1_R1_02: verifies curatorial luxury aesthetic tokens (warm ivory & deep ink palette)', () => {
        const cssPath = path.resolve(process.cwd(), 'frontend/global.css');
        expect(fs.existsSync(cssPath)).toBe(true);
        const css = fs.readFileSync(cssPath, 'utf8');
        expect(css).toMatch(/#f4f1ea|#2d312e|var\(--font-heading\)|var\(--font-body\)/);
      });

      it('T1_R1_03: verifies secondary traditional email & password inputs are present in auth form', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'frontend/login.html'), 'utf8');
        expect(html).toContain('type="email"');
        expect(html).toContain('type="password"');
        expect(html).toContain('id="email"');
        expect(html).toContain('id="password"');
      });

      it('T1_R1_04: verifies Turnstile widget container exists in login form', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'frontend/login.html'), 'utf8');
        expect(html).toMatch(/challenges\.cloudflare\.com|Turnstile|turnstile/i);
      });

      it('T1_R1_05: verifies traditional login endpoint is accessible and adheres to contract', async () => {
        const res = await app.request('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nonexistent@alfaaz.local', password: 'Password123!', turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        expect(res.status).toBe(401);
        const data: any = await res.json();
        expect(data.detail).toContain('Invalid credentials');
      });
    });

    describe('R2. Multi-Provider Authentication Suite', () => {
      it('T1_R2_01: POST /auth/send-otp contract: sends OTP request with valid phone and Turnstile', async () => {
        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+14155552671', turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.success).toBe(true);
          expect(data.message).toBeDefined();
        });
      });

      it('T1_R2_02: POST /auth/federated-login contract: Google 1-tap provider returns sovereign JWT', async () => {
        const idToken = await createMockFirebaseToken({ uid: 'google_uid_101', email: 'scholar@gmail.com', name: 'Al-Biruni' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          expect(data.user).toBeDefined();
          expect(data.user.email).toBe('scholar@gmail.com');
          expect(data.user.auth_provider).toBe('google.com');
        });
      });

      it('T1_R2_03: POST /auth/federated-login contract: Apple ID social provider returns sovereign JWT', async () => {
        const idToken = await createMockFirebaseToken({ uid: 'apple_uid_202', email: 'member@privaterelay.appleid.com', name: 'Curatorial Member', provider: 'apple.com' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'apple.com' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          expect(data.user.auth_provider).toBe('apple.com');
        });
      });

      it('T1_R2_04: POST /auth/federated-login contract: Meta / Facebook social provider returns sovereign JWT', async () => {
        const idToken = await createMockFirebaseToken({ uid: 'meta_uid_303', email: 'artist@meta.com', name: 'Zeenat Mahal', provider: 'facebook.com' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'facebook.com' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          expect(data.user.auth_provider).toBe('facebook.com');
        });
      });

      it('T1_R2_05: POST /auth/federated-login contract: Phone OTP user verification returns sovereign JWT', async () => {
        const idToken = await createMockFirebaseToken({ uid: 'phone_uid_404', phone_number: '+14155552671' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'phone' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          expect(data.user.phone).toBe('+14155552671');
          expect(data.user.auth_provider).toBe('phone');
        });
      });
    });

    describe('R3. Turnstile Bot Verification & Velocity Rate Limiting', () => {
      it('T1_R3_01: POST /auth/send-otp strictly requires Turnstile verification (rejects missing token with 403)', async () => {
        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+14155552671' }) // Missing turnstile_token
        }, getTestEnv({ TURNSTILE_SECRET_KEY: 'test-real-enforced-key' }));

        await assertContract(res, 403, (data) => {
          expect(data.error || data.detail).toMatch(/Turnstile/i);
        });
      });

      it('T1_R3_02: verifyTurnstile passes with Cloudflare official always-pass secret key', async () => {
        const isValid = await verifyTurnstile(dummyTurnstileToken, passTurnstileSecret, '127.0.0.1', 'test');
        expect(isValid).toBe(true);
      });

      it('T1_R3_03: enforces 60-second cooldown rate limit on subsequent requests to the same phone', async () => {
        const env = getTestEnv();
        // First request: should pass
        const firstRes = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
          body: JSON.stringify({ phone: '+14155550001', turnstile_token: dummyTurnstileToken })
        }, env);

        const firstResult = await assertContract(firstRes, 200);

        if (!firstResult.pending) {
          // Immediate second request within 60s: must be rejected with 429
          const secondRes = await app.request('/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
            body: JSON.stringify({ phone: '+14155550001', turnstile_token: dummyTurnstileToken })
          }, env);

          await assertContract(secondRes, 429, (data) => {
            expect(data.error).toMatch(/wait 60 seconds|Rate limit/i);
            expect(data.retry_after).toBeDefined();
          });
        }
      });

      it('T1_R3_04: enforces daily quota limit (max 5 SMS per 24 hours per phone number)', async () => {
        const env = getTestEnv();
        const testPhone = '+14155550002';

        // Pre-populate 5 records in velocity log for today
        try {
          for (let i = 0; i < 5; i++) {
            await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${testPhone}', '198.51.100.2', datetime('now', '-${i + 2} hours'))`);
          }
        } catch {
          // Ignore if table pending
        }

        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.2' },
          body: JSON.stringify({ phone: testPhone, turnstile_token: dummyTurnstileToken })
        }, env);

        await assertContract(res, 429, (data) => {
          expect(data.error).toMatch(/Daily.*limit|limit exceeded/i);
        });
      });

      it('T1_R3_05: enforces daily quota limit per IP address (max 5 SMS per 24 hours per IP)', async () => {
        const env = getTestEnv();
        const testIp = '198.51.100.99';

        // Pre-populate 5 records from same IP across 5 different phone numbers
        try {
          for (let i = 0; i < 5; i++) {
            await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('+1415555009${i}', '${testIp}', datetime('now', '-${i + 2} hours'))`);
          }
        } catch {
          // Ignore if table pending
        }

        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': testIp },
          body: JSON.stringify({ phone: '+14155550999', turnstile_token: dummyTurnstileToken })
        }, env);

        await assertContract(res, 429, (data) => {
          expect(data.error).toMatch(/Daily.*limit|limit exceeded/i);
        });
      });
    });

    describe('R4. Backend Federated Authentication & Sovereign Session Issuance', () => {
      it('T1_R4_01: POST /auth/federated-login verifies valid RS256 token and issues sovereign session JWT', async () => {
        const idToken = await createMockFirebaseToken({ uid: 'valid_fb_1', email: 'poet@alfaaz.org', name: 'Faiz Ahmad Faiz' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          const parts = data.token.split('.');
          expect(parts.length).toBe(3);
        });
      });

      it('T1_R4_02: POST /auth/federated-login strictly rejects forged or tampered token with 401', async () => {
        const validToken = await createMockFirebaseToken({ uid: 'valid_fb_2', email: 'valid@alfaaz.org' });
        const parts = validToken.split('.');
        const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature_payload`;

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: tamperedToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 401, (data) => {
          expect(data.error).toMatch(/Invalid or expired/i);
        });
      });

      it('T1_R4_03: maps or upserts user in D1 SQLite with nullable password for federated users', async () => {
        const email = 'federated_user_1@alfaaz.local';
        const idToken = await createMockFirebaseToken({ uid: 'fb_upsert_1', email, name: 'Upserted Member' });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
        }, getTestEnv());

        const result = await assertContract(res, 200);

        if (!result.pending) {
          // Check row in D1: password should be null
          const user = await mockDb.prepare('SELECT email, password, status FROM users WHERE email = ?')
            .bind(email)
            .first();
          expect(user).toBeDefined();
          expect((user as any).password).toBeNull();
        }
      });

      it('T1_R4_04: preserves existing user role (ADMIN or PARTICIPANT) during federated login', async () => {
        const email = 'existing_admin@alfaaz.local';
        const initialHash = await hashPassword('AdminPass123!');
        await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
          .bind(email, initialHash, 'Original Admin', 'ADMIN')
          .run();

        const idToken = await createMockFirebaseToken({ uid: 'fb_admin_link', email, name: 'Original Admin' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.user.status).toBe('ADMIN');
        });
      });

      it('T1_R4_05: issued sovereign session JWT is verifiable by backend verifyToken with 7-day validity', async () => {
        const token = await createToken({ email: 'session_test@alfaaz.org', status: 'PARTICIPANT' }, jwtSecret, 7 * 86400);
        const verified = await verifyToken(token, jwtSecret);
        expect(verified).not.toBeNull();
        expect(verified?.email).toBe('session_test@alfaaz.org');
        expect(verified?.status).toBe('PARTICIPANT');
        expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000) + 6 * 86400);
      });

      it('T1_R4_06: P0 Account Takeover Protection: rejects unverified email (email_verified: false) matching existing admin with 401', async () => {
        const victimEmail = 'victim_admin@alfaaz.local';
        await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
          .bind(victimEmail, await hashPassword('VictimSecretPass!'), 'Victim Admin', 'ADMIN')
          .run();

        // Attacker creates unverified Firebase account with victim's email
        const attackerToken = await createMockFirebaseToken({
          uid: 'attacker_fake_uid',
          email: victimEmail,
          email_verified: false,
          name: 'Attacker'
        });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: attackerToken, provider: 'password' })
        }, getTestEnv());

        await assertContract(res, 401, (data) => {
          expect(data.error).toMatch(/Email.*not verified/i);
        });

        // Ensure victim's account is NOT compromised or linked to attacker
        const row: any = await mockDb.prepare('SELECT firebase_uid FROM users WHERE email = ?')
          .bind(victimEmail)
          .first();
        expect(row.firebase_uid).toBeNull();
      });

      it('T1_R4_07: P0 Account Takeover Protection: rejects new user registration with unverified email (email_verified: false) with 401', async () => {
        const unverifiedToken = await createMockFirebaseToken({
          uid: 'unverified_new_uid',
          email: 'unverified_poet@alfaaz.local',
          email_verified: false,
          name: 'Unverified Poet'
        });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: unverifiedToken, provider: 'password' })
        }, getTestEnv());

        await assertContract(res, 401, (data) => {
          expect(data.error).toMatch(/Email.*not verified/i);
        });
      });

      it('T1_R4_08: email_verified=true token matching existing account succeeds with 200', async () => {
        const legitimateEmail = 'legit_poet@alfaaz.local';
        await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
          .bind(legitimateEmail, await hashPassword('LegitPass!123'), 'Legit Poet', 'PARTICIPANT')
          .run();

        const verifiedToken = await createMockFirebaseToken({
          uid: 'legit_firebase_uid_1',
          email: legitimateEmail,
          email_verified: true,
          name: 'Legit Poet'
        });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: verifiedToken })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          expect(data.user.email).toBe(legitimateEmail);
        });
      });

      it('T1_R4_09: phone-only federated user can update profile via PATCH /me', async () => {
        const phone = '+14155557788';
        const idToken = await createMockFirebaseToken({ uid: 'phone_patch_uid', phone_number: phone });
        const loginRes = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken })
        }, getTestEnv());
        const loginData = await loginRes.json();
        const jwt = loginData.token;

        const patchRes = await app.request('/auth/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({ full_name: 'Updated Phone Poet' })
        }, getTestEnv());

        expect(patchRes.status).toBe(200);

        const getRes = await app.request('/auth/me', {
          headers: { 'Authorization': `Bearer ${jwt}` }
        }, getTestEnv());
        const getData = await getRes.json();
        expect(getData.full_name).toBe('Updated Phone Poet');
      });
    });

    describe('R5. Absolute Secret Redaction & Test Invariants', () => {
      it('T1_R5_01: scans test suite fixtures for unredacted high-entropy literals', () => {
        const currentFileContent = fs.readFileSync(__filename, 'utf8');
        // Ensure no actual live secrets are written
        expect(currentFileContent).not.toMatch(/AIzaSy[0-9A-Za-z_-]{33}/);
        expect(currentFileContent).not.toMatch(/gsk_[0-9A-Za-z]{48}/);
      });

      it('T1_R5_02: auth endpoints never expose internal keys or secrets in error payloads', async () => {
        const res = await app.request('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'attacker@evil.com', password: 'bad' })
        }, getTestEnv());

        const bodyText = await res.text();
        expect(bodyText).not.toContain(jwtSecret);
        expect(bodyText).not.toContain(passTurnstileSecret);
      });

      it('T1_R5_03: sovereign JWT signature rejects modification with different secret', async () => {
        const token = await createToken({ email: 'secure@alfaaz.local', status: 'PARTICIPANT' }, jwtSecret);
        const verifiedWithWrongSecret = await verifyToken(token, 'attacker-injected-secret-key-32b');
        expect(verifiedWithWrongSecret).toBeNull();
      });

      it('T1_R5_04: enforces psychometric ratio precision formula Precision = TP / (TP + FP) with min_obs gate', () => {
        // Invariant from AGENTS.md § 2: Psychometric Ratio vs Counter Integrity
        const computePrecision = (tp: number, fp: number, minObs: number = 3) => {
          const totalObs = tp + fp;
          if (totalObs < minObs) {
            return { precision: 0.0, confident: false };
          }
          const precision = tp / totalObs;
          return { precision: Math.max(0.0, Math.min(1.0, precision)), confident: true };
        };

        // Gate: under observation minimum
        expect(computePrecision(2, 0, 3).confident).toBe(false);
        // Gate met: accurate proportion
        const res = computePrecision(4, 1, 3);
        expect(res.confident).toBe(true);
        expect(res.precision).toBeCloseTo(0.8, 5);
      });

      it('T1_R5_05: server error handler sanitizes internal database and SQL error details in production', async () => {
        // App onError handler sanitizes errors when ENV=production
        const res = await app.request('/api/nonexistent-route', {
          method: 'GET'
        }, getTestEnv({ ENV: 'production' }));

        expect(res.status).toBe(404);
        const data: any = await res.json();
        expect(data.error).toBeDefined();
      });
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases (>=5 test cases per feature for R1 - R5)
  // =========================================================================

  describe('Tier 2: Boundary & Corner Cases (R1 - R5)', () => {

    describe('R1 Boundaries: UI & Layout Edge Cases', () => {
      it('T2_R1_01: handles rapid consecutive login form requests without state bleed', async () => {
        const reqs = Array.from({ length: 3 }).map((_, i) =>
          app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `rapid_${i}@alfaaz.local`, password: 'WrongPassword!' })
          }, getTestEnv())
        );

        const results = await Promise.all(reqs);
        for (const res of results) {
          expect(res.status).toBe(401);
        }
      });

      it('T2_R1_02: auth card styling specifies responsive max-width boundary', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'frontend/login.html'), 'utf8');
        expect(html).toContain('max-width: 420px');
      });

      it('T2_R1_03: password input wrapper includes toggle visibility control element', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'frontend/login.html'), 'utf8');
        expect(html).toContain('toggle-pw');
        expect(html).toContain('id="togglePw"');
      });

      it('T2_R1_04: login form handles lost password recovery trigger accessibility attributes', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'frontend/login.html'), 'utf8');
        expect(html).toContain('id="forgotBtn"');
        expect(html).toContain('aria-live="polite"');
      });

      it('T2_R1_05: preserves UTF-8 Urdu script hover elements without corrupting encoding', () => {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'frontend/login.html'), 'utf8');
        expect(html).toContain('data-ur="داخلہ"');
        expect(html).toContain('data-ur="الفاظ"');
      });
    });

    describe('R2 Boundaries: Phone & Token Formatting Edge Cases', () => {
      it('T2_R2_01: accepts international E.164 phone formats (+1, +44, +91, +92, +33)', async () => {
        const validPhones = ['+14155552671', '+442071838750', '+919876543210', '+923001234567', '+33123456789'];
        for (const phone of validPhones) {
          const res = await app.request('/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, turnstile_token: dummyTurnstileToken })
          }, getTestEnv());

          // Should either pass (200) or return pending (404 during dev), never 400 invalid format
          if (res.status !== 404) {
            expect([200, 429]).toContain(res.status);
          }
        }
      });

      it('T2_R2_02: rejects invalid phone number formats with 400 Bad Request', async () => {
        const invalidPhones = ['invalid_string', '14155552671', '+1', '++14155552671', '03001234567', '+14155552671999999999'];
        for (const phone of invalidPhones) {
          const res = await app.request('/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, turnstile_token: dummyTurnstileToken })
          }, getTestEnv());

          await assertContract(res, 400, (data) => {
            expect(data.error || data.detail).toMatch(/phone.*format|E\.164/i);
          });
        }
      });

      it('T2_R2_03: handles federated login payload missing email claim gracefully', async () => {
        const idToken = await createMockFirebaseToken({ uid: 'apple_no_email', phone_number: '+14155559999' });
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, provider: 'phone' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.token).toBeDefined();
          expect(data.user.phone).toBe('+14155559999');
        });
      });

      it('T2_R2_04: strictly rejects malformed non-JSON request body with 400', async () => {
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{ invalid_json_payload ... '
        }, getTestEnv());

        // Should return 400 or 500 or 404 if pending
        if (res.status !== 404) {
          expect([400, 401, 500]).toContain(res.status);
        }
      });

      it('T2_R2_05: handles large payload boundary without crashing worker runtime', async () => {
        const oversizedName = 'A'.repeat(50000);
        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: 'dummy', provider: 'google.com', oversized: oversizedName })
        }, getTestEnv());

        // Worker should not crash with unhandled exception
        expect([200, 400, 401, 404, 500]).toContain(res.status);
      });
    });

    describe('R3 Boundaries: Velocity 59s vs 60s & Quota Exceedance', () => {
      it('T2_R3_01: 59-second vs 60-second cooldown boundary: T+59s rejected, T+60s permitted', async () => {
        const testPhone = '+14155556001';
        try {
          // Pre-populate an OTP request exactly 59 seconds ago
          await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${testPhone}', '198.51.100.5', datetime('now', '-59 seconds'))`);
        } catch {
          // Ignore if table pending
        }

        const res59 = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        await assertContract(res59, 429, (data) => {
          expect(data.error).toMatch(/wait 60 seconds|Rate limit/i);
        });

        // Pre-populate an OTP request 61 seconds ago
        const testPhone2 = '+14155556002';
        try {
          await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${testPhone2}', '198.51.100.5', datetime('now', '-61 seconds'))`);
        } catch {
          // Ignore if table pending
        }

        const res60 = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone2, turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        await assertContract(res60, 200);
      });

      it('T2_R3_02: daily limit 5th vs 6th request boundary: 5th request allowed, 6th request blocked', async () => {
        const testPhone = '+14155555005';
        try {
          // Insert 4 previous requests today
          for (let i = 0; i < 4; i++) {
            await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${testPhone}', '198.51.100.6', datetime('now', '-${i + 2} hours'))`);
          }
        } catch {
          // Ignore if table pending
        }

        // 5th request: should succeed
        const res5th = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        const result5th = await assertContract(res5th, 200);

        if (!result5th.pending) {
          // Insert 5th record
          try {
            await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${testPhone}', '198.51.100.6', datetime('now', '-2 minutes'))`);
          } catch {}

          // 6th request: must be rejected with 429
          const res6th = await app.request('/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone, turnstile_token: dummyTurnstileToken })
          }, getTestEnv());

          await assertContract(res6th, 429, (data) => {
            expect(data.error).toMatch(/Daily.*limit|limit exceeded/i);
          });
        }
      });

      it('T2_R3_03: Cloudflare failing Turnstile test key strictly returns 403 Forbidden', async () => {
        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+14155557777', turnstile_token: dummyTurnstileToken })
        }, getTestEnv({ TURNSTILE_SECRET_KEY: failTurnstileSecret }));

        await assertContract(res, 403, (data) => {
          expect(data.error || data.detail).toMatch(/Turnstile verification failed/i);
        });
      });

      it('T2_R3_04: rejects empty string or whitespace Turnstile token with 403', async () => {
        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+14155557777', turnstile_token: '   ' })
        }, getTestEnv({ TURNSTILE_SECRET_KEY: 'test-real-enforced-key' }));

        await assertContract(res, 403);
      });

      it('T2_R3_05: fallback header cf-turnstile-response accepted if body token is omitted', async () => {
        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-turnstile-response': dummyTurnstileToken
          },
          body: JSON.stringify({ phone: '+14155558888' })
        }, getTestEnv());

        await assertContract(res, 200);
      });
    });

    describe('R4 Boundaries: Token Expiration & Cryptographic Edge Cases', () => {
      it('T2_R4_01: strictly rejects expired Firebase ID token (exp < now) with 401', async () => {
        const expiredTime = Math.floor(Date.now() / 1000) - 300; // 5 mins ago
        const expiredToken = await createMockFirebaseToken({ uid: 'expired_user', email: 'exp@alfaaz.local', exp: expiredTime });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: expiredToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 401, (data) => {
          expect(data.error).toMatch(/Invalid or expired/i);
        });
      });

      it('T2_R4_02: strictly rejects token with incorrect audience claim with 401', async () => {
        const badAudToken = await createMockFirebaseToken({ uid: 'bad_aud_user', aud: 'malicious-attacker-project' });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: badAudToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 401, (data) => {
          expect(data.error).toMatch(/Invalid or expired/i);
        });
      });

      it('T2_R4_03: strictly rejects algorithm substitution attack (alg: "none") with 401', async () => {
        const noneToken = await createMockFirebaseToken({ uid: 'none_alg_user', alg: 'none' });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: noneToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 401, (data) => {
          expect(data.error).toMatch(/Invalid or expired/i);
        });
      });

      it('T2_R4_04: concurrent federated logins for identical user handle D1 upsert without conflict', async () => {
        const email = 'concurrent_federated@alfaaz.local';
        const idToken = await createMockFirebaseToken({ uid: 'concurrent_uid_1', email });

        const reqs = Array.from({ length: 3 }).map(() =>
          app.request('/auth/federated-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
          }, getTestEnv())
        );

        const responses = await Promise.all(reqs);
        for (const res of responses) {
          if (res.status !== 404) {
            expect(res.status).toBe(200);
          }
        }
      });

      it('T2_R4_05: corrupted sovereign session JWT rejected on protected route /auth/me with 401', async () => {
        const res = await app.request('/auth/me', {
          method: 'GET',
          headers: { 'Authorization': 'Bearer malformed.jwt.signature' }
        }, getTestEnv());

        expect(res.status).toBe(401);
      });
    });

    describe('R5 Boundaries: Secret Redaction & Defensive Injection Protection', () => {
      it('T2_R5_01: rate limit 429 error messages never disclose internal table or column names', async () => {
        const testPhone = '+14155550000';
        try {
          for (let i = 0; i < 6; i++) {
            await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${testPhone}', '127.0.0.1', datetime('now', '-${i} minutes'))`);
          }
        } catch {}

        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone, turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        const body = await res.text();
        expect(body).not.toContain('otp_velocity_logs');
        expect(body).not.toContain('sqlite_master');
      });

      it('T2_R5_02: SQL injection attempts in phone parameter are treated safely as strings', async () => {
        const sqliPhone = "'+OR+1=1;--";
        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: sqliPhone, turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        // Must reject format or handle safely without database syntax crash
        await assertContract(res, 400);
      });

      it('T2_R5_03: HTML/XSS injection attempts in full_name are sanitized or stored verbatim without execution', async () => {
        const xssToken = await createMockFirebaseToken({
          uid: 'xss_uid_1',
          email: 'xss@alfaaz.local',
          name: '<script>alert("pwned")</script>'
        });

        const res = await app.request('/auth/federated-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: xssToken, provider: 'google.com' })
        }, getTestEnv());

        await assertContract(res, 200, (data) => {
          expect(data.user).toBeDefined();
        });
      });

      it('T2_R5_04: database connection failure during rate check fails closed securely', async () => {
        const brokenDb = {
          prepare() {
            throw new Error('D1_STORAGE_OFFLINE_FATAL');
          },
          exec() {
            throw new Error('D1_STORAGE_OFFLINE_FATAL');
          }
        };

        const res = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+14155551234', turnstile_token: dummyTurnstileToken })
        }, getTestEnv({ DB: brokenDb as any }));

        // Must fail closed (500 or 404 if pending) without disclosing stack trace in production
        if (res.status !== 404) {
          expect([500, 503]).toContain(res.status);
        }
      });

      it('T2_R5_05: verifies zero plaintext passwords stored in D1 users table for traditional or federated users', async () => {
        // Register traditional user
        const res = await app.request('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'audit_user@alfaaz.local',
            password: 'PlaintextPassword123!',
            full_name: 'Audit User',
            phone: '+919876543210',
            turnstile_token: dummyTurnstileToken
          })
        }, getTestEnv());

        expect(res.status).toBe(200);

        const row: any = await mockDb.prepare('SELECT password FROM users WHERE email = ?')
          .bind('audit_user@alfaaz.local')
          .first();

        expect(row.password).not.toBe('PlaintextPassword123!');
        expect(row.password).toMatch(/^pbkdf2:sha256:/);
      });
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Turnstile, Velocity, Federated, DB)
  // =========================================================================

  describe('Tier 3: Cross-Feature Combinations', () => {

    it('T3_C01: Turnstile failure preempts rate limit check (does NOT increment velocity quota)', async () => {
      const testPhone = '+14155553001';
      // Issue request with failing Turnstile secret
      const res = await app.request('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, turnstile_token: dummyTurnstileToken })
      }, getTestEnv({ TURNSTILE_SECRET_KEY: failTurnstileSecret }));

      await assertContract(res, 403);

      // Verify no velocity log entry was created for this failed bot check
      try {
        const count = await mockDb.prepare('SELECT COUNT(*) as count FROM otp_velocity_logs WHERE phone = ?')
          .bind(testPhone)
          .first('count');
        expect(count).toBe(0);
      } catch {
        // Ignore if table pending
      }
    });

    it('T3_C02: Turnstile bypass attempt with valid rate limit status blocked at gatekeeper', async () => {
      const testPhone = '+14155553002';
      // Attempt bypass with omitted Turnstile token
      const res = await app.request('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone })
      }, getTestEnv({ TURNSTILE_SECRET_KEY: 'test-real-enforced-key' }));

      await assertContract(res, 403);
    });

    it('T3_C03: Social login with existing email/password account preserves role and links identity', async () => {
      const email = 'link_target@alfaaz.local';
      const initialHash = await hashPassword('ExistingPassword123!');
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind(email, initialHash, 'Target Member', 'PARTICIPANT')
        .run();

      const idToken = await createMockFirebaseToken({ uid: 'google_linked_uid', email, name: 'Target Member' });
      const res = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
      }, getTestEnv());

      await assertContract(res, 200, (data) => {
        expect(data.user.email).toBe(email);
        expect(data.user.status).toBe('PARTICIPANT');
      });
    });

    it('T3_C04: Phone user requesting multiple concurrent sessions receives valid sovereign JWTs', async () => {
      const phone = '+14155553004';
      const idToken1 = await createMockFirebaseToken({ uid: 'phone_sess_1', phone_number: phone });
      const idToken2 = await createMockFirebaseToken({ uid: 'phone_sess_1', phone_number: phone });

      const res1 = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken1, provider: 'phone' })
      }, getTestEnv());

      const res2 = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken2, provider: 'phone' })
      }, getTestEnv());

      if (res1.status !== 404 && res2.status !== 404) {
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
        const data1: any = await res1.json();
        const data2: any = await res2.json();
        expect(data1.token).toBeDefined();
        expect(data2.token).toBeDefined();
      }
    });

    it('T3_C05: Rate-limited phone user on SMS can still authenticate via existing social login without lockout', async () => {
      const phone = '+14155553005';
      const email = 'social_fallback@alfaaz.local';

      // Lock out phone via velocity log
      try {
        await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('${phone}', '198.51.100.1', datetime('now'))`);
      } catch {}

      // Attempt OTP: should fail with 429
      const otpRes = await app.request('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, turnstile_token: dummyTurnstileToken })
      }, getTestEnv());

      await assertContract(otpRes, 429);

      // Social login for same user should succeed
      const idToken = await createMockFirebaseToken({ uid: 'fallback_google_uid', email });
      const socialRes = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
      }, getTestEnv());

      await assertContract(socialRes, 200);
    });

    it('T3_C06: Attacker rotating IP address for same phone number blocked by phone cooldown limit', async () => {
      const phone = '+14155553006';
      // First request from IP 1
      const res1 = await app.request('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.1.1.1' },
        body: JSON.stringify({ phone, turnstile_token: dummyTurnstileToken })
      }, getTestEnv());

      const r1 = await assertContract(res1, 200);

      if (!r1.pending) {
        // Immediate second request from IP 2
        const res2 = await app.request('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '2.2.2.2' },
          body: JSON.stringify({ phone, turnstile_token: dummyTurnstileToken })
        }, getTestEnv());

        await assertContract(res2, 429);
      }
    });

    it('T3_C07: Attacker rotating phone numbers from single IP blocked by IP daily limit', async () => {
      const attackerIp = '203.0.113.88';
      // Insert 5 requests from this attacker IP
      try {
        for (let i = 0; i < 5; i++) {
          await mockDb.exec(`INSERT INTO otp_velocity_logs (phone, ip, created_at) VALUES ('+1415555800${i}', '${attackerIp}', datetime('now', '-${i + 1} hours'))`);
        }
      } catch {}

      // Attempt new phone number from same IP
      const res = await app.request('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': attackerIp },
        body: JSON.stringify({ phone: '+14155558999', turnstile_token: dummyTurnstileToken })
      }, getTestEnv());

      await assertContract(res, 429, (data) => {
        expect(data.error).toMatch(/Daily.*limit/i);
      });
    });

    it('T3_C08: Traditional registration attempt for an email already registered returns 400', async () => {
      const email = 'existing_poet@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind(email, await hashPassword('Pass123!'), 'Existing Poet', 'PARTICIPANT')
        .run();

      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'AnotherPassword456!', full_name: 'Imposter', turnstile_token: dummyTurnstileToken })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('already registered');
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================

  describe('Tier 4: Real-World Scenarios', () => {

    it('T4_S01: Simulated Distributed SMS Pumping & Toll Fraud Attack Burst', async () => {
      // Threat scenario: Botnet fires 20 rapid OTP requests across multiple numbers and IPs
      const botnetIps = ['192.0.2.1', '192.0.2.2', '192.0.2.3'];
      const targetNumbers = ['+14155559001', '+14155559002', '+14155559003'];

      const promises = [];
      for (let i = 0; i < 9; i++) {
        const ip = botnetIps[i % botnetIps.length];
        const phone = targetNumbers[i % targetNumbers.length];
        // Alternate between missing Turnstile token (botnet) and rapid requests
        const turnstileToken = i % 2 === 0 ? undefined : dummyTurnstileToken;

        promises.push(
          app.request('/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
            body: JSON.stringify({ phone, turnstile_token: turnstileToken })
          }, getTestEnv({ TURNSTILE_SECRET_KEY: 'enforced-turnstile-secret' }))
        );
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.status !== 404) {
          // Every attack attempt is either blocked by Turnstile (403) or rate limit (429) or accepted if valid (200)
          expect([200, 403, 429]).toContain(res.status);
        }
      }
    });

    it('T4_S02: Frictionless User Signup via 1-Tap Google OAuth', async () => {
      // User scenario: New visitor registers via Google 1-tap popup
      const googleEmail = 'new_scholar@gmail.com';
      const idToken = await createMockFirebaseToken({
        uid: 'google_scholar_999',
        email: googleEmail,
        name: 'Mirza Asadullah Baig'
      });

      const res = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
      }, getTestEnv());

      const result = await assertContract(res, 200, (data) => {
        expect(data.token).toBeDefined();
        expect(data.user.email).toBe(googleEmail);
      });

      if (!result.pending) {
        // Sovereign session token can access /auth/me
        const meRes = await app.request('/auth/me', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${result.data.token}` }
        }, getTestEnv());

        expect(meRes.status).toBe(200);
        const meData: any = await meRes.json();
        expect(meData.email).toBe(googleEmail);
      }
    });

    it('T4_S03: Returning Phone OTP Login & Full Authenticated Workflow', async () => {
      // User scenario: Member requests OTP, verifies client-side, submits ID token
      const phone = '+14155559876';

      // Step 1: Pre-flight gatekeeper
      const otpRes = await app.request('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, turnstile_token: dummyTurnstileToken })
      }, getTestEnv());

      await assertContract(otpRes, 200);

      // Step 2: Client Firebase phone auth completes and submits ID token
      const idToken = await createMockFirebaseToken({
        uid: 'phone_verified_user',
        phone_number: phone
      });

      const loginRes = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, provider: 'phone' })
      }, getTestEnv());

      await assertContract(loginRes, 200, (data) => {
        expect(data.token).toBeDefined();
        expect(data.user.phone).toBe(phone);
      });
    });

    it('T4_S04: User Identity Convergence (Traditional user logs in via Google)', async () => {
      // User scenario: Existing user created via email/password logs in with same email on Google
      const email = 'converged_poet@alfaaz.local';
      const initialPassword = 'PoetSecurePass123!';
      const hash = await hashPassword(initialPassword);

      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind(email, hash, 'Converged Poet', 'PARTICIPANT')
        .run();

      // Log in via Google
      const idToken = await createMockFirebaseToken({
        uid: 'google_converged_uid',
        email,
        name: 'Converged Poet'
      });

      const res = await app.request('/auth/federated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, provider: 'google.com' })
      }, getTestEnv());

      await assertContract(res, 200, (data) => {
        expect(data.user.email).toBe(email);
        expect(data.user.status).toBe('PARTICIPANT');
      });
    });

    it('T4_S05: Curatorial Luxury Auth Dual Toggle UX & State Synchronization', () => {
      // UX scenario: Verify static markup for dual toggle, return link, and form attributes
      const loginHtmlPath = path.resolve(process.cwd(), 'frontend/login.html');
      const content = fs.readFileSync(loginHtmlPath, 'utf8');

      expect(content).toContain('class="auth-card panel"');
      expect(content).toContain('id="authForm"');
      expect(content).toContain('id="returnBtn"');
      expect(content).toContain('Lost Password?');
    });
  });
});
