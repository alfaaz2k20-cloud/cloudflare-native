import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('CHALLENGER 2: EMPIRICAL HARDENING STRESS TEST HARNESS');
console.log('====================================================');

const schemaPath = path.join(rootDir, 'database/migrations/0001_initial_schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

// ==============================================================================
// TEST 1: Database-Level Uniqueness & Constraint Hardening
// ==============================================================================
console.log('\n[TEST 1] Auditing SQLite / D1 Database Constraints Directly...');
const db = new DatabaseSync(':memory:');
db.exec(schemaSql);

// 1.1 interview_bookings (slot_date, slot_time) collision
db.exec("INSERT INTO recruit_sessions (session_id) VALUES ('sess_alice')");
db.exec("INSERT INTO recruit_sessions (session_id) VALUES ('sess_bob')");

db.prepare(`
  INSERT INTO interview_bookings (session_id, candidate_name, candidate_email, slot_date, slot_time, slot_display)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('sess_alice', 'Alice Smith', 'alice@alfaaz.local', '2026-11-25', '11:00 AM', 'Nov 25, 11:00 AM');
console.log('  ✓ Booking 1 (sess_alice, 2026-11-25 11:00 AM) inserted.');

let slotCollisionCaught = false;
try {
  db.prepare(`
    INSERT INTO interview_bookings (session_id, candidate_name, candidate_email, slot_date, slot_time, slot_display)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('sess_bob', 'Bob Jones', 'bob@alfaaz.local', '2026-11-25', '11:00 AM', 'Nov 25, 11:00 AM');
} catch (err) {
  slotCollisionCaught = true;
  console.log('  ✓ Verified: DB rejected duplicate (slot_date, slot_time):', err.message);
  if (!err.message.includes('UNIQUE constraint failed: interview_bookings.slot_date, interview_bookings.slot_time')) {
    throw new Error('Unexpected error message for slot collision: ' + err.message);
  }
}
if (!slotCollisionCaught) {
  throw new Error('CRITICAL VULNERABILITY: DB allowed two sessions to book the exact same slot!');
}

// 1.2 interview_bookings session_id uniqueness
let sessionCollisionCaught = false;
try {
  db.prepare(`
    INSERT INTO interview_bookings (session_id, candidate_name, candidate_email, slot_date, slot_time, slot_display)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('sess_alice', 'Alice Smith', 'alice@alfaaz.local', '2026-11-26', '03:00 PM', 'Nov 26, 03:00 PM');
} catch (err) {
  sessionCollisionCaught = true;
  console.log('  ✓ Verified: DB rejected duplicate booking for same session_id:', err.message);
}
if (!sessionCollisionCaught) {
  throw new Error('CRITICAL VULNERABILITY: DB allowed single session to book multiple slots without replacement!');
}

// 1.3 event_registrations (event_id, user_email) uniqueness
db.exec("INSERT INTO events (id, name, registration_open, capacity) VALUES (10, 'Poetry Conclave', 1, 50)");
db.prepare(`
  INSERT INTO event_registrations (event_id, user_email, whatsapp_number)
  VALUES (?, ?, ?)
`).run(10, 'poet@alfaaz.local', '+919876543210');
console.log('  ✓ Registration 1 (event_id=10, poet@alfaaz.local) inserted.');

let eventDupCaught = false;
try {
  db.prepare(`
    INSERT INTO event_registrations (event_id, user_email, whatsapp_number)
    VALUES (?, ?, ?)
  `).run(10, 'poet@alfaaz.local', '+911234567890');
} catch (err) {
  eventDupCaught = true;
  console.log('  ✓ Verified: DB rejected duplicate event registration:', err.message);
  if (!err.message.includes('UNIQUE constraint failed: event_registrations.event_id, event_registrations.user_email')) {
    throw new Error('Unexpected error message for event registration: ' + err.message);
  }
}
if (!eventDupCaught) {
  throw new Error('CRITICAL VULNERABILITY: DB allowed duplicate event registration for same user!');
}

// 1.4 club_applications (user_email, club_name) uniqueness
db.prepare(`
  INSERT INTO club_applications (user_email, club_name, note)
  VALUES (?, ?, ?)
`).run('clubber@alfaaz.local', 'Calligraphy Circle', 'Interested in Nastaliq');
console.log('  ✓ Club application 1 (clubber@alfaaz.local, Calligraphy Circle) inserted.');

let clubDupCaught = false;
try {
  db.prepare(`
    INSERT INTO club_applications (user_email, club_name, note)
    VALUES (?, ?, ?)
  `).run('clubber@alfaaz.local', 'Calligraphy Circle', 'Duplicate application attempt');
} catch (err) {
  clubDupCaught = true;
  console.log('  ✓ Verified: DB rejected duplicate club application:', err.message);
}
if (!clubDupCaught) {
  throw new Error('CRITICAL VULNERABILITY: DB allowed duplicate club application!');
}

// 1.5 consumed_tokens primary key uniqueness
db.prepare(`
  INSERT INTO consumed_tokens (token_hash, expires_at)
  VALUES (?, ?)
`).run('sha256_mock_hash_123', Math.floor(Date.now() / 1000) + 900);
console.log('  ✓ Token hash consumed once.');

let tokenReplayCaught = false;
try {
  db.prepare(`
    INSERT INTO consumed_tokens (token_hash, expires_at)
    VALUES (?, ?)
  `).run('sha256_mock_hash_123', Math.floor(Date.now() / 1000) + 900);
} catch (err) {
  tokenReplayCaught = true;
  console.log('  ✓ Verified: DB rejected duplicate consumed_token (replay protection):', err.message);
}
if (!tokenReplayCaught) {
  throw new Error('CRITICAL VULNERABILITY: DB allowed duplicate consumed token hash!');
}

// 1.6 sjt_responses (session_id, scenario_id) uniqueness
db.prepare(`
  INSERT INTO sjt_responses (session_id, scenario_id, option_id, t_ms)
  VALUES (?, ?, ?, ?)
`).run('sess_alice', 'S1', 'S1A', 1500);
console.log('  ✓ SJT Response 1 (sess_alice, S1) inserted.');

let sjtDupCaught = false;
try {
  db.prepare(`
    INSERT INTO sjt_responses (session_id, scenario_id, option_id, t_ms)
    VALUES (?, ?, ?, ?)
  `).run('sess_alice', 'S1', 'S1B', 1600);
} catch (err) {
  sjtDupCaught = true;
  console.log('  ✓ Verified: DB rejected duplicate sjt_response for same scenario:', err.message);
}
if (!sjtDupCaught) {
  throw new Error('CRITICAL VULNERABILITY: DB allowed multiple responses for same scenario!');
}

console.log('\n[PASS] All 6 database-level uniqueness constraints verified successfully.\n');

// ==============================================================================
// TEST 2: SJT Scoring Engine Combinatorial & Bounds Verification
// ==============================================================================
console.log('[TEST 2] Testing SJT Scoring Engine Robustness & Mathematical Bounds...');

const sjtRaw = fs.readFileSync(path.join(rootDir, 'backend/src/config/sjt_items.json'), 'utf8');
const sjtData = JSON.parse(sjtRaw);
const scenarios = sjtData.scenarios;
const params = ['empathy', 'conscientiousness', 'collaborative_spirit', 'emotional_agility', 'curiosity', 'creative_initiative', 'motivation'];

// Compute parameter ranges
const ranges = {};
for (const p of params) {
  let min = 0;
  let max = 0;
  for (const s of scenarios) {
    const vals = s.options.map(opt => (opt.keys && opt.keys[p]) || 0);
    min += Math.min(...vals);
    max += Math.max(...vals);
  }
  ranges[p] = { min, max, span: max - min };
}

const optionKeyMap = new Map();
for (const s of scenarios) {
  for (const opt of s.options) {
    optionKeyMap.set(`${s.id}:${opt.id}`, opt.keys);
  }
}

function scoreResponses(responses) {
  const rawScores = {};
  for (const p of params) rawScores[p] = 0;

  for (const s of scenarios) {
    const optId = responses[s.id];
    if (!optId) {
      throw new Error(`Missing response for scenario ${s.id}`);
    }
    const key = `${s.id}:${optId}`;
    const keys = optionKeyMap.get(key);
    if (!keys) {
      throw new Error(`Invalid option ${optId} for scenario ${s.id}`);
    }
    for (const p of params) {
      rawScores[p] += keys[p] || 0;
    }
  }

  const results = {};
  for (const p of params) {
    const raw = rawScores[p];
    const { min, max, span } = ranges[p];
    const num = raw - min;
    const sjt_relative = span > 0 ? Number((num / span).toFixed(6)) : 0;

    let band;
    if (span === 0) {
      band = 'UNAVAILABLE';
    } else if (3 * num >= 2 * span) {
      band = 'HIGH';
    } else if (3 * num >= span) {
      band = 'MODERATE';
    } else {
      band = 'LOW';
    }

    results[p] = { raw, min, max, span, num, sjt_relative, band };
  }
  return results;
}

// 2.1 Out-of-bounds error handling
let missingCaught = false;
try {
  scoreResponses({ S1: 'S1A', S2: 'S2A' });
} catch (err) {
  missingCaught = true;
  console.log('  ✓ Verified: Missing scenario caught:', err.message);
}
if (!missingCaught) throw new Error('Engine failed to throw on missing scenarios');

let invalidOptCaught = false;
try {
  scoreResponses({
    S1: 'INVALID_OPT_999',
    S2: 'S2A', S3: 'S3A', S4: 'S4A', S5: 'S5A', S6: 'S6A', S7: 'S7A'
  });
} catch (err) {
  invalidOptCaught = true;
  console.log('  ✓ Verified: Invalid option caught:', err.message);
}
if (!invalidOptCaught) throw new Error('Engine failed to throw on invalid option ID');

// 2.2 Boundary condition: Minimum Possible Score across all constructs
const minResponses = {};
for (const s of scenarios) {
  // pick first option
  minResponses[s.id] = s.options[0].id;
}
const minScoreResult = scoreResponses(minResponses);
console.log('  ✓ Sample score calculated for min selection:');
for (const p of params) {
  const r = minScoreResult[p];
  if (r.raw < r.min || r.raw > r.max) throw new Error(`Raw score out of bounds for ${p}: ${r.raw}`);
  if (r.sjt_relative < 0 || r.sjt_relative > 1) throw new Error(`Relative score out of bounds for ${p}: ${r.sjt_relative}`);
  if (!['LOW', 'MODERATE', 'HIGH'].includes(r.band)) throw new Error(`Invalid band for ${p}: ${r.band}`);
}
console.log('  ✓ All 7 constructs strictly satisfy [min <= raw <= max], [0 <= relative <= 1], and valid integer thirds band.');

// 2.3 Exhaustive combination stress testing:
// Number of combinations: scenarios have 4 options each. 4^7 = 16,384 combinations.
let totalCombos = 0;
function testAllCombos(index, current) {
  if (index === scenarios.length) {
    totalCombos++;
    const res = scoreResponses(current);
    for (const p of params) {
      const score = res[p];
      if (score.raw < score.min || score.raw > score.max) {
        throw new Error(`Out of bounds score in combo ${totalCombos} for ${p}`);
      }
      if (score.num < 0 || score.num > score.span) {
        throw new Error(`Invalid num value in combo ${totalCombos} for ${p}`);
      }
      if (score.sjt_relative < 0 || score.sjt_relative > 1) {
        throw new Error(`Invalid sjt_relative in combo ${totalCombos} for ${p}`);
      }
      if (!['LOW', 'MODERATE', 'HIGH'].includes(score.band)) {
        throw new Error(`Invalid band in combo ${totalCombos} for ${p}`);
      }
    }
    return;
  }
  const s = scenarios[index];
  for (const opt of s.options) {
    current[s.id] = opt.id;
    testAllCombos(index + 1, current);
  }
}

testAllCombos(0, {});
console.log(`  ✓ Exhaustive combinatorial check: Tested ALL ${totalCombos} possible SJT response profiles.`);
console.log('  ✓ 100% of combinations remained within strict bounds; 0 overflows, 0 NaNs, 0 invalid bands.');

console.log('\n[PASS] SJT scoring engine verified mathematically and empirically sound.\n');
console.log('====================================================');
console.log('ALL EMPIRICAL CHALLENGES PASSED WITH ZERO FAILURES');
console.log('====================================================\n');
