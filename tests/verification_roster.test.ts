import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, hashPassword } from '../backend/src/auth/crypto';
import { devEmailPreviews } from '../backend/src/notifications/email';

describe('Contact Cross-Verification & Collective Roster Activity Ledger Suite', () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let mockR2: ReturnType<typeof createMockR2>;
  let mockKv: ReturnType<typeof createMockKV>;

  const jwtSecret = 'test-jwt-secret-verification-32chars!';
  const passTurnstileSecret = '1x0000000000000000000000000000000AA';
  const dummyTurnstileToken = '0x4AAAAAAtestdummytoken';
  const simulatedProdTurnstileSecret = '0x4AAAAAAtest_simulated_production_secret';

  const originalFetch = globalThis.fetch;
  beforeAll(() => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any)?.url;
      if (url && url.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(input, init);
    };
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

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

  beforeEach(() => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();
    devEmailPreviews.length = 0;
  });

  describe('Part 3: Contact Cross-Verification System', () => {
    it('V_01: POST /verification/email/send rejects unauthenticated requests with 401', async () => {
      const res = await app.request('/verification/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unauth@alfaaz.local' })
      }, getTestEnv());

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.detail).toMatch(/Authentication required/i);
    });

    it('V_02: POST /verification/email/send rejects invalid email format with 400', async () => {
      const userEmail = 'phoneuser1@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, phone, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, ?, 0, 1)')
        .bind(userEmail, '+14155550001', 'Phone User 1', 'PARTICIPANT')
        .run();

      const token = await createToken({ email: userEmail, status: 'PARTICIPANT' }, jwtSecret);

      const res = await app.request('/verification/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: 'not-an-email' })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/valid email/i);
    });

    it('V_03: POST /verification/email/send rejects email already claimed by another user with 409', async () => {
      const existingUserEmail = 'existing@alfaaz.local';
      const currentUserEmail = 'phoneuser2@alfaaz.local';

      await mockDb.prepare('INSERT INTO users (email, full_name, status) VALUES (?, ?, ?)')
        .bind(existingUserEmail, 'Existing User', 'PARTICIPANT')
        .run();

      await mockDb.prepare('INSERT INTO users (email, phone, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, ?, 0, 1)')
        .bind(currentUserEmail, '+14155550002', 'Phone User 2', 'PARTICIPANT')
        .run();

      const token = await createToken({ email: currentUserEmail, status: 'PARTICIPANT' }, jwtSecret);

      const res = await app.request('/verification/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: existingUserEmail })
      }, getTestEnv());

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/already in use/i);
    });

    it('V_04: POST /verification/email/send generates code and enforces 60s cooldown (429)', async () => {
      const userEmail = 'poet_cross@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, phone, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, ?, 0, 1)')
        .bind(userEmail, '+14155550003', 'Cross Poet', 'PARTICIPANT')
        .run();

      const token = await createToken({ email: userEmail, status: 'PARTICIPANT' }, jwtSecret);

      // First dispatch: 200 OK
      const res1 = await app.request('/verification/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: userEmail })
      }, getTestEnv());

      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);

      // Verify email was logged to devEmailPreviews
      expect(devEmailPreviews.length).toBe(1);
      expect(devEmailPreviews[0].to).toBe(userEmail);
      expect(devEmailPreviews[0].text).toMatch(/\b\d{6}\b/);

      // Immediate second dispatch: 429 Too Many Requests
      const res2 = await app.request('/verification/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: userEmail })
      }, getTestEnv());

      expect(res2.status).toBe(429);
      expect(res2.headers.get('Retry-After')).toBeDefined();
    });

    it('V_05: POST /verification/email/confirm validates code, increments attempts, and verifies email', async () => {
      const userEmail = 'verify_me@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, 0, 0)')
        .bind(userEmail, 'Verify Me', 'PARTICIPANT')
        .run();

      const token = await createToken({ email: userEmail, status: 'PARTICIPANT' }, jwtSecret);

      // 1. Dispatch verification code
      await app.request('/verification/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: userEmail })
      }, getTestEnv());

      // Extract dispatched 6-digit code from dev preview
      const previewText = devEmailPreviews[0].text;
      const codeMatch = previewText.match(/\b\d{6}\b/);
      expect(codeMatch).not.toBeNull();
      const code = codeMatch![0];

      // 2. Reject incorrect code format (400)
      const resBadFormat = await app.request('/verification/email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: '123' })
      }, getTestEnv());
      expect(resBadFormat.status).toBe(400);

      // 3. Reject incorrect code digits (400)
      const resWrongCode = await app.request('/verification/email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: '000000' })
      }, getTestEnv());
      expect(resWrongCode.status).toBe(400);

      // 4. Submit correct code -> 200 OK
      const resCorrect = await app.request('/verification/email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      }, getTestEnv());

      expect(resCorrect.status).toBe(200);
      const dataCorrect = await resCorrect.json();
      expect(dataCorrect.success).toBe(true);
      expect(dataCorrect.email_verified).toBe(1);

      // Verify DB row updated
      const userRow: any = await mockDb.prepare('SELECT email_verified, email_verified_at FROM users WHERE email = ?')
        .bind(userEmail)
        .first();
      expect(userRow.email_verified).toBe(1);
      expect(userRow.email_verified_at).not.toBeNull();

      // 5. Code replay rejection: Reusing consumed code -> 400
      const resReplay = await app.request('/verification/email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      }, getTestEnv());
      expect(resReplay.status).toBe(400);
    });

    it('V_06: POST /verification/email/confirm rejects when target does not match registered account email with 409 and leaves email_verified unchanged', async () => {
      const userEmail = 'mismatch_user@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, 0, 0)')
        .bind(userEmail, 'Mismatch User', 'PARTICIPANT')
        .run();

      const userRow: any = await mockDb.prepare('SELECT id FROM users WHERE email = ?').bind(userEmail).first();
      const code = '654321';
      const buffer = new TextEncoder().encode(code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      // Insert active code with a target different from registered email
      await mockDb.prepare(`
        INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at)
        VALUES (?, 'email', 'attacker@alfaaz.local', ?, datetime('now', '+10 minutes'))
      `).bind(userRow.id, codeHash).run();

      const token = await createToken({ email: userEmail, status: 'PARTICIPANT' }, jwtSecret);

      const res = await app.request('/verification/email/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      }, getTestEnv());

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toMatch(/target does not match/i);

      // Verify email_verified is UNCHANGED (still 0)
      const afterUser: any = await mockDb.prepare('SELECT email, email_verified, email_verified_at FROM users WHERE id = ?')
        .bind(userRow.id)
        .first();
      expect(afterUser.email).toBe(userEmail);
      expect(afterUser.email_verified).toBe(0);
      expect(afterUser.email_verified_at).toBeNull();
    });
  });

  describe('Part 4: Collective Roster Activity Ledger', () => {
    it('R_01: GET /admin/users rejects unauthenticated requests with 401', async () => {
      const res = await app.request('/admin/users', { method: 'GET' }, getTestEnv());
      expect(res.status).toBe(401);
    });

    it('R_02: GET /admin/users rejects non-admin users with 403', async () => {
      const participantToken = await createToken({ email: 'poet@alfaaz.local', status: 'PARTICIPANT' }, jwtSecret);
      const res = await app.request('/admin/users', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${participantToken}` }
      }, getTestEnv());

      expect(res.status).toBe(403);
    });

    it('R_03: GET /admin/users projects full participant activity ledger (clubs, events, exhibitions, fees)', async () => {
      // 1. Setup Admin account
      const adminEmail = 'curator_admin@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, ?, 1, 1)')
        .bind(adminEmail, await hashPassword('AdminPass123!'), 'Chief Curator', 'ADMIN')
        .run();
      const adminToken = await createToken({ email: adminEmail, status: 'ADMIN' }, jwtSecret);

      // 2. Setup a Participant with rich activity history
      const poetEmail = 'active_poet@alfaaz.local';
      const poetPhone = '+14155551122';
      await mockDb.prepare('INSERT INTO users (email, phone, full_name, status, auth_provider, email_verified, phone_verified) VALUES (?, ?, ?, ?, ?, 1, 1)')
        .bind(poetEmail, poetPhone, 'Active Poet', 'PARTICIPANT', 'email')
        .run();

      // Seed Club Application
      await mockDb.prepare('INSERT INTO club_applications (user_email, club_name, status) VALUES (?, ?, ?)')
        .bind(poetEmail, 'Khyal Circle', 'APPROVED')
        .run();

      // Seed Event and Registration
      await mockDb.prepare('INSERT INTO events (id, name, description, event_date, registration_open) VALUES (?, ?, ?, ?, 1)')
        .bind(991, 'Baitbazi Mehfil', 'Evening of poetic duels', '2026-11-15')
        .run();
      await mockDb.prepare('INSERT INTO event_registrations (event_id, user_email, whatsapp_number) VALUES (?, ?, ?)')
        .bind(991, poetEmail, poetPhone)
        .run();

      // Seed Exhibition Master and Application
      await mockDb.prepare('INSERT INTO exhibitions_list (id, title, registration_fee, is_active) VALUES (?, ?, ?, 1)')
        .bind(881, 'Cycle 4 — Nuance', '₹500')
        .run();
      await mockDb.prepare(`
        INSERT INTO exhibition_applications 
          (user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status, payment_proof_url, payment_confirmed_at)
        VALUES 
          (?, 'Cycle 4 — Nuance', 'Active Poet', 24, 'Lahore', ?, 'Ghazal', 'Manuscript', 'https://example.com/p', 'APPROVED', 'CONFIRMED', 'https://example.com/receipt.jpg', CURRENT_TIMESTAMP)
      `)
        .bind(poetEmail, poetPhone)
        .run();

      // 3. Request Admin Users Roster
      const res = await app.request('/admin/users', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const roster = await res.json();
      expect(Array.isArray(roster)).toBe(true);

      const poetEntry = roster.find((u: any) => u.email === poetEmail);
      expect(poetEntry).toBeDefined();

      // Identity verification
      expect(poetEntry.email).toBe(poetEmail);
      expect(poetEntry.full_name).toBe('Active Poet');
      expect(poetEntry.phone).toBe(poetPhone);
      expect(poetEntry.email_verified).toBe(1);
      expect(poetEntry.phone_verified).toBe(1);
      expect(poetEntry.auth_provider).toBe('email');

      // Clubs ledger verification
      expect(poetEntry.clubs).toHaveLength(1);
      expect(poetEntry.clubs[0].club_name).toBe('Khyal Circle');
      expect(poetEntry.clubs[0].status).toBe('APPROVED');

      // Events ledger verification
      expect(poetEntry.events).toHaveLength(1);
      expect(poetEntry.events[0].event_name).toBe('Baitbazi Mehfil');
      expect(poetEntry.events[0].event_date).toBe('2026-11-15');

      // Exhibitions ledger verification
      expect(poetEntry.exhibitions).toHaveLength(1);
      expect(poetEntry.exhibitions[0].exhibition_cycle).toBe('Cycle 4 — Nuance');
      expect(poetEntry.exhibitions[0].status).toBe('APPROVED');
      expect(poetEntry.exhibitions[0].registration_status).toBe('CONFIRMED');

      // Fee ledger verification
      expect(poetEntry.fees).toHaveLength(1);
      expect(poetEntry.fees[0].exhibition_cycle).toBe('Cycle 4 — Nuance');
      expect(poetEntry.fees[0].registration_fee).toBe('₹500');
      expect(poetEntry.fees[0].registration_status).toBe('CONFIRMED');
      expect(poetEntry.fees[0].payment_proof_url).toBe('https://example.com/receipt.jpg');
      expect(poetEntry.fees[0].payment_confirmed_at).not.toBeNull();
    });

    it('R_04: GET /admin/users tracks participant every step (chronological timeline, vault submissions, stats) without recruitment leak', async () => {
      const adminEmail = 'super_curator@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status, email_verified, phone_verified) VALUES (?, ?, ?, ?, 1, 1)')
        .bind(adminEmail, await hashPassword('AdminPass123!'), 'Super Curator', 'ADMIN')
        .run();
      const adminToken = await createToken({ email: adminEmail, status: 'ADMIN' }, jwtSecret);

      const candidateEmail = 'candidate_step_tracker@alfaaz.local';
      const candidatePhone = '+919876543210';
      await mockDb.prepare('INSERT INTO users (email, phone, full_name, status, auth_provider, email_verified, phone_verified) VALUES (?, ?, ?, ?, ?, 1, 1)')
        .bind(candidateEmail, candidatePhone, 'Step Tracker Participant', 'PARTICIPANT', 'google')
        .run();

      // Seed Storage Vault Submission
      await mockDb.prepare(`
        INSERT INTO submissions (submission_type, title, file_url, note, author_email)
        VALUES ('audio', 'Chinar Breeze Recitation', 'https://storage.alfaaz.org/vault/recitation.mp3', 'Recorded at sunset', ?)
      `)
        .bind(candidateEmail)
        .run();

      // Seed Event RSVP
      await mockDb.prepare('INSERT INTO events (id, name, description, event_date, registration_open) VALUES (?, ?, ?, ?, 1)')
        .bind(992, 'Autumn Ghazal Evening', 'Outdoor reading', '2026-11-20')
        .run();
      await mockDb.prepare('INSERT INTO event_registrations (event_id, user_email, whatsapp_number) VALUES (?, ?, ?)')
        .bind(992, candidateEmail, candidatePhone)
        .run();

      // Seed Circle Application
      await mockDb.prepare('INSERT INTO club_applications (user_email, club_name, note, status, admin_note) VALUES (?, ?, ?, ?, ?)')
        .bind(candidateEmail, 'Calligraphy Circle', 'Practicing Nastaliq for 3 years', 'APPROVED', 'Welcome!')
        .run();

      // Seed Exhibition Application with terms and payment proof
      await mockDb.prepare('INSERT INTO exhibitions_list (id, title, registration_fee, is_active) VALUES (?, ?, ?, 1)')
        .bind(882, 'Kaamil IV', '₹600')
        .run();
      await mockDb.prepare(`
        INSERT INTO exhibition_applications 
          (user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status, agreed_to_tnc, payment_proof_url, participant_note_reg, payment_confirmed_at)
        VALUES 
          (?, 'Kaamil IV', 'Step Tracker Participant', 22, 'Srinagar', ?, 'Visual', 'Ink on Wasli', 'https://example.com/portfolio.pdf', 'APPROVED', 'CONFIRMED', 1, 'https://example.com/fee_receipt.jpg', 'Transferred via UPI', CURRENT_TIMESTAMP)
      `)
        .bind(candidateEmail, candidatePhone)
        .run();

      // Seed unrelated recruitment session in recruit_sessions and applicant_identities
      // (must NOT be leaked in /admin/users roster)
      const testSessionId = 'test-session-recruitment-123';
      await mockDb.prepare(`
        INSERT INTO recruit_sessions (session_id, status, current_screen) VALUES (?, 'COMPLETE', 'complete')
      `).bind(testSessionId).run();
      await mockDb.prepare(`
        INSERT INTO applicant_identities (session_id, full_name, email, phone_or_contact) VALUES (?, 'Step Tracker Participant', ?, ?)
      `).bind(testSessionId, candidateEmail, candidatePhone).run();

      const res = await app.request('/admin/users', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const roster = await res.json();
      const entry = roster.find((u: any) => u.email === candidateEmail);
      expect(entry).toBeDefined();

      // 1. Storage Vault Submissions wired
      expect(entry.submissions).toHaveLength(1);
      expect(entry.submissions[0].title).toBe('Chinar Breeze Recitation');
      expect(entry.submissions[0].submission_type).toBe('audio');
      expect(entry.submissions[0].file_url).toBe('https://storage.alfaaz.org/vault/recitation.mp3');

      // 2. Timeline step-by-step provenance
      expect(Array.isArray(entry.timeline)).toBe(true);
      expect(entry.timeline.length).toBeGreaterThanOrEqual(6);

      const stepTypes = entry.timeline.map((s: any) => s.step_type);
      expect(stepTypes).toContain('ACCOUNT_CREATED');
      expect(stepTypes).toContain('EMAIL_VERIFIED');
      expect(stepTypes).toContain('PHONE_VERIFIED');
      expect(stepTypes).toContain('EVENT_RSVP');
      expect(stepTypes).toContain('CLUB_APPLICATION');
      expect(stepTypes).toContain('EXHIBITION_SUBMISSION');
      expect(stepTypes).toContain('EXHIBITION_PAYMENT_PROOF');
      expect(stepTypes).toContain('EXHIBITION_PAYMENT_CONFIRMED');
      expect(stepTypes).toContain('VAULT_SUBMISSION');

      // 3. Stats verified
      expect(entry.stats).toBeDefined();
      expect(entry.stats.submissions_count).toBe(1);
      expect(entry.stats.clubs_count).toBe(1);
      expect(entry.stats.events_count).toBe(1);
      expect(entry.stats.exhibitions_count).toBe(1);
      expect(entry.stats.total_steps).toBe(entry.timeline.length);

      // 4. Invariant: Recruitment sessions are strictly NOT in the collective roster
      expect(entry.recruit_sessions).toBeUndefined();
      expect(entry.session_id).toBeUndefined();
      expect(entry.sjt_responses).toBeUndefined();
    });
  });
});
