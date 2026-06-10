// backend/src/utils/sentiment.ts
// Construye el resumen agregado de sentimientos de una llamada

import type { SentimentResult, SentimentSummary } from '../types/index.js';

const dominant = (pos: number, neu: number, neg: number): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' => {
  // El sentimiento negativo pesa más en contexto de quejas/fraude:
  // si hay empate o predominio negativo, se reporta NEGATIVE.
  if (neg > pos && neg >= neu * 0.5) return 'NEGATIVE';
  if (pos > neg && pos >= neu * 0.5) return 'POSITIVE';
  return 'NEUTRAL';
};

export function buildSentimentSummary(
  results: SentimentResult[],
  provider: 'assemblyai' | 'openai'
): SentimentSummary | null {
  if (!results || results.length === 0) return null;

  const counts = { positive: 0, neutral: 0, negative: 0 };
  const bySpeakerCounts: Record<string, { positive: number; neutral: number; negative: number }> = {};

  for (const r of results) {
    const key = r.sentiment === 'POSITIVE' ? 'positive' : r.sentiment === 'NEGATIVE' ? 'negative' : 'neutral';
    counts[key]++;

    const speaker = r.speaker ?? '?';
    if (!bySpeakerCounts[speaker]) {
      bySpeakerCounts[speaker] = { positive: 0, neutral: 0, negative: 0 };
    }
    bySpeakerCounts[speaker][key]++;
  }

  const bySpeaker: SentimentSummary['bySpeaker'] = {};
  for (const [speaker, c] of Object.entries(bySpeakerCounts)) {
    bySpeaker[speaker] = { ...c, overall: dominant(c.positive, c.neutral, c.negative) };
  }

  return {
    ...counts,
    total: results.length,
    overall: dominant(counts.positive, counts.neutral, counts.negative),
    bySpeaker,
    provider
  };
}
