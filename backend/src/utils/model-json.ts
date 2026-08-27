// backend/src/utils/model-json.ts
//
// Parseo del JSON que devuelve Claude. El modelo puede envolver la respuesta en
// fences, añadir preámbulo o —el caso que rompía auditorías— quedarse a medias
// porque la respuesta chocó con max_tokens.
//
// El recorte "primer { … último }" que se hacía antes convertía una respuesta
// truncada en un JSON corrupto y el error resultante ("Expected ',' or ']'
// after array element…") no decía nada del verdadero problema. Aquí se separan
// los tres casos: JSON limpio, JSON con ruido alrededor y JSON truncado.

/** Quita fences markdown, BOM y espacios sobrantes. */
export function stripJsonWrapping(raw: string): string {
  return raw
    .trim()
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .replace(/^﻿/, '')
    .trim();
}

/** Error de parseo que conserva el texto original del modelo para diagnóstico. */
export class ModelJsonError extends Error {
  constructor(
    message: string,
    readonly raw: string,
    readonly truncated: boolean,
  ) {
    super(message);
    this.name = 'ModelJsonError';
  }
}

/**
 * Cierra las comillas/corchetes/llaves que quedaron abiertos en una respuesta
 * truncada, descartando el último elemento incompleto. Devuelve null si no se
 * puede recuperar nada útil.
 */
export function repairTruncatedJson(text: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  // Último punto del texto donde la estructura estaba "sana": justo después de
  // cerrar un elemento completo dentro de un array/objeto. Solo valen los
  // cierres — cortar en una coma dejaría el último objeto a medio poblar y se
  // colarían criterios sin justificación como si el modelo los hubiera emitido.
  let safeEnd = -1;
  let safeDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') { stack.push(ch); continue; }
    if (ch === '}' || ch === ']') {
      stack.pop();
      // Un elemento acaba de cerrarse: cortar aquí deja una estructura válida.
      if (stack.length > 0) { safeEnd = i; safeDepth = stack.length; }
      continue;
    }
  }

  if (safeEnd < 0) return null;

  // Reconstruir los cierres pendientes en el punto sano.
  let repaired = text.slice(0, safeEnd + 1);
  for (let d = safeDepth - 1; d >= 0; d--) {
    repaired += stack[d] === '[' ? ']' : '}';
  }

  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

export interface ParseModelJsonOptions {
  /** stop_reason del mensaje de Claude: 'max_tokens' significa respuesta cortada. */
  stopReason?: string | null;
  /**
   * Si la respuesta viene truncada, intentar recuperar la parte completa en
   * lugar de fallar. Útil en lotes, donde no se puede reintentar la llamada.
   */
  salvageTruncated?: boolean;
  /** Etiqueta para los mensajes de error (p. ej. "evaluación"). */
  label?: string;
}

export interface ParseModelJsonResult<T = any> {
  data: T;
  /** true si el JSON se recuperó de una respuesta truncada (datos incompletos). */
  salvaged: boolean;
}

/**
 * Parsea la respuesta JSON del modelo. Lanza ModelJsonError con un mensaje que
 * distingue "el modelo se quedó sin tokens" de "el modelo devolvió basura".
 */
export function parseModelJson<T = any>(
  raw: string,
  options: ParseModelJsonOptions = {},
): ParseModelJsonResult<T> {
  const { stopReason, salvageTruncated = false, label = 'respuesta' } = options;
  const cleaned = stripJsonWrapping(raw ?? '');

  if (!cleaned) {
    throw new ModelJsonError(`La ${label} del modelo vino vacía`, raw ?? '', false);
  }

  // 1. El caso normal: el modelo respondió JSON puro.
  try {
    return { data: JSON.parse(cleaned) as T, salvaged: false };
  } catch { /* seguir */ }

  // 2. JSON con texto alrededor: recortar a los límites del objeto. Solo sirve
  //    cuando de verdad sobra texto; en una respuesta truncada esto produce un
  //    JSON corrupto, así que el resultado se valida antes de aceptarlo.
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first && (first > 0 || last < cleaned.length - 1)) {
    const sliced = cleaned.slice(first, last + 1);
    try {
      return { data: JSON.parse(sliced) as T, salvaged: false };
    } catch { /* seguir */ }
  }

  // 3. Respuesta cortada a medias.
  const truncated = stopReason === 'max_tokens' || !isBalanced(cleaned);

  if (truncated && salvageTruncated) {
    const repaired = repairTruncatedJson(cleaned);
    if (repaired) {
      return { data: JSON.parse(repaired) as T, salvaged: true };
    }
  }

  throw new ModelJsonError(
    truncated
      ? `La ${label} del modelo se cortó por límite de tokens (max_tokens); no es JSON completo`
      : `La ${label} del modelo no es JSON válido`,
    cleaned,
    truncated,
  );
}

/** Comprueba si los delimitadores del JSON quedaron balanceados. */
function isBalanced(text: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  return depth === 0 && !inString;
}
