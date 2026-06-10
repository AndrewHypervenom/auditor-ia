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
    const upper = callType.toUpperCase().trim();
    const fromPlantilla = items
      .filter((i) => i.is_active !== false && (i.call_type || '').toUpperCase().trim() === upper)
      .map((i) => i.tipo_cierre.trim())
      .filter(Boolean);
    return [...new Set([...fromPlantilla, ...getFallback(callType)])].sort();
  }, [items, callType]);
}
