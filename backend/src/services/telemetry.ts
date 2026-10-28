export class TelemetryCapReachedException extends Error {
  constructor(message: string = "events_cap_reached") {
    super(message);
    this.name = "TelemetryCapReachedException";
  }
}

export async function ingestTelemetryBatch(
  db: D1Database,
  sessionId: string,
  events: any[]
): Promise<{ ingested_count: number; ignored_duplicates: number; total_session_events: number }> {
  const session = await db
    .prepare("SELECT status FROM recruit_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<{ status: string }>();

  if (!session) {
    throw new Error(`Unknown session_id: ${sessionId}`);
  }

  // Filter out continuous mouse/pointer drag events
  const filteredEvents = (events || []).filter(ev => {
    const action = ev.action || 'unknown';
    return !['mousemove', 'pointermove', 'touchmove', 'continuous_drag'].includes(action);
  });

  if (filteredEvents.length === 0) {
    const total = await db
      .prepare("SELECT COUNT(*) as cnt FROM telemetry_events WHERE session_id = ?")
      .bind(sessionId)
      .first<{ cnt: number }>();
    return { ingested_count: 0, ignored_duplicates: 0, total_session_events: total?.cnt || 0 };
  }

  if (filteredEvents.length > 100) {
    throw new Error("Batch size limit exceeded (maximum 100 discrete events)");
  }

  // Get current event count
  const countRow = await db
    .prepare("SELECT COUNT(*) as cnt FROM telemetry_events WHERE session_id = ?")
    .bind(sessionId)
    .first<{ cnt: number }>();
  const currentCount = countRow?.cnt || 0;

  if (currentCount + filteredEvents.length > 50000) {
    await db
      .prepare("INSERT INTO data_quality_flags (session_id, scope, flag, detail) VALUES (?, 'session', 'events_cap_reached', 'Exceeded 50,000 events')")
      .bind(sessionId)
      .run();
    throw new TelemetryCapReachedException("Session event limit of 50,000 reached");
  }

  // Fetch existing seqs
  const existingSeqs = new Set<number>();
  const seqRows = await db
    .prepare("SELECT seq FROM telemetry_events WHERE session_id = ?")
    .bind(sessionId)
    .all<{ seq: number }>();
  for (const r of seqRows.results || []) {
    existingSeqs.add(r.seq);
  }

  let ingested = 0;
  let duplicates = 0;

  const stmts: D1PreparedStatement[] = [];

  for (const ev of filteredEvents) {
    const seq = Number(ev.seq);
    if (isNaN(seq)) continue;

    if (existingSeqs.has(seq)) {
      duplicates++;
      continue;
    }

    const stateJson = ev.state ? JSON.stringify(ev.state) : (ev.state_json || null);
    const dataJson = ev.data ? JSON.stringify(ev.data) : (ev.data_json || null);

    const size = (stateJson?.length || 0) + (dataJson?.length || 0);
    if (size > 4096) {
      stmts.push(
        db.prepare("INSERT INTO data_quality_flags (session_id, scope, flag, detail) VALUES (?, ?, 'event_oversize', ?)")
          .bind(sessionId, `seq_${seq}`, `Event size ${size} bytes exceeds 4KB`)
      );
    }

    stmts.push(
      db.prepare(`
        INSERT INTO telemetry_events (
          session_id, seq, segment_id, t_ms, screen, game_world, mini_game, trial, action, input_type, task_def_version, state_json, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sessionId,
        seq,
        ev.segment_id || 1,
        ev.t_ms || 0,
        ev.screen || 'games',
        ev.world || ev.game_world || null,
        ev.game || ev.mini_game || null,
        ev.trial ?? null,
        ev.action || 'event',
        ev.input_type || null,
        ev.task_def_version || '2.0',
        stateJson,
        dataJson
      )
    );
    ingested++;
  }

  if (stmts.length > 0) {
    await db.batch(stmts);
  }

  return {
    ingested_count: ingested,
    ignored_duplicates: duplicates,
    total_session_events: currentCount + ingested
  };
}
