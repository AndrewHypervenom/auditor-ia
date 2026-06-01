// frontend/src/pages/ScriptsAdminPage.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  BookOpen,
  ClipboardList,
  Table,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  AlertTriangle,
  Save,
  RotateCcw,
  BarChart2,
  ListChecks,
  Loader2,
  Brain,
  Volume2,
  Monitor,
  PhoneCall,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  CreditCard,
  Sparkles,
  Info,
  Wand2,
  BarChart,
  Eye,
  RefreshCw,
  ImageIcon,
} from 'lucide-react';
import {
  scriptsService,
  criteriaService,
  plantillaService,
  promptsService,
  wordBoostService,
  imageSystemsService,
  callTypesConfigService,
  binesService,
  gpfService,
  type ScriptStep,
  type CriteriaBlock,
  type CriteriaItem,
  type CriteriaItemOverride,
  type AiPrompt,
  type WordBoostTerm,
  type ImageSystem,
  type ImageSystemField,
  type CallTypeConfig,
  type BinesItem,
  type GeneratedBlock,
  type GeneratedCriterion,
  type GpfAttention,
} from '../services/api';
import PlantillaGPFTab from '../components/PlantillaGPFTab';
import ModeSelector, { type AdminMode } from '../components/ModeSelector';
import CallTypeSelectorShared from '../components/CallTypeSelector';
import { useCallTypesConfig } from '../hooks/useCallTypesConfig';

// ─── Subcalificaciones fijas por tipo de llamada ────────────────────────────

const SUBCALIFICACIONES_POR_CALL_TYPE: Record<string, string[]> = {
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

function getSubcalificacionesForCallType(callType: string): string[] {
  const upper = callType.toUpperCase();
  for (const [key, list] of Object.entries(SUBCALIFICACIONES_POR_CALL_TYPE)) {
    if (upper.includes(key)) return list;
  }
  return [];
}

// ─── Helpers ────────────────────────────────────────────────

function groupByCallType<T extends { call_type: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = item.call_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ─── Componente principal ────────────────────────────────────

export default function ScriptsAdminPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'scripts' | 'criteria' | 'plantilla' | 'ai_prompts' | 'bines'>('criteria');

  const allTabs = [
    {
      key: 'criteria' as const,
      icon: ClipboardList,
      label: 'Criterios de Evaluación',
      description: 'Rúbricas y ponderaciones',
      color: 'purple',
    },
    {
      key: 'scripts' as const,
      icon: BookOpen,
      label: 'Scripts de Agentes',
      description: 'Guiones y frases por paso',
      color: 'blue',
    },
    {
      key: 'plantilla' as const,
      icon: Table,
      label: 'Plantilla Cierre de GPF',
      description: 'Calificación y Sub-calificación',
      color: 'teal',
    },
    {
      key: 'ai_prompts' as const,
      icon: Brain,
      label: 'Comportamiento IA',
      description: 'Prompts de análisis y evaluación',
      color: 'amber',
      adminOnly: true,
    },
    {
      key: 'bines' as const,
      icon: CreditCard,
      label: 'Bines',
      description: 'Referencia BINs bancarios',
      color: 'rose',
    },
  ];

  const visibleTabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="min-h-screen text-white">
      <AppHeader showBack onBack={() => navigate('/dashboard')} title="Criterios, Scripts y Plantilla GPF" />
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ── Description ── */}
        <p className="mb-4 text-sm text-slate-400 leading-relaxed">
          Configura todo lo que define cómo opera el sistema: criterios de calificación, scripts de agentes, plantilla de cierre GPF{isAdmin ? ' y el comportamiento de la IA' : ''}.
        </p>


        {/* ── Tab Selector ── */}
        <div className={`grid gap-3 mb-5 ${visibleTabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {visibleTabs.map(({ key, icon: Icon, label, description, color }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`group relative flex items-center gap-4 px-5 py-4 rounded-2xl border
                            text-left transition-all duration-300 overflow-hidden
                            ${isActive
                              ? color === 'blue'
                                ? 'bg-brand-500/10 border-brand-700/40 shadow-[0_0_24px_rgba(59,130,246,0.12)]'
                                : color === 'teal'
                                ? 'bg-teal-600/10 border-teal-500/40 shadow-[0_0_24px_rgba(20,184,166,0.12)]'
                                : color === 'amber'
                                ? 'bg-amber-600/10 border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.12)]'
                                : color === 'rose'
                                ? 'bg-rose-600/10 border-rose-500/40 shadow-[0_0_24px_rgba(244,63,94,0.12)]'
                                : 'bg-violet-600/10 border-violet-500/40 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
                              : 'bg-slate-900/50 border-slate-800/60 hover:bg-slate-900/80 hover:border-slate-700/60'
                            }`}
              >
                {/* Glow de fondo al estar activo */}
                {isActive && (
                  <div className={`absolute inset-0 opacity-5 pointer-events-none
                    ${color === 'blue'
                      ? 'bg-gradient-to-br from-brand-900/30 to-brand-800/30'
                      : color === 'teal'
                      ? 'bg-gradient-to-br from-teal-400 to-teal-600'
                      : color === 'amber'
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                      : color === 'rose'
                      ? 'bg-gradient-to-br from-rose-400 to-rose-600'
                      : 'bg-gradient-to-br from-violet-400 to-violet-600'
                    }`}
                  />
                )}

                {/* Icono con fondo */}
                <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                                 transition-all duration-300
                                 ${isActive
                                   ? color === 'blue'
                                     ? 'bg-brand-500/10 border border-brand-700/40'
                                     : color === 'teal'
                                     ? 'bg-teal-500/20 border border-teal-500/30'
                                     : color === 'amber'
                                     ? 'bg-amber-500/20 border border-amber-500/30'
                                     : color === 'rose'
                                     ? 'bg-rose-500/20 border border-rose-500/30'
                                     : 'bg-violet-500/20 border border-violet-500/30'
                                   : 'bg-slate-800/60 border border-slate-700/40 group-hover:bg-slate-800'
                                 }`}>
                  <Icon
                    size={18}
                    className={`transition-colors duration-300
                      ${isActive
                        ? color === 'blue' ? 'text-brand-400' : color === 'teal' ? 'text-teal-400' : color === 'amber' ? 'text-amber-400' : color === 'rose' ? 'text-rose-400' : 'text-violet-400'
                        : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                  />
                </div>

                {/* Texto */}
                <div className="relative flex flex-col min-w-0">
                  <span className={`text-sm font-semibold transition-colors duration-200 truncate
                    ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    {label}
                  </span>
                  <span className={`text-xs mt-0.5 transition-colors duration-200 truncate
                    ${isActive
                      ? color === 'blue' ? 'text-brand-400/70' : color === 'teal' ? 'text-teal-400/70' : color === 'amber' ? 'text-amber-400/70' : color === 'rose' ? 'text-rose-400/70' : 'text-violet-400/70'
                      : 'text-slate-600 group-hover:text-slate-500'
                    }`}>
                    {description}
                  </span>
                </div>

                {/* Indicador activo (punto derecho) */}
                {isActive && (
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full
                    ${color === 'blue' ? 'bg-brand-500/10' : color === 'teal' ? 'bg-teal-400' : color === 'amber' ? 'bg-amber-400' : color === 'rose' ? 'bg-rose-400' : 'bg-violet-400'}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div key={activeTab} className="animate-fadeIn">
          {activeTab === 'scripts'
            ? <ScriptsTabWrapper />
            : activeTab === 'criteria'
            ? <CriteriaTabWrapper />
            : activeTab === 'ai_prompts'
            ? <AiPromptsTab />
            : activeTab === 'bines'
            ? <BinesAdminTab />
            : <PlantillaTabWrapper />
          }
        </div>

      </div>
    </div>
  );
}


// ─── Tab: Scripts ────────────────────────────────────────────

function ScriptsTab() {
  const [scripts, setScripts] = useState<ScriptStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  const { callTypeNames: availableCallTypes } = useCallTypesConfig();

  // Setear el primer callType disponible cuando cargue desde BD
  useEffect(() => {
    if (availableCallTypes.length > 0 && !selectedCallType) {
      setSelectedCallType(availableCallTypes[0]);
    }
  }, [availableCallTypes, selectedCallType]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scriptsService.getAll();
      setScripts(data);
    } catch {
      toast.error('Error al cargar scripts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = groupByCallType(scripts.filter((s) => s.mode === mode));
  const currentSteps = (grouped[selectedCallType] || []).sort((a, b) => a.step_order - b.step_order);

  const handleAddStep = async () => {
    const newOrder = currentSteps.length > 0
      ? Math.max(...currentSteps.map((s) => s.step_order)) + 1
      : 1;
    try {
      await scriptsService.create({
        call_type: selectedCallType,
        mode,
        step_key: `paso_${newOrder}`,
        step_label: 'Nuevo paso',
        step_order: newOrder,
        lines: ['Nueva frase del script'],
      });
      toast.success('Paso agregado');
      load();
    } catch {
      toast.error('Error al agregar paso');
    }
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div>
      {/* Selector de modo */}
      <div className="mb-4">
        <ModeSelector selected={mode} onChange={setMode} />
      </div>

      {/* Selector de call type */}
      <div className="mb-4">
        <CallTypeSelectorShared selected={selectedCallType} onChange={setSelectedCallType} />
      </div>

      <div className="space-y-3">
        {currentSteps.map((step) => (
          <ScriptStepCard
            key={step.id}
            step={step}
            onUpdate={load}
            totalSteps={currentSteps.length}
          />
        ))}

        {currentSteps.length === 0 && (
          <EmptyState
            icon={<BookOpen size={28} className="text-slate-600" />}
            title="Sin pasos definidos"
            description={`Agrega el primer paso para ${selectedCallType}`}
          />
        )}

        <AddButton onClick={handleAddStep} label="Agregar paso" />
      </div>
    </div>
  );
}

// ─── Card de un paso del script ───────────────────────────────

interface ScriptStepCardProps {
  step: ScriptStep;
  onUpdate: () => void;
  totalSteps: number;
}

function ScriptStepCard({ step, onUpdate, totalSteps }: ScriptStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(step.step_label);
  const [lines, setLines] = useState<string[]>(step.lines);
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [lineValue, setLineValue] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (newLines?: string[], newLabel?: string) => {
    setSaving(true);
    try {
      await scriptsService.update(step.id, {
        step_label: newLabel ?? labelValue,
        lines: newLines ?? lines,
      });
      toast.success('Guardado');
      onUpdate();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveUp = async () => {
    if (step.step_order <= 1) return;
    await scriptsService.update(step.id, { step_order: step.step_order - 1 });
    onUpdate();
  };

  const handleMoveDown = async () => {
    if (step.step_order >= totalSteps) return;
    await scriptsService.update(step.id, { step_order: step.step_order + 1 });
    onUpdate();
  };

  const handleDeleteStep = async () => {
    if (!confirm(`¿Eliminar el paso "${step.step_label}"? También se eliminarán todas sus frases.`)) return;
    try {
      await scriptsService.remove(step.id);
      toast.success('Paso eliminado');
      onUpdate();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleSaveLabel = async () => {
    setEditingLabel(false);
    await save(undefined, labelValue);
  };

  const handleAddLine = () => {
    const newLines = [...lines, 'Nueva frase'];
    setLines(newLines);
    setEditingLineIdx(newLines.length - 1);
    setLineValue('Nueva frase');
  };

  const handleEditLine = (idx: number) => {
    setEditingLineIdx(idx);
    setLineValue(lines[idx]);
  };

  const handleSaveLine = async () => {
    if (editingLineIdx === null) return;
    const newLines = lines.map((l, i) => (i === editingLineIdx ? lineValue : l));
    setLines(newLines);
    setEditingLineIdx(null);
    await save(newLines);
  };

  const handleDeleteLine = async (idx: number) => {
    const newLines = lines.filter((_, i) => i !== idx);
    setLines(newLines);
    await save(newLines);
  };

  const handleMoveLine = async (idx: number, dir: 'up' | 'down') => {
    const newLines = [...lines];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= newLines.length) return;
    [newLines[idx], newLines[swap]] = [newLines[swap], newLines[idx]];
    setLines(newLines);
    await save(newLines);
  };

  return (
    <div
      className="group bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden
                 transition-all duration-300 hover:border-slate-700/60 hover:bg-slate-900/80"
      data-state={expanded ? 'open' : 'closed'}
    >
      {/* ── Header del paso ── */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => !editingLabel && setExpanded(!expanded)}
      >
        {/* Número de paso */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand-900/30 to-brand-800/30
                        border border-brand-700/40 text-brand-300 text-sm font-bold
                        flex items-center justify-center tabular-nums">
          {step.step_order}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          {editingLabel ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveLabel();
                  if (e.key === 'Escape') { setEditingLabel(false); setLabelValue(step.step_label); }
                }}
                className="flex-1 bg-slate-800/80 border border-slate-600/60 rounded-xl px-3 py-1.5
                           text-sm text-white focus:outline-none focus:border-brand-700/60"
                onClick={(e) => e.stopPropagation()}
              />
              <button onClick={handleSaveLabel} className="p-1.5 text-green-400 hover:text-green-300 transition-colors">
                <Check size={15} />
              </button>
              <button
                onClick={() => { setEditingLabel(false); setLabelValue(step.step_label); }}
                className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <span className="font-semibold text-white text-[15px] truncate block">{step.step_label}</span>
          )}
        </div>

        {/* Badge frases */}
        <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40
                         text-slate-400 text-xs tabular-nums">
          {lines.length} {lines.length === 1 ? 'frase' : 'frases'}
        </span>

        {/* Acciones (hover) */}
        <div
          className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleMoveUp}
            disabled={step.step_order <= 1}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-700/50
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            title="Subir"
          >
            <ChevronDown size={14} className="rotate-180" />
          </button>
          <button
            onClick={handleMoveDown}
            disabled={step.step_order >= totalSteps}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-700/50
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            title="Bajar"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={() => setEditingLabel(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-brand-400 hover:bg-brand-500/10
                       transition-all duration-150"
            title="Renombrar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDeleteStep}
            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10
                       transition-all duration-150"
            title="Eliminar paso"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Chevron */}
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* ── Frases expandibles ── */}
      <div className="expand-content border-t border-slate-800/60">
        <div className="px-5 py-4 space-y-2">
          {saving && (
            <p className="flex items-center gap-2 text-xs text-brand-400/80 mb-3">
              <Loader2 size={12} className="animate-spin" />
              Guardando...
            </p>
          )}

          {lines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-3 group/line">
              {/* Número de frase */}
              <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-lg bg-slate-800/60
                               text-slate-500 text-[11px] font-medium flex items-center justify-center tabular-nums">
                {idx + 1}
              </span>

              {editingLineIdx === idx ? (
                <div className="flex-1 flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={lineValue}
                    onChange={(e) => setLineValue(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900/80 border border-brand-700/40 rounded-xl px-3 py-2
                               text-sm text-white resize-none focus:outline-none focus:border-brand-700/60"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveLine}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/10
                                 border border-brand-700/40 text-brand-300 text-xs font-medium
                                 hover:bg-brand-500/30 transition-all duration-150"
                    >
                      <Check size={12} /> Guardar
                    </button>
                    <button
                      onClick={() => setEditingLineIdx(null)}
                      className="px-3 py-1.5 rounded-xl text-slate-400 text-xs font-medium
                                 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-150"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-300 leading-relaxed">{line}</p>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/line:opacity-100
                                  transition-opacity duration-150 flex-shrink-0">
                    <button
                      onClick={() => handleMoveLine(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50
                                 disabled:opacity-30 transition-all duration-150"
                    >
                      <ChevronDown size={12} className="rotate-180" />
                    </button>
                    <button
                      onClick={() => handleMoveLine(idx, 'down')}
                      disabled={idx === lines.length - 1}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50
                                 disabled:opacity-30 transition-all duration-150"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={() => handleEditLine(idx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10
                                 transition-all duration-150"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteLine(idx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10
                                 transition-all duration-150"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Agregar frase */}
          <button
            onClick={handleAddLine}
            className="flex items-center gap-2 mt-3 w-full px-4 py-2.5 rounded-xl
                       border border-dashed border-slate-700/60 text-slate-500
                       hover:text-slate-300 hover:border-slate-600 hover:bg-slate-800/30
                       transition-all duration-200 text-sm"
          >
            <Plus size={14} />
            Agregar frase
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Criterios ──────────────────────────────────────────

function CriteriaTab() {
  const [blocks, setBlocks] = useState<CriteriaBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const { callTypeNames: availableCallTypes } = useCallTypesConfig();

  // Setear el primer callType disponible cuando cargue desde BD
  useEffect(() => {
    if (availableCallTypes.length > 0 && !selectedCallType) {
      setSelectedCallType(availableCallTypes[0]);
    }
  }, [availableCallTypes, selectedCallType]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await criteriaService.getAll();
      setBlocks(data);
    } catch {
      toast.error('Error al cargar criterios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = groupByCallType(blocks.filter((b) => b.mode === mode));
  const currentBlocks = (grouped[selectedCallType] || []).sort((a, b) => a.block_order - b.block_order);

  const totalPoints = currentBlocks.reduce((sum, block) => {
    const blockPts = (block.criteria || [])
      .filter((c) => c.applies && c.points !== null)
      .reduce((s, c) => s + (c.points ?? 0), 0);
    return sum + blockPts;
  }, 0);

  const criticalCount = currentBlocks.reduce((sum, block) => {
    return sum + (block.criteria || []).filter((c) => c.criticality === 'Crítico' && c.applies).length;
  }, 0);

  const totalCriteria = currentBlocks.reduce((sum, block) => {
    return sum + (block.criteria || []).filter((c) => c.applies).length;
  }, 0);

  const handleAddBlock = async () => {
    const newOrder = currentBlocks.length > 0
      ? Math.max(...currentBlocks.map((b) => b.block_order)) + 1
      : 1;
    try {
      await criteriaService.createBlock({
        call_type: selectedCallType,
        mode,
        block_name: 'Nuevo bloque',
        block_order: newOrder,
      });
      toast.success('Bloque agregado');
      load();
    } catch {
      toast.error('Error al agregar bloque');
    }
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div>
      {/* Selector de modo */}
      <div className="mb-4">
        <ModeSelector selected={mode} onChange={setMode} />
      </div>

      {/* Selector de call type + Stat Chips + Botón IA */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <CallTypeSelectorShared selected={selectedCallType} onChange={setSelectedCallType} />

        <div className="flex items-center gap-2 flex-wrap">
          <StatChip icon={BarChart2} label={`${totalPoints} pts`} color="blue" />
          <StatChip icon={AlertTriangle} label={`${criticalCount} críticos`} color="red" />
          <StatChip icon={ListChecks} label={`${totalCriteria} criterios`} color="green" />
          <button
            onClick={() => setShowAiGenerator(true)}
            disabled={!selectedCallType}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                       bg-purple-500/15 border border-purple-500/30 text-purple-300
                       hover:bg-purple-500/25 disabled:opacity-40 transition-all duration-150"
          >
            <Wand2 size={12} />
            Generar con IA
          </button>
        </div>
      </div>

      {showAiGenerator && selectedCallType && (
        <AiCriteriaGeneratorDrawer
          callType={selectedCallType}
          mode={mode}
          onClose={() => setShowAiGenerator(false)}
          onImported={() => { load(); setShowAiGenerator(false); }}
        />
      )}

      <div className="space-y-3">
        {currentBlocks.map((block) => (
          <CriteriaBlockCard key={block.id} block={block} onUpdate={load} />
        ))}

        {currentBlocks.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={28} className="text-slate-600" />}
            title="Sin bloques definidos"
            description={`Agrega el primer bloque de criterios para ${selectedCallType}`}
          />
        )}

        <AddButton onClick={handleAddBlock} label="Agregar bloque" />
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────

interface StatChipProps {
  icon: React.ElementType;
  label: string;
  color: 'blue' | 'red' | 'green';
}

const colorMap = {
  blue: 'bg-brand-500/10 border-brand-700/20 text-brand-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-400',
  green: 'bg-green-500/10 border-green-500/20 text-green-400',
};

function StatChip({ icon: Icon, label, color }: StatChipProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium tabular-nums ${colorMap[color]}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

// ─── Card de un bloque de criterios ──────────────────────────

interface CriteriaBlockCardProps {
  block: CriteriaBlock;
  onUpdate: () => void;
}

function CriteriaBlockCard({ block, onUpdate }: CriteriaBlockCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(block.block_name);
  const [drawerCriteria, setDrawerCriteria] = useState<CriteriaItem | null>(null);
  const availableTipoCierres = getSubcalificacionesForCallType(block.call_type);
  const [selectedTipoCierre, setSelectedTipoCierre] = useState<string | null>(null);

  const criteria = (block.criteria || []).sort((a, b) => a.criteria_order - b.criteria_order);
  const blockPoints = criteria.filter((c) => c.applies && c.points !== null).reduce((s, c) => s + (c.points ?? 0), 0);
  const criticalCount = criteria.filter((c) => c.criticality === 'Crítico' && c.applies).length;
  const appliedCount = criteria.filter((c) => c.applies).length;

  const handleSaveBlock = async () => {
    setEditingName(false);
    try {
      await criteriaService.updateBlock(block.id, { block_name: nameValue });
      toast.success('Bloque actualizado');
      onUpdate();
    } catch {
      toast.error('Error al actualizar bloque');
      setNameValue(block.block_name);
    }
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setNameValue(block.block_name);
  };

  const handleDeleteBlock = async () => {
    if (!confirm(`¿Eliminar el bloque "${block.block_name}" y todos sus criterios?`)) return;
    try {
      await criteriaService.removeBlock(block.id);
      toast.success('Bloque eliminado');
      onUpdate();
    } catch {
      toast.error('Error al eliminar bloque');
    }
  };

  const handleAddCriteria = async () => {
    const newOrder = criteria.length > 0 ? Math.max(...criteria.map((c) => c.criteria_order)) + 1 : 1;
    try {
      const newItem = await criteriaService.createCriteria({
        block_id: block.id,
        topic: 'Nuevo criterio',
        criticality: '-',
        points: 5,
        applies: true,
        requires_manual_review: false,
        what_to_look_for: '',
        validation_source: [],
        criteria_order: newOrder,
      });
      onUpdate();
      setDrawerCriteria(newItem);
    } catch {
      toast.error('Error al agregar criterio');
    }
  };

  return (
    <div
      className="group bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden
                 transition-all duration-300 hover:border-slate-700/60 hover:bg-slate-900/80"
      data-state={expanded ? 'open' : 'closed'}
    >
      {/* ── Header del bloque ── */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => !editingName && setExpanded(!expanded)}
      >
        {/* Nombre + subcalificaciones */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          {editingName ? (
            <div className="space-y-3 py-0.5">
              {/* Fila nombre */}
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveBlock();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 bg-slate-800/80 border border-slate-600/60 rounded-xl px-3 py-1.5
                             text-sm text-white focus:outline-none focus:border-brand-700/60"
                />
                <button onClick={handleSaveBlock} className="p-1.5 text-green-400 hover:text-green-300 transition-colors">
                  <Check size={15} />
                </button>
                <button onClick={handleCancelEdit} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <span className="font-semibold text-white text-[15px] truncate block">{block.block_name}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                           bg-brand-500/10 border border-brand-700/15 text-brand-300 text-xs font-semibold tabular-nums">
            <BarChart2 size={10} />
            {blockPoints} pts
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                             bg-red-500/10 border border-red-500/15 text-red-300 text-xs font-medium">
              <AlertTriangle size={10} />
              {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-slate-500 text-xs tabular-nums">{appliedCount} criterios</span>
        </div>

        {/* Acciones (hover) */}
        <div
          className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setEditingName(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-brand-400 hover:bg-brand-500/10
                       transition-all duration-150"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDeleteBlock}
            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10
                       transition-all duration-150"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Chevron */}
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* ── Tabla de criterios ── */}
      <div className="expand-content border-t border-slate-800/60">

        {/* Selector de subcalificación — tabs visuales */}
        {availableTipoCierres.length > 0 && (
          <div className="px-5 pt-3 pb-3 border-b border-slate-800/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mr-1 flex-shrink-0">
                Subcalificación
              </span>
              <button
                onClick={() => setSelectedTipoCierre(null)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                  selectedTipoCierre === null
                    ? 'bg-slate-700/60 border-slate-600/60 text-slate-200'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                Base
              </button>
              {availableTipoCierres.map(tc => {
                const isSelected = selectedTipoCierre === tc;
                const hasOverride = criteria.some(c => c.tipo_cierre_overrides?.[tc]);
                return (
                  <button
                    key={tc}
                    onClick={() => setSelectedTipoCierre(isSelected ? null : tc)}
                    title={hasOverride ? 'Tiene configuración personalizada' : 'Sin configuración específica — usa la base'}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                        : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {tc}
                    {hasOverride && (
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-teal-400' : 'bg-teal-600'}`} />
                    )}
                  </button>
                );
              })}
            </div>
            {selectedTipoCierre && (
              <p className="text-[11px] text-teal-400/80 mt-2">
                Configuración específica para: <strong className="text-teal-400">{selectedTipoCierre}</strong>
              </p>
            )}
          </div>
        )}

        {criteria.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-sm">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Criterio
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-16">
                    Pts
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-24">
                    Criticidad
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-16">
                    Activo
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-amber-600/70 w-24">
                    Rev. Manual
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-32">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <CriteriaViewRow
                    key={c.id}
                    item={c}
                    selectedTipoCierre={selectedTipoCierre}
                    onEdit={() => setDrawerCriteria(c)}
                    onUpdate={onUpdate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-4">
          <button
            onClick={handleAddCriteria}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-400 transition-colors duration-150"
          >
            <Plus size={14} />
            Agregar criterio
          </button>
        </div>
      </div>
      {drawerCriteria && (
        <CriteriaEditDrawer
          item={drawerCriteria}
          selectedTipoCierre={selectedTipoCierre}
          blockCallType={block.call_type}
          onSave={() => { onUpdate(); setDrawerCriteria(null); }}
          onClose={() => setDrawerCriteria(null)}
        />
      )}
    </div>
  );
}

// ─── Fila de criterio (vista) ─────────────────────────────────

interface CriteriaRowProps {
  item: CriteriaItem;
  onEdit: () => void;
  onUpdate: () => void;
  selectedTipoCierre: string | null;
}

function getOverrideValue<K extends keyof CriteriaItemOverride>(
  item: CriteriaItem,
  tipoCierre: string | null,
  field: K,
  base: CriteriaItemOverride[K]
): CriteriaItemOverride[K] {
  if (!tipoCierre) return base;
  const ov = item.tipo_cierre_overrides?.[tipoCierre];
  return ov && ov[field] !== undefined ? ov[field] : base;
}

function CriteriaViewRow({ item, onEdit, onUpdate, selectedTipoCierre }: CriteriaRowProps) {
  const [wtlfExpanded, setWtlfExpanded] = useState(false);

  const effectiveApplies = getOverrideValue(item, selectedTipoCierre, 'applies', item.applies)!;
  const effectiveWtlf = getOverrideValue(item, selectedTipoCierre, 'what_to_look_for', item.what_to_look_for);
  const effectiveValidation = getOverrideValue(item, selectedTipoCierre, 'validation_source', item.validation_source);
  const effectiveManual = getOverrideValue(item, selectedTipoCierre, 'requires_manual_review', item.requires_manual_review)!;
  const hasOverride = selectedTipoCierre && !!item.tipo_cierre_overrides?.[selectedTipoCierre];

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el criterio "${item.topic}"?`)) return;
    try {
      await criteriaService.removeCriteria(item.id);
      toast.success('Criterio eliminado');
      onUpdate();
    } catch {
      toast.error('Error al eliminar criterio');
    }
  };

  const handleToggleApplies = async () => {
    try {
      if (selectedTipoCierre) {
        const ov = { ...(item.tipo_cierre_overrides || {}), [selectedTipoCierre]: { ...(item.tipo_cierre_overrides?.[selectedTipoCierre] || {}), applies: !effectiveApplies } };
        await criteriaService.updateCriteria(item.id, { tipo_cierre_overrides: ov });
      } else {
        await criteriaService.updateCriteria(item.id, { applies: !item.applies });
      }
      onUpdate();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleToggleManualReview = async () => {
    try {
      if (selectedTipoCierre) {
        const ov = { ...(item.tipo_cierre_overrides || {}), [selectedTipoCierre]: { ...(item.tipo_cierre_overrides?.[selectedTipoCierre] || {}), requires_manual_review: !effectiveManual } };
        await criteriaService.updateCriteria(item.id, { tipo_cierre_overrides: ov });
      } else {
        await criteriaService.updateCriteria(item.id, { requires_manual_review: !item.requires_manual_review });
      }
      onUpdate();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  return (
    <tr className="border-b border-slate-800/40 hover:bg-slate-800/20 group transition-colors duration-150">
      {/* Criterio */}
      <td className="py-3 px-4 max-w-xs">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-[14px] leading-snug ${effectiveApplies ? 'text-slate-200' : 'line-through text-slate-500'}`}>
              {item.topic}
            </span>
            {hasOverride && (
              <span className="relative group/sbadge flex-shrink-0">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold
                                 bg-teal-500/15 border border-teal-500/25 text-teal-400 cursor-default">
                  S
                </span>
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5
                                 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium
                                 bg-slate-800 border border-slate-700/60 text-slate-200 shadow-lg
                                 opacity-0 group-hover/sbadge:opacity-100 transition-opacity duration-150 z-50">
                  Config. específica para <strong className="text-teal-400">{selectedTipoCierre}</strong>
                  <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
                                   border-x-4 border-x-transparent border-t-4 border-t-slate-700/60" />
                </span>
              </span>
            )}
          </div>
          {effectiveWtlf && (
            <div className="flex flex-col gap-0.5">
              <span className={`text-[12px] text-slate-500 leading-relaxed ${wtlfExpanded ? '' : 'line-clamp-2'}`}>
                {effectiveWtlf}
              </span>
              {effectiveWtlf.length > 80 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setWtlfExpanded(v => !v); }}
                  className="self-start text-[11px] text-slate-600 hover:text-slate-400 transition-colors duration-150 flex items-center gap-0.5"
                >
                  <ChevronDown size={11} className={`transition-transform duration-200 ${wtlfExpanded ? 'rotate-180' : ''}`} />
                  {wtlfExpanded ? 'Ver menos' : 'Ver más'}
                </button>
              )}
            </div>
          )}
          {effectiveValidation && effectiveValidation.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {effectiveValidation.map(src => {
                const isSpecificImg = src.startsWith('imagenes:');
                const label = src === 'gpf' ? 'GPF' : src === 'llamada' ? 'Llamada' : isSpecificImg ? src.slice(9) : 'Imágenes';
                const color = src === 'gpf'
                  ? 'bg-blue-900/40 text-blue-300 border-blue-700/40'
                  : src === 'llamada'
                  ? 'bg-amber-900/40 text-amber-300 border-amber-700/40'
                  : 'bg-brand-900/40 text-brand-300 border-brand-700/40';
                return (
                  <span key={src} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${color}`}>
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </td>

      {/* Puntos */}
      <td className="py-3 px-3 text-center">
        {item.points === null ? (
          <span className="text-slate-600 text-xs">—</span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-700/15
                           text-brand-300 text-xs font-semibold tabular-nums">
            {item.points}
          </span>
        )}
      </td>

      {/* Criticidad */}
      <td className="py-3 px-3 text-center">
        {item.criticality === 'Crítico' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                           bg-red-500/10 border border-red-500/15 text-red-300 text-xs font-medium">
            <AlertTriangle size={10} />
            Crítico
          </span>
        ) : (
          <span className="text-slate-700 text-sm">—</span>
        )}
      </td>

      {/* Toggle Aplica (iOS style) */}
      <td className="py-3 px-3 text-center">
        <button
          onClick={handleToggleApplies}
          title={effectiveApplies ? 'Deshabilitar' : 'Habilitar'}
          className="toggle-track mx-auto"
          style={{ backgroundColor: effectiveApplies ? 'rgba(59,130,246,0.5)' : '' }}
        >
          <span
            className="toggle-thumb"
            style={{
              transform: effectiveApplies ? 'translateX(16px)' : 'translateX(2px)',
              backgroundColor: effectiveApplies ? '#fff' : '#64748b',
            }}
          />
        </button>
      </td>

      {/* Toggle Validación Manual */}
      <td className="py-3 px-3 text-center">
        <button
          onClick={handleToggleManualReview}
          title={effectiveManual ? 'Quitar validación manual' : 'Marcar como validación manual'}
          className="toggle-track mx-auto"
          style={{ backgroundColor: effectiveManual ? 'rgba(245,158,11,0.5)' : '' }}
        >
          <span
            className="toggle-thumb"
            style={{
              transform: effectiveManual ? 'translateX(16px)' : 'translateX(2px)',
              backgroundColor: effectiveManual ? '#fff' : '#64748b',
            }}
          />
        </button>
      </td>

      {/* Acciones */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500
                       hover:text-brand-400 hover:bg-brand-500/10 text-xs font-medium
                       transition-all duration-150"
          >
            <Pencil size={11} />
            Configurar
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10
                       transition-all duration-150"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Fila de criterio (edición) ───────────────────────────────

interface CriteriaEditRowProps {
  item: CriteriaItem;
  onSave: () => void;
  onCancel: () => void;
  selectedTipoCierre: string | null;
}

function CriteriaEditRow({ item, onSave, onCancel, selectedTipoCierre }: CriteriaEditRowProps) {
  const existingOverride = selectedTipoCierre ? item.tipo_cierre_overrides?.[selectedTipoCierre] : undefined;
  const isSubcalMode = !!selectedTipoCierre;

  const [topic, setTopic] = useState(item.topic);
  const [points, setPoints] = useState<string>(item.points === null ? 'n/a' : String(item.points));
  const [criticality, setCriticality] = useState<'Crítico' | '-'>(item.criticality);
  const [applies, setApplies] = useState(
    existingOverride?.applies !== undefined ? existingOverride.applies : item.applies
  );
  const [whatToLookFor, setWhatToLookFor] = useState(
    existingOverride?.what_to_look_for !== undefined ? (existingOverride.what_to_look_for || '') : (item.what_to_look_for || '')
  );
  const [validationSource, setValidationSource] = useState<string[]>(
    existingOverride?.validation_source !== undefined ? (existingOverride.validation_source ?? []) : (item.validation_source ?? [])
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isSubcalMode) {
        const newOverrides = {
          ...(item.tipo_cierre_overrides || {}),
          [selectedTipoCierre!]: { applies, what_to_look_for: whatToLookFor, validation_source: validationSource },
        };
        await criteriaService.updateCriteria(item.id, { tipo_cierre_overrides: newOverrides });
      } else {
        await criteriaService.updateCriteria(item.id, {
          topic,
          criticality,
          points: points === 'n/a' ? null : parseInt(points, 10),
          applies,
          what_to_look_for: whatToLookFor,
          validation_source: validationSource,
        });
      }
      toast.success('Criterio actualizado');
      onSave();
    } catch {
      toast.error('Error al guardar criterio');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOverride = async () => {
    if (!selectedTipoCierre) return;
    setSaving(true);
    try {
      const newOverrides = { ...(item.tipo_cierre_overrides || {}) };
      delete newOverrides[selectedTipoCierre];
      await criteriaService.updateCriteria(item.id, { tipo_cierre_overrides: newOverrides });
      toast.success('Configuración reseteada a base');
      onSave();
    } catch {
      toast.error('Error al resetear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-brand-700/20 bg-brand-500/10 animate-fadeIn">
      <td className="py-4 px-4" colSpan={6}>
        <div className="space-y-4">

          {/* Banner de subcalificación */}
          {isSubcalMode && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl
                            bg-teal-500/10 border border-teal-500/20">
              <span className="text-xs text-teal-300 font-medium">
                Configurando para subcalificación: <strong>{selectedTipoCierre}</strong>
                {existingOverride
                  ? ' · Tiene configuración específica'
                  : ' · Usando configuración base'}
              </span>
              {existingOverride && (
                <button
                  type="button"
                  onClick={handleResetOverride}
                  disabled={saving}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={11} />
                  Resetear a base
                </button>
              )}
            </div>
          )}

          {/* Campos base (solo cuando no hay subcalificación seleccionada) */}
          {!isSubcalMode && (
            <>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  Criterio (tema)
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2
                             text-sm text-white resize-none focus:outline-none focus:border-brand-700/60
                             focus:ring-1 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                    Puntos (o "n/a")
                  </label>
                  <input
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="5 o n/a"
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2
                               text-sm text-white focus:outline-none focus:border-brand-700/60
                               focus:ring-1 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                    Criticidad
                  </label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value as 'Crítico' | '-')}
                    className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2
                               text-sm text-white focus:outline-none focus:border-brand-700/60"
                  >
                    <option value="-">—</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Aplica (siempre visible, editable también por subcalificación) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setApplies(!applies)}
              className="toggle-track"
              style={{ backgroundColor: applies ? 'rgba(59,130,246,0.5)' : 'rgba(51,65,85,0.8)' }}
            >
              <span
                className="toggle-thumb"
                style={{
                  transform: applies ? 'translateX(16px)' : 'translateX(2px)',
                  backgroundColor: applies ? '#fff' : '#64748b',
                }}
              />
            </button>
            <span className="text-sm text-slate-300 font-medium">Aplica{isSubcalMode ? ` para ${selectedTipoCierre}` : ''}</span>
          </div>

          {/* Qué buscar */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Qué buscar (instrucciones para la IA){isSubcalMode ? ` — ${selectedTipoCierre}` : ''}
            </label>
            <textarea
              value={whatToLookFor}
              onChange={(e) => setWhatToLookFor(e.target.value)}
              rows={6}
              placeholder="Describe dónde y qué debe buscar la IA para evaluar este criterio..."
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2
                         text-sm text-white resize-y focus:outline-none focus:border-brand-700/60
                         focus:ring-1 focus:ring-brand-500/20"
            />
          </div>

          {/* Validar en */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Validar en
            </label>
            <div className="flex gap-4">
              {(['gpf', 'imagenes', 'llamada'] as const).map(src => (
                <label key={src} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={validationSource.includes(src)}
                    onChange={e =>
                      setValidationSource(prev =>
                        e.target.checked ? [...prev, src] : prev.filter(s => s !== src)
                      )
                    }
                    className="accent-brand-500 w-3.5 h-3.5"
                  />
                  <span className={`text-sm font-medium ${
                    src === 'gpf' ? 'text-blue-300' : src === 'imagenes' ? 'text-brand-300' : 'text-amber-300'
                  }`}>
                    {src === 'gpf' ? 'GPF' : src === 'imagenes' ? 'Imágenes' : 'Llamada'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500/10
                         border border-brand-700/40 text-brand-300 text-sm font-medium
                         hover:bg-brand-500/30 disabled:opacity-50 transition-all duration-150"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-slate-400 text-sm font-medium
                         hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-50
                         transition-all duration-150"
            >
              Cancelar
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── ImageAnalyticsBanner ────────────────────────────────────

interface ImageAnalyticsItem {
  system_name: string;
  count: number;
  avg_confidence: number;
  last_seen: string | null;
}

interface ImageAnalyticsBannerProps {
  onQuickEdit: (systemName: string) => void;
}

// Nombres genéricos que no son sistemas reales — se filtran del banner
const NOISE_SYSTEM_NAMES = new Set(['multiple', 'desconocido', 'unknown', 'none', 'n/a', '', 'null']);

function ImageAnalyticsBanner({ onQuickEdit }: ImageAnalyticsBannerProps) {
  const [data, setData] = useState<ImageAnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    imageSystemsService.getAnalytics()
      .then(raw => {
        // Filtrar sistemas genéricos/ruido, normalizar confidence
        const clean = raw
          .filter(d => !NOISE_SYSTEM_NAMES.has(d.system_name?.toLowerCase?.() ?? ''))
          .map(d => ({
            ...d,
            // La confianza puede venir como 0–1 o como 0–100; si avg < 1.5 asumimos escala 0–1
            avg_confidence: d.avg_confidence > 1.5 ? d.avg_confidence / 100 : d.avg_confidence,
          }));
        setData(clean);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="animate-pulse h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl mb-4" />
  );
  if (data.length === 0) return null;

  const maxCount = data[0]?.count || 1;

  return (
    <div className="mb-4 bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
            <BarChart size={12} className="text-purple-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200">Sistemas más usados en auditorías</span>
          <span className="text-xs text-slate-500">({data.length} detectados)</span>
        </div>
        <ChevronDown size={15} className={`text-slate-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <div className="px-5 pb-4 animate-fadeIn">
          <div className="space-y-2.5">
            {data.slice(0, 8).map((item) => {
              const pct = Math.max(4, Math.round((item.count / maxCount) * 100));
              // Confianza: si es 0 o muy baja, mostrar "Sin dato" en lugar de 0%
              const confPct = Math.round(item.avg_confidence * 100);
              const hasConf = confPct > 0;
              return (
                <div key={item.system_name} className="group/bar flex items-center gap-3">
                  {/* Nombre */}
                  <div className="w-24 flex-shrink-0 text-right">
                    <span className="text-xs font-mono font-bold text-purple-300">{item.system_name}</span>
                  </div>
                  {/* Barra */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-6 bg-slate-800/60 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500/40 to-purple-400/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      >
                        <span className="text-[10px] font-bold text-purple-200">{item.count}×</span>
                      </div>
                    </div>
                    {/* Confianza */}
                    <span className={`text-[10px] font-medium w-10 flex-shrink-0 ${!hasConf ? 'text-slate-600' : confPct >= 80 ? 'text-green-400' : confPct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {hasConf ? `${confPct}%` : '—'}
                    </span>
                  </div>
                  {/* Acciones (aparecen en hover) */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => onQuickEdit(item.system_name)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
                                 text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 border border-transparent
                                 hover:border-brand-700/20 transition-all duration-150"
                    >
                      <Pencil size={10} />
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {data.length > 8 && (
            <p className="text-[11px] text-slate-600 mt-3 text-center">+{data.length - 8} sistemas más</p>
          )}
          <p className="text-[10px] text-slate-700 mt-3">
            Basado en las últimas auditorías completadas · Confianza = qué tan segura está la IA de su detección
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AiCriteriaGeneratorDrawer ────────────────────────────────

interface AiCriteriaGeneratorDrawerProps {
  callType: string;
  mode: string;
  onClose: () => void;
  onImported: () => void;
}

function AiCriteriaGeneratorDrawer({ callType, mode, onClose, onImported }: AiCriteriaGeneratorDrawerProps) {
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<GeneratedBlock[]>([]);
  const [selected, setSelected] = useState<Record<string, Record<number, boolean>>>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');

  // GPF category picker
  const [gpfOpen, setGpfOpen] = useState(false);
  const [gpfLoading, setGpfLoading] = useState(false);
  const [gpfEnv, setGpfEnv] = useState<'test' | 'prod'>('prod');
  const [gpfCategories, setGpfCategories] = useState<Array<{ calificacion: string; subcalificacion: string; count: number }>>([]);
  const [gpfTotal, setGpfTotal] = useState(0);
  const [gpfError, setGpfError] = useState('');

  const fetchGpfCategories = async () => {
    setGpfLoading(true);
    setGpfError('');
    setGpfCategories([]);
    try {
      const { categories, total_attentions } = await gpfService.getCategories(gpfEnv);
      setGpfCategories(categories);
      setGpfTotal(total_attentions);
    } catch (e: any) {
      setGpfError(e?.response?.data?.error || 'Error al conectar con GPF');
    } finally {
      setGpfLoading(false);
    }
  };

  const applyGpfCategory = (cat: { calificacion: string; subcalificacion: string }) => {
    const parts = [cat.calificacion, cat.subcalificacion].filter(Boolean);
    setDescription(prev => {
      const prefix = `Tipo de llamada: ${parts.join(' / ')}\n\n`;
      return prev.startsWith('Tipo de llamada:') ? prev : prefix + prev;
    });
    setGpfOpen(false);
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setPreview([]);
    setSelected({});
    try {
      const { blocks } = await criteriaService.generateBlocks({ description: description.trim(), call_type: callType, mode });
      setPreview(blocks);
      const sel: Record<string, Record<number, boolean>> = {};
      blocks.forEach((b, bi) => {
        sel[bi] = {};
        b.criteria.forEach((_, ci) => { sel[bi][ci] = true; });
      });
      setSelected(sel);
    } catch {
      toast.error('Error al generar criterios');
    } finally {
      setGenerating(false);
    }
  };

  const toggleCriterion = (bi: number, ci: number) => {
    setSelected(prev => ({ ...prev, [bi]: { ...prev[bi], [ci]: !prev[bi]?.[ci] } }));
  };

  const toggleBlock = (bi: number) => {
    const allOn = preview[bi].criteria.every((_, ci) => selected[bi]?.[ci]);
    setSelected(prev => {
      const next = { ...prev[bi] };
      preview[bi].criteria.forEach((_, ci) => { next[ci] = !allOn; });
      return { ...prev, [bi]: next };
    });
  };

  const selectedCount = preview.reduce((sum, _, bi) =>
    sum + (preview[bi]?.criteria?.filter((_, ci) => selected[bi]?.[ci]).length || 0), 0);

  const handleImport = async () => {
    setImporting(true);
    let blockOrder = 1;
    try {
      for (let bi = 0; bi < preview.length; bi++) {
        const block = preview[bi];
        const selectedCriteria = block.criteria.filter((_, ci) => selected[bi]?.[ci]);
        if (selectedCriteria.length === 0) continue;
        setImportProgress(`Creando bloque "${block.block_name}"...`);
        const newBlock = await criteriaService.createBlock({
          call_type: callType, mode, block_name: block.block_name, block_order: blockOrder++,
        });
        for (let ci = 0; ci < selectedCriteria.length; ci++) {
          const c = selectedCriteria[ci];
          setImportProgress(`Importando criterio ${ci + 1}/${selectedCriteria.length} de "${block.block_name}"...`);
          await criteriaService.createCriteria({
            block_id: newBlock.id,
            topic: c.topic,
            criticality: (c.criticality === 'Crítico' ? 'Crítico' : '-') as 'Crítico' | '-',
            points: c.points,
            applies: c.applies !== false,
            requires_manual_review: false,
            what_to_look_for: c.what_to_look_for || '',
            validation_source: c.validation_source || [],
            criteria_order: ci + 1,
          });
        }
      }
      toast.success(`✅ ${selectedCount} criterios importados correctamente`);
      onImported();
      onClose();
    } catch {
      toast.error('Error al importar criterios');
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const sourceChip = (src: string) => {
    const isImg = src === 'imagenes' || src.startsWith('imagenes:');
    const label = src === 'gpf' ? 'GPF' : src === 'llamada' ? 'Llamada' : src.startsWith('imagenes:') ? src.slice(9) : 'Imgs';
    const color = src === 'gpf' ? 'bg-blue-500/15 text-blue-300 border-blue-500/20'
      : src === 'llamada' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
      : 'bg-brand-500/15 text-brand-300 border-brand-700/20';
    return <span key={src} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>{label}</span>;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-[560px] max-w-[calc(100vw-2rem)]
                      bg-slate-950 border-l border-slate-800/60 z-50 flex flex-col
                      overflow-hidden animate-slideFromRight shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <Wand2 size={15} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Generar criterios con IA</h2>
              <p className="text-[11px] text-slate-500">{callType} · {mode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/60 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Panel GPF — buscar categorías */}
          <div className="px-6 pt-5 pb-0">
            <button
              type="button"
              onClick={() => setGpfOpen(!gpfOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl
                         bg-teal-500/8 border border-teal-500/20 hover:bg-teal-500/12
                         transition-all duration-150 group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
                  <Eye size={12} className="text-teal-400" />
                </div>
                <span className="text-sm font-semibold text-teal-300">Buscar categorías en GPF</span>
                <span className="text-[11px] text-teal-500/70">Importa directamente desde casos reales</span>
              </div>
              <ChevronDown size={14} className={`text-teal-500 transition-transform duration-200 ${gpfOpen ? 'rotate-180' : ''}`} />
            </button>

            {gpfOpen && (
              <div className="mt-2 mb-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/50 animate-fadeIn space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-slate-700/60 overflow-hidden text-xs">
                    {(['prod', 'test'] as const).map(env => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setGpfEnv(env)}
                        className={`px-3 py-1.5 font-medium transition-colors duration-100 ${
                          gpfEnv === env
                            ? 'bg-teal-500/20 text-teal-300'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {env === 'prod' ? 'Producción' : 'Pruebas'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={fetchGpfCategories}
                    disabled={gpfLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15
                               border border-teal-500/25 text-teal-300 text-xs font-medium
                               hover:bg-teal-500/25 disabled:opacity-50 transition-all duration-150"
                  >
                    {gpfLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {gpfLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                  {gpfTotal > 0 && (
                    <span className="text-[11px] text-slate-500">{gpfTotal} casos analizados</span>
                  )}
                </div>

                {gpfError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {gpfError}
                  </p>
                )}

                {gpfCategories.length > 0 && (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {gpfCategories.map((cat, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyGpfCategory(cat)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                   bg-slate-800/50 border border-slate-700/40 hover:border-teal-500/30
                                   hover:bg-teal-500/8 transition-all duration-150 text-left group/cat"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-200 block truncate">{cat.calificacion}</span>
                          {cat.subcalificacion && (
                            <span className="text-[11px] text-teal-400/80 block truncate">{cat.subcalificacion}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-slate-500 tabular-nums">{cat.count} casos</span>
                          <span className="text-[10px] font-medium text-teal-400 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                            Usar →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!gpfLoading && gpfCategories.length === 0 && !gpfError && (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Haz clic en "Buscar" para cargar las categorías disponibles en GPF
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div className="px-6 py-5 border-b border-slate-800/40">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
              ¿Qué debe evaluar este tipo de llamada?
              <InfoTooltip text="Describe en tus palabras qué hace el agente en este tipo de llamada y qué quieres verificar." />
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder={`Ej: En llamadas de ${callType} el agente debe verificar la identidad del cliente, revisar las transacciones sospechosas en FALCON y VCAS, bloquear la tarjeta si hay fraude confirmado, crear un folio de bonificación y explicar el proceso al cliente...`}
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3.5 py-3
                         text-sm text-white resize-none focus:outline-none focus:border-purple-600/60
                         focus:ring-1 focus:ring-purple-500/20 placeholder:text-slate-600 transition-colors"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-purple-500/15 border border-purple-500/30 text-purple-300 text-sm font-semibold
                         hover:bg-purple-500/25 disabled:opacity-50 transition-all duration-150"
            >
              {generating
                ? <><Loader2 size={14} className="animate-spin" /> Analizando y generando criterios...</>
                : <><Wand2 size={14} /> Generar criterios con IA</>}
            </button>
          </div>

          {/* Preview de criterios generados */}
          {preview.length > 0 && (
            <div className="px-6 py-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">
                  Vista previa — {preview.length} bloques generados
                </p>
                <span className="text-xs text-slate-500">{selectedCount} criterios seleccionados</span>
              </div>

              {preview.map((block, bi) => {
                const blockSelectedCount = block.criteria.filter((_, ci) => selected[bi]?.[ci]).length;
                const allBlockSelected = blockSelectedCount === block.criteria.length;
                return (
                  <div key={bi} className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    {/* Block header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 bg-slate-900/60">
                      <input
                        type="checkbox"
                        checked={allBlockSelected}
                        onChange={() => toggleBlock(bi)}
                        className="w-3.5 h-3.5 accent-purple-500 cursor-pointer"
                      />
                      <span className="flex-1 text-sm font-semibold text-white">{block.block_name}</span>
                      <span className="text-xs text-slate-500">{blockSelectedCount}/{block.criteria.length} criterios</span>
                    </div>
                    {/* Criteria list */}
                    <div className="divide-y divide-slate-800/40">
                      {block.criteria.map((c, ci) => {
                        const isOn = selected[bi]?.[ci] ?? true;
                        return (
                          <div
                            key={ci}
                            onClick={() => toggleCriterion(bi, ci)}
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${
                              isOn ? 'hover:bg-slate-800/20' : 'opacity-40 hover:opacity-60 hover:bg-slate-800/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => toggleCriterion(bi, ci)}
                              onClick={e => e.stopPropagation()}
                              className="w-3.5 h-3.5 accent-purple-500 cursor-pointer mt-0.5 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 flex-wrap">
                                <span className={`text-sm leading-snug ${isOn ? 'text-slate-200' : 'text-slate-500'}`}>{c.topic}</span>
                                {c.criticality === 'Crítico' && (
                                  <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-red-300">CRÍTICO</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {c.points !== null && c.points !== undefined && (
                                  <span className="text-[10px] font-semibold text-brand-400">{c.points} pts</span>
                                )}
                                {(c.validation_source || []).map(s => sourceChip(s))}
                              </div>
                              {c.what_to_look_for && (
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{c.what_to_look_for}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {preview.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-800/60 space-y-2">
            {importing && importProgress && (
              <p className="text-xs text-purple-400 text-center animate-pulse">{importProgress}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                           bg-purple-500/20 border border-purple-500/40 text-purple-200 text-sm font-semibold
                           hover:bg-purple-500/30 disabled:opacity-50 transition-all duration-150"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {importing ? 'Importando...' : `Importar ${selectedCount} criterios`}
              </button>
              <button
                onClick={() => { setPreview([]); setDescription(''); }}
                disabled={importing}
                className="px-4 py-2.5 rounded-xl text-slate-400 text-sm hover:text-white hover:bg-slate-800/60 transition-all disabled:opacity-50"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── InfoTooltip ─────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center cursor-help">
      <Info size={13} className="text-slate-600 group-hover/tip:text-slate-400 transition-colors" />
      <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2
                       w-52 whitespace-normal rounded-xl px-3 py-2 text-[11px] leading-relaxed
                       bg-slate-900 border border-slate-700/60 text-slate-300 shadow-xl
                       opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-[60]">
        {text}
      </span>
    </span>
  );
}

// ─── AiPromptAssistant ────────────────────────────────────────

interface AiPromptAssistantProps {
  currentTopic: string;
  callType: string;
  onUse: (generated: string) => void;
}

function AiPromptAssistant({ currentTopic, callType, onUse }: AiPromptAssistantProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setResult('');
    try {
      const { prompt } = await criteriaService.generatePrompt({
        description: description.trim(),
        topic: currentTopic,
        call_type: callType,
      });
      setResult(prompt);
    } catch {
      toast.error('Error al generar instrucción con IA');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-400 transition-colors duration-150"
      >
        <Sparkles size={12} />
        {open ? 'Ocultar asistente' : 'Generar con IA'}
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 p-4 rounded-xl bg-slate-900/60 border border-slate-700/40 animate-fadeIn space-y-3">
          <p className="text-xs text-slate-400">
            Describe en tus propias palabras qué debe verificar la IA y generamos la instrucción técnica.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Ej: El agente debe verificar que la cuenta aparezca como bloqueada en el sistema VCAS..."
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2
                       text-xs text-white resize-none focus:outline-none focus:border-brand-600/60
                       placeholder:text-slate-600 transition-colors"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/15
                       border border-brand-700/30 text-brand-300 text-xs font-medium
                       hover:bg-brand-500/25 disabled:opacity-50 transition-all duration-150"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? 'Generando...' : 'Generar instrucción'}
          </button>

          {result && (
            <div className="animate-fadeIn space-y-2">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Instrucción generada</p>
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-3.5 py-3">
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{result}</p>
              </div>
              <button
                type="button"
                onClick={() => { onUse(result); setOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-green-500/15 border border-green-500/25 text-green-300 text-xs font-medium
                           hover:bg-green-500/25 transition-all duration-150"
              >
                <Check size={12} />
                Usar esta instrucción
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CriteriaEditDrawer ───────────────────────────────────────

interface CriteriaEditDrawerProps {
  item: CriteriaItem;
  selectedTipoCierre: string | null;
  blockCallType: string;
  onSave: () => void;
  onClose: () => void;
}

function CriteriaEditDrawer({ item, selectedTipoCierre, blockCallType, onSave, onClose }: CriteriaEditDrawerProps) {
  const existingOverride = selectedTipoCierre ? item.tipo_cierre_overrides?.[selectedTipoCierre] : undefined;
  const isSubcalMode = !!selectedTipoCierre;

  const [topic, setTopic] = useState(item.topic);
  const [points, setPoints] = useState<string>(item.points === null ? 'n/a' : String(item.points));
  const [criticality, setCriticality] = useState<'Crítico' | '-'>(item.criticality);
  const [applies, setApplies] = useState(
    existingOverride?.applies !== undefined ? existingOverride.applies : item.applies
  );
  const [whatToLookFor, setWhatToLookFor] = useState(
    existingOverride?.what_to_look_for !== undefined
      ? (existingOverride.what_to_look_for || '')
      : (item.what_to_look_for || '')
  );
  const [validationSource, setValidationSource] = useState<string[]>(
    existingOverride?.validation_source !== undefined
      ? (existingOverride.validation_source ?? [])
      : (item.validation_source ?? [])
  );
  const [saving, setSaving] = useState(false);
  const [availableImageSystems, setAvailableImageSystems] = useState<import('../services/api').ImageSystem[]>([]);

  useEffect(() => {
    imageSystemsService.getAll().then(sys => setAvailableImageSystems(sys.filter(s => s.is_active !== false)));
  }, []);

  const hasImages = validationSource.some(s => s === 'imagenes' || s.startsWith('imagenes:'));
  const specificSystems = validationSource.filter(s => s.startsWith('imagenes:')).map(s => s.slice(9));

  const toggleBaseSource = (src: 'gpf' | 'llamada') => {
    setValidationSource(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]);
  };

  const toggleImages = () => {
    if (hasImages) {
      setValidationSource(prev => prev.filter(s => s !== 'imagenes' && !s.startsWith('imagenes:')));
    } else {
      setValidationSource(prev => [...prev, 'imagenes']);
    }
  };

  const toggleImageSystem = (systemName: string) => {
    const key = `imagenes:${systemName}`;
    setValidationSource(prev => {
      const withoutGeneric = prev.filter(s => s !== 'imagenes');
      if (withoutGeneric.includes(key)) {
        const result = withoutGeneric.filter(s => s !== key);
        return result.some(s => s.startsWith('imagenes:')) ? result : [...result, 'imagenes'];
      }
      return [...withoutGeneric, key];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isSubcalMode) {
        const newOverrides = {
          ...(item.tipo_cierre_overrides || {}),
          [selectedTipoCierre!]: { applies, what_to_look_for: whatToLookFor, validation_source: validationSource },
        };
        await criteriaService.updateCriteria(item.id, { tipo_cierre_overrides: newOverrides });
      } else {
        await criteriaService.updateCriteria(item.id, {
          topic,
          criticality,
          points: points === 'n/a' ? null : parseInt(points, 10),
          applies,
          what_to_look_for: whatToLookFor,
          validation_source: validationSource,
        });
      }
      toast.success('Criterio actualizado');
      onSave();
    } catch {
      toast.error('Error al guardar criterio');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOverride = async () => {
    if (!selectedTipoCierre) return;
    setSaving(true);
    try {
      const newOverrides = { ...(item.tipo_cierre_overrides || {}) };
      delete newOverrides[selectedTipoCierre];
      await criteriaService.updateCriteria(item.id, { tipo_cierre_overrides: newOverrides });
      toast.success('Configuración reseteada a base');
      onSave();
    } catch {
      toast.error('Error al resetear');
    } finally {
      setSaving(false);
    }
  };


  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-screen w-[480px] max-w-[calc(100vw-2rem)]
                      bg-slate-950 border-l border-slate-800/60 z-50 flex flex-col
                      overflow-hidden animate-slideFromRight shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-700/20 flex items-center justify-center flex-shrink-0">
                <Pencil size={12} className="text-brand-400" />
              </div>
              <h2 className="text-white font-semibold text-sm">Configurar criterio</h2>
            </div>
            {isSubcalMode && (
              <div className="flex items-center gap-1.5 mt-1.5 ml-9">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                <p className="text-[11px] text-teal-400">Subcalificación: <strong>{selectedTipoCierre}</strong></p>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800/60 transition-all duration-150"
          >
            <X size={16} />
          </button>
        </div>

        {/* Override banner */}
        {isSubcalMode && existingOverride && (
          <div className="mx-6 mt-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl
                          bg-teal-500/10 border border-teal-500/20">
            <span className="text-xs text-teal-300">Configuración específica para <strong>{selectedTipoCierre}</strong></span>
            <button
              type="button"
              onClick={handleResetOverride}
              disabled={saving}
              className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw size={11} />
              Resetear a base
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ¿Qué verifica? */}
          {!isSubcalMode && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                ¿Qué verifica este criterio?
                <InfoTooltip text="Nombre o descripción del criterio. Define lo que el agente debe cumplir." />
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                placeholder="Ej: El agente verifica la identidad del cliente antes de dar información..."
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3.5 py-2.5
                           text-sm text-white resize-none focus:outline-none focus:border-brand-600/60
                           focus:ring-1 focus:ring-brand-500/20 placeholder:text-slate-600 transition-colors"
              />
            </div>
          )}

          {/* Puntos + Criticidad */}
          {!isSubcalMode && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                  Puntos
                  <InfoTooltip text="Valor en puntos de este criterio. Escribe 'n/a' si no tiene puntaje." />
                </label>
                <input
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="5 o n/a"
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3.5 py-2.5
                             text-sm text-white focus:outline-none focus:border-brand-600/60
                             focus:ring-1 focus:ring-brand-500/20 placeholder:text-slate-600 transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
                  ¿Es crítico?
                  <InfoTooltip text="Si falla un criterio crítico, la llamada puede reprobarse aunque el puntaje total sea alto." />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCriticality('Crítico')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-150 ${
                      criticality === 'Crítico'
                        ? 'bg-red-500/15 border-red-500/30 text-red-300'
                        : 'bg-slate-900/60 border-slate-700/60 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <AlertTriangle size={13} />
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriticality('-')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-150 ${
                      criticality === '-'
                        ? 'bg-slate-700/40 border-slate-600/40 text-slate-300'
                        : 'bg-slate-900/60 border-slate-700/60 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aplica */}
          <div
            onClick={() => setApplies(!applies)}
            className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              applies ? 'bg-blue-500/10 border-blue-500/20' : 'bg-slate-900/40 border-slate-800/60'
            }`}
          >
            <div className="pt-0.5 flex-shrink-0">
              <div
                className="toggle-track"
                style={{ backgroundColor: applies ? 'rgba(59,130,246,0.5)' : '' }}
              >
                <span
                  className="toggle-thumb"
                  style={{
                    transform: applies ? 'translateX(16px)' : 'translateX(2px)',
                    backgroundColor: applies ? '#fff' : '#64748b',
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-200">
                  {applies ? 'Aplica' : 'No aplica'}{isSubcalMode ? ` para ${selectedTipoCierre}` : ''}
                </p>
                <InfoTooltip text="Desactivado = la IA ignora este criterio en las auditorías automáticas." />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {applies ? 'La IA evaluará este criterio en las auditorías' : 'La IA ignorará este criterio'}
              </p>
            </div>
          </div>

          {/* Dónde verificar */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-3">
              ¿Dónde lo verifica la IA?
              <InfoTooltip text="Selecciona qué material debe revisar la IA para evaluar este criterio." />
            </label>
            <div className="flex gap-2">
              {/* GPF */}
              {(() => {
                const active = validationSource.includes('gpf');
                return (
                  <button type="button" onClick={() => toggleBaseSource('gpf')}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                      active ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-slate-900/60 border-slate-700/60 text-slate-500 hover:text-blue-300 hover:border-blue-500/20'
                    }`}>
                    <span className="text-sm font-bold">GPF</span>
                    <span className={`text-[10px] font-normal leading-tight ${active ? 'opacity-80' : 'opacity-50'}`}>Registro GPF</span>
                    {active && <Check size={12} className="mt-0.5" />}
                  </button>
                );
              })()}
              {/* Imágenes */}
              <button type="button" onClick={toggleImages}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                  hasImages ? 'bg-brand-500/15 border-brand-700/30 text-brand-300' : 'bg-slate-900/60 border-slate-700/60 text-slate-500 hover:text-brand-300 hover:border-brand-700/20'
                }`}>
                <span className="text-sm font-bold">Imágenes</span>
                <span className={`text-[10px] font-normal leading-tight text-center ${hasImages ? 'opacity-80' : 'opacity-50'}`}>
                  {specificSystems.length > 0 ? specificSystems.join(', ') : 'Capturas de pantalla'}
                </span>
                {hasImages && <Check size={12} className="mt-0.5" />}
              </button>
              {/* Llamada */}
              {(() => {
                const active = validationSource.includes('llamada');
                return (
                  <button type="button" onClick={() => toggleBaseSource('llamada')}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                      active ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-slate-900/60 border-slate-700/60 text-slate-500 hover:text-amber-300 hover:border-amber-500/20'
                    }`}>
                    <span className="text-sm font-bold">Llamada</span>
                    <span className={`text-[10px] font-normal leading-tight ${active ? 'opacity-80' : 'opacity-50'}`}>Transcripción audio</span>
                    {active && <Check size={12} className="mt-0.5" />}
                  </button>
                );
              })()}
            </div>

            {/* Sub-selector de sistemas de imagen */}
            {hasImages && availableImageSystems.length > 0 && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-900/60 border border-brand-700/20 animate-fadeIn">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">
                    ¿Qué imágenes verificar?
                  </p>
                  {specificSystems.length === 0 && (
                    <span className="text-[10px] text-slate-600">Sin selección = todas las imágenes</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableImageSystems.map(sys => {
                    const isSelected = specificSystems.includes(sys.system_name);
                    return (
                      <button
                        key={sys.id}
                        type="button"
                        onClick={() => toggleImageSystem(sys.system_name)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all duration-150 ${
                          isSelected
                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                            : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:text-purple-300 hover:border-purple-500/20'
                        }`}
                        title={sys.description}
                      >
                        {sys.system_name}
                        {isSelected && <Check size={10} />}
                      </button>
                    );
                  })}
                </div>
                {specificSystems.length > 0 && (
                  <p className="text-[10px] text-slate-600 mt-2">
                    La IA buscará evidencia específicamente en: <strong className="text-slate-500">{specificSystems.join(', ')}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Instrucción para la IA */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 mb-2">
              Instrucción para la IA
              <InfoTooltip text="Describe exactamente qué debe buscar la IA para decidir si el agente cumplió este criterio." />
            </label>
            <textarea
              value={whatToLookFor}
              onChange={(e) => setWhatToLookFor(e.target.value)}
              rows={6}
              placeholder="Ej: En la captura de VCAS, verifica que el campo Account State muestre el valor BLOCKED..."
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3.5 py-2.5
                         text-sm text-white resize-y focus:outline-none focus:border-brand-600/60
                         focus:ring-1 focus:ring-brand-500/20 placeholder:text-slate-600 transition-colors"
            />
            <AiPromptAssistant
              currentTopic={topic || item.topic}
              callType={blockCallType}
              onUse={(generated) => setWhatToLookFor(generated)}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/60 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                       bg-brand-500/15 border border-brand-700/30 text-brand-300 text-sm font-semibold
                       hover:bg-brand-500/25 disabled:opacity-50 transition-all duration-150"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 text-sm font-medium
                       hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-50
                       border border-transparent hover:border-slate-700/60 transition-all duration-150"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Empty State ─────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-3xl bg-slate-900/60 border border-slate-800/60
                      flex items-center justify-center">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-slate-400 font-medium">{title}</p>
        <p className="text-slate-600 text-sm mt-1">{description}</p>
      </div>
    </div>
  );
}

// ─── Add Button ──────────────────────────────────────────────

interface AddButtonProps {
  onClick: () => void;
  label: string;
}

function AddButton({ onClick, label }: AddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-center gap-2 w-full mt-1 py-3.5 rounded-2xl
                 border border-dashed border-slate-700/60 text-slate-500
                 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-900/40
                 transition-all duration-200 text-sm font-medium"
    >
      <div className="w-6 h-6 rounded-full border border-slate-700 group-hover:border-slate-500
                      flex items-center justify-center transition-colors duration-200">
        <Plus size={13} />
      </div>
      {label}
    </button>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton rounded-full w-48" />
              <div className="h-3 skeleton rounded-full w-32" />
            </div>
            <div className="h-5 skeleton rounded-full w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Comportamiento IA (AI Prompts) ─────────────────────

function AiPromptsTab() {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [callType, setCallType] = useState('');
  const { callTypeNames: availableCallTypes } = useCallTypesConfig();

  useEffect(() => {
    if (availableCallTypes.length > 0 && !callType) {
      setCallType(availableCallTypes[0]);
    }
  }, [availableCallTypes, callType]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await promptsService.getAll();
      setPrompts(data);
    } catch {
      toast.error('Error al cargar prompts de IA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SkeletonLoader />;

  const filteredPrompts = prompts.filter((p) => p.mode === mode && p.call_type === callType);

  return (
    <div className="space-y-4">
      {/* Selector de modo */}
      <ModeSelector selected={mode} onChange={setMode} />

      {/* Selector de call type */}
      <CallTypeSelectorShared selected={callType} onChange={setCallType} />

      {filteredPrompts.length === 0 ? (
        <EmptyState
          icon={<Brain size={28} className="text-slate-600" />}
          title="Sin prompts configurados"
          description={
            mode === 'MONITOREO'
              ? 'No hay prompts para Monitoreo aún. Crea registros en BD con call_type = MONITOREO.'
              : 'Ejecuta "Cargar datos predeterminados" para inicializar los prompts desde los archivos estáticos.'
          }
        />
      ) : (
        <>
          <p className="text-xs text-slate-500 leading-relaxed">
            Estos son los prompts enviados a la IA en cada etapa del proceso de auditoría.
            Edítalos con cuidado — afectan directamente cómo la IA analiza imágenes, evalúa llamadas y corrige transcripciones.
          </p>
          {filteredPrompts.map((prompt) => (
            <PromptEditor key={prompt.id} prompt={prompt} onUpdate={load} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Editor de Prompt individual ─────────────────────────────

interface PromptEditorProps {
  prompt: AiPrompt;
  onUpdate: () => void;
}

function PromptEditor({ prompt, onUpdate }: PromptEditorProps) {
  const [content, setContent] = useState(prompt.content);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const isDirty = content !== prompt.content;

  const handleSave = async () => {
    setSaving(true);
    try {
      await promptsService.update(prompt.id, { content });
      toast.success('Prompt actualizado');
      onUpdate();
    } catch {
      toast.error('Error al guardar prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setContent(prompt.content);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30
                          flex items-center justify-center">
            <Brain size={16} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{prompt.prompt_name}</p>
            {prompt.description && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{prompt.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {isDirty && (
            <span className="text-xs text-amber-400 font-medium">Cambios sin guardar</span>
          )}
          <span className="text-xs text-slate-600 font-mono tabular-nums">
            {content.length.toLocaleString()} car.
          </span>
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Editor (expandido) */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800/60">
          <div className="mt-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={22}
              className="w-full bg-slate-950/70 border border-slate-700/50 rounded-xl px-4 py-3
                         text-sm text-slate-200 font-mono leading-relaxed resize-y
                         focus:outline-none focus:border-amber-700/50 focus:ring-1 focus:ring-amber-700/30
                         placeholder:text-slate-600"
              spellCheck={false}
              placeholder="Escribe el prompt de sistema aquí..."
            />
          </div>
          <div className="flex items-center gap-2 mt-3 justify-end">
            <button
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600
                         transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={12} /> Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                         bg-amber-500/10 border border-amber-700/40 text-amber-300
                         hover:bg-amber-500/20 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WRAPPERS CON SUB-SECCIÓN
// ═══════════════════════════════════════════════════════════════

// ── Helper: toggle interno de sub-sección ────────────────────

function SubTabToggle({
  activeSubTab, onChange, options,
}: {
  activeSubTab: string;
  onChange: (v: string) => void;
  options: { key: string; label: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="flex gap-2 mb-5">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
            ${activeSubTab === o.key
              ? 'bg-brand-500/15 border border-brand-500/40 text-brand-300'
              : 'bg-slate-800/50 border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Wrapper: Scripts ──────────────────────────────────────────

function ScriptsTabWrapper() {
  const [subTab, setSubTab] = useState<'guiones' | 'vocabulario'>('guiones');
  return (
    <div>
      <SubTabToggle
        activeSubTab={subTab}
        onChange={(v) => setSubTab(v as 'guiones' | 'vocabulario')}
        options={[
          { key: 'guiones',     label: 'Guiones',                    icon: <BookOpen size={14} /> },
          { key: 'vocabulario', label: 'Vocabulario de Transcripción', icon: <Volume2 size={14} /> },
        ]}
      />
      {subTab === 'guiones' ? <ScriptsTab /> : <VocabularioTab />}
    </div>
  );
}

// ── Wrapper: Criterios ────────────────────────────────────────

function CriteriaTabWrapper() {
  const [subTab, setSubTab] = useState<'criterios' | 'sistemas'>('criterios');
  return (
    <div>
      <SubTabToggle
        activeSubTab={subTab}
        onChange={(v) => setSubTab(v as 'criterios' | 'sistemas')}
        options={[
          { key: 'criterios', label: 'Criterios de Evaluación', icon: <ClipboardList size={14} /> },
          { key: 'sistemas',  label: 'Sistemas de Imagen',       icon: <Monitor size={14} /> },
        ]}
      />
      {subTab === 'criterios' ? <CriteriaTab /> : <ImageSystemsTab />}
    </div>
  );
}

// ── Wrapper: Plantilla GPF ────────────────────────────────────

function PlantillaTabWrapper() {
  const [subTab, setSubTab] = useState<'plantilla' | 'tipos'>('plantilla');
  return (
    <div>
      <SubTabToggle
        activeSubTab={subTab}
        onChange={(v) => setSubTab(v as 'plantilla' | 'tipos')}
        options={[
          { key: 'plantilla', label: 'Plantilla de Cierre GPF', icon: <Table size={14} /> },
          { key: 'tipos',     label: 'Tipos de Llamada',         icon: <PhoneCall size={14} /> },
        ]}
      />
      {subTab === 'plantilla' ? <PlantillaGPFTab /> : <CallTypesTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VOCABULARIO DE TRANSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  banco:              { label: 'Banco / Tarjetas',       color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  sistemas:           { label: 'Sistemas Bancarios',      color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  terminos_bancarios: { label: 'Términos Bancarios',      color: 'bg-brand-500/15 text-brand-300 border-brand-500/30' },
  comercios:          { label: 'Comercios',               color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  codigos_bloqueo:    { label: 'Códigos de Bloqueo',      color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  nombres:            { label: 'Apellidos',               color: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
  ciudades:           { label: 'Ciudades',                color: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  call_center:        { label: 'Call Center',             color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  frases:             { label: 'Frases',                  color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_LABELS[category] ?? { label: category, color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function VocabularioTab() {
  const [terms, setTerms] = useState<WordBoostTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [newCategory, setNewCategory] = useState('banco');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await wordBoostService.getAll();
      setTerms(data);
    } catch {
      toast.error('Error al cargar vocabulario');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newTerm.trim()) return;
    setSaving(true);
    try {
      await wordBoostService.create({ term: newTerm.trim(), category: newCategory });
      toast.success('Término agregado');
      setNewTerm('');
      setShowAdd(false);
      load();
    } catch {
      toast.error('Error al agregar término');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (term: WordBoostTerm) => {
    try {
      await wordBoostService.update(term.id, { is_active: !term.is_active });
      load();
    } catch {
      toast.error('Error al actualizar término');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await wordBoostService.remove(id);
      toast.success('Término eliminado');
      load();
    } catch {
      toast.error('Error al eliminar término');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    try {
      await wordBoostService.update(id, { term: editValue.trim(), category: editCategory });
      toast.success('Término actualizado');
      setEditingId(null);
      load();
    } catch {
      toast.error('Error al actualizar término');
    }
  };

  const categories = Object.keys(CATEGORY_LABELS);
  const filtered = filterCategory === 'all' ? terms : terms.filter(t => t.category === filterCategory);
  const activeCount = terms.filter(t => t.is_active !== false).length;

  if (loading) return <SkeletonLoader />;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Términos que mejoran la precisión de transcripción de audio (AssemblyAI word boost).
            <span className="ml-2 text-brand-400 font-medium">{activeCount} activos de {terms.length} total</span>
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     bg-brand-500/10 border border-brand-500/30 text-brand-300
                     hover:bg-brand-500/20 transition-all whitespace-nowrap"
        >
          <Plus size={14} /> Agregar término
        </button>
      </div>

      {/* Formulario agregar */}
      {showAdd && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1">Término</label>
            <input
              value={newTerm}
              onChange={e => setNewTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="ej: Bradescard"
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-brand-500/50 placeholder:text-slate-600"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1">Categoría</label>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-brand-500/50"
            >
              {categories.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c].label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newTerm.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                         bg-brand-500/15 border border-brand-500/40 text-brand-300
                         hover:bg-brand-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Guardar
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewTerm(''); }}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 border border-slate-700/40 hover:text-slate-200 transition-all"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Filtro de categoría */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all
            ${filterCategory === 'all'
              ? 'bg-slate-600/40 border-slate-500/50 text-slate-200'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
            }`}
        >
          Todos ({terms.length})
        </button>
        {categories.map(cat => {
          const count = terms.filter(t => t.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all
                ${filterCategory === cat
                  ? 'bg-slate-600/40 border-slate-500/50 text-slate-200'
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                }`}
            >
              {CATEGORY_LABELS[cat]?.label ?? cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Volume2 size={28} className="text-slate-600" />}
          title="Sin términos"
          description="Agrega términos para mejorar la transcripción"
        />
      ) : (
        <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/40 bg-slate-800/40">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Término</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Categoría</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-400">Activo</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((term, i) => (
                <tr
                  key={term.id}
                  className={`border-b border-slate-800/40 transition-colors
                    ${i % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-800/10'}
                    ${term.is_active === false ? 'opacity-40' : ''}
                  `}
                >
                  <td className="px-4 py-2.5">
                    {editingId === term.id ? (
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(term.id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                        className="bg-slate-800 border border-brand-500/40 rounded-lg px-2 py-1 text-sm text-slate-200
                                   focus:outline-none focus:border-brand-400/60 w-full max-w-[200px]"
                      />
                    ) : (
                      <span className="text-slate-200 font-mono text-xs">{term.term}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {editingId === term.id ? (
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        className="bg-slate-800 border border-slate-600/40 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        {categories.map(c => (
                          <option key={c} value={c}>{CATEGORY_LABELS[c].label}</option>
                        ))}
                      </select>
                    ) : (
                      <CategoryBadge category={term.category} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => handleToggleActive(term)} className="transition-opacity hover:opacity-80">
                      {term.is_active !== false
                        ? <ToggleRight size={20} className="text-brand-400" />
                        : <ToggleLeft size={20} className="text-slate-600" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === term.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(term.id)}
                            className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400 hover:bg-brand-500/20 transition-all"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-400 hover:text-slate-200 transition-all"
                          >
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(term.id); setEditValue(term.term); setEditCategory(term.category); }}
                            className="p-1.5 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-400 hover:text-slate-200 transition-all"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(term.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DiscoveredSystemsImporter ───────────────────────────────

interface DiscoveredSystemsImporterProps {
  existingSystems: ImageSystem[];
  onCreated: () => void;
  onClose: () => void;
}

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  FALCON:  'Sistema de gestión de casos de fraude bancario',
  VCAS:    'Verificación de cuenta y estado de bloqueo',
  VISION:  'Pantalla VISION / ASHI — comentarios y estado de la cuenta',
  VRM:     'Validación de transacciones ARTD y ARSD',
  GPF:     'Registro y cierre de casos en el sistema GPF',
  HOTLIST: 'Gestión de hotlist y bloqueos preventivos',
};

function DiscoveredSystemsImporter({ existingSystems, onCreated, onClose }: DiscoveredSystemsImporterProps) {
  const existingNames = new Set(existingSystems.map(s => s.system_name.toUpperCase()));
  const today = new Date().toLocaleDateString('en-CA');

  // Carga de atenciones GPF (siempre producción)
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [attentions, setAttentions] = useState<GpfAttention[]>([]);
  const [loadingAttentions, setLoadingAttentions] = useState(false);
  const [attentionsLoaded, setAttentionsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Filtros derivados de atenciones cargadas
  const [filterCal, setFilterCal] = useState('');
  const [filterSub, setFilterSub] = useState('');

  // Mismo filtro base que NewAuditPage: solo FRAUDE y TH CONFIRMA
  const validAttentions = useMemo(() =>
    attentions.filter(a => {
      const cal = (a['Calificación'] ?? '').trim().toLowerCase();
      return cal.includes('fraude') || cal.includes('th confirma');
    }),
    [attentions]
  );

  const uniqueCalificaciones = useMemo(() =>
    [...new Set(validAttentions.map(a => (a['Calificación'] ?? '').trim()).filter(Boolean))].sort(),
    [validAttentions]
  );
  const uniqueSubcals = useMemo(() => {
    const base = filterCal
      ? validAttentions.filter(a => (a['Calificación'] ?? '').trim() === filterCal)
      : validAttentions;
    return [...new Set(base.map(a => (a['Sub-calificación'] ?? '').trim()).filter(Boolean))].sort();
  }, [validAttentions, filterCal]);

  const matchingAttentions = useMemo(() =>
    validAttentions.filter(a => {
      if (filterCal && (a['Calificación'] ?? '').trim() !== filterCal) return false;
      if (filterSub && (a['Sub-calificación'] ?? '').trim() !== filterSub) return false;
      return true;
    }),
    [validAttentions, filterCal, filterSub]
  );

  // Análisis de imágenes
  const [analyzing, setAnalyzing] = useState(false);
  const [searchInfo, setSearchInfo] = useState<{ total: number; analyzed: number; cases: string[]; message?: string } | null>(null);
  const [candidates, setCandidates] = useState<Array<{ name: string; count: number; selected: boolean; description: string }>>([]);
  const [importing, setImporting] = useState(false);

  const handleLoadAttentions = async () => {
    setLoadingAttentions(true);
    setLoadError('');
    setAttentions([]);
    setAttentionsLoaded(false);
    setCandidates([]);
    setSearchInfo(null);
    setFilterCal('');
    setFilterSub('');
    try {
      const result = await gpfService.getAttentions('prod', dateFrom || today, dateTo || today);
      setAttentions(result.attentions || []);
      setAttentionsLoaded(true);
      if ((result.attentions || []).length === 0) {
        toast('No se encontraron casos en este rango de fechas', { icon: 'ℹ' });
      }
    } catch (e: any) {
      setLoadError(e?.response?.data?.error || 'Error al cargar casos de GPF');
    } finally {
      setLoadingAttentions(false);
    }
  };

  const handleAnalyze = async () => {
    if (!filterCal) { toast.error('Selecciona una Calificación'); return; }
    setAnalyzing(true);
    setCandidates([]);
    setSearchInfo(null);
    try {
      const result = await gpfService.discoverSystems({
        env: 'prod',
        calificacion: filterCal,
        subcalificacion: filterSub || undefined,
        max_images: 8,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setSearchInfo({ total: result.total_attentions, analyzed: result.images_analyzed, cases: result.cases_checked ?? [], message: result.message });
      const valid = result.systems
        .filter(s => !NOISE_SYSTEM_NAMES.has(s.name.toLowerCase()))
        .map(s => ({
          name: s.name,
          count: s.count,
          selected: !existingNames.has(s.name),
          description: SYSTEM_DESCRIPTIONS[s.name] || `Sistema ${s.name}`,
        }));
      setCandidates(valid);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al analizar imágenes de GPF');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggle = (i: number) => setCandidates(prev => prev.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c));
  const updateDesc = (i: number, desc: string) => setCandidates(prev => prev.map((c, idx) => idx === i ? { ...c, description: desc } : c));
  const selectedCount = candidates.filter(c => c.selected && !existingNames.has(c.name)).length;

  const handleImport = async () => {
    setImporting(true);
    try {
      const toCreate = candidates.filter(c => c.selected && !existingNames.has(c.name));
      for (let i = 0; i < toCreate.length; i++) {
        await imageSystemsService.create({
          system_name: toCreate[i].name,
          description: toCreate[i].description,
          fields_schema: [],
          display_order: existingSystems.length + i + 1,
        });
      }
      toast.success(`✅ ${toCreate.length} sistema${toCreate.length !== 1 ? 's' : ''} importado${toCreate.length !== 1 ? 's' : ''}`);
      onCreated();
    } catch {
      toast.error('Error al importar sistemas');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-teal-500/20 rounded-2xl overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-teal-500/15 bg-teal-500/5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
            <Eye size={12} className="text-teal-400" />
          </div>
          <span className="text-sm font-semibold text-teal-300">Descubrir sistemas desde GPF</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/60 transition-all">
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Paso 1: Fechas + cargar casos */}
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Carga los casos de GPF y filtra por tipo de llamada para descubrir qué sistemas de imagen aparecen.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fecha desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fecha hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-teal-500/50" />
            </div>
          </div>
          <button onClick={handleLoadAttentions} disabled={loadingAttentions}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm font-semibold
                       hover:bg-slate-800 hover:border-teal-500/30 disabled:opacity-50 transition-all">
            {loadingAttentions ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loadingAttentions ? 'Cargando casos de GPF...' : 'Cargar casos de GPF'}
          </button>
          {loadError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loadError}</p>}
          {attentionsLoaded && (
            <p className="text-[11px] text-slate-500 text-center">
              {validAttentions.length} caso{validAttentions.length !== 1 ? 's' : ''} de {attentions.length} cargados (FRAUDE / TH CONFIRMA)
            </p>
          )}
        </div>

        {/* Paso 2: Filtros por calificación */}
        {attentionsLoaded && attentions.length > 0 && (
          <div className="space-y-3 animate-fadeIn pt-1 border-t border-slate-800/50">
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Calificación</label>
                <select value={filterCal}
                  onChange={e => { setFilterCal(e.target.value); setFilterSub(''); setCandidates([]); setSearchInfo(null); }}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white
                             focus:outline-none focus:border-teal-500/50 cursor-pointer">
                  <option value="">— Selecciona —</option>
                  {uniqueCalificaciones.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subcalificación</label>
                <select value={filterSub}
                  onChange={e => { setFilterSub(e.target.value); setCandidates([]); setSearchInfo(null); }}
                  disabled={!filterCal || uniqueSubcals.length === 0}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white
                             focus:outline-none focus:border-teal-500/50 cursor-pointer disabled:opacity-40">
                  <option value="">Todas</option>
                  {uniqueSubcals.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {filterCal && (
              <p className="text-[11px] text-teal-400/80">
                {matchingAttentions.length} caso{matchingAttentions.length !== 1 ? 's' : ''} coinciden con el filtro
              </p>
            )}

            <button onClick={handleAnalyze} disabled={analyzing || !filterCal || matchingAttentions.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-teal-500/20 border border-teal-500/35 text-teal-200 text-sm font-semibold
                         hover:bg-teal-500/30 disabled:opacity-50 transition-all">
              {analyzing
                ? <><Loader2 size={13} className="animate-spin" /> Analizando imágenes de GPF...</>
                : <><Eye size={13} /> Analizar imágenes de los {matchingAttentions.length} caso{matchingAttentions.length !== 1 ? 's' : ''}</>}
            </button>
            {analyzing && (
              <p className="text-[11px] text-teal-500/70 text-center animate-pulse">
                Descargando capturas y analizando con IA · 15–30 segundos
              </p>
            )}
          </div>
        )}

        {/* Info + resultados */}
        {searchInfo && (
          <div className="space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-slate-500">{searchInfo.total} atencion{searchInfo.total !== 1 ? 'es' : ''} en GPF</span>
              <span className="text-slate-600">· {searchInfo.cases.length} caso{searchInfo.cases.length !== 1 ? 's' : ''} revisado{searchInfo.cases.length !== 1 ? 's' : ''}</span>
              {searchInfo.analyzed > 0 && <span className="text-teal-400">· {searchInfo.analyzed} imagen{searchInfo.analyzed !== 1 ? 'es' : ''} analizadas</span>}
            </div>
            {searchInfo.cases.length > 0 && (
              <p className="text-[10px] text-slate-700">
                Casos revisados: {searchInfo.cases.join(', ')}
              </p>
            )}
            {searchInfo.message && (
              <p className="text-[11px] text-amber-400/80">{searchInfo.message}</p>
            )}
          </div>
        )}

        {candidates.length === 0 && searchInfo && !analyzing && (
          <div className="text-center py-3 space-y-2">
            <p className="text-slate-400 text-sm">No se encontraron capturas de pantalla</p>
            <p className="text-slate-600 text-xs max-w-xs mx-auto">
              Los casos de este tipo no tienen imágenes registradas en GPF para ese rango de fechas.
              Prueba otras fechas o agrega los sistemas manualmente con "Nuevo sistema".
            </p>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="space-y-2 animate-fadeIn">
            <p className="text-xs font-semibold text-slate-300">
              Sistemas detectados
              {candidates.filter(c => !existingNames.has(c.name)).length > 0 && (
                <span className="ml-1.5 text-teal-400 font-normal">
                  · {candidates.filter(c => !existingNames.has(c.name)).length} nuevo{candidates.filter(c => !existingNames.has(c.name)).length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
            {candidates.map((c, i) => {
              const already = existingNames.has(c.name);
              return (
                <div key={c.name} className={`rounded-xl border p-3.5 transition-all ${
                  already ? 'bg-slate-800/20 border-slate-800/40 opacity-50'
                  : c.selected ? 'bg-teal-500/8 border-teal-500/25'
                  : 'bg-slate-800/30 border-slate-700/40'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={c.selected && !already} disabled={already}
                      onChange={() => !already && toggle(i)}
                      className="w-4 h-4 accent-teal-500 cursor-pointer mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-mono font-bold text-sm text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg">{c.name}</span>
                        <span className="text-[11px] text-slate-500">{c.count} imagen{c.count !== 1 ? 'es' : ''}</span>
                        {already && <span className="text-[10px] text-slate-600 bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 rounded-full">Ya configurado</span>}
                      </div>
                      {c.selected && !already && (
                        <input value={c.description} onChange={e => updateDesc(i, e.target.value)}
                          placeholder="Descripción del sistema..."
                          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200
                                     focus:outline-none focus:border-teal-500/50 placeholder:text-slate-600" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedCount > 0 && (
              <button onClick={handleImport} disabled={importing}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold
                           bg-teal-500/20 border border-teal-500/35 text-teal-200
                           hover:bg-teal-500/30 disabled:opacity-50 transition-all">
                {importing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {importing ? 'Importando...' : `Importar ${selectedCount} sistema${selectedCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SISTEMAS DE IMAGEN
// ═══════════════════════════════════════════════════════════════

function ImageSystemsTab() {
  const [systems, setSystems] = useState<ImageSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [highlightedSystem, setHighlightedSystem] = useState<string | null>(null);

  const handleQuickEdit = (systemName: string) => {
    const sys = systems.find(s => s.system_name === systemName);
    if (sys) {
      setExpandedId(sys.id);
      setEditingId(sys.id);
      setHighlightedSystem(sys.id);
      setTimeout(() => setHighlightedSystem(null), 2000);
      // Scroll to card
      setTimeout(() => {
        document.getElementById(`sys-card-${sys.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };
  const [editData, setEditData] = useState<Partial<ImageSystem>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [newSystem, setNewSystem] = useState({ system_name: '', description: '', detection_hints: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await imageSystemsService.getAll();
      setSystems(data);
    } catch {
      toast.error('Error al cargar sistemas de imagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (sys: ImageSystem) => {
    try {
      await imageSystemsService.update(sys.id, { is_active: !sys.is_active });
      load();
    } catch {
      toast.error('Error al actualizar sistema');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await imageSystemsService.remove(id);
      toast.success('Sistema eliminado');
      load();
    } catch {
      toast.error('Error al eliminar sistema');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await imageSystemsService.update(editingId, editData);
      toast.success('Sistema actualizado');
      setEditingId(null);
      setEditData({});
      load();
    } catch {
      toast.error('Error al actualizar sistema');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSystem = async () => {
    if (!newSystem.system_name.trim() || !newSystem.description.trim()) {
      toast.error('Nombre y descripción son requeridos');
      return;
    }
    setSaving(true);
    try {
      await imageSystemsService.create({
        system_name: newSystem.system_name.trim().toUpperCase(),
        description: newSystem.description.trim(),
        detection_hints: newSystem.detection_hints.trim() || undefined,
        fields_schema: [],
        display_order: systems.length + 1,
      });
      toast.success('Sistema agregado');
      setShowAdd(false);
      setNewSystem({ system_name: '', description: '', detection_hints: '' });
      load();
    } catch {
      toast.error('Error al agregar sistema');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldUpdate = (sysId: string, fields: ImageSystemField[]) => {
    imageSystemsService.update(sysId, { fields_schema: fields })
      .then(() => load())
      .catch(() => toast.error('Error al actualizar campos'));
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div className="space-y-4">
      <ImageAnalyticsBanner onQuickEdit={handleQuickEdit} />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400 leading-relaxed flex-1 min-w-[200px]">
          Sistemas detectados en capturas de pantalla bancarias. Definen qué campos extrae la IA de cada imagen.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowImporter(!showImporter); setShowAdd(false); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold
                       bg-teal-500/10 border border-teal-500/25 text-teal-300
                       hover:bg-teal-500/20 transition-all whitespace-nowrap"
          >
            <RefreshCw size={13} /> Importar detectados
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowImporter(false); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold
                       bg-purple-500/10 border border-purple-500/30 text-purple-300
                       hover:bg-purple-500/20 transition-all whitespace-nowrap"
          >
            <Plus size={14} /> Nuevo sistema
          </button>
        </div>
      </div>

      {/* Panel: Importar sistemas detectados en auditorías */}
      {showImporter && (
        <DiscoveredSystemsImporter
          existingSystems={systems}
          onCreated={() => { load(); setShowImporter(false); }}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* Formulario nuevo sistema */}
      {showAdd && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300">Nuevo sistema de imagen</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre del sistema</label>
              <input
                value={newSystem.system_name}
                onChange={e => setNewSystem(p => ({ ...p, system_name: e.target.value }))}
                placeholder="ej: FALCON"
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Descripción corta</label>
              <input
                value={newSystem.description}
                onChange={e => setNewSystem(p => ({ ...p, description: e.target.value }))}
                placeholder="ej: Casos de fraude, números de caso..."
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                           focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Pistas de detección (opcional)</label>
            <input
              value={newSystem.detection_hints}
              onChange={e => setNewSystem(p => ({ ...p, detection_hints: e.target.value }))}
              placeholder="Texto que aparece en el PASO 1 del prompt de análisis"
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-slate-700/40 hover:text-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddSystem}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
                         bg-purple-500/15 border border-purple-500/40 text-purple-300
                         hover:bg-purple-500/25 transition-all disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Crear sistema
            </button>
          </div>
        </div>
      )}

      {/* Lista de sistemas */}
      {systems.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 px-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center">
            <ImageIcon size={24} className="text-slate-600" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-slate-300 font-semibold mb-1">Sin sistemas configurados</p>
            <p className="text-slate-500 text-sm">La IA necesita saber qué pantallas existen para extraer información correctamente.</p>
          </div>
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                       bg-teal-500/15 border border-teal-500/30 text-teal-300
                       hover:bg-teal-500/25 transition-all"
          >
            <RefreshCw size={14} />
            Importar desde auditorías anteriores
          </button>
          <p className="text-[11px] text-slate-600">o usa "Nuevo sistema" para agregar uno manualmente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {systems.map(sys => (
            <div key={sys.id} id={`sys-card-${sys.id}`}
              className={`transition-all duration-500 rounded-xl ${highlightedSystem === sys.id ? 'ring-2 ring-purple-500/50 ring-offset-1 ring-offset-slate-950' : ''}`}>
            <ImageSystemCard
              system={sys}
              expanded={expandedId === sys.id}
              onToggleExpand={() => setExpandedId(expandedId === sys.id ? null : sys.id)}
              editing={editingId === sys.id}
              editData={editData}
              onStartEdit={() => { setEditingId(sys.id); setEditData({ description: sys.description, detection_hints: sys.detection_hints ?? '' }); }}
              onCancelEdit={() => { setEditingId(null); setEditData({}); }}
              onSaveEdit={handleSaveEdit}
              onEditDataChange={setEditData}
              onToggleActive={() => handleToggleActive(sys)}
              onDelete={() => handleDelete(sys.id)}
              onFieldsChange={(fields) => handleFieldUpdate(sys.id, fields)}
              saving={saving}
            />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ImageSystemCardProps {
  system: ImageSystem;
  expanded: boolean;
  onToggleExpand: () => void;
  editing: boolean;
  editData: Partial<ImageSystem>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditDataChange: (d: Partial<ImageSystem>) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onFieldsChange: (fields: ImageSystemField[]) => void;
  saving: boolean;
}

function ImageSystemCard({
  system, expanded, onToggleExpand, editing, editData, onStartEdit, onCancelEdit,
  onSaveEdit, onEditDataChange, onToggleActive, onDelete, onFieldsChange, saving,
}: ImageSystemCardProps) {
  const [newField, setNewField] = useState<ImageSystemField>({ field_name: '', description: '', example: '' });
  const [showAddField, setShowAddField] = useState(false);
  // Asistente IA texto
  const [aiOpen, setAiOpen] = useState(false);
  const [aiUserDesc, setAiUserDesc] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ detection_hints: string; suggested_fields: ImageSystemField[] } | null>(null);

  // Asistente IA con imagen
  const [imgOpen, setImgOpen] = useState(false);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string>('');
  const [imgDesc, setImgDesc] = useState('');
  const [imgAnalyzing, setImgAnalyzing] = useState(false);

  // Resultados editables
  type EditableField = { field_name: string; description: string; example: string; how_to_evaluate: string; selected: boolean };
  const [editableHints, setEditableHints] = useState<string>('');
  const [editableFields, setEditableFields] = useState<EditableField[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const [expandedField, setExpandedField] = useState<number | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setHasResult(false);
    const reader = new FileReader();
    reader.onload = (ev) => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleImgAnalyze = async () => {
    if (!imgFile || !imgPreview) return;
    setImgAnalyzing(true);
    setHasResult(false);
    try {
      const base64 = imgPreview.split(',')[1];
      const mimeType = imgFile.type || 'image/png';
      const result = await imageSystemsService.analyzeScreenshot({
        image_base64: base64,
        mime_type: mimeType,
        system_name: system.system_name,
        user_description: imgDesc.trim(),
      });
      setEditableHints(result.detection_hints || '');
      setEditableFields(result.fields.map(f => ({ ...f, selected: true })));
      setHasResult(true);
    } catch {
      toast.error('Error al analizar imagen con IA');
    } finally {
      setImgAnalyzing(false);
    }
  };

  const updateField = (idx: number, patch: Partial<EditableField>) => {
    setEditableFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };
  const removeField = (idx: number) => {
    setEditableFields(prev => prev.filter((_, i) => i !== idx));
  };
  const addBlankField = () => {
    setEditableFields(prev => [...prev, { field_name: '', description: '', example: '', how_to_evaluate: '', selected: true }]);
    setExpandedField(editableFields.length);
  };
  const toggleAll = () => {
    const allOn = editableFields.every(f => f.selected);
    setEditableFields(prev => prev.map(f => ({ ...f, selected: !allOn })));
  };

  const selectedFieldsCount = editableFields.filter(f => f.selected && f.field_name.trim()).length;

  const applyImgResult = () => {
    if (editableHints.trim()) {
      onEditDataChange({ ...editData, detection_hints: editableHints.trim() });
    }
    const toAdd: ImageSystemField[] = editableFields
      .filter(f => f.selected && f.field_name.trim())
      .map(f => ({
        field_name: f.field_name.trim(),
        description: `${f.description.trim()}${f.how_to_evaluate.trim() ? ` | Evaluar: ${f.how_to_evaluate.trim()}` : ''}`,
        example: f.example.trim() || undefined,
      }));
    if (toAdd.length > 0) {
      onFieldsChange([...fields, ...toAdd.filter(nf => !fields.some(f => f.field_name === nf.field_name))]);
    }
    setImgOpen(false);
    setHasResult(false);
    toast.success(`✅ Aplicados: pistas + ${toAdd.length} campo${toAdd.length !== 1 ? 's' : ''}`);
  };

  const handleAiGenerate = async () => {
    if (!aiUserDesc.trim()) return;
    setAiGenerating(true);
    setAiResult(null);
    try {
      const result = await imageSystemsService.generateHints(system.system_name, aiUserDesc.trim());
      setAiResult(result);
    } catch {
      toast.error('Error al generar con IA');
    } finally {
      setAiGenerating(false);
    }
  };

  const fields: ImageSystemField[] = Array.isArray(system.fields_schema) ? system.fields_schema : [];

  const handleAddField = () => {
    if (!newField.field_name.trim() || !newField.description.trim()) return;
    onFieldsChange([...fields, { ...newField, field_name: newField.field_name.trim(), description: newField.description.trim(), example: newField.example?.trim() || undefined }]);
    setNewField({ field_name: '', description: '', example: '' });
    setShowAddField(false);
  };

  const handleRemoveField = (idx: number) => {
    onFieldsChange(fields.filter((_, i) => i !== idx));
  };

  return (
    <div className={`bg-slate-900/50 border rounded-xl overflow-hidden transition-all
      ${system.is_active !== false ? 'border-slate-700/40' : 'border-slate-800/40 opacity-60'}`}>
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggleExpand} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <ChevronRight
            size={16}
            className={`text-slate-500 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="font-mono font-bold text-sm text-purple-300 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-md shrink-0">
            {system.system_name}
          </span>
          {!editing && (
            <span className="text-slate-400 text-sm truncate">{system.description}</span>
          )}
          <span className="text-xs text-slate-600 shrink-0">({fields.length} campos)</span>
        </button>
        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggleActive} className="transition-opacity hover:opacity-80">
            {system.is_active !== false
              ? <ToggleRight size={20} className="text-brand-400" />
              : <ToggleLeft size={20} className="text-slate-600" />
            }
          </button>
          {!editing && (
            <button
              onClick={onStartEdit}
              className="p-1.5 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-400 hover:text-slate-200 transition-all"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Edición de metadatos */}
      {editing && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <input
              value={editData.description ?? ''}
              onChange={e => onEditDataChange({ ...editData, description: e.target.value })}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Pistas de detección (PASO 1 del prompt)</label>
            <input
              value={(editData.detection_hints as string) ?? ''}
              onChange={e => onEditDataChange({ ...editData, detection_hints: e.target.value })}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-purple-500/50"
            />
            {/* Asistente IA para detection_hints */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setAiOpen(!aiOpen)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors duration-150"
              >
                <Sparkles size={12} />
                {aiOpen ? 'Ocultar asistente' : 'Generar con IA'}
                <ChevronDown size={11} className={`transition-transform duration-200 ${aiOpen ? 'rotate-180' : ''}`} />
              </button>
              {aiOpen && (
                <div className="mt-2 p-3.5 rounded-xl bg-slate-900/60 border border-purple-500/20 animate-fadeIn space-y-2.5">
                  <p className="text-[11px] text-slate-400">Describe visualmente cómo se ve este sistema en pantalla y qué información muestra.</p>
                  <textarea
                    value={aiUserDesc}
                    onChange={e => setAiUserDesc(e.target.value)}
                    rows={2}
                    placeholder={`Ej: ${system.system_name} es una pantalla donde aparece el número de caso, fecha, monto y estado de la cuenta...`}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-200 resize-none
                               focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiUserDesc.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15
                               border border-purple-500/30 text-purple-300 text-xs font-medium
                               hover:bg-purple-500/25 disabled:opacity-50 transition-all duration-150"
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {aiGenerating ? 'Generando...' : 'Generar'}
                  </button>
                  {aiResult && (
                    <div className="animate-fadeIn space-y-2">
                      <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Pistas de detección generadas</p>
                        <div className="bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/40">
                          <p className="text-[11px] text-slate-200 leading-relaxed">{aiResult.detection_hints}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditDataChange({ ...editData, detection_hints: aiResult.detection_hints })}
                          className="mt-1.5 flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 transition-colors"
                        >
                          <Check size={11} /> Usar estas pistas
                        </button>
                      </div>
                      {aiResult.suggested_fields.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Campos sugeridos</p>
                          <div className="space-y-1">
                            {aiResult.suggested_fields.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px]">
                                <span className="font-mono text-purple-300/80 w-32 flex-shrink-0">{f.field_name}</span>
                                <span className="text-slate-400 flex-1">{f.description}</span>
                                {f.example && <span className="text-slate-600 italic">{f.example}</span>}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => { onFieldsChange(aiResult.suggested_fields); setAiResult(null); setAiOpen(false); }}
                            className="mt-1.5 flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 transition-colors"
                          >
                            <Check size={11} /> Agregar estos campos al sistema
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancelEdit} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700/40 hover:text-slate-200 transition-all">
              Cancelar
            </button>
            <button
              onClick={onSaveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                         bg-purple-500/15 border border-purple-500/40 text-purple-300
                         hover:bg-purple-500/25 transition-all disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Campos expandidos */}
      {expanded && (
        <div className="border-t border-slate-800/60 px-4 pb-4 pt-3">
          {/* ── Asistente IA con imagen ──────────────────────────── */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setImgOpen(!imgOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl
                         bg-brand-500/10 border border-brand-700/25 hover:bg-brand-500/15
                         transition-all duration-150"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-400" />
                <span className="text-sm font-semibold text-brand-300">Generar campos con una imagen de ejemplo (IA)</span>
              </div>
              <ChevronDown size={13} className={`text-brand-500 transition-transform duration-200 ${imgOpen ? 'rotate-180' : ''}`} />
            </button>

            {imgOpen && (
              <div className="mt-3 p-4 rounded-xl bg-slate-900/60 border border-brand-700/20 space-y-3 animate-fadeIn">
                <p className="text-[11px] text-slate-400">
                  Sube una captura de pantalla de este sistema y describe qué necesitas. La IA genera los campos y las pistas de detección automáticamente.
                </p>

                {/* Upload */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Captura de pantalla
                  </label>
                  <label className={`flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 ${
                    imgFile ? 'border-brand-700/40 bg-brand-500/5' : 'border-slate-700/50 bg-slate-800/30 hover:border-brand-700/30 hover:bg-brand-500/5'
                  }`}>
                    {imgPreview ? (
                      <img src={imgPreview} alt="preview" className="max-h-48 rounded-lg object-contain" />
                    ) : (
                      <>
                        <ImageIcon size={24} className="text-slate-600" />
                        <span className="text-xs text-slate-500">Haz clic para subir PNG o JPG</span>
                      </>
                    )}
                    <input type="file" accept="image/png,image/jpeg,image/jpg" className="sr-only" onChange={handleImageSelect} />
                  </label>
                  {imgFile && (
                    <button
                      type="button"
                      onClick={() => { setImgFile(null); setImgPreview(''); setHasResult(false); }}
                      className="mt-1.5 text-[11px] text-slate-600 hover:text-red-400 transition-colors"
                    >
                      × Quitar imagen
                    </button>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    ¿Qué debe extraer la IA?
                  </label>
                  <textarea
                    value={imgDesc}
                    onChange={e => setImgDesc(e.target.value)}
                    rows={3}
                    placeholder={`Ej: En la parte derecha aparece el BLOCK CODE y el estado de la cuenta. Necesito que verifique si está bloqueada y los comentarios del agente...`}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-200 resize-none
                               focus:outline-none focus:border-brand-600/50 placeholder:text-slate-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleImgAnalyze}
                  disabled={imgAnalyzing || !imgFile}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                             bg-brand-500/15 border border-brand-700/30 text-brand-300 text-sm font-semibold
                             hover:bg-brand-500/25 disabled:opacity-50 transition-all"
                >
                  {imgAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {imgAnalyzing ? 'Analizando imagen con IA...' : 'Analizar y generar campos'}
                </button>

                {hasResult && (
                  <div className="space-y-4 animate-fadeIn pt-2 border-t border-slate-700/40">

                    {/* Banner editable */}
                    <div className="px-3 py-2 rounded-xl bg-brand-500/10 border border-brand-700/20">
                      <p className="text-[11px] text-brand-300 leading-relaxed">
                        <strong>Todo es editable.</strong> Revisa, ajusta y desmarca lo que no necesites antes de aplicar.
                      </p>
                    </div>

                    {/* Pistas de detección — EDITABLE */}
                    <div>
                      <label className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                          Pistas de detección (cómo identificar esta pantalla)
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditableHints('')}
                          className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                        >
                          Limpiar
                        </button>
                      </label>
                      <textarea
                        value={editableHints}
                        onChange={e => setEditableHints(e.target.value)}
                        rows={4}
                        placeholder="Describe cómo se identifica visualmente esta pantalla..."
                        className="w-full bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2.5 text-xs text-slate-200 resize-y
                                   focus:outline-none focus:border-brand-600/50 placeholder:text-slate-600 leading-relaxed"
                      />
                      <p className="text-[10px] text-slate-600 mt-1">
                        Este texto entra al prompt de la IA cuando analiza imágenes reales en auditorías.
                      </p>
                    </div>

                    {/* Campos editables */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                          {editableFields.length} campo{editableFields.length !== 1 ? 's' : ''} detectado{editableFields.length !== 1 ? 's' : ''}
                          {selectedFieldsCount !== editableFields.length && (
                            <span className="ml-1 text-brand-400 font-normal normal-case">· {selectedFieldsCount} seleccionado{selectedFieldsCount !== 1 ? 's' : ''}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleAll}
                            className="text-[10px] text-slate-500 hover:text-brand-400 transition-colors"
                          >
                            {editableFields.every(f => f.selected) ? 'Desmarcar todos' : 'Seleccionar todos'}
                          </button>
                          <span className="text-slate-700">·</span>
                          <button
                            type="button"
                            onClick={addBlankField}
                            className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <Plus size={9} /> Añadir campo
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {editableFields.map((f, idx) => {
                          const isExpanded = expandedField === idx;
                          return (
                            <div
                              key={idx}
                              className={`rounded-xl border transition-all duration-150 ${
                                !f.selected ? 'opacity-40 bg-slate-800/20 border-slate-700/30'
                                : isExpanded ? 'bg-slate-800/60 border-brand-700/30'
                                : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60'
                              }`}
                            >
                              {/* Header del campo (siempre visible) */}
                              <div className="flex items-start gap-2 p-2.5">
                                <input
                                  type="checkbox"
                                  checked={f.selected}
                                  onChange={() => updateField(idx, { selected: !f.selected })}
                                  className="w-3.5 h-3.5 accent-brand-500 cursor-pointer mt-0.5 flex-shrink-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => setExpandedField(isExpanded ? null : idx)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs text-purple-300 font-bold truncate">
                                      {f.field_name || <span className="text-slate-600 italic">sin nombre</span>}
                                    </span>
                                    {f.example && (
                                      <span className="text-[10px] text-slate-500 italic truncate">ej: {f.example}</span>
                                    )}
                                  </div>
                                  {!isExpanded && f.description && (
                                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{f.description}</p>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedField(isExpanded ? null : idx)}
                                  className="p-1 text-slate-600 hover:text-brand-400 transition-colors"
                                >
                                  <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeField(idx); if (expandedField === idx) setExpandedField(null); }}
                                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                                  title="Eliminar campo"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>

                              {/* Detalle editable */}
                              {isExpanded && (
                                <div className="px-2.5 pb-2.5 space-y-2 animate-fadeIn border-t border-slate-700/40 pt-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                                        Nombre del campo
                                      </label>
                                      <input
                                        value={f.field_name}
                                        onChange={e => updateField(idx, { field_name: e.target.value })}
                                        placeholder="snake_case"
                                        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[11px] font-mono text-purple-200
                                                   focus:outline-none focus:border-brand-600/50 placeholder:text-slate-600"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                                        Ejemplo
                                      </label>
                                      <input
                                        value={f.example}
                                        onChange={e => updateField(idx, { example: e.target.value })}
                                        placeholder="Valor visible"
                                        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[11px] text-slate-200
                                                   focus:outline-none focus:border-brand-600/50 placeholder:text-slate-600"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                                      Descripción (qué representa)
                                    </label>
                                    <textarea
                                      value={f.description}
                                      onChange={e => updateField(idx, { description: e.target.value })}
                                      rows={2}
                                      placeholder="Qué significa este campo..."
                                      className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 resize-none
                                                 focus:outline-none focus:border-brand-600/50 placeholder:text-slate-600"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-brand-400/80 font-semibold uppercase tracking-wider mb-1">
                                      ↳ Cómo debe evaluarlo la IA (prompt)
                                    </label>
                                    <textarea
                                      value={f.how_to_evaluate}
                                      onChange={e => updateField(idx, { how_to_evaluate: e.target.value })}
                                      rows={3}
                                      placeholder="Instrucción para la IA evaluadora..."
                                      className="w-full bg-slate-900/60 border border-brand-700/25 rounded-lg px-2 py-1.5 text-[11px] text-brand-100 resize-y
                                                 focus:outline-none focus:border-brand-600/50 placeholder:text-slate-600"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {editableFields.length === 0 && (
                        <div className="text-center py-4 text-[11px] text-slate-600">
                          No quedan campos. Haz clic en "+ Añadir campo" para crear uno manual.
                        </div>
                      )}
                    </div>

                    {/* Aplicar */}
                    <button
                      type="button"
                      onClick={applyImgResult}
                      disabled={selectedFieldsCount === 0 && !editableHints.trim()}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                                 bg-green-500/15 border border-green-500/30 text-green-300 text-sm font-semibold
                                 hover:bg-green-500/25 disabled:opacity-40 transition-all"
                    >
                      <Check size={13} />
                      Aplicar al sistema · {selectedFieldsCount} campo{selectedFieldsCount !== 1 ? 's' : ''}
                      {editableHints.trim() && ' + pistas'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campos extraídos</p>
            <button
              onClick={() => setShowAddField(!showAddField)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium
                         bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 transition-all"
            >
              <Plus size={11} /> Agregar campo
            </button>
          </div>

          {/* Formulario agregar campo */}
          {showAddField && (
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3 mb-3 grid grid-cols-3 gap-2">
              <input
                value={newField.field_name}
                onChange={e => setNewField(p => ({ ...p, field_name: e.target.value }))}
                placeholder="field_name"
                className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono
                           focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
              />
              <input
                value={newField.description}
                onChange={e => setNewField(p => ({ ...p, description: e.target.value }))}
                placeholder="Descripción del campo"
                className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200
                           focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
              />
              <div className="flex gap-1">
                <input
                  value={newField.example ?? ''}
                  onChange={e => setNewField(p => ({ ...p, example: e.target.value }))}
                  placeholder="Ejemplo (opcional)"
                  className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200
                             focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
                />
                <button
                  onClick={handleAddField}
                  disabled={!newField.field_name.trim() || !newField.description.trim()}
                  className="px-2 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400
                             hover:bg-purple-500/25 transition-all disabled:opacity-40"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => setShowAddField(false)}
                  className="px-2 py-1.5 rounded-lg bg-slate-700/40 text-slate-400 hover:text-slate-200 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {fields.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-3">Sin campos definidos. Agrega campos para que la IA los extraiga.</p>
          ) : (
            <div className="bg-slate-950/40 rounded-lg overflow-hidden border border-slate-800/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/60 bg-slate-800/30">
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">Campo</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">Descripción</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">Ejemplo</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, idx) => (
                    <tr key={idx} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-2 font-mono text-purple-300/80">{f.field_name}</td>
                      <td className="px-3 py-2 text-slate-300">{f.description}</td>
                      <td className="px-3 py-2 text-slate-500 italic">{f.example || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleRemoveField(idx)}
                          className="p-1 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TIPOS DE LLAMADA
// ═══════════════════════════════════════════════════════════════

function CallTypesTab() {
  const [items, setItems] = useState<CallTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newModes, setNewModes] = useState<string[]>(['INBOUND', 'MONITOREO']);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editModes, setEditModes] = useState<string[]>([]);

  const ALL_MODES = ['INBOUND', 'MONITOREO'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callTypesConfigService.getAll();
      setItems(data);
    } catch {
      toast.error('Error al cargar tipos de llamada');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim() || newModes.length === 0) {
      toast.error('Nombre y al menos un modo son requeridos');
      return;
    }
    setSaving(true);
    try {
      await callTypesConfigService.create({ name: newName.trim().toUpperCase(), modes: newModes });
      toast.success('Tipo de llamada creado');
      setNewName('');
      setNewModes(['INBOUND', 'MONITOREO']);
      setShowAdd(false);
      load();
    } catch {
      toast.error('Error al crear tipo de llamada');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: CallTypeConfig) => {
    try {
      await callTypesConfigService.update(item.id, { is_active: !item.is_active });
      load();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await callTypesConfigService.update(id, { name: editName.trim().toUpperCase(), modes: editModes });
      toast.success('Tipo actualizado');
      setEditingId(null);
      load();
    } catch {
      toast.error('Error al actualizar tipo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await callTypesConfigService.remove(id);
      toast.success('Tipo eliminado');
      load();
    } catch {
      toast.error('Error al eliminar tipo');
    }
  };

  const toggleMode = (mode: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(mode) ? current.filter(m => m !== mode) : [...current, mode]);
  };

  const MODE_META: Record<string, { label: string; desc: string; color: string }> = {
    INBOUND:   { label: 'Inbound',   desc: 'Cliente llamó al banco (entrante)',                        color: 'bg-teal-500/10 border-teal-500/30 text-teal-300' },
    MONITOREO: { label: 'Monitoreo', desc: 'Banco llamó al cliente — Outbound (supervisión de calidad)', color: 'bg-violet-500/10 border-violet-500/30 text-violet-300' },
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div className="space-y-5">

      {/* ── Explicación de conceptos ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 flex gap-3 items-start">
          <div className="mt-0.5 p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
            <PhoneCall size={14} className="text-teal-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">Calificación</p>
            <p className="text-xs text-slate-500 mt-0.5">El tipo de caso según la atención: FRAUDE, TH CONFIRMA, etc. Organiza criterios, scripts y plantilla.</p>
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 flex gap-3 items-start">
          <div className="mt-0.5 p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Monitor size={14} className="text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">Modo de atención</p>
            <p className="text-xs text-slate-500 mt-0.5"><span className="text-teal-400 font-medium">Inbound</span> = cliente llamó al banco (entrante). <span className="text-violet-400 font-medium">Monitoreo</span> = banco llamó al cliente, outbound (supervisión de calidad).</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Cada calificación define en qué modos de atención puede aparecer.
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     bg-teal-500/10 border border-teal-500/30 text-teal-300
                     hover:bg-teal-500/20 transition-all whitespace-nowrap"
        >
          <Plus size={14} /> Nueva calificación
        </button>
      </div>

      {/* ── Aviso ── */}
      <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
        <AlertTriangle size={12} />
        Cambiar el nombre de una calificación afecta los criterios, scripts y plantilla que ya la usan.
      </div>

      {/* ── Formulario agregar ── */}
      {showAdd && (
        <div className="bg-slate-800/60 border border-teal-500/20 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-300">Nueva calificación</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre de la calificación</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="ej: FRAUDE INTERNACIONAL"
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200
                         focus:outline-none focus:border-teal-500/50 placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">¿En qué modos de atención aplica?</label>
            <div className="flex gap-2">
              {ALL_MODES.map(m => {
                const meta = MODE_META[m] ?? { label: m, desc: '', color: 'bg-slate-700/40 border-slate-600/40 text-slate-400' };
                const active = newModes.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMode(m, newModes, setNewModes)}
                    className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-medium border transition-all text-left
                      ${active ? meta.color : 'bg-slate-800/40 border-slate-700/40 text-slate-500'}`}
                  >
                    <span className="font-semibold block">{meta.label}</span>
                    <span className="opacity-70">{meta.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 border border-slate-700/40 hover:text-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                         bg-teal-500/15 border border-teal-500/40 text-teal-300
                         hover:bg-teal-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Crear
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de calificaciones ── */}
      {items.length === 0 ? (
        <EmptyState
          icon={<PhoneCall size={28} className="text-slate-600" />}
          title="Sin calificaciones configuradas"
          description="Agrega calificaciones para organizar criterios, scripts y plantilla"
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className={`bg-slate-900/50 border rounded-xl p-4 transition-all
                ${item.is_active !== false ? 'border-slate-700/40' : 'border-slate-800/40 opacity-50'}`}
            >
              {editingId === item.id ? (
                /* ── Modo edición ── */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nombre de la calificación</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600/40 rounded-lg px-3 py-2 text-sm text-slate-200
                                 focus:outline-none focus:border-teal-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Modos de atención disponibles</label>
                    <div className="flex gap-2">
                      {ALL_MODES.map(m => {
                        const meta = MODE_META[m] ?? { label: m, desc: '', color: 'bg-slate-700/40 border-slate-600/40 text-slate-400' };
                        const active = editModes.includes(m);
                        return (
                          <button
                            key={m}
                            onClick={() => toggleMode(m, editModes, setEditModes)}
                            className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-medium border transition-all text-left
                              ${active ? meta.color : 'bg-slate-800/40 border-slate-700/40 text-slate-500'}`}
                          >
                            <span className="font-semibold block">{meta.label}</span>
                            <span className="opacity-70">{meta.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-slate-400 border border-slate-700/40 hover:text-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
                                 bg-brand-500/10 border border-brand-500/30 text-brand-400
                                 hover:bg-brand-500/20 transition-all disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Modo lectura ── */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold text-sm px-3 py-1 rounded-lg
                        ${item.is_active !== false
                          ? 'text-teal-300 bg-teal-500/10 border border-teal-500/25'
                          : 'text-slate-500 bg-slate-800/40 border border-slate-700/30'
                        }`}>
                        {item.name}
                      </span>
                      {item.is_active === false && (
                        <span className="text-xs text-slate-600 italic">inactivo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleActive(item)} className="transition-opacity hover:opacity-80" title={item.is_active !== false ? 'Desactivar' : 'Activar'}>
                        {item.is_active !== false
                          ? <ToggleRight size={20} className="text-brand-400" />
                          : <ToggleLeft size={20} className="text-slate-600" />
                        }
                      </button>
                      <button
                        onClick={() => { setEditingId(item.id); setEditName(item.name); setEditModes(item.modes || []); }}
                        className="p-1.5 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-400 hover:text-slate-200 transition-all"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1.5">Modos de atención disponibles</p>
                    <div className="flex gap-2">
                      {(item.modes || []).map(m => {
                        const meta = MODE_META[m] ?? { label: m, desc: '', color: 'bg-slate-700/40 border-slate-600/40 text-slate-400' };
                        return (
                          <div key={m} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${meta.color}`}>
                            <span className="font-semibold">{meta.label}</span>
                            <span className="opacity-60">— {meta.desc}</span>
                          </div>
                        );
                      })}
                      {(item.modes || []).length === 0 && (
                        <span className="text-xs text-slate-600 italic">Sin modos asignados</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Bines (admin — CRUD) ───────────────────────────────

const CATEGORIAS_BINES = [
  { label: 'Tarjetas de crédito', orden: 1 },
  { label: 'Tarjetas Departamentales', orden: 2 },
  { label: 'Tarjetas de Préstamo personal', orden: 3 },
];

const emptyBinForm = {
  categoria: 'Tarjetas de crédito',
  categoria_orden: 1,
  nombre: '',
  bin: '',
  socio: '',
  producto: '',
  nombre_comercial: '',
  marca: '',
};

function BinesAdminTab() {
  const [items, setItems] = useState<BinesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BinesItem>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ ...emptyBinForm });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await binesService.getAll());
    } catch {
      toast.error('Error al cargar bines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grupos = Array.from(
    items.reduce((map, item) => {
      const list = map.get(item.categoria) ?? [];
      list.push(item);
      return map.set(item.categoria, list);
    }, new Map<string, BinesItem[]>()).entries()
  ).sort(([, a], [, b]) => a[0].categoria_orden - b[0].categoria_orden);

  const handleStartEdit = (item: BinesItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => { setEditingId(null); setEditForm({}); };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await binesService.update(editingId, editForm);
      toast.success('BIN actualizado');
      setEditingId(null);
      setEditForm({});
      await load();
    } catch {
      toast.error('Error al actualizar BIN');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BinesItem) => {
    if (!confirm(`¿Eliminar "${item.nombre}" (BIN ${item.bin})?`)) return;
    try {
      await binesService.remove(item.id);
      toast.success('BIN eliminado');
      await load();
    } catch {
      toast.error('Error al eliminar BIN');
    }
  };

  const handleCreate = async () => {
    if (!newForm.nombre || !newForm.bin || !newForm.socio || !newForm.producto) {
      toast.error('Nombre, BIN, Socio y Producto son requeridos');
      return;
    }
    setSaving(true);
    try {
      const catItems = items.filter(i => i.categoria === newForm.categoria);
      const maxOrder = catItems.length > 0 ? Math.max(...catItems.map(i => i.item_order)) + 1 : 0;
      await binesService.create({
        categoria: newForm.categoria,
        categoria_orden: newForm.categoria_orden,
        item_order: maxOrder,
        nombre: newForm.nombre,
        bin: newForm.bin,
        socio: newForm.socio,
        producto: newForm.producto,
        nombre_comercial: newForm.nombre_comercial || null,
        marca: newForm.marca || null,
      });
      toast.success('BIN agregado');
      setShowAdd(false);
      setNewForm({ ...emptyBinForm });
      await load();
    } catch {
      toast.error('Error al crear BIN');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/60 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <CreditCard size={18} className="text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Tabla de BINs Bancarios</p>
            <p className="text-xs text-slate-500 mt-0.5">{items.length} registros en total</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                     bg-rose-500/10 border border-rose-700/40 text-rose-300
                     text-xs font-medium hover:bg-rose-500/20 transition-all duration-150"
        >
          <Plus size={13} />
          Agregar BIN
        </button>
      </div>

      {/* Formulario de nuevo BIN */}
      {showAdd && (
        <div className="bg-slate-900/60 border border-rose-700/30 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-rose-300 mb-1">Nuevo BIN</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Categoría</label>
              <select
                value={newForm.categoria}
                onChange={e => {
                  const cat = CATEGORIAS_BINES.find(c => c.label === e.target.value);
                  setNewForm(f => ({ ...f, categoria: e.target.value, categoria_orden: cat?.orden ?? 0 }));
                }}
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-700/60"
              >
                {CATEGORIAS_BINES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Nombre</label>
              <input value={newForm.nombre} onChange={e => setNewForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Bodega Visa"
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-700/60" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">BIN</label>
              <input value={newForm.bin} onChange={e => setNewForm(f => ({ ...f, bin: e.target.value }))}
                placeholder="Ej: 481283"
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-rose-700/60" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Socio</label>
              <input value={newForm.socio} onChange={e => setNewForm(f => ({ ...f, socio: e.target.value }))}
                placeholder="Ej: Bodega"
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-700/60" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Producto</label>
              <input value={newForm.producto} onChange={e => setNewForm(f => ({ ...f, producto: e.target.value }))}
                placeholder="Ej: Visa / PLCC / PL"
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-700/60" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Nombre comercial / Marca</label>
              <input value={newForm.nombre_comercial || newForm.marca}
                onChange={e => {
                  if (newForm.categoria === 'Tarjetas de crédito') {
                    setNewForm(f => ({ ...f, nombre_comercial: e.target.value, marca: '' }));
                  } else {
                    setNewForm(f => ({ ...f, marca: e.target.value, nombre_comercial: '' }));
                  }
                }}
                placeholder="Ej: Bradescard Total / Carnet"
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-700/60" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-700/40 text-rose-300 text-sm font-medium hover:bg-rose-500/30 transition-all disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Guardar
            </button>
            <button onClick={() => { setShowAdd(false); setNewForm({ ...emptyBinForm }); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400 text-sm font-medium hover:bg-slate-700/60 transition-all">
              <X size={14} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla agrupada por categoría */}
      {grupos.map(([categoria, rows]) => (
        <div key={categoria} className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-slate-950/40 border-b border-slate-800/60">
            <CreditCard size={14} className="text-rose-400" />
            <span className="text-sm font-semibold text-white">{categoria}</span>
            <span className="ml-auto text-xs text-slate-500">{rows.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/30">
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Nombre</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-24">BIN</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Socio</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-20">Producto</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Nombre comercial / Marca</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(item => (
                  editingId === item.id ? (
                    // ── Fila en modo edición ──
                    <tr key={item.id} className="border-b border-rose-800/30 bg-rose-950/10">
                      <td className="py-2 px-4">
                        <input value={editForm.nombre ?? ''} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-rose-700/60" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={editForm.bin ?? ''} onChange={e => setEditForm(f => ({ ...f, bin: e.target.value }))}
                          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 text-sm font-mono text-white focus:outline-none focus:border-rose-700/60" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={editForm.socio ?? ''} onChange={e => setEditForm(f => ({ ...f, socio: e.target.value }))}
                          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-rose-700/60" />
                      </td>
                      <td className="py-2 px-3">
                        <input value={editForm.producto ?? ''} onChange={e => setEditForm(f => ({ ...f, producto: e.target.value }))}
                          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-rose-700/60" />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          value={(editForm.nombre_comercial ?? editForm.marca) ?? ''}
                          onChange={e => {
                            if (item.categoria === 'Tarjetas de crédito') {
                              setEditForm(f => ({ ...f, nombre_comercial: e.target.value, marca: null }));
                            } else {
                              setEditForm(f => ({ ...f, marca: e.target.value, nombre_comercial: null }));
                            }
                          }}
                          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-rose-700/60" />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={handleSaveEdit} disabled={saving}
                            className="p-1.5 rounded-lg bg-brand-500/20 border border-brand-700/40 text-brand-300 hover:bg-brand-500/30 transition-all disabled:opacity-50">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          </button>
                          <button onClick={handleCancelEdit}
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-400 hover:bg-slate-700/60 transition-all">
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // ── Fila en modo vista ──
                    <tr key={item.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 group transition-colors duration-150">
                      <td className="py-2.5 px-4 text-sm text-slate-200">{item.nombre}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-700/20 text-rose-300">{item.bin}</span>
                      </td>
                      <td className="py-2.5 px-3 text-sm text-slate-300">{item.socio}</td>
                      <td className="py-2.5 px-3 text-sm text-slate-400">{item.producto}</td>
                      <td className="py-2.5 px-3 text-sm text-slate-400">{item.nombre_comercial ?? item.marca ?? '—'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button onClick={() => handleStartEdit(item)}
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

