// backend/src/config/criteria-data.ts
// Criterios de calificación pre-extraídos de las imágenes oficiales:
//   scripts/FRAUDE ROEXT.png
//   scripts/TH CONFIRMA MOVIMIENTOS.png
// NO se leen imágenes en runtime — datos estáticos que compilan igual en local y producción.

export interface CriteriaTopic {
  topic: string;
  criticality: 'Crítico' | '-';
  points: number | 'n/a';
}

export interface CriteriaBlock {
  blockName: string;
  topics: CriteriaTopic[];
}

// ──────────────────────────────────────────────────────────────────────────────
// FRAUDE / ROEXT  (extraído de scripts/FRAUDE ROEXT.png)
// ──────────────────────────────────────────────────────────────────────────────
export const FRAUDE_ROEXT_CRITERIA: CriteriaBlock[] = [
  {
    blockName: 'Falcon',
    topics: [
      { topic: 'Cierre correcto del caso', criticality: 'Crítico', points: 5 },
      { topic: 'Creación y llenado correcto del caso (creación correcta del caso, selección de casillas, calificación de transacciones, comentarios correctos)', criticality: '-', points: 10 },
      { topic: 'Ingresa a HOTLIST_APROBAR / Ingresa a HOTLIST_Rechazar', criticality: '-', points: 'n/a' },
      { topic: 'Ingresa a HOTLIST_APROBAR', criticality: '-', points: 'n/a' },
      { topic: 'Ingresa a HOTLIST_Rechazar', criticality: '-', points: 'n/a' },
      { topic: 'Ingresa a HOTLIST_AVISO DE VIAJE', criticality: '-', points: 'n/a' },
      { topic: 'Califica correctamente la llamada', criticality: '-', points: 'n/a' },
    ]
  },
  {
    blockName: 'Front',
    topics: [
      { topic: 'Codificación correcta del caso', criticality: 'Crítico', points: 5 },
      { topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión)', criticality: '-', points: 'n/a' },
      { topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión, tienen afectación/sin afectación)', criticality: '-', points: 5 },
      { topic: 'Sube capturas completas', criticality: '-', points: 'n/a' },
      { topic: 'Colocar capturas completas y correctas', criticality: '-', points: 5 },
      { topic: 'Subir Excel', criticality: '-', points: 5 },
      { topic: 'Califica correctamente la llamada', criticality: '-', points: 'n/a' },
    ]
  },
  {
    blockName: 'Vcas',
    topics: [
      { topic: 'Calificación de transacciones', criticality: '-', points: 'n/a' },
      { topic: 'Aplica Bypass', criticality: '-', points: 'n/a' },
      { topic: 'Bloquea tarjeta', criticality: 'Crítico', points: 5 },
      { topic: 'Califica transacciones', criticality: '-', points: 5 },
      { topic: 'Valida compras por facturar y cortes para identificar la compra para aclaración / sin reversa', criticality: '-', points: 'n/a' },
    ]
  },
  {
    blockName: 'Vision',
    topics: [
      { topic: 'Valida pantalla OFAA y CRESP (CVV2 incorrecto, Tarjeta vencida, Fecha de vencimiento incorrecta, TJ Cancelada, etc.)', criticality: '-', points: 'n/a' },
      { topic: 'Comentarios correctos en ASHI', criticality: '-', points: 5 },
      { topic: 'Desbloquea tarjeta BLKI, BLKT, BPT0, BNFC', criticality: '-', points: 'n/a' },
      { topic: 'Bloqueo correcto', criticality: 'Crítico', points: 7 },
      { topic: 'Valida compras en ARTD y ARSD', criticality: '-', points: 5 },
    ]
  },
  {
    blockName: 'VRM',
    topics: [
      { topic: 'Calificación de transacciones, comentarios y aplica mantenimiento', criticality: 'Crítico', points: 10 },
    ]
  },
  {
    blockName: 'B.I',
    topics: [
      { topic: 'Crea el Folio Correctamente', criticality: '-', points: 10 },
    ]
  },
  {
    blockName: 'Manejo de llamada',
    topics: [
      { topic: 'Cumple con el script', criticality: '-', points: 17 },
      { topic: 'Educación, frases de conexión, comunicación efectiva y escucha activa', criticality: '-', points: 5 },
      { topic: 'Control de llamada y Puntualidad', criticality: '-', points: 6 },
      { topic: 'Autentica correctamente', criticality: '-', points: 11 },
    ]
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// TH CONFIRMA MOVIMIENTOS  (extraído de scripts/TH CONFIRMA MOVIMIENTOS.png)
// Diferencias vs FRAUDE marcadas con comentario ← DIFERENTE
// ──────────────────────────────────────────────────────────────────────────────
export const TH_CONFIRMA_CRITERIA: CriteriaBlock[] = [
  {
    blockName: 'Falcon',
    topics: [
      { topic: 'Cierre correcto del caso', criticality: 'Crítico', points: 5 },
      { topic: 'Creación y llenado correcto del caso (creación correcta del caso, selección de casillas, calificación de transacciones, comentarios correctos)', criticality: '-', points: 10 },
      { topic: 'Ingresa a HOTLIST_APROBAR / Ingresa a HOTLIST_Rechazar', criticality: '-', points: 'n/a' },
      { topic: 'Ingresa a HOTLIST_APROBAR', criticality: 'Crítico', points: 12 }, // ← DIFERENTE: Crítico 12 pts
      { topic: 'Ingresa a HOTLIST_Rechazar', criticality: '-', points: 'n/a' },
      { topic: 'Ingresa a HOTLIST_AVISO DE VIAJE', criticality: '-', points: 'n/a' },
      { topic: 'Califica correctamente la llamada', criticality: '-', points: 'n/a' },
    ]
  },
  {
    blockName: 'Front',
    topics: [
      { topic: 'Codificación correcta del caso', criticality: 'Crítico', points: 5 },
      { topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión)', criticality: '-', points: 5 }, // ← DIFERENTE: tiene 5 pts
      { topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión, tienen afectación/sin afectación)', criticality: '-', points: 'n/a' }, // ← DIFERENTE: n/a
      { topic: 'Sube capturas completas', criticality: '-', points: 'n/a' },
      { topic: 'Colocar capturas completas y correctas', criticality: '-', points: 5 },
      { topic: 'Subir Excel', criticality: '-', points: 5 },
      { topic: 'Califica correctamente la llamada', criticality: '-', points: 'n/a' },
    ]
  },
  {
    blockName: 'Vcas',
    topics: [
      { topic: 'Calificación de transacciones', criticality: '-', points: 5 }, // ← DIFERENTE: tiene 5 pts
      { topic: 'Aplica Bypass', criticality: '-', points: 10 }, // ← DIFERENTE: tiene 10 pts
      { topic: 'Bloquea tarjeta', criticality: '-', points: 'n/a' }, // ← DIFERENTE: n/a
      { topic: 'Califica transacciones', criticality: '-', points: 'n/a' }, // ← DIFERENTE: n/a
      { topic: 'Valida compras por facturar y cortes para identificar la compra para aclaración / sin reversa', criticality: '-', points: 'n/a' },
    ]
  },
  {
    blockName: 'Vision',
    topics: [
      { topic: 'Valida pantalla OFAA y CRESP (CVV2 incorrecto, Tarjeta vencida, Fecha de vencimiento incorrecta, TJ Cancelada, etc.)', criticality: '-', points: 'n/a' },
      { topic: 'Comentarios correctos en ASHI', criticality: '-', points: 5 },
      { topic: 'Desbloquea tarjeta BLKI, BLKT, BPT0, BNFC', criticality: 'Crítico', points: 5 }, // ← DIFERENTE: Crítico 5 pts
      { topic: 'Bloqueo correcto', criticality: '-', points: 'n/a' }, // ← DIFERENTE: n/a
      { topic: 'Valida compras en ARTD y ARSD', criticality: '-', points: 'n/a' }, // ← DIFERENTE: n/a (en FRAUDE era 5)
    ]
  },
  {
    blockName: 'VRM',
    topics: [
      { topic: 'Calificación de transacciones, comentarios y aplica mantenimiento', criticality: 'Crítico', points: 10 },
    ]
  },
  {
    blockName: 'B.I',
    topics: [
      { topic: 'Crea el Folio Correctamente', criticality: '-', points: 'n/a' }, // ← DIFERENTE: n/a (en FRAUDE era 10)
    ]
  },
  {
    blockName: 'Manejo de llamada',
    topics: [
      { topic: 'Cumple con el script', criticality: '-', points: 17 },
      { topic: 'Educación, frases de conexión, comunicación efectiva y escucha activa', criticality: '-', points: 5 },
      { topic: 'Control de llamada y Puntualidad', criticality: '-', points: 6 },
      { topic: 'Autentica correctamente', criticality: '-', points: 11 },
    ]
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────────────────────────

export function getCriteriaByCallType(callType: string): CriteriaBlock[] {
  const normalized = callType.toUpperCase();
  if (normalized.includes('TH')) return TH_CONFIRMA_CRITERIA;
  return FRAUDE_ROEXT_CRITERIA;
}

/** Serializa los criterios como texto estructurado para incluir en el prompt de IA */
export function formatCriteriaForPrompt(criteria: CriteriaBlock[]): string {
  const lines: string[] = [];
  for (const block of criteria) {
    lines.push(`\n[BLOQUE: ${block.blockName}]`);
    for (const t of block.topics) {
      const pts = t.points === 'n/a' ? 'N/A' : `${t.points} pts`;
      const crit = t.criticality === 'Crítico' ? ' ⚠️ CRÍTICO' : '';
      lines.push(`  • ${t.topic}${crit} — Ponderación: ${pts}`);
    }
  }
  return lines.join('\n');
}
