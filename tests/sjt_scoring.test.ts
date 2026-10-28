import { describe, it, expect } from 'vitest';
import { getPublicSjtPayload, scoreSjtResponses, getConfigHash, SJT_CONFIG_HASH } from '../backend/src/services/sjt';

describe('SJT Scoring & Security Engine', () => {
  it('computes and returns stable config hash', () => {
    const hash = getConfigHash();
    expect(hash).toBe(SJT_CONFIG_HASH);
    expect(hash).toHaveLength(64);
  });

  describe('Public Payload Anti-Leak Protection', () => {
    it('returns exactly 7 scenarios in the payload', () => {
      const payload = getPublicSjtPayload();
      expect(payload.scenarios).toHaveLength(7);
      expect(payload.sjt_version).toBe('2026-09-rev');
      expect(payload.config_hash).toBe(SJT_CONFIG_HASH);
    });

    it('sanitizes scenarios to strictly prevent scoring key exposure to candidate', () => {
      const payload = getPublicSjtPayload();

      for (const scenario of payload.scenarios) {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('setup');
        expect(scenario).toHaveProperty('options');

        for (const option of scenario.options) {
          expect(option).toHaveProperty('id');
          expect(option).toHaveProperty('text');

          // CRITICAL: candidate-facing payload must never leak psychometric keys
          expect(option).not.toHaveProperty('keys');
          expect(option).not.toHaveProperty('weights');
          expect(option).not.toHaveProperty('construct');
          expect((option as any).empathy).toBeUndefined();
          expect((option as any).curiosity).toBeUndefined();
        }
      }
    });
  });

  describe('Exact Integer Thirds Scoring Model', () => {
    const CONSTRUCTS = [
      'empathy', 'conscientiousness', 'collaborative_spirit',
      'emotional_agility', 'curiosity', 'creative_initiative', 'motivation'
    ];

    it('scores responses across all 7 psychological constructs', () => {
      const sampleResponses = {
        S1: 'S1A',
        S2: 'S2B',
        S3: 'S3A',
        S4: 'S4C',
        S5: 'S5B',
        S6: 'S6A',
        S7: 'S7B'
      };

      const result = scoreSjtResponses(sampleResponses);

      for (const construct of CONSTRUCTS) {
        expect(result).toHaveProperty(construct);
        const score = result[construct];

        expect(typeof score.raw).toBe('number');
        expect(typeof score.min).toBe('number');
        expect(typeof score.max).toBe('number');
        expect(score.span).toBe(score.max - score.min);
        expect(score.num).toBe(score.raw - score.min);

        expect(['LOW', 'MODERATE', 'HIGH']).toContain(score.band);

        // Verify integer thirds exact math:
        // LOW: 3 * num < span
        // HIGH: 3 * num >= 2 * span
        // MODERATE: otherwise
        if (3 * score.num < score.span) {
          expect(score.band).toBe('LOW');
        } else if (3 * score.num >= 2 * score.span) {
          expect(score.band).toBe('HIGH');
        } else {
          expect(score.band).toBe('MODERATE');
        }
      }
    });

    it('throws error when required scenario responses are missing', () => {
      expect(() => scoreSjtResponses({})).toThrow(/Missing response for scenario S1/);
    });
  });
});
