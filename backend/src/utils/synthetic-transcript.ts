// backend/src/utils/synthetic-transcript.ts
// Converts GPF API data into a TranscriptResult compatible with evaluator.service.ts
//
// API field shapes (from documentation):
//   comments:      [{ date: string, comment: string, agent: string }]
//   transactions:  [{ date: string, commerce_name: string, amount: string }]
//   otpValidations:[{ date: string, agent: string, resultado: boolean }]
//   rawComments:   [string]  (from captures-comments.comments — plain strings)

import type { TranscriptResult, TranscriptWord } from '../types/index.js';
import type { CommentItem, TransactionItem, OtpItem } from '../services/gpf-data.service.js';

export function buildSyntheticTranscript(
  comments: CommentItem[],
  transactions: TransactionItem[],
  otpValidations: OtpItem[],
  rawComments: string[] = []
): TranscriptResult {
  const lines: string[] = [];
  const utterances: TranscriptWord[] = [];
  let fakeTime = 0;

  const addUtterance = (text: string, speaker: string) => {
    const wordCount = text.split(/\s+/).filter(Boolean).length || 1;
    const durationMs = wordCount * 400; // ~400ms per word
    utterances.push({
      start: fakeTime,
      end: fakeTime + durationMs,
      text,
      speaker
    });
    fakeTime += durationMs + 200;
  };

  // COMENTARIOS ESTRUCTURADOS (from /comments/{id})
  if (comments.length > 0) {
    lines.push('=== COMENTARIOS DEL AGENTE ===');
    for (const c of comments) {
      const text = c.comment || '';
      const agent = c.agent || 'Agente';
      const date = c.date ? `[${c.date}] ` : '';
      const line = `${date}[${agent}]: ${text}`;
      lines.push(line);
      if (text) addUtterance(text, agent);
    }
  }

  // COMENTARIOS PLANOS (from captures-comments.comments)
  if (rawComments.length > 0) {
    lines.push('=== NOTAS DE ATENCIÓN ===');
    for (const c of rawComments) {
      lines.push(c);
      addUtterance(c, 'Sistema');
    }
  }

  // TRANSACCIONES (from /transactions/{id})
  if (transactions.length > 0) {
    lines.push('=== TRANSACCIONES ===');
    for (const t of transactions) {
      const parts = [
        t.date && `Fecha: ${t.date}`,
        t.commerce_name && `Comercio: ${t.commerce_name}`,
        t.amount && `Monto: ${t.amount}`
      ].filter(Boolean);
      const text = parts.join(' | ');
      lines.push(text);
      addUtterance(text, 'Sistema');
    }
  }

  // VALIDACIONES OTP (from /otp-validations/{id})
  if (otpValidations.length > 0) {
    lines.push('=== VALIDACIONES OTP ===');
    for (const o of otpValidations) {
      const resultado = o.resultado ? 'EXITOSO' : 'FALLIDO';
      const agent = o.agent || 'Agente';
      const date = o.date ? `[${o.date}] ` : '';
      const text = `${date}Validación OTP por ${agent}: ${resultado}`;
      lines.push(text);
      addUtterance(text, agent);
    }
  }

  if (lines.length === 0) {
    const fallback = 'Sin datos de atención disponibles en la API GPF';
    lines.push(fallback);
    addUtterance(fallback, 'Sistema');
  }

  return {
    text: lines.join('\n'),
    utterances,
    audio_duration: 0, // No audio = $0 AssemblyAI cost
    words: utterances
  };
}
