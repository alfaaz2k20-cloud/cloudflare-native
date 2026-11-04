import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, hashPassword } from '../backend/src/auth/crypto';

describe('Sprint 3: Uploads, R2 Purging, Rate Limiting & Roster Ledger Suite', () => {
  let mockDb: any;
  let mockR2: any;
  let mockKv: any;
  const jwtSecret = 'test-jwt-secret-key-32-chars-minimum-safe';

  function getTestEnv(overrides: Record<string, any> = {}) {
    return {
      DB: mockDb,
      VAULT_BUCKET: mockR2,
      CACHE_KV: mockKv,
      JWT_SECRET: jwtSecret,
      ENV: 'test',
      ...overrides
    };
  }

  beforeEach(() => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();
  });

  describe('1. Vault Uploads & isValidUrl Host Allowlist', () => {
    it('accepts /vault/file/* and trusted domains but rejects unauthorized/SSRF hosts with 400', async () => {
      const userEmail = 'artist@alfaaz.local';
      await mockDb.prepare('INSERT INTO users (email, full_name, status) VALUES (?, ?, ?)')
        .bind(userEmail, 'Vault Artist', 'PARTICIPANT')
        .run();

      const userToken = await createToken({ email: userEmail, status: 'PARTICIPANT' }, jwtSecret);

      // 1. Accept valid /vault/file/* path
      const resValidPath = await app.request('/vault/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          submission_type: 'Poetry',
          title: 'Harud Ghazal',
          file_url: '/vault/file/vault%2Fharud.pdf'
        })
      }, getTestEnv());
      expect(resValidPath.status).toBe(200);

      // 2. Accept trusted Cloudinary domain
      const resCloudinary = await app.request('/vault/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          submission_type: 'Calligraphy',
          title: 'Nastaliq Folio',
          file_url: 'https://res.cloudinary.com/alfaaz/image/upload/v1/art.jpg'
        })
      }, getTestEnv());
      expect(resCloudinary.status).toBe(200);

      // 3. Reject SSRF / internal IP host with 400
      const resSsrf = await app.request('/vault/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          submission_type: 'Expose',
          title: 'SSRF Attack',
          file_url: 'http://169.254.169.254/latest/meta-data'
        })
      }, getTestEnv());
      expect(resSsrf.status).toBe(400);
      const dataSsrf = await resSsrf.json();
      expect(dataSsrf.error).toMatch(/valid file_url/i);

      // 4. Reject arbitrary unauthorized third-party host with 400
      const resEvil = await app.request('/vault/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          submission_type: 'Malware',
          title: 'Trojan',
          file_url: 'https://evil-attacker-site.com/payload.exe'
        })
      }, getTestEnv());
      expect(resEvil.status).toBe(400);
    });
  });

  describe('2. User Purge R2 Asset Cleanup', () => {
    it('deletes R2 stored vault and payment assets when administrator purges a user', async () => {
      const adminEmail = 'admin@alfaaz.com';
      const targetEmail = 'purge_artist@alfaaz.local';

      await mockDb.prepare('INSERT INTO users (email, full_name, status) VALUES (?, ?, ?)')
        .bind(targetEmail, 'Purge Artist', 'PARTICIPANT')
        .run();

      // Put files in mock R2
      const submissionKey = 'vault/1700000000-artwork.png';
      const paymentKey = 'vault/1700000000-receipt.jpg';
      await mockR2.put(submissionKey, new TextEncoder().encode('fake-image-bytes'), {
        httpMetadata: { contentType: 'image/png' }
      });
      await mockR2.put(paymentKey, new TextEncoder().encode('fake-receipt-bytes'), {
        httpMetadata: { contentType: 'image/jpeg' }
      });

      // Insert D1 records pointing to these R2 files
      await mockDb.prepare('INSERT INTO submissions (submission_type, title, file_url, author_email) VALUES (?, ?, ?, ?)')
        .bind('Visual Arts', 'Autumn Woodwork', `/vault/file/${encodeURIComponent(submissionKey)}`, targetEmail)
        .run();

      await mockDb.prepare(`
        INSERT INTO exhibition_applications 
          (user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, payment_proof_url)
        VALUES 
          (?, 'Kaamil III', 'Purge Artist', 25, 'The Bund, Srinagar', '+919419000000', 'Visual Arts', 'Woodwork', 'https://example.com/portfolio.pdf', ?)
      `).bind(targetEmail, `/vault/file/${encodeURIComponent(paymentKey)}`).run();

      // Verify files exist in R2 before deletion
      expect(await mockR2.head(submissionKey)).not.toBeNull();
      expect(await mockR2.head(paymentKey)).not.toBeNull();

      // Admin purges user
      const adminToken = await createToken({ email: adminEmail, status: 'ADMIN' }, jwtSecret);
      const resPurge = await app.request(`/admin/users/${encodeURIComponent(targetEmail)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());
      expect(resPurge.status).toBe(200);

      // Verify files have been purged from R2
      expect(await mockR2.head(submissionKey)).toBeNull();
      expect(await mockR2.head(paymentKey)).toBeNull();
    });
  });

  describe('3. Production Fail-Closed Edge IP & Rate Limiter Resilience', () => {
    it('fails closed with 403 on rate-limited routes when cf-connecting-ip is missing in production', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // No cf-connecting-ip header passed
        },
        body: JSON.stringify({ email: 'curator@alfaaz.local', password: 'AnyPassword123!' })
      }, getTestEnv({ ENV: 'production', FAIL_CLOSED_EDGE_IP: true }));

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.detail).toMatch(/edge client ip verification required/i);
    });

    it('enforces sliding-window rate limit properly across multiple rapid requests', async () => {
      // In test mode with cf-connecting-ip provided
      const ip = '198.51.100.42';
      const requests = [];

      // Curator route has a limit of 20 requests per minute
      for (let i = 0; i < 25; i++) {
        requests.push(
          app.request('/curator/ask', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'cf-connecting-ip': ip
            },
            body: JSON.stringify({ question: 'Tell me about Pinjrakari' })
          }, getTestEnv())
        );
      }

      const results = await Promise.all(requests);
      const statuses = results.map(r => r.status);
      expect(statuses).toContain(429);
    });
  });

  describe('4. Optimized Admin Roster Aggregation', () => {
    it('computes complete user timeline and stats cleanly with pre-indexed Maps', async () => {
      const adminEmail = 'admin@alfaaz.com';
      const adminToken = await createToken({ email: adminEmail, status: 'ADMIN' }, jwtSecret);

      const res = await app.request('/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` }
      }, getTestEnv());

      expect(res.status).toBe(200);
      const roster: any[] = await res.json();
      expect(Array.isArray(roster)).toBe(true);
      expect(roster.length).toBeGreaterThan(0);

      // Verify structure of the first entry
      const first = roster[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('email');
      expect(first).toHaveProperty('timeline');
      expect(first).toHaveProperty('stats');
      expect(first.stats).toHaveProperty('total_steps');
    });
  });
});
