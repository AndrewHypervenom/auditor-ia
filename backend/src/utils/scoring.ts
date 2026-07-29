//backend/src/utils/scoring.ts

/**
 * Reglas de calificación por rubro.
 *
 * Un criterio puede calificarse de dos formas:
 *
 *  1. ESCALA NUMÉRICA (comportamiento histórico, `score_options` vacío/null)
 *     El analista asigna un valor entre 0 y `points`. Un rubro marcado como
 *     'Crítico' que recibe 0 dispara falla crítica → la auditoría se va a 0%.
 *
 *  2. OPCIONES DISCRETAS (`score_options` con al menos 2 entradas)
 *     El analista elige de una lista cerrada, p. ej. -100 / 0 / 5 / N/A.
 *     - `value: null` representa N/A: el rubro sale del numerador Y del
 *       denominador (no penaliza ni suma).
 *     - Un valor NEGATIVO representa la opción reprobatoria: dispara falla
 *       crítica → la auditoría se va a 0%, sin importar la criticidad.
 *     - Con opciones activas, el 0 deja de ser reprobatorio por sí solo: es
 *       una opción legítima de la escala del cliente.
 */

export interface ScoreOption {
  /** Puntos que otorga la opción. `null` = N/A (excluye el rubro del cálculo). */
  value: number | null;
  /** Etiqueta que ve el analista ("-100", "0", "5", "N/A"). */
  label: string;
}

/** Un renglón de `evaluations.detailed_scores`. */
export interface DetailedScore {
  criterion: string;
  score: number;
  maxScore: number;
  observations: string;
  criticality?: string;
  requiresManualReview?: boolean;
  /** El analista (o la IA) marcó el rubro como no aplicable. */
  notApplicable?: boolean;
  /** Escala discreta vigente para el rubro, si la tiene. */
  scoreOptions?: ScoreOption[] | null;
  [key: string]: unknown;
}

/** Mínimo de opciones para considerar la escala discreta como configurada. */
export const MIN_SCORE_OPTIONS = 2;

/** Mínimo de opciones recomendado por el cliente (VCAS: -100 / 0 / 5 / N/A). */
export const RECOMMENDED_SCORE_OPTIONS = 4;

/**
 * Valida y normaliza lo que venga de la BD o del request.
 * Devuelve `null` si no hay una escala discreta utilizable — nunca lanza.
 */
export function normalizeScoreOptions(raw: unknown): ScoreOption[] | null {
  if (!Array.isArray(raw)) return null;

  const seen = new Set<string>();
  const options: ScoreOption[] = [];

  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;

    // `value` ausente, null o 'n/a' → N/A
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

    // Una sola opción por valor: evita escalas con dos "0" o dos "N/A"
    const key = value === null ? 'n/a' : String(value);
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({ value, label });
  }

  return options.length >= MIN_SCORE_OPTIONS ? options : null;
}

/** `true` si el rubro se califica con una lista cerrada de opciones. */
export function hasScoreOptions(options: unknown): options is ScoreOption[] {
  return normalizeScoreOptions(options) !== null;
}

/** Opción N/A disponible en la escala. */
export function allowsNotApplicable(options: ScoreOption[] | null | undefined): boolean {
  return Array.isArray(options) && options.some(o => o.value === null);
}

/** Puntos máximos alcanzables de una escala discreta (0 si todas son ≤ 0). */
export function maxOptionValue(options: ScoreOption[] | null | undefined): number {
  if (!Array.isArray(options) || options.length === 0) return 0;
  return options.reduce((max, o) => (o.value !== null && o.value > max ? o.value : max), 0);
}

/**
 * Puntos máximos (denominador) del rubro.
 * `points` de la BD manda; si es null y hay escala discreta, se deriva de ella.
 */
export function resolveMaxScore(
  points: number | 'n/a' | null | undefined,
  options?: ScoreOption[] | null,
): number {
  if (points !== null && points !== undefined && points !== 'n/a') return points;
  return maxOptionValue(options ?? null);
}

/**
 * Ajusta un puntaje libre (típicamente el que devuelve el modelo) a la opción
 * más cercana de la escala. Ignora N/A: la IA no marca rubros como no aplicables.
 */
export function snapToNearestOption(score: number, options: ScoreOption[]): number {
  const numeric = options.filter(o => o.value !== null).map(o => o.value as number);
  if (numeric.length === 0) return score;
  return numeric.reduce((best, value) =>
    Math.abs(value - score) < Math.abs(best - score) ? value : best
  , numeric[0]);
}

/** `true` si el rubro quedó marcado como N/A y no debe entrar al cálculo. */
export function isNotApplicable(item: DetailedScore): boolean {
  return item.notApplicable === true;
}

/** `true` si el rubro es de validación manual (la IA no lo califica). */
export function isManualItem(item: DetailedScore): boolean {
  return item.requiresManualReview === true ||
    ((item.score ?? 0) === 0 &&
      typeof item.observations === 'string' &&
      item.observations.includes('Requiere validación manual'));
}

/**
 * `true` si el rubro dispara falla crítica (auditoría a 0%).
 *
 * Con escala discreta: cualquier valor negativo.
 * Sin escala discreta: rubro 'Crítico' calificado en 0 (regla histórica).
 * Los rubros N/A, los de validación manual y los que el modelo no evaluó
 * nunca disparan falla.
 */
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
  /** Porcentaje ya con la regla de falla crítica aplicada. */
  percentage: number;
  /** Porcentaje sin aplicar la falla crítica (útil para mostrar el "hubiera sido"). */
  rawPercentage: number;
  criticalFailure: boolean;
  failedCriticalCriteria: string[];
}

/**
 * Única fuente de verdad para los totales de una auditoría.
 * Los rubros N/A quedan fuera del numerador y del denominador.
 */
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
