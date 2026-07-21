// frontend/src/components/CostBreakdownCard.tsx
// Desglose de costos de una auditoría por API (Claude / AssemblyAI) y por paso.
import { DollarSign, Cpu, AudioLines } from 'lucide-react';
import type { APICostsDB } from '../types';

interface Props {
  cost: APICostsDB;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

const money = (v: unknown): string => `$${n(v).toFixed(4)}`;

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
    </div>
  );
}
