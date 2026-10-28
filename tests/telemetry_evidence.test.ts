import { describe, it, expect, vi } from 'vitest';
import { generateMinigameSeeds, LATIN_SQUARE_14 } from '../backend/src/services/world_order';
import { ingestTelemetryBatch } from '../backend/src/services/telemetry';

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

  describe('Evidence Synthesis Logic (Cross-Method Delta)', () => {
    const BAND_MAP: Record<string, number> = { 'LOW': 0, 'MODERATE': 1, 'HIGH': 2 };

    function computeRelationshipAndConfidence(sjtBand: string, gameBand: string) {
      const sVal = BAND_MAP[sjtBand] ?? 1;
      const gVal = BAND_MAP[gameBand] ?? 1;
      const delta = Math.abs(sVal - gVal);

      let relationship = 'CONCORDANT';
      let confidence = 'HIGH';

      if (delta === 0) {
        relationship = 'CONCORDANT';
        confidence = 'HIGH';
      } else if (delta === 1) {
        relationship = 'SHIFT_ADJACENT';
        confidence = 'MODERATE';
      } else {
        relationship = 'DIVERGENT';
        confidence = 'LOW';
      }

      return { delta, relationship, confidence };
    }

    it('assigns CONCORDANT and HIGH confidence when bands match', () => {
      const { delta, relationship, confidence } = computeRelationshipAndConfidence('HIGH', 'HIGH');
      expect(delta).toBe(0);
      expect(relationship).toBe('CONCORDANT');
      expect(confidence).toBe('HIGH');
    });

    it('assigns SHIFT_ADJACENT and MODERATE confidence when bands differ by 1 step', () => {
      const { delta, relationship, confidence } = computeRelationshipAndConfidence('HIGH', 'MODERATE');
      expect(delta).toBe(1);
      expect(relationship).toBe('SHIFT_ADJACENT');
      expect(confidence).toBe('MODERATE');
    });

    it('assigns DIVERGENT and LOW confidence when bands differ by 2 steps', () => {
      const { delta, relationship, confidence } = computeRelationshipAndConfidence('HIGH', 'LOW');
      expect(delta).toBe(2);
      expect(relationship).toBe('DIVERGENT');
      expect(confidence).toBe('LOW');
    });
  });
});
