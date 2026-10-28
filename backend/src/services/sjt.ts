import parametersData from '../config/parameters.json';
import sjtData from '../config/sjt_items.json';

export interface SjtScenario {
  id: string;
  act: number;
  act_title: { en: string; ur: string } | string;
  setup: string;
  options: Array<{
    id: string;
    text: string;
    keys: Record<string, number>;
  }>;
}

export interface ParameterRange {
  min: number;
  max: number;
  span: number;
}

export interface SjtScoreResult {
  raw: number;
  min: number;
  max: number;
  span: number;
  num: number;
  sjt_relative: number;
  band: 'HIGH' | 'MODERATE' | 'LOW' | 'UNAVAILABLE';
}

const params = Object.keys(parametersData);
const ranges: Record<string, ParameterRange> = {};

// Precompute min, max, span
for (const p of params) {
  let min = 0;
  let max = 0;
  for (const s of (sjtData as any).scenarios) {
    const vals = s.options.map((opt: any) => opt.keys[p] as number);
    min += Math.min(...vals);
    max += Math.max(...vals);
  }
  ranges[p] = { min, max, span: max - min };
}

export const SJT_CONFIG_HASH = "f9026b9c50ad4a7c65b3108b2b3321b8c4daece85a1402274d9f342374cf0397";

export function getConfigHash(): string {
  return SJT_CONFIG_HASH;
}

export function getPublicSjtPayload() {
  const publicScenarios = (sjtData as any).scenarios.map((s: any) => ({
    id: s.id,
    act: s.act || 1,
    act_title_en: typeof s.act_title === 'object' ? s.act_title.en : String(s.act_title || ''),
    act_title_ur: typeof s.act_title === 'object' ? s.act_title.ur : '',
    setup: s.setup,
    options: s.options.map((opt: any) => ({
      id: opt.id,
      text: opt.text
    }))
  }));

  return {
    sjt_version: (sjtData as any).sjt_version || '2026-09-rev',
    config_hash: SJT_CONFIG_HASH,
    scenarios: publicScenarios
  };
}

export function scoreSjtResponses(responses: Record<string, string>): Record<string, SjtScoreResult> {
  const scenarios: SjtScenario[] = (sjtData as any).scenarios;
  const optionKeyMap = new Map<string, Record<string, number>>();

  for (const s of scenarios) {
    for (const opt of s.options) {
      optionKeyMap.set(`${s.id}:${opt.id}`, opt.keys);
    }
  }

  const rawScores: Record<string, number> = {};
  for (const p of params) rawScores[p] = 0;

  for (const s of scenarios) {
    const optId = responses[s.id];
    if (!optId) {
      throw new Error(`Missing response for scenario ${s.id}`);
    }
    const key = `${s.id}:${optId}`;
    const keys = optionKeyMap.get(key);
    if (!keys) {
      throw new Error(`Invalid option ${optId} for scenario ${s.id}`);
    }
    for (const p of params) {
      rawScores[p] += keys[p] || 0;
    }
  }

  const results: Record<string, SjtScoreResult> = {};
  for (const p of params) {
    const raw = rawScores[p];
    const { min, max, span } = ranges[p];
    const num = raw - min;
    const sjt_relative = span > 0 ? Number((num / span).toFixed(6)) : 0;

    let band: 'HIGH' | 'MODERATE' | 'LOW' | 'UNAVAILABLE';
    if (span === 0) {
      band = 'UNAVAILABLE';
    } else if (3 * num >= 2 * span) {
      band = 'HIGH';
    } else if (3 * num >= span) {
      band = 'MODERATE';
    } else {
      band = 'LOW';
    }

    results[p] = {
      raw,
      min,
      max,
      span,
      num,
      sjt_relative,
      band
    };
  }

  return results;
}
