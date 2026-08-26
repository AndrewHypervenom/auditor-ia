// backend/src/utils/call-timing.ts
//
// Métricas de tiempo derivadas de las intervenciones de AssemblyAI.
//
// Rubros como "Control de llamada y Puntualidad" miden segundos (tiempo en tomar
// la llamada, duración de las esperas) y antes no había forma de evaluarlos: la
// transcripción llegaba como texto plano, sin tiempos, así que el modelo se veía
// obligado a calificar en 0 por falta de evidencia medible. AssemblyAI ya
// entrega `start`/`end` en milisegundos por intervención; aquí se convierten en
// una sección de evidencia que el modelo puede citar.

import type { TranscriptWord } from '../types/index.js';

export interface CallPause {
  /** Segundo en que arranca el silencio. */
  startSec: number;
  /** Duración del silencio en segundos. */
  durationSec: number;
  /** Quién habló justo antes del silencio. */
  afterSpeaker: string;
  /** Fragmento previo, para que el auditor ubique el momento. */
  afterText: string;
}

export interface CallTimingMetrics {
  /** Duración cubierta por la transcripción, en segundos. */
  totalSec: number;
  /** Segundo de la primera intervención registrada. */
  firstUtteranceSec: number;
  /** Hablante de la primera intervención. */
  firstSpeaker: string | null;
  /** Silencios detectados, del más largo al más corto. */
  pauses: CallPause[];
  /** Silencio más largo, en segundos. */
  longestPauseSec: number;
  /** Suma de todos los silencios detectados, en segundos. */
  totalSilenceSec: number;
  /** Cantidad de intervenciones. */
  utteranceCount: number;
}

/** Silencios por debajo de este umbral son pausas normales del habla, no esperas. */
const MIN_PAUSE_SEC = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeCallTiming(utterances: TranscriptWord[] | undefined): CallTimingMetrics | null {
  const list = (utterances ?? []).filter(u => typeof u?.start === 'number' && typeof u?.end === 'number');
  if (list.length === 0) return null;

  const ordered = [...list].sort((a, b) => a.start - b.start);
  const pauses: CallPause[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const gapSec = (ordered[i + 1].start - ordered[i].end) / 1000;
    if (gapSec < MIN_PAUSE_SEC) continue;
    pauses.push({
      startSec: round1(ordered[i].end / 1000),
      durationSec: round1(gapSec),
      afterSpeaker: ordered[i].speaker ?? '?',
      afterText: String(ordered[i].text ?? '').slice(-90),
    });
  }

  pauses.sort((a, b) => b.durationSec - a.durationSec);

  return {
    totalSec: round1(ordered[ordered.length - 1].end / 1000),
    firstUtteranceSec: round1(ordered[0].start / 1000),
    firstSpeaker: ordered[0].speaker ?? null,
    pauses,
    longestPauseSec: pauses.length > 0 ? pauses[0].durationSec : 0,
    totalSilenceSec: round1(pauses.reduce((s, p) => s + p.durationSec, 0)),
    utteranceCount: ordered.length,
  };
}

/** `mm:ss` a partir de segundos. */
function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Renderiza las métricas para el prompt. Deja explícito qué se puede medir y qué
 * no: la grabación empieza cuando el agente ya tomó la llamada, así que el tiempo
 * de espera en cola NO es medible y el modelo no debe penalizarlo por eso.
 */
export function formatCallTimingForPrompt(m: CallTimingMetrics | null): string {
  if (!m) {
    return '(Sin métricas de tiempo: la transcripción no trae intervenciones con marcas de tiempo. '
      + 'NO penalices los rubros de tiempos por esta ausencia: márcalos para revisión manual y dilo en la justificación.)';
  }

  const top = m.pauses.slice(0, 12);
  const pauseLines = top.length > 0
    ? top.map(p => `- ${mmss(p.startSec)} → silencio de ${p.durationSec}s (después de que habló ${p.afterSpeaker}: "…${p.afterText}")`).join('\n')
    : '- No se detectaron silencios de 3 segundos o más.';

  return `DURACIÓN TOTAL DE LA GRABACIÓN: ${m.totalSec}s (${mmss(m.totalSec)})
INTERVENCIONES: ${m.utteranceCount}
PRIMERA INTERVENCIÓN: ${mmss(m.firstUtteranceSec)} (hablante ${m.firstSpeaker ?? '?'})
SILENCIO MÁS LARGO: ${m.longestPauseSec}s
TIEMPO TOTAL EN SILENCIO: ${m.totalSilenceSec}s

SILENCIOS DETECTADOS (≥ ${MIN_PAUSE_SEC}s, de mayor a menor):
${pauseLines}

CÓMO USAR ESTOS DATOS:
- Un silencio largo tras una frase del agente del tipo "permíteme un momento" / "dame un segundo" es un TIEMPO DE ESPERA: su duración es la del silencio.
- Para el límite de espera (máximo 60 segundos), compara contra SILENCIO MÁS LARGO y contra la lista de silencios.
- LIMITACIÓN: la grabación arranca cuando la llamada ya fue tomada, así que el tiempo que el agente tardó en contestar (el límite de 5 segundos) NO es medible aquí. No lo penalices: evalúa sólo los tiempos de espera y aclara en la justificación que el tiempo de respuesta inicial requiere validación manual.`;
}
