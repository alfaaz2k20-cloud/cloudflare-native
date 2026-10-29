import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, hashPassword } from '../backend/src/auth/crypto';

describe('Admin Security & Control Subsystem (Real Route Integration)', () => {
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

  describe('User Purge Protection Rules (/admin/users/:email)', () => {
    it('prevents an administrator from purging their own account', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/admin/users/admin@alfaaz.com', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain('Cannot purge your own administrator account');
    });

    it('prevents purging of other administrator accounts', async () => {
      // Insert a secondary admin into D1
      const hashedPassword = await hashPassword('AdminPass123!');
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind('secondary_admin@alfaaz.com', hashedPassword, 'Secondary Admin', 'ADMIN')
        .run();

      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/admin/users/secondary_admin@alfaaz.com', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.error).toContain('Cannot delete an admin account');
    });

    it('permits purging regular participant accounts and cascades records', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      // volunteer@alfaaz.com is seeded as PARTICIPANT with event registrations
      const res = await app.request('/admin/users/volunteer@alfaaz.com', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');

      // Verify user is gone from D1
      const user = await mockDb.prepare('SELECT id FROM users WHERE email = ?')
        .bind('volunteer@alfaaz.com')
        .first();
      expect(user).toBeNull();

      // Verify audit log entry
      const audit = await mockDb.prepare("SELECT * FROM admin_audit_logs WHERE action = 'PURGE_USER'")
        .first();
      expect(audit).toBeDefined();
    });

    it('returns 404 if target user does not exist', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/admin/users/nonexistent@alfaaz.com', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toContain('User not found');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.request('/admin/users/volunteer@alfaaz.com', {
        method: 'DELETE'
      }, getTestEnv());

      expect(res.status).toBe(401);
    });

    it('rejects participant callers with 403', async () => {
      const participantToken = await createToken('volunteer@alfaaz.com', 'PARTICIPANT', jwtSecret);

      const res = await app.request('/admin/users/volunteer@alfaaz.com', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${participantToken}` }
      }, getTestEnv());

      expect(res.status).toBe(403);
    });
  });

  describe('Last Administrator Protection (/admin/update_status)', () => {
    it('blocks demoting the last administrator account when only 1 admin exists', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/admin/update_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'admin@alfaaz.com',
          status: 'PARTICIPANT'
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain('Cannot demote the last administrator account');
    });

    it('allows demoting an administrator when multiple admins exist', async () => {
      // Insert second admin
      const hashedPassword = await hashPassword('AdminPass123!');
      await mockDb.prepare('INSERT INTO users (email, password, full_name, status) VALUES (?, ?, ?, ?)')
        .bind('admin2@alfaaz.com', hashedPassword, 'Second Admin', 'ADMIN')
        .run();

      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/admin/update_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'admin2@alfaaz.com',
          status: 'PARTICIPANT'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');

      // Verify status in DB
      const user: any = await mockDb.prepare('SELECT status FROM users WHERE email = ?')
        .bind('admin2@alfaaz.com')
        .first();
      expect(user.status).toBe('PARTICIPANT');
    });

    it('allows promoting a participant to administrator', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const res = await app.request('/admin/update_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'volunteer@alfaaz.com',
          status: 'ADMIN'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');

      const user: any = await mockDb.prepare('SELECT status FROM users WHERE email = ?')
        .bind('volunteer@alfaaz.com')
        .first();
      expect(user.status).toBe('ADMIN');
    });
  });

  describe('Exhibition Cycle Exclusivity (/admin/exhibitions/:id/activate)', () => {
    it('ensures only one exhibition cycle is active at any time', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      // Insert two additional exhibition cycles
      await mockDb.prepare(`
        INSERT INTO exhibitions_list (title, date_text, venue, about_text, is_active)
        VALUES ('HARUD 2026', 'October 2026', 'Srinagar', 'Harud exhibition', 0)
      `).run();
      await mockDb.prepare(`
        INSERT INTO exhibitions_list (title, date_text, venue, about_text, is_active)
        VALUES ('BAYAAN 2027', 'April 2027', 'Jammu', 'Bayaan exhibition', 0)
      `).run();

      // Activate exhibition 2
      const res = await app.request('/admin/exhibitions/2/activate', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);

      // Verify that exhibition 2 is active and all others are inactive
      const allExhibitions: any = await mockDb.prepare('SELECT id, is_active FROM exhibitions_list').all();
      const activeList = allExhibitions.results.filter((e: any) => e.is_active === 1);
      expect(activeList).toHaveLength(1);
      expect(activeList[0].id).toBe(2);
    });
  });
});
