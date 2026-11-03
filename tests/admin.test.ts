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

    it('toggles age requirement between adult (18+) and youth cycle and verifies dynamic form admission', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);
      const youthToken = await createToken('young_prodigy@alfaaz.local', 'PARTICIPANT', jwtSecret);

      // Verify active exhibition starts with require_over_18 = 1
      const initialConfigRes = await app.request('/exhibitions/config', {}, getTestEnv());
      const initialConfig: any = await initialConfigRes.json();
      expect(initialConfig.require_over_18).toBe(true);

      // Attempting to apply as youth without over_19 check must fail
      const failedApplyRes = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${youthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: 'Young Poet',
          age: 15,
          address: 'Downtown Srinagar',
          whatsapp: '+919419099999',
          genre: 'Poetry',
          medium: 'Kashmiri Verse',
          portfolio_url: 'https://example.com/verse',
          over_19: false,
          agreed_to_screening: true
        })
      }, getTestEnv());
      expect(failedApplyRes.status).toBe(400);

      // Attempting to apply with age: 15 but over_19: true on adult cycle must still fail server-side (no asymmetry)
      const deceptiveApplyRes = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${youthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: 'Young Poet',
          age: 15,
          address: 'Downtown Srinagar',
          whatsapp: '+919419099999',
          genre: 'Poetry',
          medium: 'Kashmiri Verse',
          portfolio_url: 'https://example.com/verse',
          over_19: true,
          agreed_to_screening: true
        })
      }, getTestEnv());
      expect(deceptiveApplyRes.status).toBe(400);
      const deceptiveData: any = await deceptiveApplyRes.json();
      expect(deceptiveData.detail).toMatch(/18 years of age or older/i);

      // Admin toggles exhibition to Youth cycle (require_over_18: 0)
      const toggleRes = await app.request('/admin/exhibitions/1/toggle-age', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ require_over_18: 0 })
      }, getTestEnv());
      expect(toggleRes.status).toBe(200);
      const toggleData: any = await toggleRes.json();
      expect(toggleData.require_over_18).toBe(0);

      // Check /exhibitions/config now reflects require_over_18 = false
      const updatedConfigRes = await app.request('/exhibitions/config', {}, getTestEnv());
      const updatedConfig: any = await updatedConfigRes.json();
      expect(updatedConfig.require_over_18).toBe(false);

      // Now youth application without over_19 succeeds
      const youthApplyRes = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${youthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: 'Young Poet',
          age: 15,
          address: 'Downtown Srinagar',
          whatsapp: '+919419099999',
          genre: 'Poetry',
          medium: 'Kashmiri Verse',
          portfolio_url: 'https://example.com/verse',
          over_19: false,
          agreed_to_screening: true
        })
      }, getTestEnv());
      expect(youthApplyRes.status).toBe(200);

      // Admin dossier retrieval returns all complete applicant fields (zero omitted blanks)
      const dossierRes = await app.request('/admin/exhibitions', {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(dossierRes.status).toBe(200);
      const dossierData: any = await dossierRes.json();
      const applicant = dossierData.find((a: any) => a.user_email === 'young_prodigy@alfaaz.local');
      expect(applicant).toBeDefined();
      expect(applicant.age).toBe(15);
      expect(applicant.address).toBe('Downtown Srinagar');
      expect(applicant.whatsapp).toBe('+919419099999');
      expect(applicant.genre).toBe('Poetry');
      expect(applicant.medium).toBe('Kashmiri Verse');
      expect(applicant.over_19).toBe(false);
    });
  });

  describe('Curatorial Journal & Blog Management (/admin/blogs/*)', () => {
    it('creates, lists, toggles publication status, and deletes blogs with cache invalidation', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      // 1. Create a manual curatorial essay
      const createRes = await app.request('/admin/blogs/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'The Solitude of Saffron',
          excerpt: 'Contemplating agricultural heritage and artistic labor.',
          content: 'Full essay on Kashmiri saffron and curatorial praxis.',
          is_published: 1
        })
      }, getTestEnv());
      expect(createRes.status).toBe(201);
      const createData: any = await createRes.json();
      expect(createData.status).toBe('SUCCESS');
      const blogId = createData.id;
      expect(blogId).toBeGreaterThan(0);

      // 2. Admin retrieves blogs list
      const listRes = await app.request('/admin/blogs', {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(listRes.status).toBe(200);
      const blogList: any = await listRes.json();
      const createdBlog = blogList.find((b: any) => b.id === blogId);
      expect(createdBlog).toBeDefined();
      expect(createdBlog.title).toBe('The Solitude of Saffron');
      expect(createdBlog.is_published).toBe(true);

      // 3. Toggle publication to unpublish (draft mode)
      const toggleRes = await app.request(`/admin/blogs/${blogId}/toggle`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_published: 0 })
      }, getTestEnv());
      expect(toggleRes.status).toBe(200);
      const toggleData: any = await toggleRes.json();
      expect(toggleData.is_published).toBe(false);

      // 4. Delete the essay
      const deleteRes = await app.request(`/admin/blogs/${blogId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(deleteRes.status).toBe(200);

      // Verify audit log has CREATE_BLOG and DELETE_BLOG
      const blogAudits: any = await mockDb.prepare(
        "SELECT action FROM admin_audit_logs WHERE action LIKE '%BLOG%' ORDER BY id ASC"
      ).all();
      const actions = blogAudits.results.map((r: any) => r.action);
      expect(actions).toContain('CREATE_BLOG');
      expect(actions).toContain('DELETE_BLOG');
    });
  });

  describe('Subsystem Diagnostics & Live Telemetry (/admin/diagnostics/*)', () => {
    it('aggregates live system diagnostics without leaking secret keys', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const sysRes = await app.request('/admin/diagnostics/system', {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(sysRes.status).toBe(200);
      const diag: any = await sysRes.json();

      expect(diag.bindings.d1_connected).toBe(true);
      expect(typeof diag.bindings.d1_latency_ms).toBe('number');
      expect(diag.entity_metrics).toHaveProperty('users_total');
      expect(diag.entity_metrics).toHaveProperty('events_total');
      expect(diag.security_gates.jwt_configured).toBe(true);
      // Absolute Secret Redaction: Verify no secret values are returned
      expect(diag.security_gates).not.toHaveProperty('jwt_secret');
      expect(diag.security_gates).not.toHaveProperty('turnstile_secret_key');
    });

    it('executes synthetic health probe across all storage and database pathways', async () => {
      const adminToken = await createToken('admin@alfaaz.com', 'ADMIN', jwtSecret);

      const probeRes = await app.request('/admin/diagnostics/probe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(probeRes.status).toBe(200);
      const probe: any = await probeRes.json();

      expect(probe.overall_status).toBe('HEALTHY');
      expect(probe.checks.database.status).toBe('PASS');
      expect(probe.checks.cache_kv.status).toBe('PASS');
      expect(probe.checks.r2_vault.status).toBe('PASS');
      expect(probe.checks.security.status).toBe('PASS');
    });
  });
});
