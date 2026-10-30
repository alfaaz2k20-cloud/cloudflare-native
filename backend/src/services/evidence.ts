import { scoreSjtResponses, SjtScoreResult } from './sjt';

export const PARAM_MINIGAMES: Record<string, string[]> = {
  empathy: ["F1", "F2", "F3"],
  conscientiousness: ["A1", "A2", "A3"],
  collaborative_spirit: ["C1", "C2", "C3"],
  emotional_agility: ["E1", "E2", "E3"],
  curiosity: ["Q1", "Q2", "Q3"],
  creative_initiative: ["CR1", "CR2", "CR3"],
  motivation: ["M1", "M2", "M3"]
};

export const CANDIDATE_CORE_MINIGAMES: Record<string, string[]> = {
  empathy: ["F1", "F2"],
  conscientiousness: ["A1", "A2"],
  collaborative_spirit: ["C1", "C2"],
  emotional_agility: ["E1", "E2"],
  curiosity: ["Q1", "Q2"],
  creative_initiative: ["CR1", "CR3"],
  motivation: ["M1", "M2"]
};

export const OBSERVED_BEHAVIOR_SUMMARIES: Record<string, string> = {
  empathy: "F1, F2 behavioral traces recorded.",
  conscientiousness: "A1, A2 behavioral traces recorded.",
  collaborative_spirit: "C1, C2 behavioral traces recorded.",
  emotional_agility: "E1, E2 behavioral traces recorded.",
  curiosity: "Q1, Q2 behavioral traces recorded.",
  creative_initiative: "CR1, CR3 behavioral traces recorded.",
  motivation: "M1, M2 behavioral traces recorded."
};

export const GAME_BOUNDS: Record<string, { min: number; max: number; min_obs: number }> = {
  F1: { min: 0, max: 5, min_obs: 2 },
  F2: { min: 0, max: 3, min_obs: 1 },
  F3: { min: 0, max: 2, min_obs: 1 },
  A1: { min: 0, max: 4, min_obs: 2 },
  A2: { min: 0.0, max: 1.0, min_obs: 3 },
  A3: { min: 0, max: 4, min_obs: 2 },
  C1: { min: 0, max: 2, min_obs: 1 },
  C2: { min: 0, max: 2, min_obs: 1 },
  C3: { min: 0, max: 2, min_obs: 1 },
  E1: { min: 0, max: 8, min_obs: 4 },
  E2: { min: 0, max: 3, min_obs: 1 },
  E3: { min: 0, max: 2, min_obs: 1 },
  Q1: { min: 0, max: 3, min_obs: 2 },
  Q2: { min: 0, max: 3, min_obs: 1 },
  Q3: { min: 0, max: 2, min_obs: 1 },
  CR1: { min: 0, max: 2, min_obs: 2 },
  CR2: { min: 0, max: 2, min_obs: 1 },
  CR3: { min: 0, max: 2, min_obs: 1 },
  M1: { min: 0, max: 2, min_obs: 1 },
  M2: { min: 0, max: 2, min_obs: 2 },
  M3: { min: 0, max: 2, min_obs: 2 }
};

export function computeCrossMethodDelta(sjtRelative: number | null, gameRelative: number | null): number | null {
  if (sjtRelative !== null && gameRelative !== null) {
    return Number(Math.abs(sjtRelative - gameRelative).toFixed(6));
  }
  return null;
}

export function determineRelationship(
  delta: number | null,
  hasSjt: boolean,
  gameStatus: string
): string {
  if (!hasSjt) return "NOT_AVAILABLE";
  if (gameStatus === "INSUFFICIENT") return "NOT_ENOUGH_EVIDENCE";
  if (delta === null) return "NOT_AVAILABLE";

  if (delta <= 0.15) return "ALIGNED";
  if (delta <= 0.30) return "PARTLY_ALIGNED";
  return "DIFFERENT";
}

export function determineConfidence(
  hasSjt: boolean,
  nUsableGames: number,
  consistency: string,
  delta: number | null,
  hasCriticalFlag: boolean
): string {
  if (hasCriticalFlag || !hasSjt || nUsableGames < 2) {
    return "LIMITED";
  }

  const baseConfidence = (nUsableGames >= 3 && consistency === "CONSISTENT") ? "SUBSTANTIAL" : "MODERATE";

  if (delta !== null) {
    if (delta <= 0.15) {
      return baseConfidence;
    } else if (delta <= 0.30) {
      return baseConfidence === "SUBSTANTIAL" ? "MODERATE" : baseConfidence;
    } else {
      return "LIMITED";
    }
  }
  return "LIMITED";
}

export async function integrateSessionEvidence(
  db: D1Database,
  sessionId: string,
  forceRecompute: boolean = false
): Promise<any[]> {
  // 1. Fetch SJT responses
  const sjtRows = await db
    .prepare("SELECT scenario_id, option_id FROM sjt_responses WHERE session_id = ?")
    .bind(sessionId)
    .all<{ scenario_id: string; option_id: string }>();

  let sjtScores: Record<string, SjtScoreResult> | null = null;
  const hasSjt = (sjtRows.results?.length || 0) >= 7;
  if (hasSjt) {
    const respMap: Record<string, string> = {};
    for (const r of sjtRows.results || []) {
      respMap[r.scenario_id] = r.option_id;
    }
    try {
      sjtScores = scoreSjtResponses(respMap);
    } catch (e) {
      console.warn('[EVIDENCE] SJT scoring warning:', e);
    }
  }

  // 2. Fetch game scores
  const gameRows = await db
    .prepare("SELECT game_id, parameter, relative_score, status, observation_count FROM game_scores WHERE session_id = ?")
    .bind(sessionId)
    .all<{ game_id: string; parameter: string; relative_score: number | null; status: string; observation_count: number }>();

  const gameScoresByParam: Record<string, any[]> = {};
  for (const p of Object.keys(PARAM_MINIGAMES)) {
    gameScoresByParam[p] = [];
  }
  for (const g of gameRows.results || []) {
    if (gameScoresByParam[g.parameter]) {
      gameScoresByParam[g.parameter].push(g);
    }
  }

  // 3. Check for critical quality flags
  const flagRows = await db
    .prepare("SELECT flag FROM data_quality_flags WHERE session_id = ?")
    .bind(sessionId)
    .all<{ flag: string }>();
  const criticalFlags = new Set(["seq_conflict", "events_cap_reached"]);
  const hasCriticalFlag = (flagRows.results || []).some(f => criticalFlags.has(f.flag));

  // 4. Supersede old evidence records if forceRecompute (deferred to final atomic batch)
  const batchStmts: D1PreparedStatement[] = [];
  if (forceRecompute) {
    batchStmts.push(
      db.prepare("UPDATE evidence SET is_superseded = 1, superseded_at = CURRENT_TIMESTAMP WHERE session_id = ? AND is_superseded = 0").bind(sessionId)
    );
  } else {
    const existing = await db
      .prepare("SELECT * FROM evidence WHERE session_id = ? AND is_superseded = 0")
      .bind(sessionId)
      .all();
    if (existing.results && existing.results.length === 7) {
      return existing.results;
    }
  }

  // 5. Integrate per parameter
  const integratedResults = [];
  const maxVerRow = await db
    .prepare("SELECT MAX(version) as max_v FROM evidence WHERE session_id = ?")
    .bind(sessionId)
    .first<{ max_v: number }>();
  const nextVersion = ((maxVerRow?.max_v) || 0) + 1;

  for (const param of Object.keys(PARAM_MINIGAMES)) {
    const sjt = sjtScores ? sjtScores[param] : null;
    const pGames = gameScoresByParam[param] || [];
    const usableGames = pGames.filter(g => g.status === 'USABLE');
    const nUsable = usableGames.length;

    let gameRelative: number | null = null;
    let gameStatus = 'INSUFFICIENT';
    let consistency = 'NOT_COMPUTED';

    if (nUsable >= 1) {
      const sum = usableGames.reduce((acc, curr) => acc + (curr.relative_score || 0), 0);
      gameRelative = Number((sum / nUsable).toFixed(6));
      gameStatus = nUsable >= 2 ? 'USABLE' : 'PARTIAL';

      if (nUsable >= 2) {
        const scores = usableGames.map(g => g.relative_score || 0);
        const spread = Math.max(...scores) - Math.min(...scores);
        consistency = spread <= 0.33 ? 'CONSISTENT' : 'VARIED';
      }
    }

    const delta = computeCrossMethodDelta(sjt ? sjt.sjt_relative : null, gameRelative);
    const relationship = determineRelationship(delta, hasSjt, gameStatus);
    const confidence = determineConfidence(hasSjt, nUsable, consistency, delta, hasCriticalFlag);

    let profileCompleteness = 'INSUFFICIENT';
    if (hasSjt && gameStatus === 'USABLE') profileCompleteness = 'COMPLETE';
    else if (hasSjt) profileCompleteness = 'SJT_ONLY';
    else if (gameStatus === 'USABLE') profileCompleteness = 'GAMES_ONLY';

    const evidenceRecord = {
      session_id: sessionId,
      parameter: param,
      version: nextVersion,
      is_superseded: 0,
      spec_version: '2026-10-v2',
      sjt_version: '2026-09-rev',
      scoring_version: 'game_sjt_scoring_v1',
      feature_version: '1.0',
      sjt_raw: sjt?.raw ?? null,
      sjt_min: sjt?.min ?? null,
      sjt_max: sjt?.max ?? null,
      sjt_span: sjt?.span ?? null,
      sjt_num: sjt?.num ?? null,
      sjt_relative: sjt?.sjt_relative ?? null,
      sjt_band: sjt?.band ?? null,
      game_raw: gameRelative,
      game_min: 0.0,
      game_max: 1.0,
      game_span: 1.0,
      game_num: gameRelative,
      game_relative: gameRelative,
      game_observation_count: pGames.reduce((acc, g) => acc + (g.observation_count || 0), 0),
      cross_method_delta: delta,
      profile_completeness: profileCompleteness,
      game_status: gameStatus,
      game_band: gameRelative !== null
        ? (3 * gameRelative >= 2 - 1e-5 ? 'HIGH' : (3 * gameRelative >= 1 - 1e-5 ? 'MODERATE' : 'LOW'))
        : null,
      consistency,
      relationship,
      confidence,
      observed_behavior_summary: OBSERVED_BEHAVIOR_SUMMARIES[param] || `${param} behavioral traces recorded.`,
      data_quality_flags_json: JSON.stringify(flagRows.results?.map(f => f.flag) || [])
    };

    // Queue insert statement into batch
    batchStmts.push(
      db.prepare(`
        INSERT INTO evidence (
          session_id, parameter, version, is_superseded, spec_version, sjt_version,
          scoring_version, feature_version, sjt_raw, sjt_min, sjt_max, sjt_span,
          sjt_num, sjt_relative, sjt_band, game_raw, game_min, game_max, game_span,
          game_num, game_relative, game_observation_count, cross_method_delta,
          profile_completeness, game_status, consistency, relationship, confidence,
          observed_behavior_summary, data_quality_flags_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        evidenceRecord.session_id, evidenceRecord.parameter, evidenceRecord.version, evidenceRecord.is_superseded,
        evidenceRecord.spec_version, evidenceRecord.sjt_version, evidenceRecord.scoring_version, evidenceRecord.feature_version,
        evidenceRecord.sjt_raw, evidenceRecord.sjt_min, evidenceRecord.sjt_max, evidenceRecord.sjt_span,
        evidenceRecord.sjt_num, evidenceRecord.sjt_relative, evidenceRecord.sjt_band,
        evidenceRecord.game_raw, evidenceRecord.game_min, evidenceRecord.game_max, evidenceRecord.game_span,
        evidenceRecord.game_num, evidenceRecord.game_relative, evidenceRecord.game_observation_count,
        evidenceRecord.cross_method_delta, evidenceRecord.profile_completeness, evidenceRecord.game_status,
        evidenceRecord.consistency, evidenceRecord.relationship, evidenceRecord.confidence,
        evidenceRecord.observed_behavior_summary, evidenceRecord.data_quality_flags_json
      )
    );

    integratedResults.push(evidenceRecord);
  }

  if (batchStmts.length > 0) {
    await db.batch(batchStmts);
  }

  return integratedResults;
}
