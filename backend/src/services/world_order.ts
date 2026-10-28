export const LATIN_SQUARE_14: string[][] = [
  ["W1", "W2", "W7", "W3", "W6", "W4", "W5"],
  ["W2", "W3", "W1", "W4", "W7", "W5", "W6"],
  ["W3", "W4", "W2", "W5", "W1", "W6", "W7"],
  ["W4", "W5", "W3", "W6", "W2", "W7", "W1"],
  ["W5", "W6", "W4", "W7", "W3", "W1", "W2"],
  ["W6", "W7", "W5", "W1", "W4", "W2", "W3"],
  ["W7", "W1", "W6", "W2", "W5", "W3", "W4"],
  ["W5", "W4", "W6", "W3", "W7", "W2", "W1"],
  ["W6", "W5", "W7", "W4", "W1", "W3", "W2"],
  ["W7", "W6", "W1", "W5", "W2", "W4", "W3"],
  ["W1", "W7", "W2", "W6", "W3", "W5", "W4"],
  ["W2", "W1", "W3", "W7", "W4", "W6", "W5"],
  ["W3", "W2", "W4", "W1", "W5", "W7", "W6"],
  ["W4", "W3", "W5", "W2", "W6", "W1", "W7"]
];

export const ALL_MINIGAMES = [
  "F1", "F2", "F3", "A1", "A2", "A3", "C1", "C2", "C3",
  "E1", "E2", "E3", "Q1", "Q2", "Q3", "CR1", "CR2", "CR3", "M1", "M2", "M3"
];

const STIMULUS_HMAC_KEY = "alfaaz-recruit-stimulus-seed-key-2026";

export async function generateMinigameSeeds(sessionId: string): Promise<Record<string, number>> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(STIMULUS_HMAC_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const seeds: Record<string, number> = {};
  for (const mg of ALL_MINIGAMES) {
    const msg = enc.encode(`${sessionId}:${mg}`);
    const sig = await crypto.subtle.sign("HMAC", key, msg);
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    const seedInt = parseInt(hex.substring(0, 8), 16);
    seeds[mg] = seedInt;
  }
  return seeds;
}

export async function assignWorldOrder(
  db: D1Database,
  sessionId: string
): Promise<{ orderId: number; sequence: string[]; seeds: Record<string, number> }> {
  const rows = await db
    .prepare("SELECT world_order_id, COUNT(*) as cnt FROM task_assignments GROUP BY world_order_id")
    .all<{ world_order_id: number; cnt: number }>();

  const counts: Record<number, number> = {};
  for (let i = 0; i < LATIN_SQUARE_14.length; i++) counts[i] = 0;
  for (const r of rows.results || []) {
    if (counts[r.world_order_id] !== undefined) {
      counts[r.world_order_id] = r.cnt;
    }
  }

  const minCount = Math.min(...Object.values(counts));
  const leastUsed = Object.keys(counts)
    .map(Number)
    .filter(id => counts[id] === minCount);

  const chosenOrderId = leastUsed[Math.floor(Math.random() * leastUsed.length)];
  const sequence = [...LATIN_SQUARE_14[chosenOrderId]];
  const seeds = await generateMinigameSeeds(sessionId);

  return {
    orderId: chosenOrderId,
    sequence,
    seeds
  };
}
