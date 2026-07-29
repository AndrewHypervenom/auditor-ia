// frontend/src/lib/scoring.ts
//
// Espejo de backend/src/utils/scoring.ts — las dos copias deben moverse juntas.
// Reglas resumidas:
//   · Sin `scoreOptions`: escala numérica 0..maxScore. Rubro 'Crítico' en 0 → auditoría a 0%.
//   · Con `scoreOptions`: lista cerrada (p. ej. -100 / 0 / 5 / N/A).
//       - value null  → N/A: el rubro sale del numerador y del denominador.
//       - value < 0   → opción reprobatoria: la auditoría se va a 0%.
//       - el 0 deja de ser reprobatorio por sí solo.

export interface ScoreOption {
  value: number | null;
  label: string;
}

export interface DetailedScore {
  criterion: string;
  score: number;
  maxScore: number;
  observations?: string;
  criticality?: string;
  requiresManualReview?: boolean;
  notApplicable?: boolean;
  scoreOptions?: ScoreOption[] | null;
  [key: string]: unknown;
}

export const MIN_SCORE_OPTIONS = 2;
export const RECOMMENDED_SCORE_OPTIONS = 4;

/** Escala sugerida al activar opciones discretas por primera vez. */
export const DEFAULT_SCORE_OPTIONS: ScoreOption[] = [
  { value: -100, label: '-100' },
  { value: 0, label: '0' },
  { value: 5, label: '5' },
  { value: null, label: 'N/A' },
];

export function normalizeScoreOptions(raw: unknown): ScoreOption[] | null {
  if (!Array.isArray(raw)) return null;

  const seen = new Set<string>();
  const options: ScoreOption[] = [];

  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;

    const rawValue = candidate.value;
    let value: number | null;
    if (rawValue === null || rawValue === undefined) {
      value = null;
    } else if (typeof rawValue === 'number') {
      value = Number.isFinite(rawValue) ? rawValue : null;
    } else {
      const text = String(rawValue).trim();
      if (text === '' || text.toLowerCase() === 'n/a' || text.toLowerCase() === 'na') {
        value = null;
      } else {
        const parsed = Number(text);
        if (!Number.isFinite(parsed)) continue;
        value = parsed;
      }
    }

    const label = typeof candidate.label === 'string' && candidate.label.trim()
      ? candidate.label.trim()
      : (value === null ? 'N/A' : String(value));

    const key = value === null ? 'n/a' : String(value);
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({ value, label });
  }

  return options.length >= MIN_SCORE_OPTIONS ? options : null;
}

export function hasScoreOptions(options: unknown): options is ScoreOption[] {
  return normalizeScoreOptions(options) !== null;
}

export function allowsNotApplicable(options: ScoreOption[] | null | undefined): boolean {
  return Array.isArray(options) && options.some(o => o.value === null);
}

export function maxOptionValue(options: ScoreOption[] | null | undefined): number {
  if (!Array.isArray(options) || options.length === 0) return 0;
  return options.reduce((max, o) => (o.value !== null && o.value > max ? o.value : max), 0);
}

export function isNotApplicable(item: DetailedScore): boolean {
  return item.notApplicable === true;
}

export function isManualItem(item: DetailedScore): boolean {
  return item.requiresManualReview === true ||
    ((item.score ?? 0) === 0 &&
      typeof item.observations === 'string' &&
      item.observations.includes('Requiere validación manual'));
}

export function isCriticalFailure(item: DetailedScore): boolean {
  if (isNotApplicable(item)) return false;
  if (isManualItem(item)) return false;
  if (typeof item.observations === 'string' &&
      item.observations.startsWith('No evaluado por el modelo')) return false;

  const score = item.score ?? 0;

  if (hasScoreOptions(item.scoreOptions)) return score < 0;

  return item.criticality === 'Crítico' && (item.maxScore ?? 0) > 0 && score === 0;
}

export interface ScoreTotals {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  rawPercentage: number;
  criticalFailure: boolean;
  failedCriticalCriteria: string[];
}

export function computeScoreTotals(detailedScores: DetailedScore[]): ScoreTotals {
  const counted = (detailedScores ?? []).filter(s => !isNotApplicable(s));

  const totalScore = counted.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const maxPossibleScore = counted.reduce((sum, s) => sum + (s.maxScore ?? 0), 0);

  const failedCriticalCriteria = counted.filter(isCriticalFailure).map(s => s.criterion);
  const criticalFailure = failedCriticalCriteria.length > 0;

  const rawPercentage = maxPossibleScore > 0
    ? Math.max(0, (totalScore / maxPossibleScore) * 100)
    : 0;

  return {
    totalScore,
    maxPossibleScore,
    percentage: criticalFailure ? 0 : rawPercentage,
    rawPercentage,
    criticalFailure,
    failedCriticalCriteria,
  };
}
