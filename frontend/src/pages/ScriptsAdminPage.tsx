// frontend/src/pages/ScriptsAdminPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
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
} from 'lucide-react';
import {
  scriptsService,
  criteriaService,
  promptsService,
  wordBoostService,
  imageSystemsService,
  callTypesConfigService,
  type ScriptStep,
  type CriteriaBlock,
  type CriteriaItem,
  type AiPrompt,
  type WordBoostTerm,
  type ImageSystem,
  type ImageSystemField,
  type CallTypeConfig,
} from '../services/api';
import PlantillaGPFTab from '../components/PlantillaGPFTab';
import ModeSelector, { type AdminMode } from '../components/ModeSelector';
import CallTypeSelectorShared from '../components/CallTypeSelector';
import { useCallTypesConfig } from '../hooks/useCallTypesConfig';

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
  const [activeTab, setActiveTab] = useState<'scripts' | 'criteria' | 'plantilla' | 'ai_prompts'>('criteria');

  return (
    <div className="min-h-screen text-white">
      <AppHeader showBack onBack={() => navigate('/dashboard')} title="Criterios, Scripts y Plantilla GPF" />
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ── Description ── */}
        <p className="mb-4 text-sm text-slate-400 leading-relaxed">
          Configura todo lo que define cómo opera el sistema: criterios de calificación, scripts de agentes, plantilla de cierre GPF y el comportamiento de la IA.
        </p>


        {/* ── Tab Selector ── */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
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
            },
          ]).map(({ key, icon: Icon, label, description, color }) => {
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
                                     : 'bg-violet-500/20 border border-violet-500/30'
                                   : 'bg-slate-800/60 border border-slate-700/40 group-hover:bg-slate-800'
                                 }`}>
                  <Icon
                    size={18}
                    className={`transition-colors duration-300
                      ${isActive
                        ? color === 'blue' ? 'text-brand-400' : color === 'teal' ? 'text-teal-400' : color === 'amber' ? 'text-amber-400' : 'text-violet-400'
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
                      ? color === 'blue' ? 'text-brand-400/70' : color === 'teal' ? 'text-teal-400/70' : color === 'amber' ? 'text-amber-400/70' : 'text-violet-400/70'
                      : 'text-slate-600 group-hover:text-slate-500'
                    }`}>
                    {description}
                  </span>
                </div>

                {/* Indicador activo (punto derecho) */}
                {isActive && (
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full
                    ${color === 'blue' ? 'bg-brand-500/10' : color === 'teal' ? 'bg-teal-400' : color === 'amber' ? 'bg-amber-400' : 'bg-violet-400'}`}
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

      {/* Selector de call type + Stat Chips */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <CallTypeSelectorShared selected={selectedCallType} onChange={setSelectedCallType} />

        <div className="flex items-center gap-2 flex-wrap">
          <StatChip icon={BarChart2} label={`${totalPoints} pts`} color="blue" />
          <StatChip icon={AlertTriangle} label={`${criticalCount} críticos`} color="red" />
          <StatChip icon={ListChecks} label={`${totalCriteria} criterios`} color="green" />
        </div>
      </div>

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
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null);

  const criteria = (block.criteria || []).sort((a, b) => a.criteria_order - b.criteria_order);
  const blockPoints = criteria.filter((c) => c.applies && c.points !== null).reduce((s, c) => s + (c.points ?? 0), 0);
  const criticalCount = criteria.filter((c) => c.criticality === 'Crítico' && c.applies).length;
  const appliedCount = criteria.filter((c) => c.applies).length;

  const handleSaveName = async () => {
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
      await criteriaService.createCriteria({
        block_id: block.id,
        topic: 'Nuevo criterio',
        criticality: '-',
        points: 5,
        applies: true,
        requires_manual_review: false,
        what_to_look_for: '',
        criteria_order: newOrder,
      });
      toast.success('Criterio agregado');
      onUpdate();
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
        {/* Nombre */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setEditingName(false); setNameValue(block.block_name); }
                }}
                className="flex-1 bg-slate-800/80 border border-slate-600/60 rounded-xl px-3 py-1.5
                           text-sm text-white focus:outline-none focus:border-brand-700/60"
              />
              <button onClick={handleSaveName} className="p-1.5 text-green-400 hover:text-green-300 transition-colors">
                <Check size={15} />
              </button>
              <button
                onClick={() => { setEditingName(false); setNameValue(block.block_name); }}
                className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <span className="font-semibold text-white text-[15px] truncate block">{block.block_name}</span>
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
        {criteria.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-sm">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Criterio
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-20">
                    Pts
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-24">
                    Criticidad
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-16">
                    Aplica
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-amber-600/70 w-24">
                    Val. Manual
                  </th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-20">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) =>
                  editingCriteriaId === c.id ? (
                    <CriteriaEditRow
                      key={c.id}
                      item={c}
                      onSave={() => { setEditingCriteriaId(null); onUpdate(); }}
                      onCancel={() => setEditingCriteriaId(null)}
                    />
                  ) : (
                    <CriteriaViewRow
                      key={c.id}
                      item={c}
                      onEdit={() => setEditingCriteriaId(c.id)}
                      onUpdate={onUpdate}
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-4">
          <button
            onClick={handleAddCriteria}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors duration-150"
          >
            <Plus size={14} />
            Agregar criterio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de criterio (vista) ─────────────────────────────────

interface CriteriaRowProps {
  item: CriteriaItem;
  onEdit: () => void;
  onUpdate: () => void;
}

function CriteriaViewRow({ item, onEdit, onUpdate }: CriteriaRowProps) {
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
      await criteriaService.updateCriteria(item.id, { applies: !item.applies });
      onUpdate();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleToggleManualReview = async () => {
    try {
      await criteriaService.updateCriteria(item.id, { requires_manual_review: !item.requires_manual_review });
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
          <span className={`text-[14px] leading-snug ${item.applies ? 'text-slate-200' : 'line-through text-slate-500'}`}>
            {item.topic}
          </span>
          {item.what_to_look_for && (
            <span className="text-[12px] text-slate-500 leading-relaxed line-clamp-2" title={item.what_to_look_for}>
              {item.what_to_look_for}
            </span>
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
          title={item.applies ? 'Deshabilitar' : 'Habilitar'}
          className="toggle-track mx-auto"
          style={{ backgroundColor: item.applies ? 'rgba(59,130,246,0.5)' : '' }}
        >
          <span
            className="toggle-thumb"
            style={{
              transform: item.applies ? 'translateX(16px)' : 'translateX(2px)',
              backgroundColor: item.applies ? '#fff' : '#64748b',
            }}
          />
        </button>
      </td>

      {/* Toggle Validación Manual */}
      <td className="py-3 px-3 text-center">
        <button
          onClick={handleToggleManualReview}
          title={item.requires_manual_review ? 'Quitar validación manual' : 'Marcar como validación manual'}
          className="toggle-track mx-auto"
          style={{ backgroundColor: item.requires_manual_review ? 'rgba(245,158,11,0.5)' : '' }}
        >
          <span
            className="toggle-thumb"
            style={{
              transform: item.requires_manual_review ? 'translateX(16px)' : 'translateX(2px)',
              backgroundColor: item.requires_manual_review ? '#fff' : '#64748b',
            }}
          />
        </button>
      </td>

      {/* Acciones */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10
                       transition-all duration-150"
          >
            <Pencil size={13} />
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
}

function CriteriaEditRow({ item, onSave, onCancel }: CriteriaEditRowProps) {
  const [topic, setTopic] = useState(item.topic);
  const [points, setPoints] = useState<string>(item.points === null ? 'n/a' : String(item.points));
  const [criticality, setCriticality] = useState<'Crítico' | '-'>(item.criticality);
  const [applies, setApplies] = useState(item.applies);
  const [whatToLookFor, setWhatToLookFor] = useState(item.what_to_look_for || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await criteriaService.updateCriteria(item.id, {
        topic,
        criticality,
        points: points === 'n/a' ? null : parseInt(points, 10),
        applies,
        what_to_look_for: whatToLookFor,
      });
      toast.success('Criterio actualizado');
      onSave();
    } catch {
      toast.error('Error al guardar criterio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-brand-700/20 bg-brand-500/10 animate-fadeIn">
      <td className="py-4 px-4" colSpan={6}>
        <div className="space-y-4">
          {/* Criterio */}
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

          <div className="grid grid-cols-3 gap-3">
            {/* Puntos */}
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

            {/* Criticidad */}
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

            {/* Aplica */}
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
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
                <span className="text-sm text-slate-300 font-medium">Aplica</span>
              </label>
            </div>
          </div>

          {/* Qué buscar */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
              Qué buscar (instrucciones para la IA)
            </label>
            <textarea
              value={whatToLookFor}
              onChange={(e) => setWhatToLookFor(e.target.value)}
              rows={3}
              placeholder="Describe dónde y qué debe buscar la IA para evaluar este criterio..."
              className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-2
                         text-sm text-white resize-none focus:outline-none focus:border-brand-700/60
                         focus:ring-1 focus:ring-brand-500/20"
            />
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

// ═══════════════════════════════════════════════════════════════
// SISTEMAS DE IMAGEN
// ═══════════════════════════════════════════════════════════════

function ImageSystemsTab() {
  const [systems, setSystems] = useState<ImageSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ImageSystem>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
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
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400 leading-relaxed">
          Sistemas detectados en capturas de pantalla bancarias. Definen qué campos extrae la IA de cada imagen.
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     bg-purple-500/10 border border-purple-500/30 text-purple-300
                     hover:bg-purple-500/20 transition-all whitespace-nowrap"
        >
          <Plus size={14} /> Nuevo sistema
        </button>
      </div>

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
        <EmptyState
          icon={<Monitor size={28} className="text-slate-600" />}
          title="Sin sistemas configurados"
          description="Agrega sistemas para que la IA pueda detectarlos en imágenes"
        />
      ) : (
        <div className="space-y-3">
          {systems.map(sys => (
            <ImageSystemCard
              key={sys.id}
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

