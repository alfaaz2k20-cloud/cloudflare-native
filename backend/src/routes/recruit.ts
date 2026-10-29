import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Env, Variables } from '../types';
import { getPublicSjtPayload, scoreSjtResponses, getConfigHash } from '../services/sjt';
import { assignWorldOrder } from '../services/world_order';
import { ingestTelemetryBatch } from '../services/telemetry';
import { extractSessionFeatures } from '../services/features';
import { integrateSessionEvidence } from '../services/evidence';
import { getEmailProvider } from '../notifications/email';
import { verifyTurnstile } from '../middleware/rate_limit';
import { verifyToken, getJwtSecret } from '../auth/crypto';

const recruitRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper: Ensure session exists and has consent
async function requireConsentedSession(db: D1Database, sessionId: string) {
  const session = await db.prepare('SELECT * FROM recruit_sessions WHERE session_id = ?').bind(sessionId).first();
  if (!session) {
    throw new HTTPException(404, {
      res: new Response(JSON.stringify({ error: 'Session not found', detail: 'Session not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      })
    });
  }

  const consent = await db.prepare('SELECT id FROM consent_records WHERE session_id = ?').bind(sessionId).first();
  if (!consent) {
    throw new HTTPException(403, {
      res: new Response(JSON.stringify({ error: 'Affirmative consent is required', detail: 'Affirmative consent is required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' }
      })
    });
  }

  return session;
}

// POST /recruit/consent - Step 0: Consent & counterbalanced Latin Square assignment
recruitRouter.post('/consent', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const turnstileToken = c.req.header('cf-turnstile-response') || body['cf-turnstile-response'] || body.turnstile_token;
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined;
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstileValid) {
    return c.json({ error: 'Turnstile verification failed. Please complete the security challenge.', detail: 'Turnstile verification failed.' }, 403);
  }

  const confirmed18Plus = body.confirmed_18_plus !== undefined ? Boolean(body.confirmed_18_plus) : true;
  const choices = body.choices || {};

  if (!confirmed18Plus || choices.research_telemetry === false) {
    return c.json({ error: 'Affirmative consent is required', detail: 'Affirmative consent is required' }, 400);
  }

  const sessionId = crypto.randomUUID();
  const configHash = getConfigHash();

  const { orderId, sequence, seeds } = await assignWorldOrder(c.env.DB, sessionId);

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO recruit_sessions (
        session_id, status, current_screen, order_id, spec_version,
        sjt_version, scoring_version, feature_version, config_hash,
        device_class, input_modality
      ) VALUES (?, 'CONSENTED', 'identity', ?, '2026-10-v2', '2026-09-rev', '1.0-exact-thirds', '1.0', ?, ?, ?)
    `).bind(
      sessionId,
      orderId,
      configHash,
      body.device_class || 'desktop',
      body.input_modality || 'mouse'
    ),
    c.env.DB.prepare(`
      INSERT INTO consent_records (session_id, consent_text_version, choices_json, confirmed_18_plus)
      VALUES (?, '2026-10-v2', ?, 1)
    `).bind(sessionId, JSON.stringify(choices)),
    c.env.DB.prepare(`
      INSERT INTO task_assignments (session_id, world_order_id, world_sequence_json, seeds_json)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, orderId, JSON.stringify(sequence), JSON.stringify(seeds))
  ]);

  return c.json({
    session_id: sessionId,
    world_order_id: orderId,
    world_sequence: sequence,
    seeds: seeds,
    config_hash: configHash
  });
});

// POST /recruit/identity - Step 1: Candidate identity
recruitRouter.post('/identity', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();
  const fullName = (body.full_name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phoneOrContact = (body.phone_or_contact || body.whatsapp_no || '').trim() || null;
  const linkedinUrl = (body.linkedin_url || '').trim() || null;

  if (!sessionId) return c.json({ error: 'session_id is required' }, 400);
  if (!fullName || fullName.length < 2) return c.json({ error: 'full_name must be at least 2 characters' }, 400);
  if (!email || !email.includes('@')) return c.json({ error: 'A valid email is required' }, 400);

  await requireConsentedSession(c.env.DB, sessionId);

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO applicant_identities (session_id, full_name, email, phone_or_contact, linkedin_url)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        full_name = excluded.full_name,
        email = excluded.email,
        phone_or_contact = excluded.phone_or_contact,
        linkedin_url = excluded.linkedin_url
    `).bind(sessionId, fullName, email, phoneOrContact, linkedinUrl),
    c.env.DB.prepare(`
      UPDATE recruit_sessions
      SET status = 'IDENTIFIED', current_screen = 'accessibility'
      WHERE session_id = ?
    `).bind(sessionId)
  ]);

  return c.json({ status: 'SUCCESS', session_id: sessionId });
});

// POST /recruit/accessibility - Step 2: Accessibility adjustments
recruitRouter.post('/accessibility', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();
  const modesEnabled = Array.isArray(body.modes_enabled) ? body.modes_enabled : [];

  if (!sessionId) return c.json({ error: 'session_id is required' }, 400);
  await requireConsentedSession(c.env.DB, sessionId);

  await c.env.DB.prepare(`
    INSERT INTO accessibility_profiles (session_id, modes_enabled_json)
    VALUES (?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      modes_enabled_json = excluded.modes_enabled_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(sessionId, JSON.stringify(modesEnabled)).run();

  return c.json({ status: 'SUCCESS' });
});

// POST /recruit/warmup - Step 3: Latency warmup baseline
recruitRouter.post('/warmup', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();

  if (!sessionId) return c.json({ error: 'session_id is required' }, 400);
  await requireConsentedSession(c.env.DB, sessionId);

  await c.env.DB.prepare(`
    INSERT INTO warmup_baselines (
      session_id, tap_latency_baseline_ms, movement_speed_baseline,
      reading_dwell_baseline_ms, pointer_type, viewport_class
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      tap_latency_baseline_ms = excluded.tap_latency_baseline_ms,
      movement_speed_baseline = excluded.movement_speed_baseline,
      reading_dwell_baseline_ms = excluded.reading_dwell_baseline_ms,
      pointer_type = excluded.pointer_type,
      viewport_class = excluded.viewport_class
  `).bind(
    sessionId,
    body.tap_latency_baseline_ms !== undefined ? Number(body.tap_latency_baseline_ms) : null,
    body.movement_speed_baseline !== undefined ? Number(body.movement_speed_baseline) : null,
    body.reading_dwell_baseline_ms !== undefined ? Number(body.reading_dwell_baseline_ms) : null,
    body.pointer_type || null,
    body.viewport_class || null
  ).run();

  return c.json({ status: 'SUCCESS' });
});

// GET /recruit/sjt/public - Step 4a: Candidate SJT scenario questions
recruitRouter.get('/sjt/public', async (c) => {
  const publicPayload = getPublicSjtPayload();
  return c.json(publicPayload);
});

// POST /recruit/sjt/submit - Step 4b: Submit SJT scenario responses
recruitRouter.post('/sjt/submit', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();
  const responses = body.responses || {};
  const tMs = typeof body.t_ms === 'number' ? body.t_ms : null;

  if (!sessionId) return c.json({ error: 'session_id is required', detail: 'session_id is required' }, 400);
  if (!responses || typeof responses !== 'object' || Object.keys(responses).length === 0) {
    return c.json({ error: 'responses dictionary is required', detail: 'responses dictionary is required' }, 400);
  }

  await requireConsentedSession(c.env.DB, sessionId);

  // Check for idempotent resubmission
  const existingRows = await c.env.DB.prepare('SELECT scenario_id, option_id FROM sjt_responses WHERE session_id = ?').bind(sessionId).all<{ scenario_id: string; option_id: string }>();
  if (existingRows.results && existingRows.results.length > 0) {
    const existingMap: Record<string, string> = {};
    for (const r of existingRows.results) existingMap[r.scenario_id] = r.option_id;

    let isIdentical = true;
    for (const [sId, oId] of Object.entries(responses)) {
      if (existingMap[sId] !== String(oId)) {
        isIdentical = false;
        break;
      }
    }

    if (isIdentical) {
      return c.json({ status: 'SUCCESS', message: 'Idempotent SJT resubmission accepted.', received: Object.keys(responses).length });
    } else {
      await c.env.DB.prepare(`
        INSERT INTO data_quality_flags (session_id, scope, flag, detail)
        VALUES (?, 'SJT', 'sjt_conflict', 'Conflicting SJT submission rejected; original responses preserved')
      `).bind(sessionId).run();
      return c.json({ error: 'Conflicting SJT submission rejected', detail: 'Conflicting SJT submission rejected' }, 409);
    }
  }

  // Score responses via exact integer thirds engine
  try {
    scoreSjtResponses(responses);
  } catch (err: any) {
    return c.json({ error: err.message, detail: err.message }, 400);
  }

  // Store individual scenario selections in sjt_responses (using option_id)
  const insertStmts: D1PreparedStatement[] = [];
  for (const [scenarioId, chosenOptionId] of Object.entries(responses)) {
    insertStmts.push(
      c.env.DB.prepare(`
        INSERT INTO sjt_responses (session_id, scenario_id, option_id, t_ms)
        VALUES (?, ?, ?, ?)
      `).bind(sessionId, scenarioId, String(chosenOptionId), tMs)
    );
  }

  if (insertStmts.length > 0) {
    await c.env.DB.batch(insertStmts);
  }

  // Update session screen and status
  await c.env.DB.prepare(`
    UPDATE recruit_sessions
    SET status = 'ACTIVE', current_screen = 'games'
    WHERE session_id = ?
  `).bind(sessionId).run();

  // Synthesize initial SJT evidence
  try {
    await integrateSessionEvidence(c.env.DB, sessionId, true);
  } catch (e) {
    console.warn('[RECRUIT] SJT evidence integration notice:', e);
  }

  // Return generic success: NEVER leak scoring or construct details to candidate
  return c.json({ status: 'SUCCESS', message: 'SJT recorded successfully.', received: Object.keys(responses).length });
});

// POST /recruit/telemetry - Step 5: Streaming behavioral telemetry events
recruitRouter.post('/telemetry', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();
  const events = Array.isArray(body.events) ? body.events : [];

  if (!sessionId) return c.json({ error: 'session_id is required', detail: 'session_id is required' }, 400);
  const session = await requireConsentedSession(c.env.DB, sessionId);

  // If session is already COMPLETE, enforce post-completion telemetry invariants
  if (session.status === 'COMPLETE' || session.status === 'COMPLETED') {
    return c.json({
      status: 'SUCCESS',
      message: 'Session already completed; previously accepted telemetry acknowledged.',
      result: { accepted_count: 0, new_rejected_count: events.length, session_status: 'COMPLETE' }
    });
  }

  try {
    const result = await ingestTelemetryBatch(c.env.DB, sessionId, events);
    return c.json({ status: 'SUCCESS', ingested_count: result.ingested_count, result });
  } catch (err: any) {
    if (err.message && (err.message.includes('Hard cap') || err.message.includes('limit of 50,000') || err.message.includes('events_cap_reached'))) {
      return c.json({
        detail: { status: 'DATA_LIMITED', detail: 'events_cap_reached' },
        error: 'Session event limit of 50,000 reached'
      }, 422);
    }
    return c.json({ error: err.message || 'Telemetry ingestion failed', detail: err.message || 'Telemetry ingestion failed' }, 400);
  }
});

// POST /recruit/complete - Step 6: Finalize session and trigger evidence synthesis
recruitRouter.post('/complete', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();

  if (!sessionId) return c.json({ error: 'session_id is required', detail: 'session_id is required' }, 400);
  const session = await requireConsentedSession(c.env.DB, sessionId);

  if (session.status === 'COMPLETE' || session.status === 'COMPLETED') {
    return c.json({
      status: 'SUCCESS',
      session_status: 'COMPLETE',
      message: 'Assessment already completed.',
      is_already_completed: true
    });
  }

  // Mark session completed
  await c.env.DB.prepare(`
    UPDATE recruit_sessions
    SET status = 'COMPLETE', current_screen = 'complete', completed_at = CURRENT_TIMESTAMP
    WHERE session_id = ?
  `).bind(sessionId).run();

  // Extract features and integrate psychometric evidence
  try {
    await extractSessionFeatures(c.env.DB, sessionId);
    await integrateSessionEvidence(c.env.DB, sessionId, true);
  } catch (err) {
    console.error(`[COMPLETE SESSION] Evidence integration background error for ${sessionId}:`, err);
  }

  // Dispatch assessment completion receipt if candidate email was recorded
  try {
    const identity = await c.env.DB
      .prepare('SELECT full_name, email FROM applicant_identities WHERE session_id = ?')
      .bind(sessionId)
      .first<{ full_name: string; email: string }>();

    if (identity?.email) {
      const candidateName = identity.full_name || 'Candidate';
      const emailProvider = getEmailProvider(c.env);
      await emailProvider.sendEmail(
        identity.email,
        'ALFAAZ — Assessment Dossier Cataloged',
        `Greetings ${candidateName},\n\nYour interactive assessment session and task records have been successfully submitted and cataloged for the Alfaaz Collective Admissions Committee.\n\nOur team is currently reviewing your dossier alongside your situational evaluation. If selected for an interview, you will receive an invitation link to reserve an interview slot.\n\nThank you for your creative investment and time.\n\n— Alfaaz Admissions`
      );
    }
  } catch (emailErr) {
    console.warn('[EMAIL WARNING] Assessment completion email failed:', emailErr);
  }

  return c.json({
    status: 'SUCCESS',
    session_status: 'COMPLETE',
    message: 'Assessment Complete. Thank you for your time.',
    is_already_completed: false
  });
});

// GET /recruit/interview-slots - Step 7: Available interview dates & times
recruitRouter.get('/interview-slots', async (c) => {
  const settingsRow = await c.env.DB.prepare('SELECT slots_json, skip_days_json FROM interview_settings WHERE id = 1').first<{ slots_json: string; skip_days_json: string }>();
  let standardTimes = ["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"];
  let skipDays = ["Sunday"];

  if (settingsRow) {
    try {
      if (settingsRow.slots_json) standardTimes = JSON.parse(settingsRow.slots_json);
      if (settingsRow.skip_days_json) skipDays = JSON.parse(settingsRow.skip_days_json);
    } catch {}
  }

  const skipDayNames = new Set(skipDays.map(d => d.toLowerCase()));
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Query booked slots from database
  const booked = await c.env.DB.prepare("SELECT slot_date, slot_time FROM interview_bookings WHERE status = 'SCHEDULED'").all<{ slot_date: string; slot_time: string }>();
  const bookedSet = new Set((booked.results || []).map(b => `${b.slot_date} ${b.slot_time}`));

  const availableDays = [];
  const now = new Date();

  for (let offset = 1; offset <= 10; offset++) {
    const d = new Date(now.getTime() + offset * 86400000);
    const dayName = weekdayNames[d.getDay()];
    if (skipDayNames.has(dayName.toLowerCase())) continue;

    const dateStr = d.toISOString().split('T')[0];
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const fullDateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const freeTimes = standardTimes.filter(t => !bookedSet.has(`${dateStr} ${t}`));
    if (freeTimes.length > 0) {
      availableDays.push({
        date: dateStr,
        date_label: dateLabel,
        full_date_label: fullDateLabel,
        times: freeTimes
      });
    }

    if (availableDays.length >= 6) break;
  }

  return c.json({
    days: availableDays,
    configured_slots: standardTimes,
    skip_days: skipDays,
    slots: availableDays
  });
});

// POST /recruit/schedule-interview - Step 7b: Reserve interview slot
recruitRouter.post('/schedule-interview', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = (body.session_id || '').trim();
  const slotDate = (body.slot_date || '').trim();
  const slotTime = (body.slot_time || '').trim();
  const slotDisplay = (body.slot_display || `${slotDate} ${slotTime}`).trim();
  const notes = body.notes || null;

  if (!sessionId || !slotDate || !slotTime) {
    return c.json({ error: 'session_id, slot_date, and slot_time are required', detail: 'session_id, slot_date, and slot_time are required' }, 400);
  }

  await requireConsentedSession(c.env.DB, sessionId);

  // Retrieve candidate identity
  const identity = await c.env.DB.prepare('SELECT full_name, email, phone_or_contact FROM applicant_identities WHERE session_id = ?').bind(sessionId).first<{
    full_name: string; email: string; phone_or_contact: string | null;
  }>();

  const candidateName = body.candidate_name || (identity ? identity.full_name : 'Candidate');
  const candidateEmail = body.candidate_email || (identity ? identity.email : '');
  const candidatePhone = body.candidate_phone || (identity ? identity.phone_or_contact : null);

  // Check collision: if already booked
  const existing = await c.env.DB.prepare("SELECT id FROM interview_bookings WHERE slot_date = ? AND slot_time = ? AND status = 'SCHEDULED'").bind(slotDate, slotTime).first();
  if (existing) {
    return c.json({ error: 'This interview slot was just taken. Please choose another time.', detail: 'This interview slot was just taken. Please choose another time.' }, 409);
  }

  try {
    await c.env.DB.prepare(`
      INSERT INTO interview_bookings (
        session_id, candidate_name, candidate_email, candidate_phone,
        slot_date, slot_time, slot_display, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        candidate_name = excluded.candidate_name,
        candidate_email = excluded.candidate_email,
        candidate_phone = excluded.candidate_phone,
        slot_date = excluded.slot_date,
        slot_time = excluded.slot_time,
        slot_display = excluded.slot_display,
        notes = excluded.notes,
        status = 'SCHEDULED'
    `).bind(sessionId, candidateName, candidateEmail, candidatePhone, slotDate, slotTime, slotDisplay, notes).run();
  } catch (err: any) {
    if (err.message && (err.message.includes('UNIQUE') || err.message.includes('constraint'))) {
      return c.json({ error: 'This interview slot was just taken. Please choose another time.', detail: 'This interview slot was just taken. Please choose another time.' }, 409);
    }
    throw err;
  }

  if (candidateEmail) {
    const emailProvider = getEmailProvider(c.env);
    await emailProvider.sendEmail(
      candidateEmail,
      'ALFAAZ — Interview Scheduled',
      `Greetings ${candidateName},\n\nYour interview slot with Alfaaz Collective has been confirmed for:\n\n${slotDisplay}\n\nWe look forward to speaking with you.\n\n— Alfaaz Admissions`
    );
  }

  return c.json({
    status: 'CONFIRMED',
    booking: {
      session_id: sessionId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      candidate_phone: candidatePhone,
      slot_date: slotDate,
      slot_time: slotTime,
      slot_display: slotDisplay,
      status: 'SCHEDULED'
    }
  });
});

// GET /recruit/interview-booking/:session_id - Get existing booking (protected PII)
recruitRouter.get('/interview-booking/:session_id', async (c) => {
  const sessionId = c.req.param('session_id');
  const booking: any = await c.env.DB.prepare(`
    SELECT session_id, candidate_name, candidate_email, candidate_phone,
           slot_date, slot_time, slot_display, notes, created_at, status
    FROM interview_bookings
    WHERE session_id = ?
  `).bind(sessionId).first();

  if (!booking) {
    return c.json({ booking: null });
  }

  // Check optional auth header for admin privileges
  const authHeader = c.req.header('Authorization');
  let isAdmin = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7).trim();
      const secret = getJwtSecret(c.env);
      const payload = await verifyToken(token, secret);
      if (payload && payload.status === 'ADMIN') {
        isAdmin = true;
      }
    } catch {
      // ignore token verification failure
    }
  }

  // If unauthenticated caller, protect candidate PII (name, email, phone, notes)
  if (!isAdmin) {
    return c.json({
      booking: {
        session_id: booking.session_id,
        slot_date: booking.slot_date,
        slot_time: booking.slot_time,
        slot_display: booking.slot_display,
        status: booking.status,
        created_at: booking.created_at
      }
    });
  }

  return c.json({ booking });
});

export default recruitRouter;
