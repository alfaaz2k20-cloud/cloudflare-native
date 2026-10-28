import { GAME_BOUNDS } from './evidence';

export interface ExtractedFeature {
  session_id: string;
  mini_game: string;
  feature_name: string;
  value_raw: number | null;
  value_adjusted: number | null;
  adjust_method: string | null;
  feature_version: string;
  valid: boolean;
  flags: string[];
}

export const FEATURE_METADATA: Record<string, { mini_game: string; direction: 'POSITIVE' | 'NEGATIVE'; is_timing: boolean }> = {
  classification_rule_adherence_rate: { mini_game: "A1", direction: "POSITIVE", is_timing: false },
  verification_duration_ratio: { mini_game: "A1", direction: "POSITIVE", is_timing: true },
  exception_flagging_precision: { mini_game: "A2", direction: "POSITIVE", is_timing: false },
  cue_response_latency_ms: { mini_game: "F1", direction: "NEGATIVE", is_timing: true },
  clarification_vs_assumption_ratio: { mini_game: "F2", direction: "POSITIVE", is_timing: false },
  need_sensitive_sharing_index: { mini_game: "C1", direction: "POSITIVE", is_timing: false },
  coordination_collision_avoidance_rate: { mini_game: "C2", direction: "POSITIVE", is_timing: false },
  perseverative_error_count: { mini_game: "E1", direction: "NEGATIVE", is_timing: false },
  cadence_stability_ratio: { mini_game: "E2", direction: "POSITIVE", is_timing: false },
  optional_alcove_exploration_rate: { mini_game: "Q1", direction: "POSITIVE", is_timing: false },
  anomaly_investigation_depth: { mini_game: "Q2", direction: "POSITIVE", is_timing: false },
  solution_uniqueness_index: { mini_game: "CR1", direction: "POSITIVE", is_timing: false },
  functional_fixedness_overcome_rate: { mini_game: "CR3", direction: "POSITIVE", is_timing: false },
  mandatory_cadence_consistency: { mini_game: "M1", direction: "POSITIVE", is_timing: false },
  optional_units_completed: { mini_game: "M2", direction: "POSITIVE", is_timing: false }
};

export async function extractSessionFeatures(db: D1Database, sessionId: string): Promise<void> {
  const events = await db
    .prepare("SELECT * FROM telemetry_events WHERE session_id = ? ORDER BY seq ASC")
    .bind(sessionId)
    .all<any>();

  if (!events.results || events.results.length === 0) return;

  // Group events by minigame
  const mgEvents: Record<string, any[]> = {};
  for (const ev of events.results) {
    const mg = ev.mini_game || ev.game;
    if (mg) {
      if (!mgEvents[mg]) mgEvents[mg] = [];
      mgEvents[mg].push(ev);
    }
  }

  // Clear previous features
  await db.prepare("DELETE FROM features WHERE session_id = ?").bind(sessionId).run();
  await db.prepare("DELETE FROM game_scores WHERE session_id = ?").bind(sessionId).run();

  const featureInserts: D1PreparedStatement[] = [];
  const scoreInserts: D1PreparedStatement[] = [];

  const GAME_TO_PARAM: Record<string, string> = {
    F1: 'empathy', F2: 'empathy', F3: 'empathy',
    A1: 'conscientiousness', A2: 'conscientiousness', A3: 'conscientiousness',
    C1: 'collaborative_spirit', C2: 'collaborative_spirit', C3: 'collaborative_spirit',
    E1: 'emotional_agility', E2: 'emotional_agility', E3: 'emotional_agility',
    Q1: 'curiosity', Q2: 'curiosity', Q3: 'curiosity',
    CR1: 'creative_initiative', CR2: 'creative_initiative', CR3: 'creative_initiative',
    M1: 'motivation', M2: 'motivation', M3: 'motivation'
  };

  for (const [mg, evs] of Object.entries(mgEvents)) {
    const param = GAME_TO_PARAM[mg];
    if (!param) continue;

    const bounds = GAME_BOUNDS[mg] || { min: 0, max: 1, min_obs: 1 };
    const obsCount = evs.length;
    const isUsable = obsCount >= bounds.min_obs;

    // Deterministic score derived from event actions
    let rawScore = 0;
    for (const ev of evs) {
      if (['correct', 'select', 'share', 'flag', 'success', 'complete_trial', 'confirm'].includes(ev.action)) {
        rawScore += 1;
      }
    }
    // Clamp to bounds
    rawScore = Math.min(bounds.max, Math.max(bounds.min, rawScore));
    const span = bounds.max - bounds.min;
    const num = rawScore - bounds.min;
    const relativeScore = span > 0 ? Number((num / span).toFixed(6)) : 0;
    const band = relativeScore >= 0.66 ? 'HIGH' : (relativeScore >= 0.33 ? 'MODERATE' : 'LOW');
    const status = isUsable ? 'USABLE' : 'INSUFFICIENT';

    scoreInserts.push(
      db.prepare(`
        INSERT INTO game_scores (
          session_id, game_id, parameter, raw_score, min_score, max_score, span,
          num, relative_score, band, status, task_def_version, scoring_version,
          observation_count, flags_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2.0', 'game_sjt_scoring_v1', ?, '[]')
      `).bind(
        sessionId, mg, param, rawScore, bounds.min, bounds.max, span,
        num, relativeScore, band, status, obsCount
      )
    );

    featureInserts.push(
      db.prepare(`
        INSERT INTO features (
          session_id, mini_game, feature_name, value_raw, value_adjusted,
          adjust_method, feature_version, valid, flags_json
        ) VALUES (?, ?, ?, ?, ?, 'standard', '1.0', 1, '[]')
      `).bind(
        sessionId, mg, `${mg.toLowerCase()}_performance_index`, relativeScore, relativeScore
      )
    );
  }

  if (featureInserts.length > 0) await db.batch(featureInserts);
  if (scoreInserts.length > 0) await db.batch(scoreInserts);
}
