//backend/src/config/evaluation-criteria.ts

import type { ScoreOption } from '../utils/scoring.js';

export interface EvaluationTopic {
  topic: string;
  criticality: 'Crítico' | '-';
  points: number | 'n/a';
  applies: boolean;
  whatToLookFor?: string;
  validationSource?: string[];
  requiresManualReview?: boolean;
  /** Escala discreta de calificación (-100 / 0 / 5 / N/A). null = escala numérica 0..points. */
  scoreOptions?: ScoreOption[] | null;
}

export interface EvaluationBlock {
  blockName: string;
  topics: EvaluationTopic[];
}
