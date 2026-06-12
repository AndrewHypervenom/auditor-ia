// frontend/src/hooks/useSubcalificaciones.ts
// Subcalificaciones (tipos de cierre) por call_type, derivadas dinámicamente
// de la Plantilla GPF, con fallback a las listas históricas conocidas.

import { useState, useEffect, useMemo } from 'react';
import { plantillaService, type PlantillaGPFItem } from '../services/api';

// ── Fallback estático (listas históricas) ────────────────────
const SUBCALIFICACIONES_FALLBACK: Record<string, string[]> = {
  FRAUDE: [
    'INTERNET',
    'PRIMERAS PARTES',
    'ROBADA/EXTRAVIADA',
    'ROBO DE IDENTIDAD',
    'TARJETA NO ENTREGADA (NUEVA REPOSICION)',
  ],
  'TH CONFIRMA': [
    'BLOQUEO BLKI',
    'BLOQUEO BLKT',
    'BLOQUEO MATCH',
    'BLOQUEO PREVENTIVO (P)/SE LIBERA TARJETA',
    'EXCEDIO LIMITE DE CREDITO',
    'INGRESO INCORRECTO CVV2',
    'MSI NO PERMITIDO',
    'SIN REGISTRO EN FALCON/VCAS/VISION',
    'VCAS/VRM',
  ],
};

function getFallback(callType: string): string[] {
  const upper = callType.toUpperCase();
  for (const [key, list] of Object.entries(SUBCALIFICACIONES_FALLBACK)) {
    if (upper.includes(key)) return list;
  }
  return [];
}

// Nombre canónico de una calificación (espejo de normalizeCallTypeForDB del
// backend). Permite enganchar cada subcalificación con SU calificación real,
// tolerando ruido de datos (mayúsculas/acentos) y los nombres internos
// históricos 'FRAUDE' / 'TH CONFIRMA'.
function canonicalCalificacion(s: string): string {
  const upper = (s || '').toUpperCase().trim();
  if (upper.includes('TH CONFIRMA') || upper.includes('TH_CONFIRMA')) return 'TH CONFIRMA MOVIMIENTOS';
  if (upper.includes('FRAUDE') || upper.includes('ROEXT')) return 'FRAUDE/ROEXT';
  return upper.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Caché compartida de la plantilla ─────────────────────────
let cache: PlantillaGPFItem[] | null = null;
let cacheTime = 0;
let pending: Promise<PlantillaGPFItem[]> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function loadPlantilla(): Promise<PlantillaGPFItem[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) return cache;
  if (!pending) {
    pending = plantillaService.getAll()
      .then((data) => {
        cache = data;
        cacheTime = Date.now();
        return data;
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

/**
 * Retorna las subcalificaciones disponibles para un call_type:
 * los tipos de cierre activos de la Plantilla GPF unidos al fallback estático.
 */
export function useSubcalificaciones(callType: string): string[] {
  const [items, setItems] = useState<PlantillaGPFItem[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    loadPlantilla()
      .then((data) => { if (alive) setItems(data); })
      .catch(() => { /* fallback estático sigue funcionando */ });
    return () => { alive = false; };
  }, []);

  return useMemo(() => {
    const targetCanonical = canonicalCalificacion(callType);
    // Enganchar por la categoría REAL de cada fila (su calificación), no por el
    // call_type almacenado: en la plantilla hay filas con call_type mal asignado
    // (p. ej. subs de TH CONFIRMA etiquetadas como FRAUDE/ROEXT) que, filtrando
    // por call_type, se cruzaban a la calificación equivocada.
    const fromPlantilla = items
      .filter((i) => {
        if (i.is_active === false) return false;
        const rowCanonical = canonicalCalificacion(i.categoria || i.call_type || '');
        return rowCanonical === targetCanonical;
      })
      .map((i) => i.tipo_cierre.trim())
      .filter(Boolean);
    // La plantilla GPF es la fuente de verdad: si tiene tipos de cierre para este
    // call type, se usan EXCLUSIVAMENTE esos. El fallback estático solo entra
    // cuando la plantilla no tiene datos (call type sin sincronizar todavía).
    // Unir ambos traía subcalificaciones históricas de más (p. ej. FRAUDE/ROEXT
    // arrastraba las subs de "FRAUDE" por coincidencia de substring).
    const source = fromPlantilla.length > 0 ? fromPlantilla : getFallback(callType);
    // Dedup tolerante a mayúsculas/acentos
    const strip = (s: string) => s.toUpperCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tc of source) {
      const key = strip(tc);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(tc);
    }
    return result.sort();
  }, [items, callType]);
}
