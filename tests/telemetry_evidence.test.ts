import { describe, it, expect, vi } from 'vitest';
import { generateMinigameSeeds, LATIN_SQUARE_14 } from '../backend/src/services/world_order';
import { ingestTelemetryBatch } from '../backend/src/services/telemetry';
import { computeCrossMethodDelta, determineRelationship, determineConfidence } from '../backend/src/services/evidence';

describe('Telemetry & Evidence Engine', () => {
  describe('Latin Square & Deterministic HMAC Seeds', () => {
    it('defines 14 balanced rows with 7 worlds each', () => {
      expect(LATIN_SQUARE_14).toHaveLength(14);
      for (const row of LATIN_SQUARE_14) {
        expect(row).toHaveLength(7);
        // Each row contains 7 distinct worlds
        const uniqueWorlds = new Set(row);
        expect(uniqueWorlds.size).toBe(7);
      }
    });

    it('generates deterministic seeds for a given session ID', async () => {
      const sessionId = 'test-session-12345';
      const seeds1 = await generateMinigameSeeds(sessionId);
      const seeds2 = await generateMinigameSeeds(sessionId);

      expect(seeds1).toEqual(seeds2);
      expect(typeof seeds1['F1']).toBe('number');
      expect(typeof seeds1['M3']).toBe('number');
    });

    it('generates distinct seeds for different session IDs', async () => {
      const seedsA = await generateMinigameSeeds('session-A');
      const seedsB = await generateMinigameSeeds('session-B');

      expect(seedsA['F1']).not.toBe(seedsB['F1']);
    });
  });

  describe('Telemetry Batch Ingestion & Quotas', () => {
    function createMockDb(currentCount = 0) {
      return {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...params: any[]) => ({
            first: vi.fn(async () => {
              if (sql.includes('recruit_sessions')) {
                return { status: 'CONSENTED' };
              }
              return { cnt: currentCount };
            }),
            run: vi.fn(async () => ({ success: true })),
            all: vi.fn(async () => ({ results: [] }))
          }))
        })),
        batch: vi.fn(async (stmts: any[]) => stmts.map(() => ({ success: true })))
      } as unknown as D1Database;
    }

    it('rejects batches with more than 100 events', async () => {
      const mockDb = createMockDb(0);
      const oversizedEvents = Array.from({ length: 101 }, (_, i) => ({
        seq: i + 1,
        action: 'click',
        t_ms: i * 10
      }));

      await expect(
        ingestTelemetryBatch(mockDb, 'test-session', oversizedEvents)
      ).rejects.toThrow(/Batch size limit exceeded/);
    });

    it('rejects ingestion if session has reached the 50,000 hard cap', async () => {
      const mockDb = createMockDb(50000);
      const events = [{ seq: 1, action: 'tap', t_ms: 100 }];

      await expect(
        ingestTelemetryBatch(mockDb, 'test-session', events)
      ).rejects.toThrow(/Session event limit of 50,000 reached/);
    });

    it('successfully ingests valid batches within limits', async () => {
      const mockDb = createMockDb(10);
      const events = [
        { seq: 11, mini_game: 'F1', action: 'focus_start', t_ms: 100 },
        { seq: 12, mini_game: 'F1', action: 'tap', t_ms: 250 }
      ];

      const res = await ingestTelemetryBatch(mockDb, 'test-session', events);
      expect(res.ingested_count).toBe(2);
      expect(res.total_session_events).toBe(12);
    });
  });

  describe('Evidence Synthesis Logic (Cross-Method Delta & Confidence)', () => {
    it('computes cross-method delta correctly and returns null on missing values', () => {
      expect(computeCrossMethodDelta(0.85, 0.70)).toBe(0.15);
      expect(computeCrossMethodDelta(0.50, 0.50)).toBe(0.0);
      expect(computeCrossMethodDelta(null, 0.75)).toBeNull();
      expect(computeCrossMethodDelta(0.75, null)).toBeNull();
      expect(computeCrossMethodDelta(null, null)).toBeNull();
    });

    it('evaluates construct relationship categories according to psychometric delta thresholds', () => {
      expect(determineRelationship(0.10, true, 'USABLE')).toBe('ALIGNED');
      expect(determineRelationship(0.15, true, 'USABLE')).toBe('ALIGNED');
      expect(determineRelationship(0.25, true, 'USABLE')).toBe('PARTLY_ALIGNED');
      expect(determineRelationship(0.30, true, 'USABLE')).toBe('PARTLY_ALIGNED');
      expect(determineRelationship(0.35, true, 'USABLE')).toBe('DIFFERENT');
      expect(determineRelationship(0.10, false, 'USABLE')).toBe('NOT_AVAILABLE');
      expect(determineRelationship(0.10, true, 'INSUFFICIENT')).toBe('NOT_ENOUGH_EVIDENCE');
      expect(determineRelationship(null, true, 'USABLE')).toBe('NOT_AVAILABLE');
    });

    it('enforces confidence gates based on critical quality flags, usable game count and consistency', () => {
      // Critical quality flag forces LIMITED confidence immediately
      expect(determineConfidence(true, 3, 'CONSISTENT', 0.10, true)).toBe('LIMITED');

      // Fewer than 2 usable games forces LIMITED
      expect(determineConfidence(true, 1, 'CONSISTENT', 0.10, false)).toBe('LIMITED');

      // Missing SJT forces LIMITED
      expect(determineConfidence(false, 3, 'CONSISTENT', 0.10, false)).toBe('LIMITED');

      // 3 usable games + CONSISTENT + low delta (<= 0.15) yields SUBSTANTIAL
      expect(determineConfidence(true, 3, 'CONSISTENT', 0.10, false)).toBe('SUBSTANTIAL');

      // 3 usable games + CONSISTENT + moderate delta (0.15 < delta <= 0.30) yields MODERATE
      expect(determineConfidence(true, 3, 'CONSISTENT', 0.25, false)).toBe('MODERATE');

      // 2 usable games + low delta yields MODERATE (needs >= 3 usable for SUBSTANTIAL)
      expect(determineConfidence(true, 2, 'CONSISTENT', 0.10, false)).toBe('MODERATE');

      // High delta (> 0.30) forces LIMITED
      expect(determineConfidence(true, 3, 'CONSISTENT', 0.35, false)).toBe('LIMITED');
    });
  });
});
