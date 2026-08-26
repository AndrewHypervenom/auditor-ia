// frontend/src/utils/tipoCierre.ts
//
// Espejo de backend/src/utils/matching.ts para las llaves de subcalificación
// (tipo de cierre). La vista debe resolver un override con la misma regla que
// usa el evaluador: si no, la pestaña dice "sin configuración específica"
// mientras la IA sí está aplicando un override guardado con otra grafía.

export function normSubcalificacion(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Busca el override de un tipo de cierre tolerando mayúsculas, acentos y espacios. */
export function pickTipoCierreOverride<T>(
  overrides: Record<string, T> | null | undefined,
  subCalificacion?: string | null,
): T | undefined {
  if (!overrides || !subCalificacion) return undefined;
  if (Object.prototype.hasOwnProperty.call(overrides, subCalificacion)) {
    return overrides[subCalificacion];
  }
  const target = normSubcalificacion(subCalificacion);
  if (!target) return undefined;
  for (const [key, value] of Object.entries(overrides)) {
    if (normSubcalificacion(key) === target) return value;
  }
  return undefined;
}

/**
 * Escribe un override colapsando cualquier llave existente que apunte al mismo
 * tipo de cierre, para no dejar dos overrides (p. ej. "INTERNET" e "Internet")
 * donde el lookup resolvería el viejo.
 */
export function setTipoCierreOverride<T>(
  overrides: Record<string, T> | null | undefined,
  subCalificacion: string,
  value: T,
): Record<string, T> {
  const target = normSubcalificacion(subCalificacion);
  const result: Record<string, T> = {};
  for (const [key, v] of Object.entries(overrides || {})) {
    if (normSubcalificacion(key) !== target) result[key] = v;
  }
  result[subCalificacion] = value;
  return result;
}

/** Elimina el override de un tipo de cierre en todas sus grafías. */
export function removeTipoCierreOverride<T>(
  overrides: Record<string, T> | null | undefined,
  subCalificacion: string,
): Record<string, T> {
  const target = normSubcalificacion(subCalificacion);
  const result: Record<string, T> = {};
  for (const [key, v] of Object.entries(overrides || {})) {
    if (normSubcalificacion(key) !== target) result[key] = v;
  }
  return result;
}
