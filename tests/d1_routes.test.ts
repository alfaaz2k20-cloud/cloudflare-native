import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken } from '../backend/src/auth/crypto';

describe('Real Route-Level D1 SQLite & R2 Integration Test Suite', () => {
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
      EMAIL_PROVIDER: 'dev' as const
    };
  }

  beforeEach(() => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();
  });

  describe('Authentication Routes (/auth/*)', () => {
    it('POST /auth/register creates a new user in D1 and returns JWT', async () => {
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'poet@alfaaz.local',
          password: 'Password123!',
          full_name: 'Mirza Ghalib'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('poet@alfaaz.local');
      expect(data.user.status).toBe('PARTICIPANT');

      // Verify row in D1
      const user = await mockDb.prepare('SELECT email, full_name, status FROM users WHERE email = ?')
        .bind('poet@alfaaz.local')
        .first();
      expect(user).toBeDefined();
      expect((user as any).full_name).toBe('Mirza Ghalib');
    });

    it('POST /auth/register rejects duplicate registration with 400', async () => {
      const payload = JSON.stringify({
        email: 'volunteer@alfaaz.com', // Seed user
        password: 'Password123!',
        full_name: 'Existing Volunteer'
      });

      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('already registered');
    });

    it('POST /auth/login validates credentials and returns session token', async () => {
      // Seed user has password 'alfaaz2026!'
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'volunteer@alfaaz.com',
          password: 'alfaaz2026!'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('volunteer@alfaaz.com');
    });

    it('POST /auth/login rejects incorrect password with 401', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'volunteer@alfaaz.com',
          password: 'WrongPassword!'
        })
      }, getTestEnv());

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.detail).toBe('Invalid credentials');
    });

    it('GET /auth/me returns profile for authenticated Bearer token', async () => {
      const token = await createToken('volunteer@alfaaz.com', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.email).toBe('volunteer@alfaaz.com');
      expect(data.status).toBe('PARTICIPANT');
    });

    it('GET /auth/me rejects unauthorized request with 401', async () => {
      const res = await app.request('/auth/me', {}, getTestEnv());
      expect(res.status).toBe(401);
    });

    it('POST /auth/forgot-password and /auth/reset-password flow works end-to-end', async () => {
      const forgotRes = await app.request('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'volunteer@alfaaz.com' })
      }, getTestEnv());

      expect(forgotRes.status).toBe(200);
      const forgotData: any = await forgotRes.json();
      expect(forgotData.message).toContain('reset link has been dispatched');

      // Generate a valid reset token
      const resetToken = await createToken('volunteer@alfaaz.com', 'reset' as any, jwtSecret);

      const resetRes = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          new_password: 'NewPassword2026!'
        })
      }, getTestEnv());

      expect(resetRes.status).toBe(200);

      // Verify login with new password
      const newLogin = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'volunteer@alfaaz.com',
          password: 'NewPassword2026!'
        })
      }, getTestEnv());

      expect(newLogin.status).toBe(200);
    });
  });

  describe('Recruitment Assessment Lifecycle (/recruit/*)', () => {
    it('POST /recruit/consent creates a valid recruitment session', async () => {
      const res = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_18_plus: true,
          choices: { research_telemetry: true }
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.session_id).toBeDefined();
      expect(data.world_sequence).toBeInstanceOf(Array);
      expect(data.world_sequence.length).toBeGreaterThan(0);

      // Verify row in D1 recruit_sessions
      const session = await mockDb.prepare('SELECT status FROM recruit_sessions WHERE session_id = ?')
        .bind(data.session_id)
        .first();
      expect(session).toBeDefined();
      expect((session as any).status).toBe('CONSENTED');
    });

    it('POST /recruit/identity binds candidate identity to session', async () => {
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      const identityRes = await app.request('/recruit/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          full_name: 'Faiz Ahmad Faiz',
          email: 'faiz@alfaaz.local',
          linkedin_url: 'https://linkedin.com/in/faiz-ahmad'
        })
      }, getTestEnv());

      expect(identityRes.status).toBe(200);
      const data: any = await identityRes.json();
      expect(data.status).toBe('SUCCESS');

      // Verify identity in D1 applicant_identities
      const identity = await mockDb.prepare('SELECT full_name, email, linkedin_url FROM applicant_identities WHERE session_id = ?')
        .bind(sId)
        .first();
      expect((identity as any).full_name).toBe('Faiz Ahmad Faiz');
      expect((identity as any).email).toBe('faiz@alfaaz.local');
    });

    it('POST /recruit/sjt/submit submits scenario responses and synthesizes evidence', async () => {
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      const submitRes = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          responses: {
            S1: 'S1A',
            S2: 'S2B',
            S3: 'S3C',
            S4: 'S4A',
            S5: 'S5B',
            S6: 'S6C',
            S7: 'S7D'
          },
          t_ms: 2400
        })
      }, getTestEnv());

      expect(submitRes.status).toBe(200);
      const data: any = await submitRes.json();
      expect(data.status).toBe('SUCCESS');

      // Verify stored with option_id column in D1 sjt_responses
      const sjtRows = await mockDb.prepare('SELECT scenario_id, option_id FROM sjt_responses WHERE session_id = ?')
        .bind(sId)
        .all();
      expect(sjtRows.results).toHaveLength(7);
      const first = (sjtRows.results as any[]).find(r => r.scenario_id === 'S1');
      expect(first.option_id).toBe('S1A');

      // Verify evidence records synthesized
      const evidenceRows = await mockDb.prepare('SELECT parameter, sjt_band FROM evidence WHERE session_id = ?')
        .bind(sId)
        .all();
      expect(evidenceRows.results.length).toBeGreaterThan(0);
    });

    it('POST /recruit/telemetry ingests batches and enforces cap', async () => {
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      const telemRes = await app.request('/recruit/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          events: [
            { seq: 1, segment_id: 0, t_ms: 100, screen: 'warmup', action: 'mouse_move', data_json: '{}' },
            { seq: 2, segment_id: 0, t_ms: 250, screen: 'warmup', action: 'click', data_json: '{}' }
          ]
        })
      }, getTestEnv());

      expect(telemRes.status).toBe(200);
      const data: any = await telemRes.json();
      expect(data.status).toBe('SUCCESS');
      expect(data.ingested_count).toBe(2);

      const countRow: any = await mockDb.prepare('SELECT COUNT(*) as cnt FROM telemetry_events WHERE session_id = ?')
        .bind(sId)
        .first();
      expect(countRow.cnt).toBe(2);
    });

    it('POST /recruit/complete returns status SUCCESS and session_status COMPLETE', async () => {
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      const compRes = await app.request('/recruit/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sId })
      }, getTestEnv());

      expect(compRes.status).toBe(200);
      const data: any = await compRes.json();
      expect(data.status).toBe('SUCCESS');
      expect(data.session_status).toBe('COMPLETE');
      expect(data.is_already_completed).toBe(false);

      // Verify D1 status in recruit_sessions
      const sessionRow: any = await mockDb.prepare('SELECT status, completed_at FROM recruit_sessions WHERE session_id = ?')
        .bind(sId)
        .first();
      expect(sessionRow.status).toBe('COMPLETE');
      expect(sessionRow.completed_at).toBeDefined();
    });

    it('GET /recruit/interview-slots and POST /recruit/schedule-interview workflow', async () => {
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      // 1. Fetch available days & slots
      const slotsRes = await app.request('/recruit/interview-slots', {}, getTestEnv());
      expect(slotsRes.status).toBe(200);
      const slotsData: any = await slotsRes.json();
      expect(slotsData.days).toBeInstanceOf(Array);
      expect(slotsData.days.length).toBeGreaterThan(0);
      const firstDay = slotsData.days[0];
      const slotDate = firstDay.date;
      const slotTime = firstDay.times[0];

      // 2. Book slot
      const bookRes = await app.request('/recruit/schedule-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          candidate_name: 'Habib Jalib',
          candidate_email: 'jalib@alfaaz.local',
          slot_date: slotDate,
          slot_time: slotTime,
          slot_display: `${firstDay.date_label} · ${slotTime}`
        })
      }, getTestEnv());

      expect(bookRes.status).toBe(200);
      const bookData: any = await bookRes.json();
      expect(bookData.status).toBe('CONFIRMED');
      expect(bookData.booking.slot_time).toBe(slotTime);

      // 3. Duplicate booking collision returns 409 Conflict
      const secondConsent = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const secondSessionId = (await secondConsent.json() as any).session_id;

      const dupRes = await app.request('/recruit/schedule-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: secondSessionId,
          candidate_name: 'Second Person',
          candidate_email: 'second@alfaaz.local',
          slot_date: slotDate,
          slot_time: slotTime
        })
      }, getTestEnv());

      expect(dupRes.status).toBe(409);
      const dupData: any = await dupRes.json();
      expect(dupData.detail).toContain('just taken');

      // 4. Retrieve booking (Admin retrieves full candidate PII; unauthenticated gets safe booking without PII)
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);
      const checkBooking = await app.request(`/recruit/interview-booking/${sId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(checkBooking.status).toBe(200);
      const bookingData: any = await checkBooking.json();
      expect(bookingData.booking).toBeDefined();
      expect(bookingData.booking.candidate_email).toBe('jalib@alfaaz.local');

      // Unauthenticated caller cannot see candidate PII
      const unauthCheck = await app.request(`/recruit/interview-booking/${sId}`, {}, getTestEnv());
      const unauthData: any = await unauthCheck.json();
      expect(unauthData.booking.candidate_email).toBeUndefined();
      expect(unauthData.booking.candidate_phone).toBeUndefined();
      expect(unauthData.booking.slot_display).toBeDefined();
    });
  });

  describe('Recruiter Research View (/recruit/research/*)', () => {
    it('GET /recruit/research/sessions returns candidate profiles with full_name & email', async () => {
      // Create a consented session with identity
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      await app.request('/recruit/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          full_name: 'Zuhair Kashfi',
          email: 'zuhair@alfaaz.local'
        })
      }, getTestEnv());

      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/recruit/research/sessions', {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThanOrEqual(1);

      const candidate = data.find((c: any) => c.session_id === sId);
      expect(candidate).toBeDefined();
      expect(candidate.full_name).toBe('Zuhair Kashfi');
      expect(candidate.email).toBe('zuhair@alfaaz.local');
    });

    it('GET /recruit/research/sessions/:session_id returns full dossier schema and logs access', async () => {
      // Create session, identity, and submit SJT
      const consentRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const sId = (await consentRes.json() as any).session_id;

      await app.request('/recruit/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          full_name: 'Jaun Elia',
          email: 'jaun@alfaaz.local'
        })
      }, getTestEnv());

      await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sId,
          responses: {
            S1: 'S1A',
            S2: 'S2B',
            S3: 'S3C',
            S4: 'S4A',
            S5: 'S5B',
            S6: 'S6C',
            S7: 'S7D'
          }
        })
      }, getTestEnv());

      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request(`/recruit/research/sessions/${sId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const dossier: any = await res.json();
      expect(dossier.metadata).toBeDefined();
      expect(dossier.metadata.session_id).toBe(sId);
      expect(dossier.profile_summary).toBeDefined();
      expect(dossier.dimensions).toBeInstanceOf(Array);
      expect(dossier.dimensions.length).toBe(7);
      expect(dossier.evidence_by_parameter).toBeDefined();
      expect(dossier.psychometric_status).toBeDefined();

      // Verify access log inserted in D1 with valid columns
      const log = await mockDb.prepare('SELECT admin_email, session_id FROM recruiter_access_logs WHERE session_id = ?')
        .bind(sId)
        .first();
      expect(log).toBeDefined();
      expect((log as any).admin_email).toBe('admin@alfaaz.com');
    });

    it('GET and POST /recruit/research/interview-settings reads and writes settings in D1', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      // GET default settings
      const getRes = await app.request('/recruit/research/interview-settings', {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(getRes.status).toBe(200);
      const initialSettings: any = await getRes.json();
      expect(initialSettings.slots).toBeInstanceOf(Array);

      // POST updated settings
      const postRes = await app.request('/recruit/research/interview-settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slots: ['11:00 AM', '03:00 PM', '05:00 PM'],
          skip_days: ['Sunday', 'Friday']
        })
      }, getTestEnv());

      expect(postRes.status).toBe(200);

      // GET updated settings to verify persistence
      const updatedRes = await app.request('/recruit/research/interview-settings', {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      const updatedData: any = await updatedRes.json();
      expect(updatedData.slots).toEqual(['11:00 AM', '03:00 PM', '05:00 PM']);
      expect(updatedData.skip_days).toEqual(['Sunday', 'Friday']);
    });
  });

  describe('Events and Collective Circles (/events/* and /clubs/*)', () => {
    it('GET /events/active returns live community events', async () => {
      const res = await app.request('/events/active', {}, getTestEnv());
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toBeDefined();
      expect(data[0].capacity).toBeDefined();
    });

    it('POST /events/register registers participant and enforces duplicate prevention', async () => {
      const token = await createToken('newvolunteer@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const regRes = await app.request('/events/register', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_id: 1,
          whatsapp_number: '+919876543210'
        })
      }, getTestEnv());

      expect(regRes.status).toBe(200);
      const regData: any = await regRes.json();
      expect(regData.status).toBe('SUCCESS');

      // Duplicate registration attempt returns 400
      const dupRes = await app.request('/events/register', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_id: 1,
          whatsapp_number: '+919876543210'
        })
      }, getTestEnv());

      expect(dupRes.status).toBe(400);
      const dupData: any = await dupRes.json();
      expect(dupData.detail).toContain('Already registered');
    });

    it('GET /clubs/my-status and POST /clubs/apply handle club membership applications', async () => {
      const token = await createToken('poet@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // Status before applying
      const preStatus = await app.request('/clubs/my-status', {
        headers: { Authorization: `Bearer ${token}` }
      }, getTestEnv());
      expect(preStatus.status).toBe(200);
      const preData: any = await preStatus.json();
      expect(preData.status).toBe('NONE');

      // Apply for circle
      const applyRes = await app.request('/clubs/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          club_name: 'Literature',
          note: 'I wish to contribute Urdu poetry translation work.'
        })
      }, getTestEnv());

      expect(applyRes.status).toBe(200);
      const applyData: any = await applyRes.json();
      expect(applyData.status).toBe('PENDING');

      // Status after applying
      const postStatus = await app.request('/clubs/my-status', {
        headers: { Authorization: `Bearer ${token}` }
      }, getTestEnv());
      const postData: any = await postStatus.json();
      expect(postData.status).toBe('PENDING');
      expect(postData.club).toBe('Literature');
    });
  });

  describe('Creative Vault & Exhibitions (/vault/* and /exhibitions/*)', () => {
    it('POST /vault/submit and GET /vault/file/:key store and retrieve assets via R2', async () => {
      const token = await createToken('volunteer@alfaaz.com', 'PARTICIPANT', jwtSecret);

      // Create multipart submission
      const formData = new FormData();
      formData.append('submission_type', 'POEM_MANUSCRIPT');
      formData.append('title', 'Subh-e-Azadi');
      formData.append('note', 'Draft archival version');
      const testFile = new File(['Ye daagh daagh ujaala ye shab-gazeeda sahar'], 'manuscript.txt', {
        type: 'text/plain'
      });
      formData.append('file', testFile);

      const submitRes = await app.request('/vault/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      }, getTestEnv());

      expect(submitRes.status).toBe(200);
      const submitData: any = await submitRes.json();
      expect(submitData.status).toBe('SUCCESS');

      // Verify row in submissions table in D1
      const subRow: any = await mockDb.prepare('SELECT file_url FROM submissions WHERE author_email = ? AND title = ?')
        .bind('volunteer@alfaaz.com', 'Subh-e-Azadi')
        .first();
      expect(subRow).toBeDefined();
      expect(subRow.file_url).toContain('/vault/file/');

      // Now retrieve the file via the returned URL (authenticated)
      const getFileRes = await app.request(subRow.file_url, {
        headers: { Authorization: `Bearer ${token}` }
      }, getTestEnv());
      expect(getFileRes.status).toBe(200);
      expect(getFileRes.headers.get('cache-control')).toContain('private');
      const fileContent = await getFileRes.text();
      expect(fileContent).toBe('Ye daagh daagh ujaala ye shab-gazeeda sahar');
    });

    it('GET /exhibitions/config and POST /exhibitions/apply', async () => {
      const configRes = await app.request('/exhibitions/config', {}, getTestEnv());
      expect(configRes.status).toBe(200);
      const configData: any = await configRes.json();
      expect(configData.is_open).toBe(true);
      expect(configData.title).toBe('KAAMIL III — The Vernacular Breath');

      const token = await createToken('artist@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const applyRes = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: 'Amrita Sher-Gil',
          age: 28,
          address: 'Shimla, Himachal Pradesh',
          whatsapp: '+919419011111',
          genre: 'Contemporary Visual Art',
          medium: 'Oil on Canvas',
          portfolio_url: 'https://alfaaz.local/amrita',
          over_19: true,
          agreed_to_screening: true
        })
      }, getTestEnv());

      expect(applyRes.status).toBe(200);
      const applyData: any = await applyRes.json();
      expect(applyData.status).toBe('SUCCESS');

      // Verify row in D1 exhibition_applications
      const appRow: any = await mockDb.prepare('SELECT full_name, status FROM exhibition_applications WHERE user_email = ?')
        .bind('artist@alfaaz.local')
        .first();
      expect(appRow).toBeDefined();
      expect(appRow.full_name).toBe('Amrita Sher-Gil');
      expect(appRow.status).toBe('PENDING');
    });

    it('GET /api/notices returns live notice feed matching schema { events, exhibition, latest_blog }', async () => {
      // Seed a test blog
      await mockDb.prepare('INSERT INTO blogs (title, excerpt, content, is_published) VALUES (?, ?, ?, 1)')
        .bind('Kashmiri Aesthetic Modernism', 'A deep contemplation on art', 'Full content here')
        .run();

      const res = await app.request('/api/notices', { method: 'GET' }, getTestEnv());
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('exhibition');
      expect(data).toHaveProperty('latest_blog');
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.latest_blog).not.toBeNull();
      expect(data.latest_blog.title).toBeTruthy();

      // Test dual-mount /notices as well
      const dualRes = await app.request('/notices', { method: 'GET' }, getTestEnv());
      expect(dualRes.status).toBe(200);
    });

    it('handles legacy blog backward compatibility routes with 301 redirects to canonical endpoints', async () => {
      // 1. GET /api/blog?id=1 redirects (301) to canonical /api/blogs/1
      const redirectRes = await app.request('/api/blog?id=1', { method: 'GET' }, getTestEnv());
      expect(redirectRes.status).toBe(301);
      expect(redirectRes.headers.get('location')).toBe('/api/blogs/1');

      // 2. GET /api/blog without id returns 400
      const missingIdRes = await app.request('/api/blog', { method: 'GET' }, getTestEnv());
      expect(missingIdRes.status).toBe(400);

      // 3. GET /api/blog with non-numeric id returns 400
      const invalidIdRes = await app.request('/api/blog?id=invalid', { method: 'GET' }, getTestEnv());
      expect(invalidIdRes.status).toBe(400);

      // 4. GET /api/blogs returns 200 list of published articles
      const blogsListRes = await app.request('/api/blogs', { method: 'GET' }, getTestEnv());
      expect(blogsListRes.status).toBe(200);
      const blogsData: any = await blogsListRes.json();
      expect(Array.isArray(blogsData)).toBe(true);

      // 5. GET /notices/blogs redirects (301) to canonical /api/blogs
      const noticesBlogsRes = await app.request('/notices/blogs', { method: 'GET' }, getTestEnv());
      expect(noticesBlogsRes.status).toBe(301);
      expect(noticesBlogsRes.headers.get('location')).toBe('/api/blogs');
    });
  });
});
