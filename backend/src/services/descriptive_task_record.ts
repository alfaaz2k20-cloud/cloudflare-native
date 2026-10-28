export const DOSSIER_STATEMENT = "Descriptive task counts; not a score, not norm-referenced, and not a basis for automated decisions.";

export const LOCKED_GAMES = [
  { game_id: "F1", world_id: "W1", world_name: "The Frequency", game_name: "Cue Detection", is_neutral: false },
  { game_id: "F2", world_id: "W1", world_name: "The Frequency", game_name: "Ambiguous Cue", is_neutral: true },
  { game_id: "F3", world_id: "W1", world_name: "The Frequency", game_name: "Context Change", is_neutral: false },
  { game_id: "A1", world_id: "W2", world_name: "The Archive", game_name: "Classification", is_neutral: false },
  { game_id: "A2", world_id: "W2", world_name: "The Archive", game_name: "Exception Handling", is_neutral: false },
  { game_id: "A3", world_id: "W2", world_name: "The Archive", game_name: "Quality Control", is_neutral: false },
  { game_id: "C1", world_id: "W3", "world_name": "The Shared Canvas", game_name: "Resource Cooperation", is_neutral: true },
  { game_id: "C2", world_id: "W3", "world_name": "The Shared Canvas", game_name: "Coordination", is_neutral: false },
  { game_id: "C3", world_id: "W3", "world_name": "The Shared Canvas", game_name: "Collaboration Repair", is_neutral: false },
  { game_id: "E1", world_id: "W4", "world_name": "The Shifting Grid", game_name: "Rule Shift", is_neutral: false },
  { game_id: "E2", world_id: "W4", "world_name": "The Shifting Grid", game_name: "Setback Recovery", is_neutral: true },
  { game_id: "E3", world_id: "W4", "world_name": "The Shifting Grid", game_name: "Changing Conditions", is_neutral: false },
  { game_id: "Q1", world_id: "W5", "world_name": "The Hidden Gallery", game_name: "Optional Discovery", is_neutral: true },
  { game_id: "Q2", world_id: "W5", "world_name": "The Hidden Gallery", game_name: "Mystery Exploration", is_neutral: true },
  { game_id: "Q3", world_id: "W5", "world_name": "The Hidden Gallery", game_name: "Information Integration", is_neutral: true },
  { game_id: "CR1", world_id: "W6", "world_name": "The Broken Tool", game_name: "Open Construction", is_neutral: true },
  { game_id: "CR2", world_id: "W6", "world_name": "The Broken Tool", game_name: "Constraint Shift", is_neutral: true },
  { game_id: "CR3", world_id: "W6", "world_name": "The Broken Tool", game_name: "Unspecified Tool Use", is_neutral: true },
  { game_id: "M1", world_id: "W7", "world_name": "The Repetition", game_name: "Minimum Completed", is_neutral: true },
  { game_id: "M2", world_id: "W7", "world_name": "The Repetition", game_name: "Optional Continuation", is_neutral: true },
  { game_id: "M3", world_id: "W7", "world_name": "The Repetition", game_name: "Persistence Under Reduced Feedback", is_neutral: true }
];

export async function getSessionTaskRecords(db: D1Database, sessionId: string): Promise<any[]> {
  const events = await db
    .prepare("SELECT mini_game, COUNT(*) as count FROM telemetry_events WHERE session_id = ? GROUP BY mini_game")
    .bind(sessionId)
    .all<{ mini_game: string; count: number }>();

  const eventCountMap: Record<string, number> = {};
  for (const r of events.results || []) {
    if (r.mini_game) eventCountMap[r.mini_game] = r.count;
  }

  const scores = await db
    .prepare("SELECT game_id, raw_score, relative_score, band, status, observation_count FROM game_scores WHERE session_id = ?")
    .bind(sessionId)
    .all<any>();
  const scoresMap: Record<string, any> = {};
  for (const s of scores.results || []) {
    scoresMap[s.game_id] = s;
  }

  return LOCKED_GAMES.map(g => {
    const sc = scoresMap[g.game_id];
    const evCount = eventCountMap[g.game_id] || 0;
    const isCandidateCore = ["F1", "F2", "A1", "A2", "C1", "C2", "E1", "E2", "Q1", "Q2", "CR1", "CR3", "M1", "M2"].includes(g.game_id);

    return {
      game_id: g.game_id,
      world_id: g.world_id,
      world_name: g.world_name,
      game_name: g.game_name,
      battery_role: isCandidateCore ? "candidate_core" : "research_bank",
      display_status: evCount > 0 ? (sc?.status || "USABLE") : "NOT_PRESENTED",
      opportunity_count: evCount,
      descriptive_counts: {
        raw: sc?.raw_score ?? null,
        relative: sc?.relative_score ?? null,
        band: sc?.band ?? null,
        observations: sc?.observation_count ?? evCount
      },
      tag: g.is_neutral ? "neutral behavioral record, no good/bad direction" : null
    };
  });
}
