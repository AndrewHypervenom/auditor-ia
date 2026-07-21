// frontend/src/components/CostBreakdownCard.tsx
// Desglose de costos de una auditoría por API (Claude / AssemblyAI) y por paso.
import { DollarSign, Cpu, AudioLines, Info, CalendarClock } from 'lucide-react';
import type { APICostsDB } from '../types';

interface Props {
  cost: APICostsDB;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

const money = (v: unknown): string => `$${n(v).toFixed(4)}`;

// ── Precio introductorio de Claude Sonnet 5 ────────────────────────────────
// $2/$10 por 1M (intro) vs $3/$15 (lista). El de lista es exactamente 1.5× el
// introductorio, así que el costo a precio de lista = costo intro × 1.5.
const SONNET5_INTRO_END = new Date('2026-09-01T00:00:00Z');
const LIST_OVER_INTRO = 1.5;          // 3/2 = 15/10
const INTRO_PRICE = { input: 2, output: 10 };
const LIST_PRICE = { input: 3, output: 15 };

export default function CostBreakdownCard({ cost }: Props) {
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

  const claudeSteps: { label: string; value: number; hint?: string }[] = [
    { label: 'Corrección de transcripción', value: correction },
    { label: 'Análisis de sentimientos', value: sentiment },
    { label: 'Análisis de imágenes', value: images, hint: cost.openai_images_count ? `${cost.openai_images_count} img` : undefined },
    { label: 'Evaluación con criterios', value: evaluation },
  ];

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
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {s.label}
                  {s.hint && <span className="text-slate-600"> · {s.hint}</span>}
                </span>
                <span className="text-slate-300 tabular-nums">{money(s.value)}</span>
              </div>
            ))}
          </div>
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
            <div className="text-[11px] text-slate-600 pt-1">Universal-3 Pro · diarización</div>
          </div>
        </div>
      </div>

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
