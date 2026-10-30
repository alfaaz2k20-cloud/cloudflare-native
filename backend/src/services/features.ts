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

  // Defer clearing previous features into the final atomic batch to protect against mid-flight failure
  const deleteStmts: D1PreparedStatement[] = [
    db.prepare("DELETE FROM features WHERE session_id = ?").bind(sessionId),
    db.prepare("DELETE FROM game_scores WHERE session_id = ?").bind(sessionId)
  ];

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

  const GAME_SCORING_ACTIONS: Record<string, string[]> = {
    F1: ['trial_submit', 'dialogue_selected'],
    F2: ['trial_submit', 'inquiry_selected'],
    F3: ['transition_completed', 'trial_submit'],
    A1: ['item_sorted', 'document_filed'],
    A2: ['decision_logged', 'exception_resolved'],
    A3: ['item_inspected', 'record_flagged'],
    C1: ['allocation_confirmed', 'resource_transferred'],
    C2: ['placement_confirmed', 'placement_attempted'],
    C3: ['repair_executed', 'breakdown_resolved'],
    E1: ['tile_sorted', 'rule_shifted'],
    E2: ['sequence_completed', 'action_selected'],
    E3: ['adaptation_confirmed', 'condition_shifted'],
    Q1: ['decision_submitted', 'alcove_explored'],
    Q2: ['investigation_finalized', 'clue_inspected'],
    Q3: ['dossier_retrieved', 'synthesis_decided'],
    CR1: ['stage_completed', 'part_toggled'],
    CR2: ['reframing_adjusted', 'constraint_shifted'],
    CR3: ['strategy_adapted', 'tool_selected'],
    M1: ['unit_completed', 'unit_action_performed'],
    M2: ['continuation_choice_selected', 'unit_completed'],
    M3: ['persistence_trial_completed', 'unit_verified']
  };

  // Ground truth target maps matching alfaaz-project task definitions
  const F1_EXPECTED: Record<string, string> = {
    F1_T1: 'accommodate',
    F1_T2: 'maintain_objective',
    F1_T3: 'accommodate',
    F1_T4: 'clarify',
    F1_T5: 'maintain_objective'
  };
  const F1_EXPECTED_ACTIONS: Record<string, string> = {
    F1_T1: 'attenuate_reverb',
    F1_T2: 'maintain_baseline',
    F1_T3: 'boost_intelligibility',
    F1_T4: 'clarify_channel',
    F1_T5: 'maintain_baseline'
  };

  const F2_EXPECTED: Record<string, string> = {
    F2_T1: 'act',
    F2_T2: 'clarify',
    F2_T3: 'maintain'
  };
  const F2_EXPECTED_ACTIONS: Record<string, string> = {
    F2_T1: 'support_cue',
    F2_T2: 'clarify_intent',
    F2_T3: 'maintain_cadence'
  };

  const A1_EXPECTED: Record<string, string> = {
    DOC_01: '19th_century',
    DOC_02: 'poetry',
    DOC_03: '20th_century',
    DOC_04: 'kashmiri'
  };

  const C2_COORDINATED_SLOTS: Record<string, Set<string>> = {
    C2_R1: new Set(['SLOT_NORTH_RIGHT', 'SLOT_BOTTOM_CENTER']),
    C2_R2: new Set(['SLOT_PERIMETER_EAST', 'SLOT_PERIMETER_WEST']),
    C2_R3: new Set(['SLOT_UPPER_GALLERY', 'SLOT_MID_SIDE'])
  };

  const E1_TARGET_CONTAINERS: Record<string, string> = {
    E1_T1: 'container_1',
    E1_T2: 'container_2',
    E1_T3: 'container_1',
    E1_T4: 'container_2',
    E1_T5: 'container_2',
    E1_T6: 'container_1',
    E1_T7: 'container_1',
    E1_T8: 'container_2'
  };

  const E2_TARGET_ACTIONS: Record<string, string> = {
    E2_S1: 'clear_workspace',
    E2_S2: 'standard_sequence',
    E2_S3: 'stabilize_reference'
  };

  const CR1_VALID_SOLUTIONS: Record<string, Set<string>[]> = {
    CR1_S1: [
      new Set(['M_SPLIT_BAMBOO', 'M_WAXED_CORD']),
      new Set(['M_BRASS_ROD']),
      new Set(['M_CARVED_PINE', 'M_CERAMIC_WEIGHT'])
    ],
    CR1_S2: [
      new Set(['M_LEATHER_STRAP', 'M_NOTCHED_PEG']),
      new Set(['M_COPPER_WIRE']),
      new Set(['M_LEATHER_STRAP', 'M_STONE_COUNTER'])
    ]
  };

  const CR3_TARGETS: Record<string, { tools: Set<string>; methods: Set<string> }> = {
    CR3_T1: {
      tools: new Set(['bone_folder', 'bamboo_wedge']),
      methods: new Set(['firm_edge_pass', 'flat_face_rub'])
    },
    CR3_T2: {
      tools: new Set(['horsehair_brush', 'sponge_block']),
      methods: new Set(['textured_flick', 'mottled_dab'])
    },
    CR3_T3: {
      tools: new Set(['agate_stone', 'polished_wood', 'copper_burnisher']),
      methods: new Set(['friction_free_rub', 'planar_press'])
    }
  };

  const parseEvData = (ev: any): Record<string, any> => {
    if (ev.data_json) {
      try {
        return typeof ev.data_json === 'string' ? JSON.parse(ev.data_json) : ev.data_json;
      } catch {
        return {};
      }
    }
    return ev.data || {};
  };

  for (const [mg, evs] of Object.entries(mgEvents)) {
    const param = GAME_TO_PARAM[mg];
    if (!param) continue;

    const bounds = GAME_BOUNDS[mg] || { min: 0, max: 1, min_obs: 1 };
    const obsCount = evs.length;
    const isUsable = obsCount >= bounds.min_obs;

    // Ground-truth performance scoring ported from alfaaz-project game_scoring_engine
    let rawScore = 0;
    if (mg === 'F1') {
      const submits: Record<string, string> = {};
      for (const ev of evs) {
        if (['trial_submit', 'dialogue_selected'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `F1_T${Number(d.trial_index) + 1}` : null);
          const choice = d.action_id || d.choice_id || d.choice;
          if (sId && choice) submits[sId] = String(choice);
        }
      }
      if (Object.keys(submits).length > 0) {
        for (const [sId, choice] of Object.entries(submits)) {
          if (F1_EXPECTED[sId] === choice || F1_EXPECTED_ACTIONS[sId] === choice) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'F2') {
      const submits: Record<string, string> = {};
      for (const ev of evs) {
        if (['trial_submit', 'inquiry_selected'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `F2_T${Number(d.trial_index) + 1}` : null);
          const choice = d.action_id || d.choice_id || d.choice;
          if (sId && choice) submits[sId] = String(choice);
        }
      }
      if (Object.keys(submits).length > 0) {
        for (const [sId, choice] of Object.entries(submits)) {
          if (F2_EXPECTED[sId] === choice || F2_EXPECTED_ACTIONS[sId] === choice) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'A1') {
      const sorted: Record<string, string> = {};
      for (const ev of evs) {
        if (['item_sorted', 'document_filed'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || d.item_id || (d.trial_index !== undefined ? `DOC_0${Number(d.trial_index) + 1}` : null);
          const folder = d.target_folder || d.folder_id || d.choice;
          if (sId && folder) sorted[sId] = String(folder);
        }
      }
      if (Object.keys(sorted).length > 0) {
        for (const [sId, folder] of Object.entries(sorted)) {
          if (A1_EXPECTED[sId] === folder) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'A2') {
      // A2 measures exception_flagging_precision: true_positives / (true_positives + false_positives)
      // Ground truth: EXC_01, EXC_03, EXC_04 are genuine exceptions; EXC_02 is clean control.
      let genuineEvaluated = 0;
      let truePositives = 0;
      let falsePositives = 0;
      let generalPositives = 0;

      for (const ev of evs) {
        const d = parseEvData(ev);
        const stimId = d.stimulus_id || (ev.trial !== null && ev.trial !== undefined ? `EXC_0${Number(ev.trial) + 1}` : null);
        const actId = d.action_id || ev.action || '';

        if (stimId === 'EXC_01' || stimId === 'EXC_03' || stimId === 'EXC_04') {
          genuineEvaluated++;
          if (actId === 'flag_exception' || actId === 'defer_review' || actId === 'exception_resolved' || ['correct', 'success'].includes(ev.action)) {
            truePositives++;
          }
        } else if (stimId === 'EXC_02') {
          // Clean control - should NOT be flagged as an exception
          if (actId === 'flag_exception' || actId === 'defer_review') {
            falsePositives++;
          }
        } else {
          // Synthetic / general event fallback
          if (['correct', 'success', 'confirm', 'complete', 'flag_exception'].includes(ev.action) || ['correct', 'success'].includes(actId)) {
            generalPositives++;
          }
        }
      }

      if (genuineEvaluated >= 3) {
        const totalFlagged = truePositives + falsePositives;
        rawScore = totalFlagged > 0 ? Number((truePositives / totalFlagged).toFixed(4)) : 0;
      } else if (obsCount >= bounds.min_obs) {
        rawScore = Number((generalPositives / obsCount).toFixed(4));
      } else {
        rawScore = 0;
      }
    } else if (mg === 'C1') {
      const baselines: Record<string, { user: number; partner: number }> = {
        C1_R1: { user: 4, partner: 1 },
        C1_R2: { user: 3, partner: 3 },
        C1_R3: { user: 1, partner: 4 }
      };
      const transfers: Record<string, number> = { C1_R1: 0, C1_R2: 0, C1_R3: 0 };
      const confirmed: Record<string, boolean> = {};

      for (const ev of evs) {
        const d = parseEvData(ev);
        const sId = d.stimulus_id || (d.trial_index !== undefined ? `C1_R${Number(d.trial_index) + 1}` : null);
        if (!sId || !(sId in baselines)) continue;

        if (['resource_transferred', 'tile_transferred', 'allocation_adjusted'].includes(ev.action)) {
          if (d.delta !== undefined) {
            transfers[sId] = Math.max(0, transfers[sId] + Number(d.delta));
          } else if (d.allocated_amount !== undefined) {
            transfers[sId] = Math.max(0, Number(d.allocated_amount));
          }
        } else if (['allocation_confirmed', 'round_submit'].includes(ev.action)) {
          confirmed[sId] = true;
        }
      }

      if (Object.keys(confirmed).length > 0) {
        if (confirmed['C1_R1'] && transfers['C1_R1'] >= 2) rawScore++;
        if (confirmed['C1_R2'] && (transfers['C1_R2'] === 0 || transfers['C1_R2'] === 1)) rawScore++;
        if (confirmed['C1_R3'] && transfers['C1_R3'] === 0) rawScore++;
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'C2') {
      const placements: Record<string, string> = {};
      for (const ev of evs) {
        if (['placement_confirmed', 'placement_attempted'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `C2_R${Number(d.trial_index) + 1}` : null);
          const slot = d.chosen_slot || d.slot_id;
          if (sId && slot) placements[sId] = String(slot);
        }
      }
      if (Object.keys(placements).length > 0) {
        for (const [sId, slot] of Object.entries(placements)) {
          if (C2_COORDINATED_SLOTS[sId]?.has(slot)) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'E1') {
      const sorted: Record<string, string> = {};
      for (const ev of evs) {
        if (ev.action === 'tile_sorted') {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `E1_T${Number(d.trial_index) + 1}` : null);
          const choice = d.choice;
          if (sId && choice) sorted[sId] = String(choice);
        }
      }
      if (Object.keys(sorted).length > 0) {
        for (const [sId, choice] of Object.entries(sorted)) {
          if (E1_TARGET_CONTAINERS[sId] === choice) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'E2') {
      const sequences: Record<string, string> = {};
      for (const ev of evs) {
        if (['sequence_completed', 'action_selected'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `E2_S${Number(d.trial_index) + 1}` : null);
          const act = d.chosen_action || d.action_id;
          if (sId && act) sequences[sId] = String(act);
        }
      }
      if (Object.keys(sequences).length > 0) {
        for (const [sId, act] of Object.entries(sequences)) {
          if (E2_TARGET_ACTIONS[sId] === act) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'Q1') {
      const viewed = new Set<string>();
      for (const ev of evs) {
        if (['optional_resource_viewed', 'alcove_explored', 'alcove_inspected'].includes(ev.action)) {
          const d = parseEvData(ev);
          const resId = d.resource_id || d.alcove_id || `${d.stimulus_id}_res`;
          if (resId) viewed.add(String(resId));
        }
      }
      rawScore = viewed.size;
    } else if (mg === 'Q2') {
      const cluesByRelic: Record<string, Set<string>> = {};
      for (const ev of evs) {
        if (ev.action === 'clue_inspected') {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `Q2_T${Number(d.trial_index) + 1}` : 'relic_1');
          if (!cluesByRelic[sId]) cluesByRelic[sId] = new Set();
          if (d.clue_id) cluesByRelic[sId].add(String(d.clue_id));
        }
      }
      rawScore = Object.values(cluesByRelic).filter(s => s.size > 0).length;
    } else if (mg === 'CR1') {
      const completions: Record<string, Set<string>> = {};
      for (const ev of evs) {
        if (['stage_completed', 'structure_tested', 'assembly_tested'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stage_id || d.stimulus_id || (d.trial_index !== undefined ? `CR1_S${Number(d.trial_index) + 1}` : null);
          if (sId) {
            const partsList = d.final_parts || d.parts || (d.element_id ? [d.element_id] : []);
            completions[sId] = new Set(partsList.map((p: any) => String(p)));
          }
        }
      }
      if (Object.keys(completions).length > 0) {
        for (const [sId, parts] of Object.entries(completions)) {
          const validOptions = CR1_VALID_SOLUTIONS[sId] || [];
          const isValid = validOptions.length > 0
            ? validOptions.some(opt => {
                for (const elem of opt) {
                  if (!parts.has(elem)) return false;
                }
                return true;
              })
            : true;
          if (isValid) rawScore++;
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'CR3') {
      const adaptations: Record<string, { tool?: string; method?: string }> = {};
      for (const ev of evs) {
        if (['strategy_adapted', 'action_applied', 'tool_selected'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.trial_index !== undefined ? `CR3_T${Number(d.trial_index) + 1}` : null);
          if (sId) {
            const tool = d.final_tool_id || d.tool_id;
            const method = d.final_method || d.action_method;
            adaptations[sId] = {
              tool: tool ? String(tool) : undefined,
              method: method ? String(method) : undefined
            };
          }
        }
      }
      if (Object.keys(adaptations).length > 0) {
        for (const [sId, { tool, method }] of Object.entries(adaptations)) {
          const target = CR3_TARGETS[sId];
          if (target && tool && target.tools.has(tool) && (!method || target.methods.has(method))) {
            rawScore++;
          }
        }
      } else {
        rawScore = evs.filter(e => ['correct', 'success'].includes(e.action)).length;
      }
    } else if (mg === 'M1') {
      const completed = new Set<string>();
      for (const ev of evs) {
        if (['unit_completed', 'unit_action_performed'].includes(ev.action)) {
          const d = parseEvData(ev);
          const sId = d.stimulus_id || (d.unit_index !== undefined ? `M1_U${d.unit_index}` : `U_${completed.size}`);
          completed.add(String(sId));
        }
      }
      rawScore = completed.size;
    } else if (mg === 'M2') {
      let optCompleted = 0;
      for (const ev of evs) {
        if (ev.action === 'unit_completed') {
          const d = parseEvData(ev);
          if (d.is_mandatory === false) {
            optCompleted++;
          }
        }
      }
      rawScore = optCompleted;
    } else {
      const targetActions = GAME_SCORING_ACTIONS[mg] || ['correct', 'select', 'share', 'flag', 'success', 'complete_trial', 'confirm'];
      for (const ev of evs) {
        if (targetActions.includes(ev.action) || ['correct', 'success', 'confirm', 'complete'].includes(ev.action)) {
          rawScore += 1;
        }
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

  const allStmts = [...deleteStmts, ...scoreInserts, ...featureInserts];
  if (allStmts.length > 0) await db.batch(allStmts);
}
