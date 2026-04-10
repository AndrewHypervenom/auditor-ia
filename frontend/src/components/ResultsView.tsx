// frontend/src/components/ResultsView.tsx

import { Download, CheckCircle2, AlertCircle, Clock, TrendingUp, FileText, Award, Target, Sparkles, ChevronDown, ChevronUp, PhoneIncoming, Monitor, Pencil, Check, X, Save, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
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

export default function ResultsView({ result, auditId, callType, onDownload, onNewAudit }: ResultsViewProps) {
 const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
 scores: true,
 observations: true,
 recommendations: true,
 keyMoments: true,
 transcript: false
 });

 // Estado de edición de puntajes
 const [scoreEdits, setScoreEdits] = useState<Record<number, number>>({}); // índice → nuevo score
 const [editingIndex, setEditingIndex] = useState<number | null>(null);
 const [editInputValue, setEditInputValue] = useState<string>('');
 const [isSaving, setIsSaving] = useState(false);

 const toggleSection = (section: string) => {
 setExpandedSections(prev => ({
 ...prev,
 [section]: !prev[section]
 }));
 };

 const getScoreColor = (percentage: number) => {
 if (percentage >= 90) return 'text-emerald-400';
 if (percentage >= 80) return 'text-green-400';
 if (percentage >= 70) return 'text-yellow-400';
 if (percentage >= 60) return 'text-orange-400';
 return 'text-red-400';
 };

 const getScoreGradient = (percentage: number) => {
 if (percentage >= 90) return 'from-emerald-500 to-green-500';
 if (percentage >= 80) return 'from-green-500 to-emerald-500';
 if (percentage >= 70) return 'from-yellow-500 to-orange-500';
 if (percentage >= 60) return 'from-orange-500 to-red-500';
 return 'from-red-500 to-red-700';
 };

 const getScoreBadge = (percentage: number) => {
 if (percentage >= 90) return { text: 'Excelente', class: 'badge-success', icon: '' };
 if (percentage >= 80) return { text: 'Muy Bueno', class: 'badge-success', icon: '' };
 if (percentage >= 70) return { text: 'Bueno', class: 'badge-warning', icon: '' };
 if (percentage >= 60) return { text: 'Aceptable', class: 'badge-warning', icon: '' };
 return { text: 'Necesita Mejora', class: 'badge-danger', icon: '' };
 };

 const getImpactIcon = (impact: string) => {
 switch (impact) {
 case 'positive':
 return <CheckCircle2 className="w-4 h-4 text-green-400" />;
 case 'negative':
 return <AlertCircle className="w-4 h-4 text-red-400" />;
 default:
 return <Clock className="w-4 h-4 text-slate-400" />;
 }
 };

 const formatTimestamp = (timestamp: string | number): string => {
 if (!timestamp) return '00:00';
 
 const timestampStr = String(timestamp);
 
 if (/^\d{1,2}:\d{2}$/.test(timestampStr)) {
 const [mins, secs] = timestampStr.split(':').map(Number);
 return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 }
 
 if (/^\d{1,2}:\d{2}:\d{2}$/.test(timestampStr)) {
 const parts = timestampStr.split(':').map(Number);
 const hours = parts[0] || 0;
 const minutes = parts[1] || 0;
 const seconds = parts[2] || 0;
 
 const totalMinutes = hours * 60 + minutes;
 return `${totalMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
 }
 
 const totalSeconds = parseInt(timestampStr);
 if (!isNaN(totalSeconds)) {
 const mins = Math.floor(totalSeconds / 60);
 const secs = totalSeconds % 60;
 return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 }
 
 return timestampStr;
 };

 const formatTranscript = (transcript: string): string => {
 if (!transcript) return 'No hay transcripción disponible';
 return transcript.replace(/\[([^\]]+)\]/g, (match, timestamp) => {
 const formatted = formatTimestamp(timestamp);
 return `[${formatted}]`;
 });
 };

 // âœ… VALIDACIONES DEFENSIVAS
 const safeResult = {
 percentage: result?.percentage ?? 0,
 totalScore: result?.totalScore ?? 0,
 maxPossibleScore: result?.maxPossibleScore ?? 0,
 detailedScores: Array.isArray(result?.detailedScores) ? result.detailedScores : [],
 observations: result?.observations ?? 'Sin observaciones',
 recommendations: Array.isArray(result?.recommendations) ? result.recommendations : [],
 keyMoments: Array.isArray(result?.keyMoments) ? result.keyMoments : [],
 transcript: result?.transcript ?? '',
 audioConfidence: result?.audioConfidence
 };

 const getAudioQualityLabel = (confidence: number) => {
 if (confidence >= 90) return { label: 'Excelente', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
 if (confidence >= 75) return { label: 'Buena', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
 if (confidence >= 60) return { label: 'Moderada', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
 return { label: 'Baja', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
 };

 // ── Cálculos en tiempo real con ediciones ──────────────────────────
 const currentScores = safeResult.detailedScores.map((s: any, i: number) => ({
 ...s,
 score: scoreEdits[i] !== undefined ? scoreEdits[i] : (s.score ?? 0)
 }));

 const currentTotal = currentScores.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0);
 const currentMax = currentScores.reduce((sum: number, s: any) => sum + (s.maxScore ?? 0), 0);
 const rawPercentage = currentMax > 0 ? (currentTotal / currentMax) * 100 : 0;

 // Reevaluar fallo crítico con ediciones actuales
 const criticalFailed = currentScores.filter((s: any) => s.criticality === 'Crítico' && (s.score ?? 0) === 0);
 const hasCriticalFailure = criticalFailed.length > 0;
 const currentPercentage = hasCriticalFailure ? 0 : rawPercentage;

 // Porcentaje exclusivo de criterios críticos
 const criticalOnly = currentScores.filter((s: any) => s.criticality === 'Crítico' && typeof s.maxScore === 'number' && s.maxScore > 0);
 const criticalTotalScore = criticalOnly.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0);
 const criticalMaxScore = criticalOnly.reduce((sum: number, s: any) => sum + s.maxScore, 0);
 const criticalPercentage = criticalMaxScore > 0 ? (criticalTotalScore / criticalMaxScore) * 100 : null;

 const hasEdits = Object.keys(scoreEdits).length > 0;

 // Helpers de edición
 const startEdit = (idx: number, currentScore: number) => {
 setEditingIndex(idx);
 setEditInputValue(String(currentScore));
 };

 const cancelEdit = () => {
 setEditingIndex(null);
 setEditInputValue('');
 };

 const confirmEdit = (idx: number, maxScore: number) => {
 const parsed = parseInt(editInputValue, 10);
 if (!isNaN(parsed) && parsed >= 0 && parsed <= maxScore) {
 setScoreEdits(prev => ({ ...prev, [idx]: parsed }));
 }
 setEditingIndex(null);
 setEditInputValue('');
 };

 const discardEdits = () => {
 setScoreEdits({});
 setEditingIndex(null);
 setEditInputValue('');
 };

 const saveEdits = async () => {
 if (!auditId || !hasEdits) return;
 setIsSaving(true);
 try {
 const updatedScores = currentScores.map((s: any) => ({
 criterion: s.criterion,
 score: s.score,
 maxScore: s.maxScore,
 observations: s.observations,
 criticality: s.criticality || '-'
 }));
 await auditService.updateAuditScores(auditId, updatedScores);
 setScoreEdits({});
 toast.success('Puntajes guardados correctamente');
 } catch {
 toast.error('Error al guardar los puntajes');
 } finally {
 setIsSaving(false);
 }
 };
 // ────────────────────────────────────────────────────────────────────

 const scoreBadge = getScoreBadge(currentPercentage);

 // âœ… Agrupar scores por bloque de forma segura (usando currentScores para incluir ediciones)
 const scoresByBlock = currentScores.reduce((acc: Record<string, any[]>, score: any, globalIdx: number) => {
 if (!score || !score.criterion) return acc;
 const match = score.criterion.match(/\[(.*?)\]/);
 const block = match ? match[1] : 'Otros';
 if (!acc[block]) acc[block] = [];
 acc[block].push({ ...score, _globalIndex: globalIdx });
 return acc;
 }, {} as Record<string, any[]>);

 return (
 <div className="space-y-6 animate-fadeIn">
 {/* Header con Score Principal */}
 <div className="card-highlight relative overflow-hidden">
 <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
 
 <div className="relative">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-4">
 <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
 <Award className="w-8 h-8 text-white" />
 </div>
 <div>
 <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
 Resultados de Evaluación
 </h1>
 <div className="flex items-center gap-3 mt-1">
 <p className="text-slate-400">Análisis completado exitosamente</p>
 {callType && (
 (callType || '').toUpperCase() === 'MONITOREO' ? (
 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
 <Monitor className="w-3.5 h-3.5" />
 Monitoreo
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
 <PhoneIncoming className="w-3.5 h-3.5" />
 Inbound
 </span>
 )
 )}
 </div>
 </div>
 </div>
 </div>
 
 <div className="text-center md:text-right">
 <div className="mb-3">
 <div className={`text-7xl font-bold ${getScoreColor(currentPercentage)} drop-shadow-glow transition-all duration-300`}>
 {currentPercentage.toFixed(1)}%
 </div>
 <div className="flex items-center justify-center md:justify-end gap-2 mt-2 flex-wrap">
 <span className={`badge ${scoreBadge.class} text-base px-4 py-1.5`}>
 {scoreBadge.icon} {scoreBadge.text}
 </span>
 {hasCriticalFailure && (
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
 <ShieldAlert className="w-4 h-4" />
 Criterio Crítico en 0
 </span>
 )}
 {hasEdits && (
 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
 <Pencil className="w-3 h-3" />
 Modificado
 </span>
 )}
 </div>
 </div>
 <div className="text-slate-400 mb-2">
 <span className="text-2xl font-bold text-white">{currentTotal}</span>
 <span className="text-lg"> / {currentMax}</span>
 <span className="text-sm ml-1">puntos</span>
 </div>
 {criticalPercentage !== null && (
 <div className={`text-sm font-semibold ${criticalPercentage === 0 ? 'text-red-400' : criticalPercentage >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
 <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
 Críticos: {criticalPercentage.toFixed(1)}%
 </div>
 )}
 </div>
 </div>

 {/* Progress Bar */}
 <div className="mt-6">
 <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden">
 <div
 className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getScoreGradient(currentPercentage)} rounded-full transition-all duration-500 shadow-glow`}
 style={{ width: `${Math.max(0, Math.min(100, currentPercentage))}%` }}
 >
 <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex flex-wrap gap-3 mt-6">
 <button onClick={onDownload} className="btn-success flex items-center gap-2">
 <Download className="w-4 h-4" />
 Descargar Excel
 </button>
 <button onClick={onNewAudit} className="btn-secondary flex items-center gap-2">
 <Sparkles className="w-4 h-4" />
 Nueva Auditoría
 </button>
 {hasEdits && auditId && (
 <>
 <button
 onClick={saveEdits}
 disabled={isSaving}
 className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
 >
 <Save className="w-4 h-4" />
 {isSaving ? 'Guardando...' : 'Guardar cambios'}
 </button>
 <button
 onClick={discardEdits}
 disabled={isSaving}
 className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all duration-200 disabled:opacity-60"
 >
 <RotateCcw className="w-4 h-4" />
 Descartar
 </button>
 </>
 )}
 </div>
 </div>
 </div>

 {/* Alerta de baja calidad de audio */}
 {safeResult.audioConfidence !== undefined && safeResult.audioConfidence > 0 && safeResult.audioConfidence < 70 && (
 <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mt-4">
 <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
 <p className="text-amber-300 text-sm">
 La calidad del audio puede haber afectado esta evaluación (confianza de transcripción: {safeResult.audioConfidence.toFixed(1)}%). Se recomienda revisión manual.
 </p>
 </div>
 )}

 {/* Banner de fallo crítico */}
 {hasCriticalFailure && (
 <div className="flex items-start gap-4 p-4 bg-red-950/30 border border-red-500/40 rounded-xl">
 <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
 <div>
 <p className="text-red-300 font-bold mb-1">Fallo en criterio(s) crítico(s) — Resultado: 0%</p>
 <p className="text-red-400/80 text-sm">
 Los siguientes criterios críticos tienen 0 puntos:{' '}
 <span className="font-semibold text-red-300">
 {criticalFailed.map((s: any) => s.criterion.replace(/\[.*?\]\s*/, '')).join(', ')}
 </span>
 </p>
 <p className="text-red-400/60 text-xs mt-1">Puedes editar los puntajes manualmente si es necesario.</p>
 </div>
 </div>
 )}

 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Criterios Evaluados</span>
 <Target className="w-5 h-5 text-blue-400" />
 </div>
 <div className="text-3xl font-bold text-white">{safeResult.detailedScores.length}</div>
 <div className="text-xs text-slate-500 mt-1">Total de ítems</div>
 </div>

 {criticalPercentage !== null && (
 <div className={`stat-card border ${hasCriticalFailure ? 'border-red-500/40 bg-red-950/10' : 'border-slate-700/50'}`}>
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">% Críticos</span>
 <ShieldAlert className={`w-5 h-5 ${hasCriticalFailure ? 'text-red-400' : 'text-green-400'}`} />
 </div>
 <div className={`text-3xl font-bold ${hasCriticalFailure ? 'text-red-400' : criticalPercentage >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
 {criticalPercentage.toFixed(1)}%
 </div>
 <div className="text-xs text-slate-500 mt-1">{criticalOnly.length} criterios críticos</div>
 </div>
 )}

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Recomendaciones</span>
 <TrendingUp className="w-5 h-5 text-green-400" />
 </div>
 <div className="text-3xl font-bold text-white">{safeResult.recommendations.length}</div>
 <div className="text-xs text-slate-500 mt-1">Sugerencias de mejora</div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Momentos Clave</span>
 <Clock className="w-5 h-5 text-orange-400" />
 </div>
 <div className="text-3xl font-bold text-white">{safeResult.keyMoments.length}</div>
 <div className="text-xs text-slate-500 mt-1">Puntos destacados</div>
 </div>
 </div>

 {/* Scores Detallados */}
 <div className="card">
 <button 
 onClick={() => toggleSection('scores')}
 className="w-full flex items-center justify-between mb-6 group"
 >
 <h2 className="section-header mb-0">
 <Target className="w-6 h-6 text-blue-400" />
 Evaluación Detallada
 </h2>
 {expandedSections.scores ? (
 <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 ) : (
 <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 )}
 </button>
 
 {expandedSections.scores && (
 <div className="space-y-6">
 {Object.entries(scoresByBlock).map(([block, scores]) => (
 <div key={block} className="space-y-4">
 <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2 pb-2 border-b border-slate-800">
 <span className="p-1.5 bg-blue-500/10 rounded-lg">
 <Target className="w-4 h-4" />
 </span>
 {block}
 </h3>
 
 <div className="space-y-4">
 {scores.map((score: any) => {
 const globalIdx: number = score._globalIndex;
 const isCritical = score.criticality === 'Crítico';
 const isEdited = scoreEdits[globalIdx] !== undefined;
 const isCurrentlyEditing = editingIndex === globalIdx;

 const safeScore = {
 criterion: score?.criterion ?? 'Sin criterio',
 score: score?.score ?? 0,
 maxScore: score?.maxScore ?? 0,
 observations: score?.observations ?? score?.justification ?? 'Sin justificación disponible',
 evidence: Array.isArray(score?.evidence) ? score.evidence : [],
 criticality: score?.criticality || '-'
 };

 const percentage = safeScore.maxScore > 0
 ? Math.round((safeScore.score / safeScore.maxScore) * 100)
 : 0;

 const isCriticalZero = isCritical && safeScore.score === 0;

 return (
 <div
 key={globalIdx}
 className={`p-5 rounded-xl border transition-all duration-300 ${
 isCriticalZero
 ? 'bg-red-950/20 border-red-500/40 hover:border-red-400/60'
 : isEdited
 ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-400/50'
 : 'bg-slate-800/30 border-slate-700/50 hover:border-blue-500/30'
 }`}
 >
 {/* Cabecera: nombre + badges + botón editar */}
 <div className="flex items-start justify-between mb-3 gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <h4 className="text-base font-semibold text-white">
 {safeScore.criterion.replace(/\[.*?\]\s*/, '')}
 </h4>
 {isCritical && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex-shrink-0">
 <ShieldAlert className="w-3 h-3" />
 Crítico
 </span>
 )}
 {isEdited && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
 <Pencil className="w-3 h-3" />
 Editado
 </span>
 )}
 </div>

 {/* Puntaje: modo lectura o modo edición */}
 {isCurrentlyEditing ? (
 <div className="flex items-center gap-2 mt-2">
 <div className="flex flex-col gap-1.5">
 <div className="flex items-center gap-2">
 <input
 type="number"
 min={0}
 max={safeScore.maxScore}
 value={editInputValue}
 onChange={e => setEditInputValue(e.target.value)}
 onKeyDown={e => {
 if (e.key === 'Enter') confirmEdit(globalIdx, safeScore.maxScore);
 if (e.key === 'Escape') cancelEdit();
 }}
 autoFocus
 className="w-20 px-2 py-1 bg-slate-900 border border-blue-500 rounded-lg text-white text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 />
 <span className="text-slate-400 text-sm">/ {safeScore.maxScore}</span>
 <button
 onClick={() => confirmEdit(globalIdx, safeScore.maxScore)}
 className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
 title="Confirmar"
 >
 <Check className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={cancelEdit}
 className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
 title="Cancelar"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 <input
 type="range"
 min={0}
 max={safeScore.maxScore}
 value={parseInt(editInputValue) || 0}
 onChange={e => setEditInputValue(e.target.value)}
 className="w-40 accent-blue-500"
 />
 </div>
 </div>
 ) : (
 <div className="flex items-center gap-3 mt-1">
 <span className="text-sm text-slate-400">
 Puntos:{' '}
 <span className={`font-bold ${isCriticalZero ? 'text-red-400' : 'text-white'}`}>
 {safeScore.score}
 </span>
 /{safeScore.maxScore}
 </span>
 <span className={`text-sm font-bold ${
 percentage >= 80 ? 'text-green-400' :
 percentage >= 60 ? 'text-yellow-400' :
 'text-red-400'
 }`}>
 {percentage}%
 </span>
 </div>
 )}
 </div>

 {/* Botón editar (solo cuando no está en modo edición) */}
 {!isCurrentlyEditing && safeScore.maxScore > 0 && (
 <button
 onClick={() => startEdit(globalIdx, safeScore.score)}
 className="flex-shrink-0 p-2 rounded-lg bg-slate-700/50 hover:bg-blue-600/30 hover:text-blue-300 text-slate-400 transition-all duration-200 border border-transparent hover:border-blue-500/40"
 title="Editar puntaje"
 >
 <Pencil className="w-4 h-4" />
 </button>
 )}
 </div>

 {/* Alerta crítico en cero */}
 {isCriticalZero && (
 <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
 <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
 <p className="text-xs text-red-300 font-semibold">
 Criterio crítico con 0 puntos — el resultado global es 0%
 </p>
 </div>
 )}

 {/* Progress bar */}
 {!isCurrentlyEditing && (
 <div className="mb-3">
 <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
 <div
 className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
 percentage >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
 percentage >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
 'bg-gradient-to-r from-red-500 to-red-700'
 }`}
 style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
 />
 </div>
 </div>
 )}

 {/* Justificación */}
 <div className="mb-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800">
 <p className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
 <FileText className="w-4 h-4" />
 Justificación:
 </p>
 <p className="text-slate-300 leading-relaxed">{safeScore.observations}</p>
 </div>

 {/* Evidencia (si existe) */}
 {safeScore.evidence.length > 0 && (
 <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
 <p className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4" />
 Evidencia:
 </p>
 <ul className="space-y-1.5">
 {safeScore.evidence.map((ev: string, i: number) => (
 <li key={i} className="text-sm text-slate-400 flex items-start gap-2 leading-relaxed">
 <span className="text-blue-400 mt-1 flex-shrink-0">â–¸</span>
 <span>{ev}</span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Observaciones */}
 <div className="card">
 <button 
 onClick={() => toggleSection('observations')}
 className="w-full flex items-center justify-between mb-6 group"
 >
 <h2 className="section-header mb-0">
 <FileText className="w-6 h-6 text-purple-400" />
 Observaciones Generales
 </h2>
 {expandedSections.observations ? (
 <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 ) : (
 <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 )}
 </button>
 
 {expandedSections.observations && (
 <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
 <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
 {safeResult.observations}
 </p>
 </div>
 )}
 </div>

 {/* Recomendaciones */}
 <div className="card">
 <button 
 onClick={() => toggleSection('recommendations')}
 className="w-full flex items-center justify-between mb-6 group"
 >
 <h2 className="section-header mb-0">
 <TrendingUp className="w-6 h-6 text-green-400" />
 Recomendaciones
 </h2>
 {expandedSections.recommendations ? (
 <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 ) : (
 <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 )}
 </button>
 
 {expandedSections.recommendations && (
 <div className="space-y-3">
 {safeResult.recommendations.length > 0 ? (
 safeResult.recommendations.map((rec, index) => (
 <div 
 key={index} 
 className="flex items-start gap-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl hover:border-green-500/40 transition-all duration-300"
 >
 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30">
 <span className="text-sm font-bold text-green-400">{index + 1}</span>
 </div>
 <p className="text-slate-200 flex-1 leading-relaxed pt-0.5">{rec}</p>
 </div>
 ))
 ) : (
 <div className="p-6 text-center text-slate-400">
 No hay recomendaciones disponibles
 </div>
 )}
 </div>
 )}
 </div>

 {/* Momentos Clave */}
 {safeResult.keyMoments.length > 0 && (
 <div className="card">
 <button 
 onClick={() => toggleSection('keyMoments')}
 className="w-full flex items-center justify-between mb-6 group"
 >
 <h2 className="section-header mb-0">
 <Clock className="w-6 h-6 text-orange-400" />
 Momentos Clave de la Llamada
 </h2>
 {expandedSections.keyMoments ? (
 <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 ) : (
 <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 )}
 </button>
 
 {expandedSections.keyMoments && (
 <div className="space-y-3">
 {safeResult.keyMoments.map((moment, index) => {
 // âœ… Validación defensiva para cada momento
 const safeMoment = {
 timestamp: moment?.timestamp ?? '00:00',
 impact: moment?.impact ?? moment?.type ?? 'neutral',
 event: moment?.event ?? moment?.type ?? 'Sin título',
 description: moment?.description ?? 'Sin descripción'
 };

 return (
 <div 
 key={index} 
 className="flex items-start gap-4 p-5 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300"
 >
 <div className="flex items-center gap-3 flex-shrink-0">
 <span className="font-mono text-blue-400 text-base font-bold px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/30">
 {formatTimestamp(safeMoment.timestamp)}
 </span>
 {getImpactIcon(safeMoment.impact)}
 </div>
 <div className="flex-1">
 <p className="font-semibold text-white mb-1">{safeMoment.event}</p>
 <p className="text-sm text-slate-400 leading-relaxed">{safeMoment.description}</p>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* Transcripción */}
 <div className="card">
 <button
 onClick={() => toggleSection('transcript')}
 className="w-full flex items-center justify-between mb-6 group"
 >
 <div className="flex items-center gap-3">
 <h2 className="section-header mb-0">
 <FileText className="w-6 h-6 text-slate-400" />
 Transcripción Completa
 </h2>
 {safeResult.audioConfidence !== undefined && safeResult.audioConfidence > 0 && (() => {
 const q = getAudioQualityLabel(safeResult.audioConfidence!);
 return (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${q.cls}`}>
 Calidad de audio: {safeResult.audioConfidence!.toFixed(1)}% — {q.label}
 </span>
 );
 })()}
 </div>
 {expandedSections.transcript ? (
 <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 ) : (
 <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
 )}
 </button>
 
 {expandedSections.transcript && (
 <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800 max-h-[600px] overflow-y-auto">
 <p className="text-slate-300 whitespace-pre-wrap leading-relaxed font-mono text-sm">
 {formatTranscript(safeResult.transcript)}
 </p>
 </div>
 )}
 </div>
 </div>
 );
}