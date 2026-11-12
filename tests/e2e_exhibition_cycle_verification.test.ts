import { describe, it, expect, beforeEach } from 'vitest';
import app from '../backend/src/index';
import { createMockD1, createMockR2, createMockKV } from './helpers/d1_mock';
import { createToken, getJwtSecret } from '../backend/src/auth/crypto';

describe('End-to-End Exhibition Lifecycle & Guidance Verification Suite', () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let mockR2: ReturnType<typeof createMockR2>;
  let mockKv: ReturnType<typeof createMockKV>;
  const jwtSecret = 'test-jwt-secret-alfaaz-collective-2026';

  function getTestEnv() {
    return {
      DB: mockDb,
      VAULT_BUCKET: mockR2,
      CACHE_KV: mockKv,
      JWT_SECRET: jwtSecret,
      ENV: 'test',
      FRONTEND_URL: 'http://localhost:8787'
    } as any;
  }

  async function makeHeaders(email: string, status = 'PARTICIPANT') {
    const token = await createToken(email, status, jwtSecret);
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  beforeEach(() => {
    mockDb = createMockD1();
    mockR2 = createMockR2();
    mockKv = createMockKV();
  });

  it('1. Registration and Login Warning Invariants', async () => {
    // 1a. Register a new user
    const regRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'artist_kashmir@alfaaz.local',
        password: 'Password123!',
        full_name: 'Mirza Mehdi',
        phone: '+919419123456'
      })
    }, getTestEnv());
    expect(regRes.status).toBe(200);

    // 1b. Attempt to register again with same email returns 400 with 'already registered'
    const dupRegRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'artist_kashmir@alfaaz.local',
        password: 'AnotherPassword123!',
        full_name: 'Mirza Mehdi',
        phone: '+919419123457'
      })
    }, getTestEnv());
    expect(dupRegRes.status).toBe(400);
    const dupData: any = await dupRegRes.json();
    expect(dupData.detail.toLowerCase()).toContain('already registered');

    // 1c. Attempt to login with unknown email returns 401 'Invalid credentials'
    const badLoginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unregistered_person@alfaaz.local',
        password: 'Password123!'
      })
    }, getTestEnv());
    expect(badLoginRes.status).toBe(401);
    const badLoginData: any = await badLoginRes.json();
    expect(badLoginData.detail).toBe('Invalid credentials');
  });

  it('2. Multi-Cycle Admin Creation: Concurrent Youth & General Exhibitions', async () => {
    const adminHeaders = await makeHeaders('admin@alfaaz.com', 'ADMIN');

    // 2a. Admin creates an active Youth Exhibition (require_over_18 = 0)
    const youthCreateRes = await app.request('/admin/exhibitions/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'SHEHJAR I — Youth Dreams',
        date_text: 'Dec 1–15, 2026',
        venue: 'Alfaaz Creative Studio, Srinagar',
        about_text: 'Open call for youth under 18 years of age across Kashmir.',
        require_over_18: 0,
        is_active: 1,
        status: 'PUBLISHED'
      })
    }, getTestEnv());
    expect(youthCreateRes.status).toBe(200);

    // 2b. Admin creates an active General Exhibition (require_over_18 = 1)
    const adultCreateRes = await app.request('/admin/exhibitions/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'HARUD II — Autumn Expressions',
        date_text: 'Dec 20–30, 2026',
        venue: 'Zero Bridge Gallery, Srinagar',
        about_text: 'General public exhibition open to visual and literary artists.',
        require_over_18: 1,
        is_active: 1,
        status: 'PUBLISHED'
      })
    }, getTestEnv());
    expect(adultCreateRes.status).toBe(200);

    // 2c. Both exhibitions remain active concurrently
    const configRes = await app.request('/exhibitions/config', { method: 'GET' }, getTestEnv());
    expect(configRes.status).toBe(200);
    const configData: any = await configRes.json();
    expect(configData.active_cycles.length).toBeGreaterThanOrEqual(2);

    const hasYouth = configData.active_cycles.some((c: any) => c.title.includes('Youth Dreams') && (c.require_over_18 === false || c.require_over_18 === 0));
    const hasAdult = configData.active_cycles.some((c: any) => c.title.includes('Autumn Expressions') && (c.require_over_18 === true || c.require_over_18 === 1));
    expect(hasYouth).toBe(true);
    expect(hasAdult).toBe(true);

    // 2d. Admin toggles cohort with explicit target value (idempotency check)
    const youthId = (await youthCreateRes.json() as any).id;
    const toggleRes = await app.request(`/admin/exhibitions/${youthId}/toggle-age`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ require_over_18: 1 })
    }, getTestEnv());
    expect(toggleRes.status).toBe(200);
    const toggleData: any = await toggleRes.json();
    expect(toggleData.require_over_18).toBe(1);

    // Toggle back to youth
    const toggleBackRes = await app.request(`/admin/exhibitions/${youthId}/toggle-age`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ require_over_18: 0 })
    }, getTestEnv());
    expect(toggleBackRes.status).toBe(200);
    const toggleBackData: any = await toggleBackRes.json();
    expect(toggleBackData.require_over_18).toBe(0);
  });

  it('3. Notice Generation for Updates Section on Homepage', async () => {
    const adminHeaders = await makeHeaders('admin@alfaaz.com', 'ADMIN');
    // Ensure both active
    await app.request('/admin/exhibitions/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'SHEHJAR YOUTH III',
        require_over_18: 0,
        is_active: 1,
        status: 'PUBLISHED'
      })
    }, getTestEnv());

    await app.request('/admin/exhibitions/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'HARUD GENERAL III',
        require_over_18: 1,
        is_active: 1,
        status: 'PUBLISHED'
      })
    }, getTestEnv());

    const noticesRes = await app.request('/notices', { method: 'GET' }, getTestEnv());
    expect(noticesRes.status).toBe(200);
    const noticesData: any = await noticesRes.json();

    expect(noticesData.exhibitions).toBeDefined();
    expect(noticesData.exhibitions.length).toBeGreaterThanOrEqual(2);
  });

  it('4. Full Intake & Dashboard Integration Lifecycle', async () => {
    const adminHeaders = await makeHeaders('admin@alfaaz.com', 'ADMIN');

    // Create Youth Cycle
    const youthRes = await app.request('/admin/exhibitions/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'SHEHJAR FINAL YOUTH',
        require_over_18: 0,
        is_active: 1,
        status: 'PUBLISHED'
      })
    }, getTestEnv());
    const youthData: any = await youthRes.json();
    const youthId = youthData.id;

    // Create General Cycle
    const adultRes = await app.request('/admin/exhibitions/create', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'HARUD FINAL GENERAL',
        require_over_18: 1,
        is_active: 1,
        status: 'PUBLISHED'
      })
    }, getTestEnv());
    const adultData: any = await adultRes.json();
    const adultId = adultData.id;

    // 4a. Minor submits application to Youth Exhibition with Guardian consent + Recent Works
    const minorHeaders = await makeHeaders('student@alfaaz.local', 'PARTICIPANT');
    const minorApplyRes = await app.request('/exhibitions/apply', {
      method: 'POST',
      headers: minorHeaders,
      body: JSON.stringify({
        exhibition_id: youthId,
        full_name: 'Zaira Jan',
        age: 15,
        address: 'Downtown Srinagar',
        whatsapp: '+919419111222',
        genre: 'Watercolor & Ink',
        medium: 'Handmade Paper (12x16 in)',
        recent_works_url: 'https://alfaazcollective.org/vault/file/recent-works/sample.jpg',
        guardian_name: 'Farooq Ahmad Jan',
        guardian_relationship: 'Father',
        guardian_contact: '+919419333444',
        guardian_consent: 1,
        participant_assent: 1,
        agreed_to_screening: true
      })
    }, getTestEnv());
    expect(minorApplyRes.status).toBe(200);

    // 4b. Adult artist submits application to General Exhibition with Recent Works
    const adultArtistHeaders = await makeHeaders('senior_artist@alfaaz.local', 'PARTICIPANT');
    const adultApplyRes = await app.request('/exhibitions/apply', {
      method: 'POST',
      headers: adultArtistHeaders,
      body: JSON.stringify({
        exhibition_id: adultId,
        full_name: 'Bashir Ahmad',
        age: 32,
        address: 'Rajbagh, Srinagar',
        whatsapp: '+919419555666',
        genre: 'Wood Carving & Calligraphy',
        medium: 'Walnut Wood Panel',
        recent_works_url: 'https://alfaazcollective.org/vault/file/recent-works/woodwork.pdf',
        over_18: true,
        agreed_to_screening: true
      })
    }, getTestEnv());
    expect(adultApplyRes.status).toBe(200);

    // 4c. Verify Minor's Status on Dashboard
    const minorStatusRes = await app.request('/exhibitions/my-status', {
      method: 'GET',
      headers: minorHeaders
    }, getTestEnv());
    expect(minorStatusRes.status).toBe(200);
    const minorStatusData: any = await minorStatusRes.json();
    expect(minorStatusData.status).toBe('PENDING');
    expect(minorStatusData.guardian_verification_status).toBe('PENDING');

    // 4d. Verify Adult's Status on Dashboard
    const adultStatusRes = await app.request('/exhibitions/my-status', {
      method: 'GET',
      headers: adultArtistHeaders
    }, getTestEnv());
    expect(adultStatusRes.status).toBe(200);
    const adultStatusData: any = await adultStatusRes.json();
    expect(adultStatusData.status).toBe('PENDING');
  });
});
