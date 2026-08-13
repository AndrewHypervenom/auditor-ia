// frontend/src/components/CostBreakdownCard.tsx
// Desglose de costos de una auditoría por API (Claude / AssemblyAI) y por paso.
import { DollarSign, Cpu, AudioLines, Info, CalendarClock, Hash, Type } from 'lucide-react';
import type { APICostsDB } from '../types';

interface Props {
  cost: APICostsDB;
  /** Texto de la transcripción, para contar palabras del audio. */
  transcript?: string;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

const money = (v: unknown): string => `$${n(v).toFixed(4)}`;

// Miles con separador (1.234.567) y forma compacta para los hints (12.3k).
const num = (v: unknown): string => n(v).toLocaleString('es-MX');
const compact = (v: unknown): string => {
  const x = n(v);
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}k`;
  return String(x);
};

const countWords = (text?: string): number =>
  text ? (text.trim().match(/\S+/g) ?? []).length : 0;

// ── Precio introductorio de Claude Sonnet 5 ────────────────────────────────
// $2/$10 por 1M (intro) vs $3/$15 (lista). El de lista es exactamente 1.5× el
// introductorio, así que el costo a precio de lista = costo intro × 1.5.
const SONNET5_INTRO_END = new Date('2026-09-01T00:00:00Z');
const LIST_OVER_INTRO = 1.5;          // 3/2 = 15/10
const INTRO_PRICE = { input: 2, output: 10 };
const LIST_PRICE = { input: 3, output: 15 };

export default function CostBreakdownCard({ cost, transcript }: Props) {
  const assemblyai = n(cost.assemblyai_cost);
  const correction = n(cost.claude_correction_cost);
  const sentiment = n(cost.claude_sentiment_cost);
  const images = n(cost.openai_images_cost);
  const evaluation = n(cost.openai_evaluation_cost);
  const claudeTotal =
    cost.openai_total_cost != null
      ? n(cost.openai_total_cost)
      : correction + sentiment + images + evaluation;
  const total = n(cost.total_cost) || claudeTotal + assemblyai;

  // ── Doble precio (intro vs lista) para Sonnet 5 ──────────────────────────
  const isSonnet5 = (cost.claude_model ?? 'claude-sonnet-5').toLowerCase().includes('sonnet-5');
  const inIntro = new Date() < SONNET5_INTRO_END;
  // Durante el intro, lo guardado ya es precio intro; tras el 31-ago es lista.
  const claudeIntro = inIntro ? claudeTotal : claudeTotal / LIST_OVER_INTRO;
  const claudeList = inIntro ? claudeTotal * LIST_OVER_INTRO : claudeTotal;
  const totalIntro = assemblyai + claudeIntro;
  const totalList = assemblyai + claudeList;
  const introEndStr = SONNET5_INTRO_END.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  const claudePct = total > 0 ? (claudeTotal / total) * 100 : 0;
  const assemblyPct = total > 0 ? (assemblyai / total) * 100 : 0;

  // ── Tokens por paso ──────────────────────────────────────────────────────
  const claudeSteps: { label: string; value: number; hint?: string; inTok: number; outTok: number }[] = [
    {
      label: 'Corrección de transcripción',
      value: correction,
      inTok: n(cost.claude_correction_input_tokens),
      outTok: n(cost.claude_correction_output_tokens),
    },
    {
      label: 'Análisis de sentimientos',
      value: sentiment,
      inTok: n(cost.claude_sentiment_input_tokens),
      outTok: n(cost.claude_sentiment_output_tokens),
    },
    {
      label: 'Análisis de imágenes',
      value: images,
      hint: cost.openai_images_count ? `${cost.openai_images_count} img` : undefined,
      inTok: n(cost.openai_images_input_tokens),
      outTok: n(cost.openai_images_output_tokens),
    },
    {
      label: 'Evaluación con criterios',
      value: evaluation,
      inTok: n(cost.openai_evaluation_input_tokens),
      outTok: n(cost.openai_evaluation_output_tokens),
    },
  ];

  const inputTokens = claudeSteps.reduce((s, x) => s + x.inTok, 0);
  const outputTokens = claudeSteps.reduce((s, x) => s + x.outTok, 0);
  const totalTokens = inputTokens + outputTokens;
  const hasTokens = totalTokens > 0;

  // Palabras del audio transcrito (fuente real del texto que se procesó).
  const transcriptWords = countWords(transcript);
  // Referencia útil: ~1.3 tokens por palabra en español, así que la relación
  // tokens/palabra explica por qué el prompt pesa más que la transcripción.
  const tokensPerWord = transcriptWords > 0 ? totalTokens / transcriptWords : 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 rounded-xl">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          Costo de esta auditoría
        </h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-400">{money(total)}</div>
          {cost.claude_model && (
            <div className="text-[11px] text-slate-500">Modelo: {cost.claude_model}</div>
          )}
        </div>
      </div>

      {/* Barra de proporción por API */}
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-700 mb-4">
        <div className="bg-violet-500 h-full" style={{ width: `${claudePct}%` }} title={`Claude ${claudePct.toFixed(1)}%`}></div>
        <div className="bg-cyan-500 h-full" style={{ width: `${assemblyPct}%` }} title={`AssemblyAI ${assemblyPct.toFixed(1)}%`}></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claude */}
        <div className="p-4 bg-slate-800/50 border border-violet-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-violet-300 font-semibold text-sm">
              <Cpu className="w-4 h-4" /> Claude (LLM)
            </span>
            <span className="text-violet-300 font-bold">{money(claudeTotal)}</span>
          </div>
          <div className="space-y-1.5">
            {claudeSteps.map((s) => (
              <div key={s.label} className="flex items-start justify-between text-xs gap-3">
                <span className="text-slate-400">
                  {s.label}
                  {s.hint && <span className="text-slate-600"> · {s.hint}</span>}
                  {(s.inTok > 0 || s.outTok > 0) && (
                    <span className="block text-[10px] text-slate-600 tabular-nums">
                      {compact(s.inTok)} in · {compact(s.outTok)} out
                    </span>
                  )}
                </span>
                <span className="text-slate-300 tabular-nums">{money(s.value)}</span>
              </div>
            ))}
          </div>

          {hasTokens && (
            <div className="mt-3 pt-2 border-t border-violet-500/20 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Hash className="w-3.5 h-3.5 text-violet-400" /> Tokens totales
              </span>
              <span className="text-violet-200 tabular-nums font-semibold">{num(totalTokens)}</span>
            </div>
          )}
        </div>

        {/* AssemblyAI */}
        <div className="p-4 bg-slate-800/50 border border-cyan-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
              <AudioLines className="w-4 h-4" /> AssemblyAI
            </span>
            <span className="text-cyan-300 font-bold">{money(assemblyai)}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Transcripción de audio</span>
              <span className="text-slate-300 tabular-nums">{money(assemblyai)}</span>
            </div>
            {cost.assemblyai_duration_minutes != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Duración</span>
                <span className="text-slate-300 tabular-nums">{n(cost.assemblyai_duration_minutes).toFixed(2)} min</span>
              </div>
            )}
            {transcriptWords > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Palabras transcritas</span>
                <span className="text-slate-300 tabular-nums">{num(transcriptWords)}</span>
              </div>
            )}
            <div className="text-[11px] text-slate-600 pt-1">Universal-3 Pro · diarización</div>
          </div>
        </div>
      </div>

      {/* ── Consumo: tokens y palabras ─────────────────────────────────────── */}
      {(hasTokens || transcriptWords > 0) && (
        <div className="mt-4 p-4 bg-slate-800/40 border border-[#1e1e32] rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">Consumo de esta auditoría</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Tokens de entrada</div>
              <div className="text-base font-bold text-violet-300 tabular-nums">{num(inputTokens)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Tokens de salida</div>
              <div className="text-base font-bold text-violet-300 tabular-nums">{num(outputTokens)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Tokens totales</div>
              <div className="text-base font-bold text-slate-100 tabular-nums">{num(totalTokens)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Type className="w-3 h-3" /> Palabras transcritas
              </div>
              <div className="text-base font-bold text-cyan-300 tabular-nums">
                {transcriptWords > 0 ? num(transcriptWords) : '—'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5">
            Los tokens son de Claude (todos los pasos: corrección, sentimientos, imágenes y evaluación) y son
            lo que se cobra. Las palabras son las del audio transcrito.
            {tokensPerWord > 0 && (
              <> Relación: <span className="text-slate-300 tabular-nums">{tokensPerWord.toFixed(1)} tokens por palabra</span> —
              es mayor a 1 porque cada paso reenvía la transcripción junto con los criterios y las instrucciones.</>
            )}
          </p>
        </div>
      )}

      {/* ── Aviso de precio introductorio de Claude Sonnet 5 ────────────────── */}
      {isSonnet5 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20 bg-amber-500/8">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-300">Precio de Claude: introductorio vs. de lista</span>
          </div>

          <div className="px-4 py-3 space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
              <CalendarClock className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <span>
                Claude <span className="text-slate-200 font-medium">Sonnet 5</span> tiene un{' '}
                <span className="text-amber-300 font-semibold">precio introductorio hasta el {introEndStr}</span>.
                A partir del <span className="text-amber-300 font-semibold">1 de septiembre de 2026</span> aplica el
                precio de lista — el que realmente costará de ahí en adelante. Lo mostramos ahora para que{' '}
                <span className="text-slate-200">no haya sorpresas</span> después de esa fecha.
              </span>
            </p>

            {/* Dos columnas: intro vs lista */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Introductorio */}
              <div className={`rounded-lg border p-3 ${inIntro ? 'border-brand-500/40 bg-brand-500/5' : 'border-[#1e1e32] bg-slate-800/40'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">
                    Introductorio {inIntro && <span className="text-brand-400">· vigente</span>}
                  </span>
                  <span className="text-[10px] text-slate-500">hasta {introEndStr}</span>
                </div>
                <div className="text-[11px] text-slate-500 mb-2">
                  ${INTRO_PRICE.input} in / ${INTRO_PRICE.output} out · por 1M tokens
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Claude en esta auditoría</span>
                  <span className="text-slate-200 tabular-nums font-semibold">{money(claudeIntro)}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-[#1e1e32]">
                  <span className="text-slate-400">Total (con AssemblyAI)</span>
                  <span className="text-brand-300 tabular-nums font-bold">{money(totalIntro)}</span>
                </div>
              </div>

              {/* De lista */}
              <div className={`rounded-lg border p-3 ${!inIntro ? 'border-amber-500/40 bg-amber-500/5' : 'border-amber-500/25 bg-slate-800/40'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">
                    De lista {!inIntro ? <span className="text-amber-400">· vigente</span> : <span className="text-amber-400/80">· desde 1-sep-2026</span>}
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-semibold">≈ 1.5×</span>
                </div>
                <div className="text-[11px] text-slate-500 mb-2">
                  ${LIST_PRICE.input} in / ${LIST_PRICE.output} out · por 1M tokens
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Claude en esta auditoría</span>
                  <span className="text-slate-200 tabular-nums font-semibold">{money(claudeList)}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-amber-500/20">
                  <span className="text-slate-400">Total (con AssemblyAI)</span>
                  <span className="text-amber-300 tabular-nums font-bold">{money(totalList)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              AssemblyAI ({money(assemblyai)}) no cambia — el ajuste es solo en la parte de Claude.
              A partir del 1-sep, esta auditoría costaría <span className="text-amber-300 font-semibold">{money(totalList)}</span> en vez de {money(totalIntro)}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
