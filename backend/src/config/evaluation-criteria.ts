//backend/src/config/evaluation-criteria.ts

export interface EvaluationTopic {
  topic: string;
  criticality: 'Crítico' | '-';
  points: number | 'n/a';
  applies: boolean;
  whatToLookFor?: string;
}

export interface EvaluationBlock {
  blockName: string;
  topics: EvaluationTopic[];
}
