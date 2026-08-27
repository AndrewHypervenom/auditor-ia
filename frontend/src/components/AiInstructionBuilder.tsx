// frontend/src/components/AiInstructionBuilder.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Sparkles,
  ChevronDown,
  Check,
  Loader2,
  RefreshCw,
  Wand2,
  ArrowDownToLine,
  CornerDownLeft,
} from 'lucide-react';
import { criteriaService, type InstructionBrief } from '../services/api';

/** Un brief sin texto no vale la pena guardarlo: ensucia el criterio sin aportar. */
export function briefHasContent(brief: InstructionBrief | null | undefined): boolean {
  return Boolean(brief?.goal?.trim());
}

/** Rellena lo que falte en briefs guardados por versiones anteriores. */
export function normalizeBrief(raw: InstructionBrief | null | undefined): InstructionBrief | null {
  if (!raw) return null;
  return { ...raw, goal: raw.goal ?? '' };
}

interface AiInstructionBuilderProps {
  brief: InstructionBrief | null;
  onBriefChange: (brief: InstructionBrief | null) => void;
  /** Instrucción vigente en el textarea del criterio. */
  instruction: string;
  onUseInstruction: (text: string) => void;
  topic: string;
  callType: string;
  subCalificacion?: string | null;
  validationSource: string[];
}

export default function AiInstructionBuilder({
  brief,
  onBriefChange,
  instruction,
  onUseInstruction,
  topic,
  callType,
  subCalificacion,
  validationSource,
}: AiInstructionBuilderProps) {
  const { t } = useTranslation();
  // Se evalúa una sola vez al montar: describe si el criterio LLEGÓ con texto
  // guardado. Si dependiera del estado vivo, el título cambiaría en cuanto el
  // usuario escribe la primera letra.
  const [hadSavedBrief] = useState(() => briefHasContent(brief));
  const [open, setOpen] = useState(hadSavedBrief);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');

  const goal = brief?.goal ?? '';
  const setGoal = (value: string) => onBriefChange({ ...(brief ?? {}), goal: value });

  const canGenerate = goal.trim().length > 2;
  const isEdited = Boolean(
    brief?.generated_prompt && instruction.trim() && instruction.trim() !== brief.generated_prompt.trim()
  );
  /** Atajo para el caso típico: ya hay texto suelto escrito a mano en el criterio. */
  const canImportInstruction = !goal.trim() && instruction.trim().length > 2;
  /** Destacado mientras el criterio aún no tiene una instrucción hecha con el asistente. */
  const highlight = !open && !hadSavedBrief;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setDraft('');
    try {
      const { prompt } = await criteriaService.generatePrompt({
        description: goal.trim(),
        topic,
        call_type: callType,
        sub_calificacion: subCalificacion ?? null,
        validation_source: validationSource,
      });
      setDraft(prompt);
    } catch {
      toast.error(t('scriptsAdmin.instructionGenError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleUse = () => {
    const now = new Date().toISOString();
    onUseInstruction(draft);
    onBriefChange({ goal, generated_prompt: draft, generated_at: now, updated_at: now });
    setDraft('');
  };

  return (
    <div className="mt-3">
      {/* Cabecera plegable. Cerrada y sin instrucción generada todavía, se
          comporta como llamada a la acción para que no se pierda en la vista. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 rounded-xl border transition-all duration-150 ${
          highlight
            ? 'px-3.5 py-3 bg-gradient-to-r from-brand-500/25 to-brand-500/10 border-brand-500/40 text-brand-200 hover:from-brand-500/35 hover:to-brand-500/20 animate-aiGlow'
            : open
              ? 'px-3.5 py-2.5 bg-brand-500/10 border-brand-700/30 text-brand-300'
              : 'px-3.5 py-2.5 bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-brand-300 hover:border-brand-700/25'
        }`}
      >
        <Wand2
          size={highlight ? 15 : 13}
          className={`flex-shrink-0 ${highlight ? 'animate-aiSparkle' : ''}`}
        />
        <span className={`font-semibold ${highlight ? 'text-[13px]' : 'text-xs'}`}>
          {hadSavedBrief ? t('scriptsAdmin.builder.openSaved') : t('scriptsAdmin.builder.open')}
        </span>
        <span className="flex-1" />
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {highlight && (
        <p className="mt-1.5 px-1 text-[11px] text-slate-500">{t('scriptsAdmin.builder.callout')}</p>
      )}

      {/* Resumen cuando está cerrado y ya hay texto guardado */}
      {!open && hadSavedBrief && (
        <p className="mt-1.5 px-1 text-[11px] text-slate-500 line-clamp-2">{goal}</p>
      )}

      {open && (
        <div className="mt-3 rounded-2xl bg-slate-900/50 border border-slate-700/40 animate-fadeIn p-4 space-y-3">
          <p className="text-[11px] text-slate-400 leading-relaxed">{t('scriptsAdmin.builder.intro')}</p>

          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            placeholder={t('scriptsAdmin.builder.goalPlaceholder')}
            className={inputCls}
          />

          {canImportInstruction && (
            <button
              type="button"
              onClick={() => setGoal(instruction.trim())}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-brand-300 transition-colors"
            >
              <CornerDownLeft size={11} />
              {t('scriptsAdmin.builder.useCurrentText')}
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-brand-500/20 border border-brand-700/40 text-brand-200 text-sm font-semibold
                       hover:bg-brand-500/30 disabled:opacity-40 transition-all duration-150"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating
              ? t('reports.generating')
              : brief?.generated_prompt
                ? t('scriptsAdmin.builder.regenerate')
                : t('scriptsAdmin.generateInstruction')}
          </button>

          {/* Propuesta editable antes de reemplazar la instrucción */}
          {draft && (
            <div className="animate-fadeIn space-y-2 rounded-xl bg-slate-950/60 border border-brand-700/25 p-3.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-brand-400" />
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider whitespace-nowrap">
                  {t('scriptsAdmin.builder.proposalTitle')}
                </p>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className={`${inputCls} leading-relaxed`}
              />
              <p className="text-[10px] text-slate-600">{t('scriptsAdmin.builder.proposalEditable')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleUse}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             bg-green-500/15 border border-green-500/25 text-green-300 text-xs font-semibold
                             hover:bg-green-500/25 transition-all duration-150"
                >
                  <ArrowDownToLine size={12} />
                  {t('scriptsAdmin.useInstruction')}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs font-medium
                             hover:text-brand-300 disabled:opacity-50 transition-all duration-150"
                >
                  <RefreshCw size={12} />
                  {t('scriptsAdmin.builder.regenerate')}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft('')}
                  className="px-3 py-1.5 rounded-lg text-slate-500 text-xs hover:text-slate-300 transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Trazabilidad: qué se generó y si luego se editó a mano */}
          {brief?.generated_at && !draft && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <Check size={11} className="text-slate-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {t('scriptsAdmin.builder.generatedOn', {
                  date: new Date(brief.generated_at).toLocaleString(),
                })}
                {isEdited && <span className="text-amber-400"> · {t('scriptsAdmin.builder.editedByHand')}</span>}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white ' +
  'resize-y focus:outline-none focus:border-brand-600/60 focus:ring-1 focus:ring-brand-500/20 ' +
  'placeholder:text-slate-600 transition-colors';
