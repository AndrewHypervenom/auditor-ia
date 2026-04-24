// frontend/src/components/ResultsView.tsx

import {
  Download, CheckCircle2, AlertCircle, Clock, TrendingUp, FileText, Award,
  Target, ChevronDown, ChevronUp, PhoneIncoming, Monitor, Pencil, Check,
  X, Save, RotateCcw, AlertTriangle, ShieldAlert, Plus, ChevronsUpDown,
  MinusCircle, XCircle, ClipboardList
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { auditService } from '../services/api';
import type { EvaluationResult } from '../types';

interface ResultsViewProps {
  result: EvaluationResult;
  auditId?: string;
  callType?: string;
  onDownload: () => void;
  onNewAudit: () => void;
}

type FilterType = 'all' | 'passed' | 'partial' | 'failed' | 'critical' | 'manual';

export default function ResultsView({ result, auditId, callType, onDownload, onNewAudit }: ResultsViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scores: true,
    observations: false,
    recommendations: false,
    keyMoments: false,
    transcript: false,
  });
  const [expandedCriteria, setExpandedCriteria] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const [localScores, setLocalScores] = useState<any[]>(result.detailedScores ?? []);
  const [savedPercentage, setSavedPercentage] = useState<number>(result.percentage ?? 0);
  const [scoreEdits, setScoreEdits] = useState<Record<number, number>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInputValue, setEditInputValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Datos seguros ────────────────────────────────────────────────────────────
  const safeResult = {
    percentage: result?.percentage ?? 0,
    totalScore: result?.totalScore ?? 0,
    maxPossibleScore: result?.maxPossibleScore ?? 0,
    detailedScores: Array.isArray(result?.detailedScores) ? result.detailedScores : [],
    observations: result?.observations ?? 'Sin observaciones',
    recommendations: Array.isArray(result?.recommendations) ? result.recommendations : [],
    keyMoments: Array.isArray(result?.keyMoments) ? result.keyMoments : [],
    transcript: result?.transcript ?? '',
    audioConfidence: result?.audioConfidence,
    dataWarnings: Array.isArray(result?.dataWarnings) ? result.dataWarnings : [],
  };

  // ── Cálculos en tiempo real ──────────────────────────────────────────────────
  const currentScores = localScores.map((s: any, i: number) => ({
    ...s,
    score: scoreEdits[i] !== undefined ? scoreEdits[i] : (s.score ?? 0),
    _globalIndex: i,
  }));

  const currentTotal = currentScores.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0);
  const currentMax   = currentScores.reduce((sum: number, s: any) => sum + (s.maxScore ?? 0), 0);
  const rawPct       = currentMax > 0 ? (currentTotal / currentMax) * 100 : 0;

  const hasEdits = Object.keys(scoreEdits).length > 0;

  const criticalFailed  = currentScores.filter((s: any) => !isManualItem(s) && s.criticality === 'Crítico' && (s.score ?? 0) === 0);
  // hasCriticalFail: detectado en tiempo real (edición activa) O por el percentage=0 guardado en BD (registros sin campo criticality)
  const hasCriticalFail = criticalFailed.length > 0 || (!hasEdits && savedPercentage === 0 && rawPct > 0);
  const currentPct      = hasCriticalFail ? 0 : rawPct;
  // displayPct: muestra el porcentaje guardado en BD cuando no hay ediciones activas
  const displayPct      = hasEdits ? currentPct : savedPercentage;

  const criticalOnly = currentScores.filter(
    (s: any) => s.criticality === 'Crítico' && typeof s.maxScore === 'number' && s.maxScore > 0
  );
  const criticalPct =
    criticalOnly.length > 0
      ? (criticalOnly.reduce((s: number, x: any) => s + (x.score ?? 0), 0) /
          criticalOnly.reduce((s: number, x: any) => s + x.maxScore, 0)) * 100
      : null;

  // ── Clasificar criterios ─────────────────────────────────────────────────────
  const getCriterionStatus = (score: number, maxScore: number): 'passed' | 'partial' | 'failed' => {
    if (maxScore === 0) return 'passed';
    const pct = (score / maxScore) * 100;
    if (pct >= 80) return 'passed';
    if (pct > 0)   return 'partial';
    return 'failed';
  };

  const isManualItem = (s: any): boolean =>
    s.requiresManualReview === true ||
    ((s.score ?? 0) === 0 && typeof s.observations === 'string' &&
      s.observations.includes('Requiere validación manual'));

  const filterCounts = useMemo(() => {
    const counts = { passed: 0, partial: 0, failed: 0, critical: 0, manual: 0 };
    currentScores.forEach((s: any) => {
      if (isManualItem(s)) {
        counts.manual++;
      } else {
        counts[getCriterionStatus(s.score ?? 0, s.maxScore ?? 0)]++;
        if (s.criticality === 'Crítico') counts.critical++;
      }
    });
    return counts;
  }, [currentScores]);

  // ── Agrupado y filtrado ──────────────────────────────────────────────────────
  const scoresByBlock = useMemo((): Record<string, any[]> => {
    return currentScores.reduce((acc: Record<string, any[]>, score: any) => {
      if (!score?.criterion) return acc;
      const m = score.criterion.match(/\[(.*?)\]/);
      const block = m ? m[1] : 'General';
      if (!acc[block]) acc[block] = [];
      const isManual = isManualItem(score);
      const status = isManual ? 'manual' : getCriterionStatus(score.score ?? 0, score.maxScore ?? 0);
      const isCrit = !isManual && score.criticality === 'Crítico';
      if (
        filter === 'all' ||
        (filter === 'manual' && isManual) ||
        (filter === status && !isManual) ||
        (filter === 'critical' && isCrit)
      ) acc[block].push(score);
      return acc;
    }, {});
  }, [currentScores, filter]);

  const visibleBlocks = Object.entries(scoresByBlock).filter(([, scores]) => scores.length > 0);

  // ── Estado de expansión por criterio ────────────────────────────────────────
  const isCriterionExpanded = (idx: number, score: number, maxScore: number) => {
    if (allExpanded !== null) return allExpanded;
    if (expandedCriteria[idx] !== undefined) return expandedCriteria[idx];
    // Auto-expand si tiene falla o puntuación baja
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 100;
    return pct < 80;
  };

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleCriterion = (idx: number, currentOpen: boolean) =>
    setExpandedCriteria(prev => ({ ...prev, [idx]: !currentOpen }));

  const toggleExpandAll = () => {
    const next = allExpanded === true ? false : true;
    setAllExpanded(next);
    setExpandedCriteria({});
  };

  // ── Edición ──────────────────────────────────────────────────────────────────
  const startEdit   = (idx: number, cur: number) => { setEditingIndex(idx); setEditInputValue(String(cur)); };
  const cancelEdit  = () => { setEditingIndex(null); setEditInputValue(''); };
  const confirmEdit = (idx: number, max: number) => {
    const v = parseInt(editInputValue, 10);
    if (!isNaN(v) && v >= 0 && v <= max) setScoreEdits(prev => ({ ...prev, [idx]: v }));
    setEditingIndex(null); setEditInputValue('');
  };
  const discardEdits = () => { setScoreEdits({}); setEditingIndex(null); setEditInputValue(''); };
  const saveEdits    = async () => {
    if (!auditId || !hasEdits) return;
    setIsSaving(true);
    try {
      const saved = await auditService.updateAuditScores(
        auditId,
        currentScores.map((s: any) => ({
          criterion: s.criterion, score: s.score, maxScore: s.maxScore,
          observations: s.observations, criticality: s.criticality || '-',
          requiresManualReview: s.requiresManualReview ?? false,
        }))
      );
      setLocalScores(currentScores.map((s: any) => ({ ...s })));
      setSavedPercentage(saved.percentage);
      setScoreEdits({});
      toast.success('Puntajes guardados');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Helpers visuales ─────────────────────────────────────────────────────────
  const getScoreColor = (pct: number) => {
    if (pct >= 90) return 'text-brand-400';
    if (pct >= 80) return 'text-green-400';
    if (pct >= 70) return 'text-yellow-400';
    if (pct >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getBarBg = (pct: number) => {
    if (pct >= 80) return 'bg-brand-500';
    if (pct >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreBadge = (pct: number) => {
    if (pct >= 90) return { text: 'Excelente',      cls: 'bg-brand-500/10 text-brand-400 border-brand-700/40' };
    if (pct >= 80) return { text: 'Muy bueno',      cls: 'bg-green-500/10 text-green-400 border-green-500/30' };
    if (pct >= 70) return { text: 'Bueno',           cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
    if (pct >= 60) return { text: 'Aceptable',       cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
    return          { text: 'Necesita mejora',       cls: 'bg-red-500/10 text-red-400 border-red-500/30' };
  };

  // Ícono de estado inequívoco por criterio
  const StatusIcon = ({ score, maxScore, isCritical }: { score: number; maxScore: number; isCritical: boolean }) => {
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 100;
    const isCriticalZero = isCritical && score === 0;
    if (isCriticalZero)  return <ShieldAlert  className="w-4 h-4 text-red-400 flex-shrink-0" />;
    if (pct >= 80)       return <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />;
    if (pct > 0)         return <MinusCircle  className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    return                      <XCircle      className="w-4 h-4 text-red-400 flex-shrink-0" />;
  };

  const getImpactIcon = (impact: string) => {
    if (impact === 'positive') return <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />;
    if (impact === 'negative') return <AlertCircle  className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
    return                            <Clock        className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />;
  };

  const getAudioQuality = (c: number) => {
    if (c >= 90) return { label: 'Excelente', cls: 'bg-brand-500/10 text-brand-400 border-brand-700/30' };
    if (c >= 75) return { label: 'Buena',     cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
    if (c >= 60) return { label: 'Moderada',  cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
    return               { label: 'Baja',     cls: 'bg-red-500/10 text-red-400 border-red-500/30' };
  };

  const formatTimestamp = (ts: string | number): string => {
    if (!ts) return '00:00';
    const s = String(ts);
    if (/^\d{1,2}:\d{2}$/.test(s))    { const [m, sec] = s.split(':').map(Number); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) { const [h,m,sec]=s.split(':').map(Number); return `${String(h*60+m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
    const n = parseInt(s);
    return isNaN(n) ? s : `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  };

  const formatTranscript = (text: string) =>
    text ? text.replace(/\[([^\]]+)\]/g, (_, ts) => `[${formatTimestamp(ts)}]`) : 'No hay transcripción disponible';

  const scoreBadge = getScoreBadge(displayPct);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3 animate-fadeIn">

      {/* ── 1. TARJETA DE SCORE ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(18,18,32,0.99), rgba(10,10,20,1))',
          borderColor: hasCriticalFail ? 'rgba(239,68,68,0.3)' : 'rgba(30,30,50,1)',
        }}
      >
        {/* Línea de acento superior */}
        <div
          className="h-0.5 w-full"
          style={{
            background: hasCriticalFail
              ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)'
              : `linear-gradient(90deg, transparent, ${displayPct >= 80 ? 'rgba(0,214,50,0.5)' : displayPct >= 60 ? 'rgba(234,179,8,0.5)' : 'rgba(239,68,68,0.5)'}, transparent)`,
          }}
        />

        <div className="p-5">
          {/* Fila superior: etiqueta + tipo de llamada + botones */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-700/30">
                <Award className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Resultados de Evaluación</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-slate-500">Análisis completado</span>
                  {callType && (
                    callType.toUpperCase() === 'MONITOREO' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Monitor className="w-3 h-3" /> Monitoreo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-700/25">
                        <PhoneIncoming className="w-3 h-3" /> Inbound
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasEdits && auditId && (
                <>
                  <button onClick={discardEdits} disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-card border border-dark-border text-slate-400 hover:text-white transition-all">
                    <RotateCcw className="w-3.5 h-3.5" /> Descartar
                  </button>
                  <button onClick={saveEdits} disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 text-black hover:bg-brand-400 transition-all disabled:opacity-50 shadow-md shadow-brand-500/20">
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </>
              )}
              <button onClick={onDownload} className="btn-success flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Descargar Excel
              </button>
              <button onClick={onNewAudit} className="btn-secondary flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Nueva
              </button>
            </div>
          </div>

          {/* Puntuación principal + mini stats */}
          <div className="flex items-stretch gap-5">
            {/* % grande */}
            <div className="flex-shrink-0 flex flex-col justify-center min-w-[100px]">
              <div className={`text-5xl font-black tabular-nums leading-none ${getScoreColor(displayPct)}`}>
                {displayPct.toFixed(1)}<span className="text-xl font-semibold text-slate-500">%</span>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${scoreBadge.cls}`}>
                  {scoreBadge.text}
                </span>
                {hasCriticalFail && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse">
                    <ShieldAlert className="w-3 h-3" /> Crítico
                  </span>
                )}
                {hasEdits && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                    <Pencil className="w-3 h-3" /> Editado
                  </span>
                )}
              </div>
            </div>

            {/* Divisor */}
            <div className="w-px bg-dark-border self-stretch flex-shrink-0" />

            {/* Stats en grid 2×2 */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 content-center">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Puntos obtenidos</p>
                <p className="text-base font-bold text-white tabular-nums">
                  {currentTotal} <span className="text-slate-600 font-normal text-xs">/ {currentMax}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Criterios evaluados</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-white tabular-nums">{safeResult.detailedScores.length}</p>
                  {filterCounts.failed > 0 && (
                    <span className="text-xs font-semibold text-red-400">{filterCounts.failed} fallido{filterCounts.failed > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              {criticalOnly.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Críticos</p>
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className={`w-3.5 h-3.5 flex-shrink-0 ${hasCriticalFail ? 'text-red-400' : 'text-slate-500'}`} />
                    <p className={`text-base font-bold tabular-nums ${hasCriticalFail ? 'text-red-400' : criticalPct !== null && criticalPct >= 80 ? 'text-brand-400' : 'text-yellow-400'}`}>
                      {criticalFailed.length}/{criticalOnly.length}
                      {hasCriticalFail && <span className="text-red-400 font-normal text-xs ml-1">fallidos</span>}
                    </p>
                  </div>
                </div>
              )}
              {safeResult.audioConfidence !== undefined && safeResult.audioConfidence > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Calidad de audio</p>
                  <p className="text-base font-bold text-white tabular-nums">
                    {safeResult.audioConfidence.toFixed(0)}%
                    <span className={`text-xs font-semibold ml-1 ${getAudioQuality(safeResult.audioConfidence).cls.split(' ')[1]}`}>
                      {getAudioQuality(safeResult.audioConfidence).label}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 relative h-2 bg-dark-border rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${getBarBg(displayPct)}`}
                style={{ width: `${Math.max(0, Math.min(100, displayPct))}%` }}
              />
            </div>
            <span className="text-xs text-slate-600 tabular-nums flex-shrink-0">{displayPct.toFixed(0)}%</span>
          </div>

          {/* ── Advertencias de calidad de datos ── */}
          {safeResult.dataWarnings && safeResult.dataWarnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-500/8 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-amber-400/20 bg-amber-400/8">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-bold text-amber-300">Advertencias de calidad de datos</span>
                <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                  {safeResult.dataWarnings.length}
                </span>
              </div>
              {/* Lista */}
              <ul className="divide-y divide-amber-400/10">
                {safeResult.dataWarnings.map((w: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 px-3.5 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-200/90 leading-relaxed">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── ALERTAS ─────────────────────────────────────────────────────────── */}
      {hasCriticalFail && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-red-500/40 bg-red-950/25">
          <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-300 mb-1">
              Fallo en criterio crítico — Resultado final: 0%
            </p>
            {criticalFailed.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {criticalFailed.map((s: any) => (
                  <span key={s.criterion}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
                    <ShieldAlert className="w-3 h-3" />
                    {s.criterion.replace(/\[.*?\]\s*/, '')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-red-400/80">
                Un criterio crítico quedó en 0 puntos. Revisa los criterios marcados con <ShieldAlert className="inline w-3 h-3 mx-0.5" /> en la lista.
              </p>
            )}
          </div>
        </div>
      )}
      {safeResult.audioConfidence !== undefined && safeResult.audioConfidence > 0 && safeResult.audioConfidence < 70 && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300 leading-relaxed">
            Calidad de audio baja ({safeResult.audioConfidence.toFixed(1)}%). La transcripción puede tener errores. Se recomienda revisión manual.
          </p>
        </div>
      )}


      {/* ── 2. EVALUACIÓN DETALLADA ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-dark-border overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(18,18,32,0.97), rgba(10,10,20,1))' }}>

        {/* Cabecera de sección con filtros */}
        <div className="px-4 py-3 border-b border-dark-border">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Filtros */}
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { key: 'all',      label: 'Todos',       count: safeResult.detailedScores.length, color: 'text-slate-300'  },
                  { key: 'passed',   label: 'Aprobados',   count: filterCounts.passed,              color: 'text-brand-400'  },
                  { key: 'partial',  label: 'Parciales',   count: filterCounts.partial,             color: 'text-yellow-400' },
                  { key: 'failed',   label: 'Reprobados',  count: filterCounts.failed,              color: 'text-red-400'    },
                  { key: 'critical', label: 'Críticos',    count: filterCounts.critical,            color: 'text-red-400'    },
                  { key: 'manual',   label: 'Manuales',    count: filterCounts.manual,              color: 'text-amber-400'  },
                ] as const
              ).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === tab.key
                      ? 'bg-white/8 text-white border border-white/10'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/4'
                  }`}
                >
                  {tab.key === 'critical' && <ShieldAlert className={`w-3 h-3 ${filter === tab.key ? 'text-white' : 'text-red-400'}`} />}
                  {tab.key === 'manual' && <ClipboardList className={`w-3 h-3 ${filter === tab.key ? 'text-white' : 'text-amber-400'}`} />}
                  <span className={filter === tab.key ? 'text-white' : tab.color}>{tab.count}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Expandir / Colapsar todo */}
            <button
              onClick={toggleExpandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/4 transition-all border border-transparent hover:border-white/8"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              {allExpanded === true ? 'Colapsar todo' : 'Expandir todo'}
            </button>
          </div>
        </div>

        {/* Lista de criterios agrupada por bloque */}
        {visibleBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-brand-400 mb-2" />
            <p className="text-sm font-semibold text-slate-300">Sin criterios en esta categoría</p>
          </div>
        ) : (
          visibleBlocks.map(([block, scores], blockIdx) => {
            const blockTotal         = scores.reduce((s: number, x: any) => s + (x.score ?? 0), 0);
            const blockMax           = scores.reduce((s: number, x: any) => s + (x.maxScore ?? 0), 0);
            const blockPct           = blockMax > 0 ? (blockTotal / blockMax) * 100 : 0;
            const blockFails         = scores.filter((s: any) => !isManualItem(s) && getCriterionStatus(s.score ?? 0, s.maxScore ?? 0) === 'failed').length;
            const blockCritical      = scores.filter((s: any) => !isManualItem(s) && s.criticality === 'Crítico').length;
            const blockCriticalFailed = scores.filter((s: any) => !isManualItem(s) && s.criticality === 'Crítico' && (s.score ?? 0) === 0).length;

            return (
              <div key={block} className={blockIdx > 0 ? 'border-t border-dark-border/70' : ''}>
                {/* Encabezado del bloque */}
                <div className="flex items-center justify-between px-4 py-2 bg-dark-surface/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-300 tracking-wide">{block}</span>
                    <span className="text-xs text-slate-600">{scores.length} criterio{scores.length !== 1 ? 's' : ''}</span>
                    {blockFails > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        {blockFails} fallido{blockFails > 1 ? 's' : ''}
                      </span>
                    )}
                    {blockCritical > 0 && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold border ${
                        blockCriticalFailed > 0
                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                          : 'bg-red-500/8 text-red-400/70 border-red-500/15'
                      }`}>
                        <ShieldAlert className="w-3 h-3" />
                        {blockCritical} crítico{blockCritical > 1 ? 's' : ''}
                        {blockCriticalFailed > 0 && ` · ${blockCriticalFailed} fallido${blockCriticalFailed > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-600 tabular-nums">{blockTotal}/{blockMax} pts</span>
                    <div className="w-14 h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getBarBg(blockPct)} transition-all duration-300`}
                        style={{ width: `${Math.max(0, Math.min(100, blockPct))}%` }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums w-8 text-right ${getScoreColor(blockPct)}`}>
                      {blockPct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Criterios */}
                <div className="divide-y divide-dark-border/40">
                  {scores.map((score: any) => {
                    const idx           = score._globalIndex;
                    const isManual      = isManualItem(score);
                    const isCritical    = !isManual && score.criticality === 'Crítico';
                    const isEdited      = scoreEdits[idx] !== undefined;
                    const isEditing     = editingIndex === idx;
                    const safeScore     = score.score ?? 0;
                    const safeMax       = score.maxScore ?? 0;
                    const pct           = safeMax > 0 ? Math.round((safeScore / safeMax) * 100) : 0;
                    const isCritZero    = isCritical && safeScore === 0;
                    const name          = (score.criterion ?? '').replace(/\[.*?\]\s*/, '');
                    const observations  = score.observations ?? score.justification ?? '';
                    const evidence      = Array.isArray(score.evidence) ? score.evidence : [];
                    const hasDetail     = observations || evidence.length > 0;
                    const isExpanded    = isCriterionExpanded(idx, safeScore, safeMax);
                    const status        = getCriterionStatus(safeScore, safeMax);

                    // ── Fila de validación manual ────────────────────────
                    if (isManual) {
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 px-4 py-2.5 bg-amber-950/10 hover:bg-amber-950/15 border-l-2 border-l-amber-500/50 transition-colors"
                        >
                          <div className="flex-shrink-0">
                            <ClipboardList className="w-4 h-4 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm leading-snug text-amber-200 font-medium">{name}</span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                                <ClipboardList className="w-3 h-3" /> Validación manual
                              </span>
                            </div>
                          </div>
                          <span className="text-xs tabular-nums font-semibold text-amber-500/70 flex-shrink-0">
                            {safeMax > 0 ? `— / ${safeMax} pts` : '—'}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`transition-colors border-l-2 ${
                          isCritZero  ? 'bg-red-950/20 hover:bg-red-950/25 border-l-red-500/60'   :
                          isCritical  ? 'bg-red-950/8  hover:bg-red-950/12  border-l-brand-500/40' :
                          status === 'failed'  ? 'bg-red-950/8 hover:bg-red-950/12 border-l-transparent'   :
                          status === 'partial' ? 'bg-amber-950/8 hover:bg-amber-950/12 border-l-transparent' :
                          'hover:bg-white/[0.015] border-l-transparent'
                        }`}
                      >
                        {/* ── FILA PRINCIPAL ─────────────────────────────── */}
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          {/* Ícono de estado (siempre visible) */}
                          <div className="flex-shrink-0">
                            <StatusIcon score={safeScore} maxScore={safeMax} isCritical={isCritical} />
                          </div>

                          {/* Nombre + badges */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm leading-snug ${
                                status === 'failed' ? 'text-red-200 font-medium' :
                                status === 'partial' ? 'text-yellow-100 font-medium' :
                                'text-slate-200 font-medium'
                              }`}>
                                {name}
                              </span>
                              {isCritical && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                                  isCritZero
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                  <ShieldAlert className="w-3 h-3" /> Crítico
                                </span>
                              )}
                              {isEdited && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
                                  <Pencil className="w-3 h-3" /> Editado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Score + acciones (lado derecho) */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isEditing ? (
                              // ── Modo edición ─────────────────────────────
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number" min={0} max={safeMax}
                                      value={editInputValue}
                                      onChange={e => setEditInputValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') confirmEdit(idx, safeMax);
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                      autoFocus
                                      className="w-14 px-2 py-1 text-center text-sm font-bold bg-dark-bg border border-brand-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    />
                                    <span className="text-xs text-slate-500">/ {safeMax} pts</span>
                                  </div>
                                  <input
                                    type="range" min={0} max={safeMax}
                                    value={parseInt(editInputValue) || 0}
                                    onChange={e => setEditInputValue(e.target.value)}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{ accentColor: '#00D632' }}
                                  />
                                </div>
                                <button onClick={() => confirmEdit(idx, safeMax)}
                                  className="p-1.5 rounded-lg bg-brand-500 text-black hover:bg-brand-400 transition-colors" title="Confirmar (Enter)">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={cancelEdit}
                                  className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-slate-400 hover:text-white transition-colors" title="Cancelar (Esc)">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              // ── Modo lectura ──────────────────────────────
                              <>
                                {/* Barra compacta */}
                                <div className="w-16 h-1.5 bg-dark-border rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${getBarBg(pct)} transition-all duration-300`}
                                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                  />
                                </div>
                                {/* Puntos */}
                                <span className={`text-xs tabular-nums font-semibold w-14 text-right ${
                                  status === 'failed' ? 'text-red-400' :
                                  status === 'partial' ? 'text-yellow-400' : 'text-brand-400'
                                }`}>
                                  {safeScore}/{safeMax} pts
                                </span>
                                {/* % */}
                                <span className={`text-sm font-bold tabular-nums w-9 text-right ${getScoreColor(pct)}`}>
                                  {pct}%
                                </span>
                                {/* Botón editar — siempre visible */}
                                {safeMax > 0 && (
                                  <button
                                    onClick={() => startEdit(idx, safeScore)}
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-brand-400 hover:bg-brand-500/10 border border-transparent hover:border-brand-700/30 transition-all"
                                    title="Editar puntaje"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {/* Expand toggle — solo si hay detalle */}
                                {hasDetail && (
                                  <button
                                    onClick={() => toggleCriterion(idx, isExpanded)}
                                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
                                    title={isExpanded ? 'Ocultar justificación' : 'Ver justificación'}
                                  >
                                    {isExpanded
                                      ? <ChevronUp   className="w-3.5 h-3.5" />
                                      : <ChevronDown className="w-3.5 h-3.5" />
                                    }
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* ── JUSTIFICACIÓN EXPANDIDA ─────────────────────── */}
                        {isExpanded && !isEditing && hasDetail && (
                          <div className="px-4 pb-3 ml-7 max-w-[62%]">
                            {/* Alerta crítico */}
                            {isCritZero && (
                              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                <p className="text-xs text-red-300 font-medium">
                                  Criterio crítico en 0 — el resultado global es 0%
                                </p>
                              </div>
                            )}

                            {/* Justificación de la IA */}
                            {observations && (
                              <div className="mb-2.5 p-3 rounded-lg border border-dark-border/60 bg-dark-surface/40">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" /> Justificación de la IA
                                </p>
                                <p className="text-sm text-slate-300 leading-relaxed">{observations}</p>
                              </div>
                            )}

                            {/* Evidencia */}
                            {evidence.length > 0 && (
                              <div className="p-3 rounded-lg border border-dark-border/60 bg-dark-surface/40">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3" /> Evidencia encontrada
                                </p>
                                <ul className="space-y-1.5">
                                  {evidence.map((ev: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400 leading-relaxed">
                                      <span className="text-brand-500 mt-0.5 flex-shrink-0">▸</span>
                                      <span>{ev}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 3 — 5. SECCIONES SECUNDARIAS ────────────────────────────────────── */}
      {[
        {
          key: 'observations',
          icon: <FileText className="w-3.5 h-3.5 text-brand-400" />,
          label: 'Observaciones Generales',
          count: null,
          content: (
            <div className="px-4 py-3 border-t border-dark-border">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {safeResult.observations}
              </p>
            </div>
          ),
        },
        safeResult.recommendations.length > 0 && {
          key: 'recommendations',
          icon: <TrendingUp className="w-3.5 h-3.5 text-green-400" />,
          label: 'Recomendaciones',
          count: safeResult.recommendations.length,
          content: (
            <div className="border-t border-dark-border divide-y divide-dark-border/40">
              {safeResult.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.015] transition-colors">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500/10 border border-brand-700/30 flex items-center justify-center text-xs font-bold text-brand-400 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-300 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          ),
        },
        safeResult.keyMoments.length > 0 && {
          key: 'keyMoments',
          icon: <Clock className="w-3.5 h-3.5 text-orange-400" />,
          label: 'Momentos Clave',
          count: safeResult.keyMoments.length,
          content: (
            <div className="border-t border-dark-border divide-y divide-dark-border/40">
              {safeResult.keyMoments.map((moment: any, i: number) => {
                const m = {
                  timestamp: moment?.timestamp ?? '00:00',
                  impact: moment?.impact ?? moment?.type ?? 'neutral',
                  event: moment?.event ?? moment?.type ?? 'Sin título',
                  description: moment?.description ?? '',
                };
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.015] transition-colors">
                    <span className="flex-shrink-0 font-mono text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-700/25 rounded px-2 py-1 mt-0.5 tabular-nums">
                      {formatTimestamp(m.timestamp)}
                    </span>
                    {getImpactIcon(m.impact)}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{m.event}</p>
                      {m.description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        },
        {
          key: 'transcript',
          icon: <FileText className="w-3.5 h-3.5 text-slate-500" />,
          label: 'Transcripción Completa',
          count: null,
          badge: safeResult.audioConfidence !== undefined && safeResult.audioConfidence > 0 && (() => {
            const q = getAudioQuality(safeResult.audioConfidence!);
            return (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${q.cls}`}>
                {safeResult.audioConfidence!.toFixed(0)}% · {q.label}
              </span>
            );
          })(),
          content: (
            <div className="border-t border-dark-border px-4 py-3 max-h-80 overflow-y-auto">
              <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed font-mono">
                {formatTranscript(safeResult.transcript)}
              </p>
            </div>
          ),
        },
      ].filter(Boolean).map((section: any) => (
        <div
          key={section.key}
          className="rounded-xl border border-dark-border overflow-hidden"
          style={{ background: 'linear-gradient(145deg, rgba(18,18,32,0.97), rgba(10,10,20,1))' }}
        >
          <button
            onClick={() => toggleSection(section.key)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group"
          >
            <div className="flex items-center gap-2">
              {section.icon}
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{section.label}</span>
              {section.count !== null && section.count !== undefined && (
                <span className="text-xs font-bold text-slate-600">{section.count}</span>
              )}
              {section.badge}
            </div>
            {expandedSections[section.key]
              ? <ChevronUp   className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            }
          </button>
          {expandedSections[section.key] && section.content}
        </div>
      ))}

    </div>
  );
}
