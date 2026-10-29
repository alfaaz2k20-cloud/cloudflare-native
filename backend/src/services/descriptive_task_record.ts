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
    const hasEvents = evCount > 0;
    const gateStatus = hasEvents ? "RECORDED" : "NOT_DERIVED";

    const NEUTRAL_TAG = "neutral behavioral record, no good/bad direction";
    let descText = "not derived yet";
    if (hasEvents) {
      switch (g.game_id) {
        case "F1": descText = `completed ${evCount} cue attunement trials`; break;
        case "F2": descText = `completed ${evCount} ambiguous cue inquiry trials; ${NEUTRAL_TAG}`; break;
        case "F3": descText = `completed ${evCount} contextual interpretation transitions`; break;
        case "A1": descText = `completed ${evCount} classification items`; break;
        case "A2": descText = `handled ${evCount} exception decisions as defined`; break;
        case "A3": descText = `inspected ${evCount} records; flagged discrepancies`; break;
        case "C1": descText = `completed ${evCount} resource allocation rounds; ${NEUTRAL_TAG}`; break;
        case "C2": descText = `completed ${evCount} canvas coordination rounds`; break;
        case "C3": descText = `executed collaboration repair in ${evCount} breakdowns`; break;
        case "E1": descText = `completed ${evCount} rule-shift sorting trials`; break;
        case "E2": descText = `completed ${evCount} setback recovery sequences; ${NEUTRAL_TAG}`; break;
        case "E3": descText = `completed ${evCount} environmental condition transitions`; break;
        case "Q1": descText = `explored ${evCount} optional alcoves and decisions; ${NEUTRAL_TAG}`; break;
        case "Q2": descText = `inspected ${evCount} optional investigative clues; ${NEUTRAL_TAG}`; break;
        case "Q3": descText = `retrieved ${evCount} optional synthesis dossiers; ${NEUTRAL_TAG}`; break;
        case "CR1": descText = `assembled compositions using ${evCount} distinct elements; ${NEUTRAL_TAG}`; break;
        case "CR2": descText = `completed constraint shifts with ${evCount} adjustments; ${NEUTRAL_TAG}`; break;
        case "CR3": descText = `tested ${evCount} tool affordances across problems; ${NEUTRAL_TAG}`; break;
        case "M1": descText = `completed ${evCount} verification units; ${NEUTRAL_TAG}`; break;
        case "M2": descText = `completed mandatory units and continued for ${evCount} optional units; ${NEUTRAL_TAG}`; break;
        case "M3": descText = `completed persistence trials under reduced feedback; ${NEUTRAL_TAG}`; break;
        default: descText = `completed ${evCount} behavioral observations`; break;
      }
    }

    return {
      game_id: g.game_id,
      world_id: g.world_id,
      world_name: g.world_name,
      game_name: g.game_name,
      battery_role: isCandidateCore ? "candidate_core" : "research_bank",
      status: gateStatus,
      display_status: gateStatus,
      display_text: descText,
      opportunity_count: evCount,
      opportunities_count: evCount,
      descriptive_counts: {
        raw: sc?.raw_score ?? null,
        relative: sc?.relative_score ?? null,
        band: sc?.band ?? null,
        observations: sc?.observation_count ?? evCount
      },
      tag: g.is_neutral ? NEUTRAL_TAG : null,
      is_neutral_record: g.is_neutral
    };
  });
}
