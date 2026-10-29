import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken } from '../backend/src/auth/crypto';

describe('Adversarial Hardening: Concurrency, Schema Integrity & Bounds Verification', () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let mockR2: ReturnType<typeof createMockR2>;
  let mockKv: ReturnType<typeof createMockKV>;
  const jwtSecret = 'super-secret-hardening-test-jwt-key-32';

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

  describe('1. Interview Booking Race Conditions & Slot Concurrency', () => {
    it('guarantees that 5 simultaneous race-condition booking attempts result in exactly 1 confirmation and 4 rejections (409)', async () => {
      // 1. Setup 5 distinct candidate sessions
      const sessionIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const cRes = await app.request('/recruit/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
        }, getTestEnv());
        const data: any = await cRes.json();
        sessionIds.push(data.session_id);
      }
      expect(sessionIds).toHaveLength(5);

      const targetDate = '2026-12-05';
      const targetTime = '05:30 PM';

      // 2. Fire 5 simultaneous requests targeting the exact same slot
      const racePromises = sessionIds.map((sid, idx) =>
        app.request('/recruit/schedule-interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sid,
            candidate_name: `Candidate ${idx + 1}`,
            candidate_email: `candidate${idx + 1}@alfaaz.local`,
            slot_date: targetDate,
            slot_time: targetTime
          })
        }, getTestEnv())
      );

      const responses = await Promise.all(racePromises);
      const statuses = responses.map(r => r.status);

      // Exactly 1 must be 200, exactly 4 must be 409
      const successCount = statuses.filter(s => s === 200).length;
      const conflictCount = statuses.filter(s => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      // Verify error message for the 4 rejected attempts
      for (const res of responses) {
        if (res.status === 409) {
          const body: any = await res.json();
          expect(body.detail).toContain('just taken');
        }
      }

      // Verify underlying database contains exactly 1 booking for this slot
      const bookedRows = await mockDb.prepare(
        'SELECT id, session_id, candidate_name FROM interview_bookings WHERE slot_date = ? AND slot_time = ?'
      ).bind(targetDate, targetTime).all();

      expect(bookedRows.results).toHaveLength(1);
    });

    it('enforces database-level UNIQUE(slot_date, slot_time) rejection even if application-level check is bypassed', async () => {
      // Directly bypass app layer and execute raw SQLite insert
      const rawDb = mockDb._sqlite;

      rawDb.exec("INSERT INTO recruit_sessions (session_id) VALUES ('s_raw_1')");
      rawDb.exec("INSERT INTO recruit_sessions (session_id) VALUES ('s_raw_2')");

      // First direct insert
      rawDb.prepare(`
        INSERT INTO interview_bookings (session_id, candidate_name, candidate_email, slot_date, slot_time, slot_display)
        VALUES ('s_raw_1', 'Raw One', 'raw1@alfaaz.local', '2026-12-10', '03:00 PM', 'Dec 10, 03:00 PM')
      `).run();

      // Second direct insert for exact same slot must throw SQLite UNIQUE constraint error
      expect(() => {
        rawDb.prepare(`
          INSERT INTO interview_bookings (session_id, candidate_name, candidate_email, slot_date, slot_time, slot_display)
          VALUES ('s_raw_2', 'Raw Two', 'raw2@alfaaz.local', '2026-12-10', '03:00 PM', 'Dec 10, 03:00 PM')
        `).run();
      }).toThrow(/UNIQUE constraint failed: interview_bookings\.slot_date, interview_bookings\.slot_time/);
    });
  });

  describe('2. Event Registration Duplication & Concurrency', () => {
    it('rejects concurrent registration requests from the same user for the same event', async () => {
      const userToken = await createToken('concurrent_user@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // Concurrent race for Event 1
      const p1 = app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 1 })
      }, getTestEnv());

      const p2 = app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 1 })
      }, getTestEnv());

      const [res1, res2] = await Promise.all([p1, p2]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);

      // The second request must fail (either with 400 'Already registered' or DB constraint rejection)
      const otherStatus = statuses.find(s => s !== 200);
      expect(otherStatus).toBe(400);

      // Verify database contains exactly 1 registration
      const rows = await mockDb.prepare(
        'SELECT id FROM event_registrations WHERE event_id = 1 AND user_email = ?'
      ).bind('concurrent_user@alfaaz.local').all();

      expect(rows.results).toHaveLength(1);
    });

    it('enforces database-level UNIQUE(event_id, user_email) constraint directly', async () => {
      const rawDb = mockDb._sqlite;

      rawDb.prepare(`
        INSERT INTO event_registrations (event_id, user_email)
        VALUES (2, 'direct_db_attendee@alfaaz.local')
      `).run();

      expect(() => {
        rawDb.prepare(`
          INSERT INTO event_registrations (event_id, user_email)
          VALUES (2, 'direct_db_attendee@alfaaz.local')
        `).run();
      }).toThrow(/UNIQUE constraint failed: event_registrations\.event_id, event_registrations\.user_email/);
    });
  });

  describe('3. Out-of-Bounds SJT Input Validation & Scoring Hardening', () => {
    let consentedSessionId: string;

    beforeEach(async () => {
      const cRes = await app.request('/recruit/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_18_plus: true, choices: { research_telemetry: true } })
      }, getTestEnv());
      const data: any = await cRes.json();
      consentedSessionId = data.session_id;
    });

    it('rejects empty or missing responses dictionary with 400', async () => {
      const res1 = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: {} })
      }, getTestEnv());
      expect(res1.status).toBe(400);

      const res2 = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: null })
      }, getTestEnv());
      expect(res2.status).toBe(400);

      const res3 = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: 'not-an-object' })
      }, getTestEnv());
      expect(res3.status).toBe(400);
    });

    it('rejects incomplete responses (missing required scenarios) with 400', async () => {
      const res = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: consentedSessionId,
          responses: {
            S1: 'S1A',
            S2: 'S2A'
            // Missing S3..S7
          }
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Missing response for scenario S3');
    });

    it('rejects out-of-bounds / fictitious option IDs with 400', async () => {
      const res = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: consentedSessionId,
          responses: {
            S1: 'S1_IMPOSSIBLE_OPTION_X',
            S2: 'S2A', S3: 'S3A', S4: 'S4A', S5: 'S5A', S6: 'S6A', S7: 'S7A'
          }
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Invalid option S1_IMPOSSIBLE_OPTION_X for scenario S1');
    });

    it('rejects options belonging to a different scenario with 400', async () => {
      const res = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: consentedSessionId,
          responses: {
            S1: 'S2A', // Option S2A is valid for S2, but illegal for S1
            S2: 'S2A', S3: 'S3A', S4: 'S4A', S5: 'S5A', S6: 'S6A', S7: 'S7A'
          }
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Invalid option S2A for scenario S1');
    });

    it('preserves existing responses and rejects conflicting resubmission with 409', async () => {
      const initialResponses = {
        S1: 'S1A', S2: 'S2A', S3: 'S3A', S4: 'S4A', S5: 'S5A', S6: 'S6A', S7: 'S7A'
      };

      // Initial successful submission
      const firstRes = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: initialResponses })
      }, getTestEnv());
      expect(firstRes.status).toBe(200);

      // Attempt conflicting resubmission (different answers)
      const conflictResponses = {
        S1: 'S1B', S2: 'S2B', S3: 'S3B', S4: 'S4B', S5: 'S5B', S6: 'S6B', S7: 'S7B'
      };
      const secondRes = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: conflictResponses })
      }, getTestEnv());

      expect(secondRes.status).toBe(409);
      const errData: any = await secondRes.json();
      expect(errData.detail).toContain('Conflicting SJT submission rejected');

      // Verify data_quality_flags recorded the tampering attempt
      const flagRows = await mockDb.prepare(
        'SELECT flag, detail FROM data_quality_flags WHERE session_id = ?'
      ).bind(consentedSessionId).all();
      expect(flagRows.results).toHaveLength(1);
      expect((flagRows.results[0] as any).flag).toBe('sjt_conflict');

      // Verify original responses in sjt_responses were untouched
      const originalRow = await mockDb.prepare(
        'SELECT option_id FROM sjt_responses WHERE session_id = ? AND scenario_id = ?'
      ).bind(consentedSessionId, 'S1').first<{ option_id: string }>();
      expect(originalRow?.option_id).toBe('S1A');
    });

    it('accepts idempotent resubmission of identical responses with 200', async () => {
      const initialResponses = {
        S1: 'S1A', S2: 'S2A', S3: 'S3A', S4: 'S4A', S5: 'S5A', S6: 'S6A', S7: 'S7A'
      };

      await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: initialResponses })
      }, getTestEnv());

      const res = await app.request('/recruit/sjt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: consentedSessionId, responses: initialResponses })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.message).toContain('Idempotent SJT resubmission accepted');
    });
  });
});
