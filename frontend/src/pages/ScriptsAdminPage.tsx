// frontend/src/pages/ScriptsAdminPage.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import toast from 'react-hot-toast';
import {
  BookOpen,
  ClipboardList,
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
} from 'lucide-react';
import {
  scriptsService,
  criteriaService,
  type ScriptStep,
  type CriteriaBlock,
  type CriteriaItem,
} from '../services/api';

const CALL_TYPES = ['FRAUDE', 'TH CONFIRMA'];

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
  const [activeTab, setActiveTab] = useState<'scripts' | 'criteria'>('criteria');

  return (
    <div className="min-h-screen text-white">
      <AppHeader showBack onBack={() => navigate('/dashboard')} />
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* ── Page Header ── */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-brand-400/70 mb-2">
            Administración
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Scripts y Criterios</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Edita los guiones de los agentes y las rúbricas de evaluación sin modificar el código.
          </p>
        </div>

        {/* ── Tab Selector ── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
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
                                : 'bg-violet-600/10 border-violet-500/40 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
                              : 'bg-slate-900/50 border-slate-800/60 hover:bg-slate-900/80 hover:border-slate-700/60'
                            }`}
              >
                {/* Glow de fondo al estar activo */}
                {isActive && (
                  <div className={`absolute inset-0 opacity-5 pointer-events-none
                    ${color === 'blue'
                      ? 'bg-gradient-to-br from-brand-900/30 to-brand-800/30'
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
                                     : 'bg-violet-500/20 border border-violet-500/30'
                                   : 'bg-slate-800/60 border border-slate-700/40 group-hover:bg-slate-800'
                                 }`}>
                  <Icon
                    size={18}
                    className={`transition-colors duration-300
                      ${isActive
                        ? color === 'blue' ? 'text-brand-400' : 'text-violet-400'
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
                      ? color === 'blue' ? 'text-brand-400/70' : 'text-violet-400/70'
                      : 'text-slate-600 group-hover:text-slate-500'
                    }`}>
                    {description}
                  </span>
                </div>

                {/* Indicador activo (punto derecho) */}
                {isActive && (
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full
                    ${color === 'blue' ? 'bg-brand-500/10' : 'bg-violet-400'}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div key={activeTab} className="animate-fadeIn">
          {activeTab === 'scripts' ? <ScriptsTab /> : <CriteriaTab />}
        </div>

      </div>
    </div>
  );
}

// ─── Pill Selector de Call Type ───────────────────────────────

interface CallTypeSelectorProps {
  selected: string;
  onChange: (ct: string) => void;
}

function CallTypeSelector({ selected, onChange }: CallTypeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {CALL_TYPES.map((ct) => (
        <button
          key={ct}
          onClick={() => onChange(ct)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
            selected === ct
              ? 'bg-brand-500/10 border-brand-700/40 text-brand-300 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
              : 'bg-transparent border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          {ct}
        </button>
      ))}
    </div>
  );
}

// ─── Tab: Scripts ────────────────────────────────────────────

function ScriptsTab() {
  const [scripts, setScripts] = useState<ScriptStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallType, setSelectedCallType] = useState<string>(CALL_TYPES[0]);

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

  const grouped = groupByCallType(scripts);
  const currentSteps = (grouped[selectedCallType] || []).sort((a, b) => a.step_order - b.step_order);

  const handleAddStep = async () => {
    const newOrder = currentSteps.length > 0
      ? Math.max(...currentSteps.map((s) => s.step_order)) + 1
      : 1;
    try {
      await scriptsService.create({
        call_type: selectedCallType,
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
      {/* Selector */}
      <div className="mb-4">
        <CallTypeSelector selected={selectedCallType} onChange={setSelectedCallType} />
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
  const [selectedCallType, setSelectedCallType] = useState<string>(CALL_TYPES[0]);

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

  const grouped = groupByCallType(blocks);
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
      {/* Selector + Stat Chips */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <CallTypeSelector selected={selectedCallType} onChange={setSelectedCallType} />

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
      <td className="py-4 px-4" colSpan={5}>
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

