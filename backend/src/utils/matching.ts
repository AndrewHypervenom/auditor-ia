// backend/src/utils/matching.ts
//
// Normalización compartida para emparejar nombres que viajan entre GPF, la BD y
// el modelo. Antes cada punto del flujo aplicaba su propia regla (match exacto
// en los overrides de criterios, toUpperCase en los de scripts, normalización
// con acentos en el filtro de bloques), y eso hacía que una diferencia de
// mayúsculas o un acento descartara en silencio la configuración del analista.
// Toda comparación de subcalificaciones y de nombres de criterio debe pasar por
// aquí.

/** Quita marcas diacríticas (á → a) sin tocar el resto del texto. */
export function stripDiacritics(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Llave canónica de una subcalificación / tipo de cierre.
 * GPF entrega MAYÚSCULAS ("INTERNET"), la plantilla histórica guarda Title Case
 * ("Internet") y el analista pudo configurar cualquiera de las dos: todas deben
 * resolver a la misma llave.
 */
export function normSubcalificacion(s: string): string {
  return stripDiacritics(s).toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Busca el override de un tipo de cierre tolerando mayúsculas, acentos y
 * espacios. Devuelve `undefined` si no hay override aplicable.
 */
export function pickTipoCierreOverride<T>(
  overrides: Record<string, T> | null | undefined,
  subCalificacion?: string | null,
): T | undefined {
  if (!overrides || !subCalificacion) return undefined;
  // Coincidencia exacta primero: es la más barata y la más común.
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
 * Colapsa las llaves de un mapa de overrides que apuntan a la misma
 * subcalificación (p. ej. "INTERNET" y "Internet"), conservando la última
 * escrita. Sin esto, la vista puede ofrecer una grafía distinta a la ya guardada
 * y quedarían dos overrides para el mismo tipo de cierre: el lookup resolvería
 * el viejo por coincidencia exacta y el cambio recién guardado no se aplicaría.
 */
export function dedupeTipoCierreOverrides<T>(
  overrides: Record<string, T> | null | undefined,
): Record<string, T> | null | undefined {
  if (!overrides || typeof overrides !== 'object') return overrides;
  const byNorm = new Map<string, { key: string; value: T }>();
  for (const [key, value] of Object.entries(overrides)) {
    byNorm.set(normSubcalificacion(key), { key, value });
  }
  const result: Record<string, T> = {};
  for (const { key, value } of byNorm.values()) result[key] = value;
  return result;
}

/**
 * Llave canónica del nombre de un tópico/criterio.
 * El prompt numera los tópicos ("5. Subir Excel") y el modelo suele devolver el
 * número; también varían comillas, mayúsculas y acentos. Sin esta normalización
 * el criterio real quedaba sin calificar y la evaluación del modelo se colaba
 * como un criterio fantasma con puntos propios.
 */
export function normTopic(s: string): string {
  let t = stripDiacritics(s).toLowerCase();
  // Prefijo de enumeración: "5.", "12)", "3 -", "4:"
  t = t.replace(/^\s*\d{1,3}\s*[.)\-:]\s*/, '');
  // Comillas de apertura/cierre (rectas y tipográficas)
  t = t.replace(/^[\s"'“”‘’]+/, '').replace(/[\s"'“”‘’]+$/, '');
  return t.replace(/\s+/g, ' ').trim();
}

/** Separa una clave `[Bloque] Tópico` en sus dos partes normalizadas. */
export function splitCriterionKey(criterion: string): { block: string; topic: string } {
  const raw = String(criterion ?? '');
  // [\s\S] y no `.`: hay tópicos configurados con saltos de línea dentro del
  // nombre, y con `.` la expresión no cruzaba el salto, devolvía bloque vacío y
  // el criterio real quedaba huérfano.
  const m = raw.match(/^\s*\[([^\]]*)\]\s*([\s\S]*)$/);
  if (!m) return { block: '', topic: normTopic(raw) };
  return { block: normTopic(m[1]), topic: normTopic(m[2]) };
}

/** Llave canónica completa de un criterio guardado (`[Bloque] Tópico`). */
export function normCriterionKey(criterion: string): string {
  const { block, topic } = splitCriterionKey(criterion);
  return `${block}|||${topic}`;
}
