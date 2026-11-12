import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken } from '../backend/src/auth/crypto';

describe('Exhibitions Multi-Cycle, Private R2 Uploads & Youth Safeguarding Suite', () => {
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
      EMAIL_PROVIDER: 'dev' as const,
      ENV: 'test'
    };
  }

  async function makeAuthHeaders(email: string, status: 'ADMIN' | 'PARTICIPANT' = 'PARTICIPANT') {
    const token = await createToken({ sub: 'user_1', email, status }, jwtSecret);
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  beforeEach(async () => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();

    // Ensure we have two active cycles in D1 for multi-cycle testing:
    // Cycle 1: Adults (18+), id = 1
    // Cycle 2: Youth (<18), id = 2 with allow_recent_works_youth = 1
    await mockDb.exec(`
      UPDATE exhibitions_list SET is_active = 0;

      INSERT OR REPLACE INTO exhibitions_list (
        id, title, date_text, venue, about_text, is_active, require_over_18, allow_recent_works_youth, registration_fee
      ) VALUES (
        1, 'KAAMIL III — The Vernacular Breath', 'Nov 15 - 30', 'Mahatta Art Gallery, Srinagar',
        'Adult Curatorial Showcase', 1, 1, 0, '500'
      );

      INSERT OR REPLACE INTO exhibitions_list (
        id, title, date_text, venue, about_text, is_active, require_over_18, allow_recent_works_youth, registration_fee
      ) VALUES (
        2, 'SHEHJAR I — Youth & Vernacular Dreams', 'Dec 01 - 10', 'Zero Bridge Vitrine',
        'Children and Young Artists Showcase', 1, 0, 1, '250'
      );
    `);
  });

  describe('1. Public Discovery & Multi-Cycle Configuration', () => {
    it('GET /exhibitions/config returns active cycles without requiring authentication', async () => {
      const res = await app.request('/exhibitions/config', {
        method: 'GET'
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.is_open).toBe(true);
      expect(data.total_active).toBe(2);
      expect(data.active_cycles).toHaveLength(2);
      expect(data.active_cycles[0].id).toBe(1);
      expect(data.active_cycles[1].id).toBe(2);
      expect(data.active_cycles[1].allow_recent_works_youth).toBe(true);
    });

    it('GET /exhibitions/config?id=2 returns the exact requested cycle', async () => {
      const res = await app.request('/exhibitions/config?id=2', {
        method: 'GET'
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.id).toBe(2);
      expect(data.title).toBe('SHEHJAR I — Youth & Vernacular Dreams');
      expect(data.require_over_18).toBe(false);
      expect(data.allow_recent_works_youth).toBe(true);
    });

    it('GET /exhibitions/config?id=9999 explicitly returns 404 and does not silently fall back', async () => {
      const res = await app.request('/exhibitions/config?id=9999', {
        method: 'GET'
      }, getTestEnv());

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.not_found).toBe(true);
      expect(data.is_open).toBe(false);
    });
  });

  describe('2. Private R2 Uploads & File Signature Checks', () => {
    it('POST /exhibitions/upload-portfolio accepts genuine PDF and returns user-bound vault URL', async () => {
      const headers = await makeAuthHeaders('artist@alfaaz.local');
      delete (headers as any)['Content-Type'];

      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5
      const file = new File([pdfHeader], 'my_portfolio.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const res = await app.request('/exhibitions/upload-portfolio', {
        method: 'POST',
        headers,
        body: formData
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');
      expect(data.secure_url).toMatch(/^\/vault\/file\/portfolios%2F/);
    });

    it('POST /exhibitions/upload-portfolio strictly rejects file with spoofed .pdf extension but invalid signature', async () => {
      const headers = await makeAuthHeaders('artist@alfaaz.local');
      delete (headers as any)['Content-Type'];

      const fakePdf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" plain text
      const file = new File([fakePdf], 'malicious.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      const res = await app.request('/exhibitions/upload-portfolio', {
        method: 'POST',
        headers,
        body: formData
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain('Invalid file signature');
    });

    it('POST /exhibitions/upload-payment-proof accepts valid PNG/JPEG receipt and stores privately in R2', async () => {
      const headers = await makeAuthHeaders('artist@alfaaz.local');
      delete (headers as any)['Content-Type'];

      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
      const file = new File([pngHeader], 'receipt.png', { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', file);

      const res = await app.request('/exhibitions/upload-payment-proof', {
        method: 'POST',
        headers,
        body: formData
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');
      expect(data.secure_url).toMatch(/^\/vault\/file\/payment-proofs%2F/);
    });
  });

  describe('3. Child Safeguarding & Youth Intake (/apply)', () => {
    it('POST /exhibitions/apply rejects minor in Youth cycle if guardian consent is missing', async () => {
      const headers = await makeAuthHeaders('youth@alfaaz.local');
      const res = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 2,
          full_name: 'Zainab Shah',
          age: 14,
          address: 'Downtown Srinagar',
          whatsapp: '+919900112233',
          genre: 'Painting',
          medium: 'Watercolour',
          portfolio_url: '/vault/file/portfolios/demo-zainab.pdf',
          agreed_to_screening: true,
          guardian_name: 'Fatima Shah',
          guardian_relationship: 'Mother',
          guardian_contact: '+919900112244',
          guardian_consent_granted: false, // Missing consent!
          participant_assent_granted: true
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Explicit parent or guardian consent is required');
    });

    it('POST /exhibitions/apply succeeds for minor with full guardian consent and records PENDING verification status', async () => {
      const headers = await makeAuthHeaders('youth_approved@alfaaz.local');
      const res = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 2,
          full_name: 'Ayaan Lone',
          age: 15,
          address: 'Baramulla, Kashmir',
          whatsapp: '+919900556677',
          genre: 'Drawing',
          medium: 'Charcoal on Paper',
          portfolio_url: '/vault/file/portfolios/demo-ayaan.pdf',
          agreed_to_screening: true,
          guardian_name: 'Tariq Lone',
          guardian_relationship: 'Father',
          guardian_contact: '+919900556688',
          guardian_consent_granted: true,
          participant_assent_granted: true
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUCCESS');

      // Verify row in database
      const row: any = await mockDb.prepare(
        'SELECT guardian_name, guardian_verification_status, guardian_consent_version FROM exhibition_applications WHERE user_email = ?'
      ).bind('youth_approved@alfaaz.local').first();

      expect(row.guardian_name).toBe('Tariq Lone');
      expect(row.guardian_verification_status).toBe('PENDING');
      expect(row.guardian_consent_version).toBe('2026-v1');
    });

    it('POST /exhibitions/apply allows minor to submit with or without optional recent_works_url', async () => {
      const headers = await makeAuthHeaders('youth_recent@alfaaz.local');
      const res = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 2,
          full_name: 'Bilal Ahmad',
          age: 16,
          address: 'Anantnag, Kashmir',
          whatsapp: '+919900334455',
          genre: 'Craft',
          medium: 'Paper Mache',
          portfolio_url: '/vault/file/portfolios/demo-bilal.pdf',
          recent_works_url: '/vault/file/recent-works/demo-bilal-earlier.pdf', // Optional provided!
          agreed_to_screening: true,
          guardian_name: 'Parveena Ahmad',
          guardian_relationship: 'Mother',
          guardian_contact: '+919900334466',
          guardian_consent_granted: true,
          participant_assent_granted: true
        })
      }, getTestEnv());

      expect(res.status).toBe(200);

      const row: any = await mockDb.prepare(
        'SELECT recent_works_url FROM exhibition_applications WHERE user_email = ?'
      ).bind('youth_recent@alfaaz.local').first();

      expect(row.recent_works_url).toBe('/vault/file/recent-works/demo-bilal-earlier.pdf');
    });

    it('POST /exhibitions/apply rejects adult (>18) in Youth cycle and minor (<18) in Adult cycle', async () => {
      const headers = await makeAuthHeaders('adult_in_youth@alfaaz.local');
      // Attempt adult (25) in cycle 2 (Youth)
      const res1 = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 2,
          full_name: 'Adult User',
          age: 25,
          address: 'Srinagar',
          whatsapp: '+919900112233',
          genre: 'Painting',
          medium: 'Oil',
          portfolio_url: '/vault/file/portfolios/adult.pdf',
          agreed_to_screening: true
        })
      }, getTestEnv());

      expect(res1.status).toBe(400);
      const data1: any = await res1.json();
      expect(data1.detail).toContain('specifically for children and youth under 18');

      // Attempt minor (15) in cycle 1 (Adult)
      const res2 = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 1,
          full_name: 'Minor User',
          age: 15,
          over_18: false,
          address: 'Srinagar',
          whatsapp: '+919900112233',
          genre: 'Painting',
          medium: 'Oil',
          portfolio_url: '/vault/file/portfolios/minor.pdf',
          agreed_to_screening: true
        })
      }, getTestEnv());

      expect(res2.status).toBe(400);
      const data2: any = await res2.json();
      expect(data2.detail).toContain('18 years of age or older');
    });

    it('POST /exhibitions/apply explicitly rejects unknown cycle ID and does not silently fall back', async () => {
      const headers = await makeAuthHeaders('unknown_cycle@alfaaz.local');
      const res = await app.request('/exhibitions/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 9999, // Unknown!
          full_name: 'Artist',
          age: 22,
          over_18: true,
          address: 'Srinagar',
          whatsapp: '+919900112233',
          genre: 'Painting',
          medium: 'Oil',
          portfolio_url: '/vault/file/portfolios/demo.pdf',
          agreed_to_screening: true
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.detail).toContain('Requested exhibition cycle does not exist or is currently closed');
    });
  });

  describe('4. Multi-Cycle Status Tracking & Registration Finalization', () => {
    it('GET /exhibitions/my-status returns independent statuses for each cycle in statuses_by_cycle', async () => {
      // Seed applications in both Cycle 1 and Cycle 2 for dual_artist@alfaaz.local
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status
        ) VALUES (
          'dual_artist@alfaaz.local', 'KAAMIL III — The Vernacular Breath', 'Dual Artist', 24, 'Srinagar', '+919876543210', 'Painting', 'Oil', '/vault/file/demo1.pdf', 'APPROVED', 'NONE'
        );

        INSERT INTO exhibition_applications (
          user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status
        ) VALUES (
          'dual_artist@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Dual Artist', 17, 'Srinagar', '+919876543210', 'Sculpture', 'Clay', '/vault/file/demo2.pdf', 'PENDING', 'NONE'
        );
      `);

      const headers = await makeAuthHeaders('dual_artist@alfaaz.local');
      const res = await app.request('/exhibitions/my-status', {
        method: 'GET',
        headers
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.statuses_by_cycle).toBeDefined();
      expect(data.statuses_by_cycle['KAAMIL III — The Vernacular Breath'].status).toBe('APPROVED');
      expect(data.statuses_by_cycle['SHEHJAR I — Youth & Vernacular Dreams'].status).toBe('PENDING');
    });

    it('POST /exhibitions/finalize completes registration when matching exhibition_id is approved', async () => {
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status, guardian_verification_status
        ) VALUES (
          'final_artist@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Final Artist', 16, 'Srinagar', '+919876543210', 'Calligraphy', 'Ink', '/vault/file/demo.pdf', 'APPROVED', 'NONE', 'VERIFIED'
        );
      `);

      const headers = await makeAuthHeaders('final_artist@alfaaz.local');
      const res = await app.request('/exhibitions/finalize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 2,
          agreed_to_tnc: true,
          payment_proof_url: '/vault/file/payment-proofs/receipt.png'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe('SUBMITTED');

      const appRow: any = await mockDb.prepare(
        "SELECT registration_status FROM exhibition_applications WHERE user_email = ? AND exhibition_cycle = 'SHEHJAR I — Youth & Vernacular Dreams'"
      ).bind('final_artist@alfaaz.local').first();

      expect(appRow.registration_status).toBe('SUBMITTED');
    });

    it('POST /exhibitions/finalize strictly rejects registration if user is approved in Cycle 2 but passes Cycle 1', async () => {
      // User is only approved in Cycle 2
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url, status, registration_status
        ) VALUES (
          'cycle2_only@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Cycle 2 Artist', 16, 'Srinagar', '+919876543210', 'Calligraphy', 'Ink', '/vault/file/demo.pdf', 'APPROVED', 'NONE'
        );
      `);

      const headers = await makeAuthHeaders('cycle2_only@alfaaz.local');
      const res = await app.request('/exhibitions/finalize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 1, // Cycle 1 (where user has NO approved application)
          agreed_to_tnc: true,
          payment_proof_url: '/vault/file/payment-proofs/receipt.png'
        })
      }, getTestEnv());

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.detail).toContain('No approved application found for this specific exhibition cycle');
    });
  });

  describe('5. Admin Guided Builder & Guardian Verification Controls', () => {
    it('PATCH /admin/exhibitions/:id/edit updates exhibition details including recent works toggle', async () => {
      const headers = await makeAuthHeaders('admin@alfaaz.com', 'ADMIN');
      const res = await app.request('/admin/exhibitions/1/edit', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title: 'KAAMIL III — Updated Curatorial Title',
          date_text: 'Nov 20 - Dec 05',
          venue: 'Sheri Kashmir Cultural Centre',
          allow_recent_works_youth: 1,
          status: 'PUBLISHED'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);

      const exRow: any = await mockDb.prepare('SELECT title, venue, allow_recent_works_youth FROM exhibitions_list WHERE id = 1').first();
      expect(exRow.title).toBe('KAAMIL III — Updated Curatorial Title');
      expect(exRow.venue).toBe('Sheri Kashmir Cultural Centre');
      expect(exRow.allow_recent_works_youth).toBe(1);
    });

    it('PATCH /admin/exhibitions/applications/:id/verify-guardian allows confirming youth consent and records admin audit', async () => {
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          id, user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url,
          guardian_name, guardian_verification_status, status
        ) VALUES (
          50, 'safeguarded_child@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Child Artist', 12, 'Srinagar', '+919900112233', 'Painting', 'Gouache', '/vault/file/demo.pdf',
          'Parent Name', 'PENDING', 'PENDING'
        );
      `);

      const headers = await makeAuthHeaders('admin@alfaaz.com', 'ADMIN');
      const res = await app.request('/admin/exhibitions/applications/50/verify-guardian', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'VERIFIED' })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.guardian_verification_status).toBe('VERIFIED');
      expect(data.guardian_verified_by).toBe('admin@alfaaz.com');
      expect(typeof data.guardian_verified_at).toBe('string');

      const appRow: any = await mockDb.prepare('SELECT guardian_verification_status, guardian_verified_at, guardian_verified_by FROM exhibition_applications WHERE id = 50').first();
      expect(appRow.guardian_verification_status).toBe('VERIFIED');
      expect(appRow.guardian_verified_by).toBe('admin@alfaaz.com');
      expect(appRow.guardian_verified_at).toBeTruthy();
    });

    it('POST /admin/exhibitions/review strictly blocks approving under-18 participant if guardian consent is unverified (400)', async () => {
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          id, user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url,
          guardian_name, guardian_verification_status, status
        ) VALUES (
          51, 'unverified_minor@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Unverified Minor', 15, 'Srinagar', '+919900112244', 'Textiles', 'Silk', '/vault/file/demo.pdf',
          'Guardian Name', 'PENDING', 'PENDING'
        );
      `);

      const headers = await makeAuthHeaders('admin@alfaaz.com', 'ADMIN');
      const res = await app.request('/admin/exhibitions/review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          application_id: 51,
          status: 'APPROVED',
          curator_note: 'Selected work'
        })
      }, getTestEnv());

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.code).toBe('GUARDIAN_CONSENT_UNVERIFIED');
      expect(data.error).toContain('Child Safeguarding');
    });

    it('POST /exhibitions/finalize strictly blocks under-18 participant if guardian consent is unverified (403)', async () => {
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          id, user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url,
          guardian_name, guardian_verification_status, status, registration_status
        ) VALUES (
          52, 'blocked_minor@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Blocked Minor', 14, 'Srinagar', '+919900112255', 'Craft', 'Wood', '/vault/file/demo.pdf',
          'Guardian Name', 'PENDING', 'APPROVED', 'NONE'
        );
      `);

      const headers = await makeAuthHeaders('blocked_minor@alfaaz.local');
      const res = await app.request('/exhibitions/finalize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          exhibition_id: 2,
          agreed_to_tnc: true,
          payment_proof_url: '/vault/file/payment-proofs/receipt.png'
        })
      }, getTestEnv());

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.code).toBe('GUARDIAN_CONSENT_UNVERIFIED');
      expect(data.detail).toContain('Parent/Guardian consent must be verified');
    });

    it('POST /admin/exhibitions/applications/:id/guardian/reject records rejection outcome, reason, timestamp, and admin identity', async () => {
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          id, user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url,
          guardian_name, guardian_verification_status, status
        ) VALUES (
          53, 'reject_minor@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Reject Minor', 16, 'Baramulla', '+919900112266', 'Painting', 'Oil', '/vault/file/demo.pdf',
          'Guardian Name', 'PENDING', 'PENDING'
        );
      `);

      const headers = await makeAuthHeaders('admin@alfaaz.com', 'ADMIN');
      const res = await app.request('/admin/exhibitions/applications/53/guardian/reject', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rejection_reason: 'Unreachable contact number and unverifiable signature'
        })
      }, getTestEnv());

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.guardian_verification_status).toBe('REJECTED');
      expect(data.guardian_rejection_reason).toBe('Unreachable contact number and unverifiable signature');
      expect(data.guardian_verified_by).toBe('admin@alfaaz.com');
      expect(data.guardian_verified_at).toBeTruthy();

      const appRow: any = await mockDb.prepare('SELECT guardian_verification_status, guardian_rejection_reason, guardian_verified_by, guardian_verified_at FROM exhibition_applications WHERE id = 53').first();
      expect(appRow.guardian_verification_status).toBe('REJECTED');
      expect(appRow.guardian_rejection_reason).toBe('Unreachable contact number and unverifiable signature');
      expect(appRow.guardian_verified_by).toBe('admin@alfaaz.com');
    });

    it('Unauthorized participants cannot access guardian verification endpoints (403)', async () => {
      const participantHeaders = await makeAuthHeaders('regular_user@alfaaz.local', 'PARTICIPANT');

      const res1 = await app.request('/admin/exhibitions/applications/50/guardian/confirm', {
        method: 'POST',
        headers: participantHeaders
      }, getTestEnv());
      expect(res1.status).toBe(403);

      const res2 = await app.request('/admin/exhibitions/applications/50/guardian/reject', {
        method: 'POST',
        headers: participantHeaders,
        body: JSON.stringify({ rejection_reason: 'Exploit attempt' })
      }, getTestEnv());
      expect(res2.status).toBe(403);

      const res3 = await app.request('/admin/exhibitions/applications/50/verify-guardian', {
        method: 'PATCH',
        headers: participantHeaders,
        body: JSON.stringify({ status: 'VERIFIED' })
      }, getTestEnv());
      expect(res3.status).toBe(403);
    });

    it('Approving or finalizing an applicant with guardian_verification_status = REJECTED is strictly blocked', async () => {
      await mockDb.exec(`
        INSERT INTO exhibition_applications (
          id, user_email, exhibition_cycle, full_name, age, address, whatsapp, genre, medium, portfolio_url,
          guardian_name, guardian_verification_status, guardian_rejection_reason, status, registration_status
        ) VALUES (
          54, 'rejected_artist@alfaaz.local', 'SHEHJAR I — Youth & Vernacular Dreams', 'Rejected Youth', 15, 'Srinagar', '+919900112277', 'Craft', 'Clay', '/vault/file/demo.pdf',
          'Guardian Contact', 'REJECTED', 'Safeguarding contact mismatch', 'PENDING', 'NONE'
        );
      `);

      const adminHeaders = await makeAuthHeaders('admin@alfaaz.com', 'ADMIN');
      const approveRes = await app.request('/admin/exhibitions/review', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          application_id: 54,
          status: 'APPROVED'
        })
      }, getTestEnv());

      expect(approveRes.status).toBe(400);
      const approveData: any = await approveRes.json();
      expect(approveData.code).toBe('GUARDIAN_CONSENT_UNVERIFIED');
      expect(approveData.error).toContain('Guardian consent was rejected');

      // Now even if marked as APPROVED manually in DB, finalization must fail-closed:
      await mockDb.exec("UPDATE exhibition_applications SET status = 'APPROVED' WHERE id = 54");

      const artistHeaders = await makeAuthHeaders('rejected_artist@alfaaz.local');
      const finalizeRes = await app.request('/exhibitions/finalize', {
        method: 'POST',
        headers: artistHeaders,
        body: JSON.stringify({
          exhibition_id: 2,
          agreed_to_tnc: true,
          payment_proof_url: '/vault/file/payment-proofs/receipt.png'
        })
      }, getTestEnv());

      expect(finalizeRes.status).toBe(403);
      const finalizeData: any = await finalizeRes.json();
      expect(finalizeData.code).toBe('GUARDIAN_CONSENT_UNVERIFIED');
      expect(finalizeData.detail).toContain('rejected by administration');
    });

    it('Newly created exhibitions default to status = DRAFT and are excluded from public discovery until published', async () => {
      const adminHeaders = await makeAuthHeaders('admin@alfaaz.com', 'ADMIN');

      const createRes = await app.request('/admin/exhibitions/create', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          title: 'WOON I — Secret Draft Cycle',
          date_text: 'Dates in Spring 2027',
          venue: 'Pari Mahal Pavilion',
          about_text: 'An unreleased future exhibition cycle',
          registration_fee: '300'
        })
      }, getTestEnv());

      expect(createRes.status).toBe(200);

      const row: any = await mockDb.prepare("SELECT status, is_active FROM exhibitions_list WHERE title = 'WOON I — Secret Draft Cycle'").first();
      expect(row.status).toBe('DRAFT');
      expect(row.is_active).toBe(0);

      // Public discovery should NOT return it
      const pubRes = await app.request('/exhibitions/config', { method: 'GET' }, getTestEnv());
      const pubData: any = await pubRes.json();
      const draftExists = (pubData.active_cycles || []).some((c: any) => c.title === 'WOON I — Secret Draft Cycle');
      expect(draftExists).toBe(false);
    });
  });
});
