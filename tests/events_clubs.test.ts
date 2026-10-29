import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken } from '../backend/src/auth/crypto';

describe('Community Events & Collective Circles Subsystem (Real Route Integration)', () => {
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

  describe('Event Registration & Capacity Enforcement (/events/*)', () => {
    it('successfully registers an authenticated user when capacity has space', async () => {
      const userToken = await createToken('newuser@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // Event 1 is 'Harud Poetry Gathering' with capacity 30, open in dev seed
      const res = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          event_id: 1,
          whatsapp_number: '+91 94190 12345'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');

      // Verify row in D1
      const reg = await mockDb.prepare('SELECT * FROM event_registrations WHERE event_id = ? AND user_email = ?')
        .bind(1, 'newuser@alfaaz.local')
        .first();
      expect(reg).toBeDefined();
    });

    it('rejects registration when event registration is closed', async () => {
      // Insert a closed event
      await mockDb.prepare(`
        INSERT INTO events (id, name, description, event_date, capacity, registration_open)
        VALUES (99, 'Closed Gathering', 'Past event', 'Oct 01, 2026', 50, 0)
      `).run();

      const userToken = await createToken('user@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 99 })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Registration closed');
    });

    it('rejects duplicate registration attempt by the same user', async () => {
      // volunteer@alfaaz.com is already registered for event 1 in seed
      const userToken = await createToken('volunteer@alfaaz.com', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 1 })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Already registered');
    });

    it('enforces capacity limit strictly and rejects once full', async () => {
      // Create an event with capacity 1 and fill it
      await mockDb.prepare(`
        INSERT INTO events (id, name, description, event_date, capacity, registration_open)
        VALUES (100, 'Micro Salon', 'One attendee only', 'Nov 20, 2026', 1, 1)
      `).run();
      await mockDb.prepare(`
        INSERT INTO event_registrations (event_id, user_email)
        VALUES (100, 'first@alfaaz.local')
      `).run();

      const userToken = await createToken('second@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 100 })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Event full');
    });

    it('allows unlimited registrations if capacity is 0', async () => {
      // Create an open event with capacity 0 (unlimited)
      await mockDb.prepare(`
        INSERT INTO events (id, name, description, event_date, capacity, registration_open)
        VALUES (101, 'Open Public Reading', 'Unlimited capacity', 'Dec 01, 2026', 0, 1)
      `).run();

      const userToken = await createToken('anyone@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({ event_id: 101 })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');
    });

    it('GET /events/my-registrations returns all events registered by the caller', async () => {
      const userToken = await createToken('volunteer@alfaaz.com', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/events/my-registrations', {
        headers: { Authorization: `Bearer ${userToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].event_name).toBe('Harud Poetry Gathering');
    });
  });

  describe('Collective Circles & Clubs (/clubs/*)', () => {
    it('allows applying to a valid creative club', async () => {
      const userToken = await createToken('writer@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/clubs/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          club_name: 'Literature',
          note: 'Poetry enthusiast eager to join the circle.'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('PENDING');

      // Verify in DB
      const appRow: any = await mockDb.prepare('SELECT * FROM club_applications WHERE user_email = ?')
        .bind('writer@alfaaz.local')
        .first();
      expect(appRow).toBeDefined();
      expect(appRow.club_name).toBe('Literature');
    });

    it('rejects applying with an invalid club name', async () => {
      const userToken = await createToken('writer@alfaaz.local', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/clubs/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          club_name: 'InvalidClubXYZ'
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Invalid club');
    });

    it('rejects duplicate pending club applications from the same user', async () => {
      const userToken = await createToken('writer@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // Pre-insert a pending application
      await mockDb.prepare("INSERT INTO club_applications (user_email, club_name, status) VALUES (?, 'Literature', 'PENDING')")
        .bind('writer@alfaaz.local')
        .run();

      const res = await app.request('/clubs/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          club_name: 'Literature'
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Pending application exists');
    });

    it('blocks applying if user is already an approved member of another club', async () => {
      const userToken = await createToken('member@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // Pre-insert an approved membership
      await mockDb.prepare("INSERT INTO club_applications (user_email, club_name, status) VALUES (?, 'Film Club', 'APPROVED')")
        .bind('member@alfaaz.local')
        .run();

      const res = await app.request('/clubs/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          club_name: 'Philosophy'
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Already a member of Film Club');
    });

    it('GET /clubs/my-status returns the applicant status', async () => {
      const userToken = await createToken('status_user@alfaaz.local', 'PARTICIPANT', jwtSecret);

      await mockDb.prepare("INSERT INTO club_applications (user_email, club_name, status, note) VALUES (?, 'Art & Craft', 'PENDING', 'My art samples')")
        .bind('status_user@alfaaz.local')
        .run();

      const res = await app.request('/clubs/my-status', {
        headers: { Authorization: `Bearer ${userToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('PENDING');
      expect(data.club_name).toBe('Art & Craft');
    });
  });
});
