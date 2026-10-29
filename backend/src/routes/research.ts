import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { requireAdmin } from '../middleware/auth';
import { getSessionTaskRecords, DOSSIER_STATEMENT, LOCKED_GAMES } from '../services/descriptive_task_record';
import { getEmailProvider } from '../notifications/email';
import { extractSessionFeatures } from '../services/features';
import { integrateSessionEvidence, PARAM_MINIGAMES, CANDIDATE_CORE_MINIGAMES } from '../services/evidence';

const researchRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All recruiter dossier views require admin role
researchRouter.use('*', requireAdmin);

const PARAM_DISPLAY_NAMES: Record<string, string> = {
  empathy: "Empathy",
  conscientiousness: "Conscientiousness",
  collaborative_spirit: "Collaborative Spirit",
  emotional_agility: "Emotional Agility",
  curiosity: "Curiosity",
  creative_initiative: "Creative Initiative",
  motivation: "Motivation"
};

const RANDOM_RESPONDER_REFERENCE: Record<string, { LOW: string; MODERATE: string; HIGH: string }> = {
  empathy: { LOW: "34.6%", MODERATE: "59.7%", HIGH: "5.7%" },
  conscientiousness: { LOW: "46.0%", MODERATE: "51.1%", HIGH: "2.9%" },
  collaborative_spirit: { LOW: "34.2%", MODERATE: "60.9%", HIGH: "5.0%" },
  emotional_agility: { LOW: "43.9%", MODERATE: "51.9%", HIGH: "4.2%" },
  curiosity: { LOW: "48.2%", MODERATE: "49.2%", HIGH: "2.5%" },
  creative_initiative: { LOW: "48.9%", MODERATE: "48.9%", HIGH: "2.2%" },
  motivation: { LOW: "34.7%", MODERATE: "59.6%", HIGH: "5.7%" }
};

// GET /recruit/research - Root discovery
researchRouter.get('/', async (c) => {
  return c.json({
    status: 'ACTIVE',
    service: 'Alfaaz Recruit Research & Recruiter Dossier API',
    quarantine_status: '19_QUARANTINED_2_ACTIVE',
    calibration_status: 'UNCALIBRATED',
    endpoints: {
      sessions: '/recruit/research/sessions',
      session_dossier: '/recruit/research/sessions/:session_id',
      interview_settings: '/recruit/research/interview-settings'
    }
  });
});

// GET /recruit/research/sessions - Candidate list with ethical safeguards
researchRouter.get('/sessions', async (c) => {
  const url = new URL(c.req.url);
  const prohibitedParams = [
    'band', 'parameter', 'confidence', 'relationship', 'score',
    'sort', 'search', 'rank', 'fit', 'features', 'trait'
  ];

  for (const param of prohibitedParams) {
    if (url.searchParams.has(param)) {
      return c.json({
        error: `Evidence-field sorting/filtering/searching is prohibited: ${param}`,
        detail: `Evidence-field sorting/filtering/searching is prohibited: ${param}`
      }, 400);
    }
  }

  const statusFilter = url.searchParams.get('status');

  let stmt: D1PreparedStatement;
  if (statusFilter) {
    stmt = c.env.DB.prepare(`
      SELECT session_id, status, current_screen, order_id, spec_version, created_at, completed_at
      FROM recruit_sessions
      WHERE status = ?
      ORDER BY created_at DESC
    `).bind(statusFilter);
  } else {
    stmt = c.env.DB.prepare(`
      SELECT session_id, status, current_screen, order_id, spec_version, created_at, completed_at
      FROM recruit_sessions
      ORDER BY created_at DESC
    `);
  }

  const sessionsRes = await stmt.all();
  const sessions = sessionsRes.results || [];

  if (sessions.length === 0) return c.json([]);

  // Batch load candidate identities and bookings
  const identitiesRes = await c.env.DB.prepare('SELECT session_id, full_name, email, phone_or_contact, linkedin_url FROM applicant_identities').all();
  const identityMap = new Map((identitiesRes.results || []).map((i: any) => [i.session_id, i]));

  const bookingsRes = await c.env.DB.prepare("SELECT session_id, slot_date, slot_time, slot_display, status, created_at FROM interview_bookings WHERE status = 'SCHEDULED'").all();
  const bookingMap = new Map((bookingsRes.results || []).map((b: any) => [b.session_id, b]));

  const sjtCountsRes = await c.env.DB.prepare('SELECT session_id, COUNT(*) as count FROM sjt_responses GROUP BY session_id').all();
  const sjtCountMap = new Map((sjtCountsRes.results || []).map((s: any) => [s.session_id, Number(s.count)]));

  const list = sessions.map((s: any) => {
    const ident: any = identityMap.get(s.session_id) || {};
    const booking: any = bookingMap.get(s.session_id) || null;
    const sjtCount = sjtCountMap.get(s.session_id) || 0;

    return {
      session_id: s.session_id,
      full_name: ident.full_name || 'Anonymous Applicant',
      candidate_name: ident.full_name || 'Anonymous Applicant',
      email: ident.email || '—',
      candidate_email: ident.email || '—',
      phone_or_contact: ident.phone_or_contact || null,
      candidate_phone: ident.phone_or_contact || null,
      linkedin_url: ident.linkedin_url || null,
      status: s.status,
      current_screen: s.current_screen,
      order_id: s.order_id,
      spec_version: s.spec_version,
      has_sjt: sjtCount >= 7,
      has_sjt_completed: sjtCount >= 7,
      interview_booking: booking ? {
        slot_date: booking.slot_date,
        slot_time: booking.slot_time,
        slot_display: booking.slot_display,
        status: booking.status,
        created_at: booking.created_at
      } : null,
      created_at: s.created_at,
      completed_at: s.completed_at
    };
  });

  return c.json(list);
});

// GET /recruit/research/sessions/:session_id - Comprehensive candidate evaluation dossier
researchRouter.get('/sessions/:session_id', async (c) => {
  const admin = c.get('user');
  const sessionId = c.req.param('session_id');

  const session = await c.env.DB.prepare('SELECT * FROM recruit_sessions WHERE session_id = ?').bind(sessionId).first<any>();
  if (!session) {
    return c.json({ error: 'Candidate session not found.', detail: 'Candidate session not found.' }, 404);
  }

  // Log recruiter access to audit trail
  try {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    await c.env.DB.prepare(`
      INSERT INTO recruiter_access_logs (admin_email, session_id, ip_address)
      VALUES (?, ?, ?)
    `).bind(admin.email, sessionId, ip).run();
  } catch (err) {
    console.error('Failed to record recruiter access log:', err);
  }

  const forceRecompute = c.req.query('recompute')?.toLowerCase() === 'true';

  const eventsCountRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM telemetry_events WHERE session_id = ?').bind(sessionId).first<{ count: number }>();
  const eventsCount = eventsCountRow?.count || 0;

  // Check existing evidence
  let evidenceList = (await c.env.DB.prepare('SELECT * FROM evidence WHERE session_id = ? AND is_superseded = 0').bind(sessionId).all<any>()).results || [];

  const needsRecompute = forceRecompute || evidenceList.length === 0 || (eventsCount > 0 && evidenceList.every((e: any) => e.game_raw === null));

  if (needsRecompute) {
    try {
      await extractSessionFeatures(c.env.DB, sessionId);
      evidenceList = await integrateSessionEvidence(c.env.DB, sessionId, true);
    } catch (e) {
      console.warn(`[DOSSIER] Auto feature/evidence extraction notice for ${sessionId}:`, e);
    }
  }

  const identity = await c.env.DB.prepare('SELECT * FROM applicant_identities WHERE session_id = ?').bind(sessionId).first<any>();
  const consent = await c.env.DB.prepare('SELECT * FROM consent_records WHERE session_id = ?').bind(sessionId).first<any>();
  const booking = await c.env.DB.prepare('SELECT * FROM interview_bookings WHERE session_id = ?').bind(sessionId).first<any>();
  const flags = (await c.env.DB.prepare('SELECT * FROM data_quality_flags WHERE session_id = ?').bind(sessionId).all<any>()).results || [];
  const features = (await c.env.DB.prepare('SELECT * FROM features WHERE session_id = ?').bind(sessionId).all<any>()).results || [];
  const gameScores = (await c.env.DB.prepare('SELECT * FROM game_scores WHERE session_id = ?').bind(sessionId).all<any>()).results || [];

  const gameScoresById: Record<string, any> = {};
  for (const gs of gameScores) {
    gameScoresById[gs.game_id] = gs;
  }

  const featuresByGame: Record<string, any[]> = {};
  for (const f of features) {
    if (!featuresByGame[f.mini_game]) featuresByGame[f.mini_game] = [];
    featuresByGame[f.mini_game].push(f);
  }

  const evidenceDict: Record<string, any> = {};
  for (const ev of evidenceList) {
    evidenceDict[ev.parameter] = {
      parameter: ev.parameter,
      sjt_raw: ev.sjt_raw,
      sjt_min: ev.sjt_min,
      sjt_max: ev.sjt_max,
      sjt_span: ev.sjt_span,
      sjt_num: ev.sjt_num,
      sjt_relative: ev.sjt_relative,
      sjt_band: ev.sjt_band,
      random_responder_reference: RANDOM_RESPONDER_REFERENCE[ev.parameter] || {},
      predicted_sjt_relative: ev.predicted_sjt_relative,
      model_version: ev.model_version,
      prediction_status: ev.prediction_status,
      game_raw: ev.game_raw,
      game_min: ev.game_min,
      game_max: ev.game_max,
      game_span: ev.game_span,
      game_num: ev.game_num,
      game_relative: ev.game_relative,
      game_observation_count: ev.game_observation_count,
      game_consistency_spread: ev.game_consistency_spread,
      cross_method_delta: ev.cross_method_delta,
      profile_completeness: ev.profile_completeness,
      game_status: ev.game_status,
      game_band: ev.game_band,
      consistency: ev.consistency,
      relationship: ev.relationship,
      confidence: ev.confidence,
      observed_behavior: ev.observed_behavior_summary
    };
  }

  // Build Dimensions array for 7 parameters
  const dimensions: any[] = [];
  for (const paramName of Object.keys(PARAM_MINIGAMES)) {
    const ev = evidenceList.find((e: any) => e.parameter === paramName);
    const gameIds = PARAM_MINIGAMES[paramName];
    const usableCount = gameIds.filter(gid => {
      const gs = gameScoresById[gid];
      return gs && gs.status === 'USABLE' && gs.relative_score !== null;
    }).length;

    dimensions.push({
      parameter: paramName,
      display_name: PARAM_DISPLAY_NAMES[paramName] || paramName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      sjt: {
        raw: ev?.sjt_raw ?? null,
        min: ev?.sjt_min ?? null,
        max: ev?.sjt_max ?? null,
        span: ev?.sjt_span ?? null,
        num: ev?.sjt_num ?? null,
        relative: ev?.sjt_relative ?? null,
        band: ev?.sjt_band ?? null,
      },
      games: {
        status: ev?.game_status || 'INSUFFICIENT',
        raw: ev?.game_raw ?? null,
        min: ev?.game_min ?? null,
        max: ev?.game_max ?? null,
        span: ev?.game_span ?? null,
        num: ev?.game_num ?? null,
        relative: ev?.game_relative ?? null,
        band: ev?.game_band ?? null,
        observation_count: ev?.game_observation_count ?? 0,
        consistency: ev?.consistency || 'INSUFFICIENT',
        consistency_spread: ev?.game_consistency_spread ?? null,
        usable_count: usableCount,
        total_count: gameIds.length
      },
      game_relative: ev?.game_relative ?? null,
      cross_method_delta: ev?.cross_method_delta ?? null,
      model: {
        status: ev?.prediction_status || 'NOT_AVAILABLE',
        predicted_relative: ev?.predicted_sjt_relative ?? null,
        model_version: ev?.model_version || 'none'
      },
      relationship: ev?.relationship || 'NOT_AVAILABLE',
      confidence: ev?.confidence || 'LIMITED',
      observed_behavior: ev?.observed_behavior_summary || 'No data.'
    });
  }

  // Compute multi-mode ranks across dimensions
  const sortedBySjt = [...dimensions].sort((a, b) => {
    const aVal = a.sjt?.relative !== null ? a.sjt.relative : -999;
    const bVal = b.sjt?.relative !== null ? b.sjt.relative : -999;
    return bVal - aVal;
  });
  sortedBySjt.forEach((d, idx) => {
    d.rank_sjt = d.sjt?.relative !== null ? idx + 1 : null;
  });

  const sortedByGame = [...dimensions].sort((a, b) => {
    const aVal = a.game_relative !== null ? a.game_relative : -999;
    const bVal = b.game_relative !== null ? b.game_relative : -999;
    return bVal - aVal;
  });
  sortedByGame.forEach((d, idx) => {
    d.rank_game = d.game_relative !== null ? idx + 1 : null;
  });

  const sortedByDelta = [...dimensions].sort((a, b) => {
    const aVal = a.cross_method_delta !== null ? a.cross_method_delta : -999;
    const bVal = b.cross_method_delta !== null ? b.cross_method_delta : -999;
    return bVal - aVal;
  });
  sortedByDelta.forEach((d, idx) => {
    d.rank_delta = d.cross_method_delta !== null ? idx + 1 : null;
  });

  const hasAnySjt = dimensions.some(d => d.sjt?.relative !== null);
  const hasAnyGame = dimensions.some(d => d.game_relative !== null);

  if (hasAnySjt) {
    dimensions.sort((a, b) => ((b.sjt?.relative ?? -999) - (a.sjt?.relative ?? -999)));
  } else if (hasAnyGame) {
    dimensions.sort((a, b) => ((b.game_relative ?? -999) - (a.game_relative ?? -999)));
  }
  dimensions.forEach((d, idx) => { d.rank = idx + 1; });

  // Measurement comparisons
  const measurementComparisons: Record<string, any> = {};
  for (const [parameter, gameIds] of Object.entries(PARAM_MINIGAMES)) {
    const gameMeasures = [];
    for (const gameId of gameIds) {
      const gFeatures = featuresByGame[gameId] || [];
      const gs = gameScoresById[gameId];
      gameMeasures.push({
        mini_game: gameId,
        status: gs?.status || (gFeatures.length > 0 ? 'USABLE' : 'INSUFFICIENT'),
        feature_status: gFeatures.length === 0 ? 'NOT_DERIVED' : (gFeatures.every(f => f.valid) ? 'VALID' : 'FLAGGED'),
        features: gFeatures.map(f => ({
          feature_name: f.feature_name,
          value_raw: f.value_raw,
          display_value: f.value_raw !== null ? String(Number(f.value_raw).toFixed(2)) : 'Not implemented',
          valid: Boolean(f.valid),
          flags: JSON.parse(f.flags_json || '[]')
        }))
      });
    }
    measurementComparisons[parameter] = {
      parameter,
      games: gameMeasures,
      calibrated_bands: []
    };
  }

  // Duration
  let durationMinutes: number | null = null;
  if (session.created_at && session.completed_at) {
    const start = new Date(session.created_at).getTime();
    const end = new Date(session.completed_at).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      durationMinutes = Number(((end - start) / 60000).toFixed(1));
    }
  }

  const profileCompleteness = evidenceList[0]?.profile_completeness || 'INSUFFICIENT';

  const profileSummary = {
    model_id: 'game_sjt_scoring_v1',
    model_version: '1.0',
    completeness: profileCompleteness,
    calibration_status: 'UNCALIBRATED',
    interpretation_type: 'WITHIN_PERSON_RELATIVE_PROFILE',
    safeguards: {
      statement: 'Provisional within-person relative profile for exploratory human review only. Not validated for selection, hiring, or comparative ranking.',
      overall_score_allowed: false,
      normative_ranking_allowed: false
    }
  };

  const candidateCoreGames = Object.values(CANDIDATE_CORE_MINIGAMES).flat();
  const researchBankGames = LOCKED_GAMES.filter(g => !candidateCoreGames.includes(g.game_id)).map(g => g.game_id);

  const formattedFeatures = features.map(f => {
    return {
      mini_game: f.mini_game,
      feature_name: f.feature_name,
      value_raw: f.value_raw,
      display_value: f.value_raw !== null ? String(Number(f.value_raw).toFixed(2)) : 'Not implemented',
      valid: Boolean(f.valid),
      flags: JSON.parse(f.flags_json || '[]'),
      is_quarantined: false,
      status: f.valid ? 'VALID' : 'FLAGGED',
      quarantine_reason: null
    };
  });

  const taskRecords = await getSessionTaskRecords(c.env.DB, sessionId);

  return c.json({
    metadata: {
      session_id: session.session_id,
      status: session.status,
      battery_version: '2.0',
      expected_candidate_game_count: 14,
      candidate_core_games: candidateCoreGames,
      research_bank_games: researchBankGames,
      created_at: session.created_at,
      completed_at: session.completed_at,
      duration_minutes: durationMinutes,
      applicant: {
        full_name: identity ? identity.full_name : null,
        email: identity ? identity.email : null,
        phone_or_contact: identity ? identity.phone_or_contact : null,
        linkedin_url: identity ? identity.linkedin_url : null,
        interview_booking: booking ? {
          slot_date: booking.slot_date,
          slot_time: booking.slot_time,
          slot_display: booking.slot_display,
          status: booking.status,
          created_at: booking.created_at
        } : null
      },
      consent: {
        consent_text_version: consent ? consent.consent_text_version : '2026-10-v2',
        timestamp: consent ? consent.timestamp : null,
        confirmed_18_plus: consent ? Boolean(consent.confirmed_18_plus) : true
      },
      telemetry_summary: {
        total_events: eventsCount
      },
      safeguards: {
        banner: 'Research evidence view. Not validated. Not for selection decisions.',
        ipsative_note: 'Parameters are derived from Situational Judgment responses and interactive behavioral tasks. These are provisional within-person relative indicators, NOT standardized trait scores.',
        sjt_emphasis_note: 'Relative emphasis in this SJT\'s trade-offs: higher / middle / lower.'
      }
    },
    profile_summary: profileSummary,
    dimensions,
    evidence_by_parameter: evidenceDict,
    measurement_comparisons: measurementComparisons,
    psychometric_status: {
      calibration_status: 'UNCALIBRATED',
      reliability: 'NOT_ESTIMATED',
      validity: 'NOT_ESTIMATED',
      regression: 'DEACTIVATED',
      reliability_method: null,
      validity_method: null,
      reliability_note: 'Requires task-appropriate empirical normative study; cross-method delta does NOT establish reliability.',
      validity_note: 'Criterion validity and regression require linked external outcome data.',
      single_score_status: 'PROHIBITED',
      single_score: null,
      safeguard: 'Alfaaz Recruit does not compute a single overall score, suitability score, or normative candidate ranking.'
    },
    features: formattedFeatures,
    task_records: taskRecords,
    task_records_statement: DOSSIER_STATEMENT,
    data_quality_flags: flags.map(fl => ({ scope: fl.scope, flag: fl.flag, detail: fl.detail }))
  });
});

// POST /recruit/research/sessions/:session_id/reschedule - Reschedule or cancel interview
researchRouter.post('/sessions/:session_id/reschedule', async (c) => {
  const sessionId = c.req.param('session_id');
  const body = await c.req.json().catch(() => ({}));

  if (body.action === 'CANCEL') {
    await c.env.DB.prepare('DELETE FROM interview_bookings WHERE session_id = ?').bind(sessionId).run();
    return c.json({ status: 'CANCELLED' });
  }

  const slotDate = (body.slot_date || '').trim();
  const slotTime = (body.slot_time || '').trim();
  const slotDisplay = (body.slot_display || `${slotDate} ${slotTime}`).trim();

  if (!slotDate || !slotTime) {
    return c.json({ error: 'slot_date and slot_time are required', detail: 'slot_date and slot_time are required' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE interview_bookings
    SET slot_date = ?, slot_time = ?, slot_display = ?
    WHERE session_id = ?
  `).bind(slotDate, slotTime, slotDisplay, sessionId).run();

  return c.json({ status: 'RESCHEDULED', slot_date: slotDate, slot_time: slotTime });
});

// GET /recruit/research/interview-settings - Recruiter interview window config
researchRouter.get('/interview-settings', async (c) => {
  const settings = await c.env.DB.prepare('SELECT slots_json, skip_days_json FROM interview_settings WHERE id = 1').first<{ slots_json: string; skip_days_json: string }>();
  if (!settings) {
    return c.json({
      slots: ["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"],
      skip_days: ["Sunday"]
    });
  }

  let slots = ["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"];
  let skipDays = ["Sunday"];
  try {
    if (settings.slots_json) slots = JSON.parse(settings.slots_json);
    if (settings.skip_days_json) skipDays = JSON.parse(settings.skip_days_json);
  } catch {}

  return c.json({
    slots,
    skip_days: skipDays
  });
});

// POST /recruit/research/interview-settings - Update interview config
researchRouter.post('/interview-settings', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const slots = Array.isArray(body.slots) ? body.slots : ["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"];
  const skipDays = Array.isArray(body.skip_days) ? body.skip_days : (Array.isArray(body.skip_days_json) ? body.skip_days_json : ["Sunday"]);

  const slotsJson = JSON.stringify(slots);
  const skipDaysJson = JSON.stringify(skipDays);

  await c.env.DB.prepare(`
    INSERT INTO interview_settings (id, slots_json, skip_days_json)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slots_json = excluded.slots_json,
      skip_days_json = excluded.skip_days_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(slotsJson, skipDaysJson).run();

  return c.json({ status: 'SUCCESS' });
});

// POST /recruit/research/webhook-test - Recruiter webhook testing
researchRouter.post('/webhook-test', async (c) => {
  const admin = c.get('user');
  const emailProvider = getEmailProvider(c.env);
  const success = await emailProvider.sendEmail(
    admin.email,
    'ALFAAZ — Recruiter Webhook Diagnostic',
    'Diagnostic ping from Alfaaz Recruiter Research Dossier system.'
  );

  return c.json({ status: success ? 'DELIVERED' : 'FAILED', target: admin.email });
});

export default researchRouter;
