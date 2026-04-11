// frontend/src/pages/ScriptsAdminPage.tsx

import { useState, useEffect, useCallback } from 'react';
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
  ChevronUp,
  AlertTriangle,
  Save,
  RotateCcw,
} from 'lucide-react';
import {
  scriptsService,
  criteriaService,
  type ScriptStep,
  type CriteriaBlock,
  type CriteriaItem,
} from '../services/api';

const CALL_TYPES = ['FRAUDE', 'MONITOREO', 'TH CONFIRMA'];

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
  const [activeTab, setActiveTab] = useState<'scripts' | 'criteria'>('scripts');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Administración de Scripts y Criterios</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Edita los guiones de los agentes y las rúbricas de evaluación sin modificar el código.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('scripts')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'scripts'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen size={16} />
            Scripts de Agentes
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'criteria'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardList size={16} />
            Criterios de Evaluación
          </button>
        </div>

        {activeTab === 'scripts' ? <ScriptsTab /> : <CriteriaTab />}
      </div>
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
      ? Math.max(...currentSteps.map(s => s.step_order)) + 1
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Selector tipo de llamada */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CALL_TYPES.map(ct => (
          <button
            key={ct}
            onClick={() => setSelectedCallType(ct)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCallType === ct
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {ct}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {currentSteps.map(step => (
          <ScriptStepCard
            key={step.id}
            step={step}
            onUpdate={load}
            totalSteps={currentSteps.length}
          />
        ))}

        {currentSteps.length === 0 && (
          <div className="card p-8 text-center text-slate-400">
            No hay pasos definidos para {selectedCallType}. Agrega el primero.
          </div>
        )}

        <button onClick={handleAddStep} className="btn-secondary flex items-center gap-2 w-full justify-center py-3">
          <Plus size={16} />
          Agregar paso
        </button>
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
    <div className="card border border-slate-700/50">
      {/* Header del paso */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 text-sm font-bold flex items-center justify-center">
            {step.step_order}
          </span>

          {editingLabel ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={labelValue}
                onChange={e => setLabelValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') { setEditingLabel(false); setLabelValue(step.step_label); } }}
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              />
              <button onClick={handleSaveLabel} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
              <button onClick={() => { setEditingLabel(false); setLabelValue(step.step_label); }} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
          ) : (
            <span className="font-medium text-white truncate">{step.step_label}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button onClick={handleMoveUp} disabled={step.step_order <= 1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronUp size={16} />
          </button>
          <button onClick={handleMoveDown} disabled={step.step_order >= totalSteps} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronDown size={16} />
          </button>
          <button onClick={() => setEditingLabel(true)} className="p-1.5 text-slate-400 hover:text-blue-400">
            <Pencil size={16} />
          </button>
          <button onClick={handleDeleteStep} className="p-1.5 text-slate-400 hover:text-red-400">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:text-white ml-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Frases del paso */}
      {expanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-2">
          {saving && <p className="text-xs text-blue-400 flex items-center gap-1"><Save size={12} /> Guardando...</p>}

          {lines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2 group">
              <span className="flex-shrink-0 w-5 h-5 mt-1 rounded bg-slate-700 text-slate-400 text-xs flex items-center justify-center">{idx + 1}</span>

              {editingLineIdx === idx ? (
                <div className="flex-1 flex flex-col gap-1">
                  <textarea
                    autoFocus
                    value={lineValue}
                    onChange={e => setLineValue(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-blue-500/50 rounded px-3 py-2 text-sm text-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveLine} className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                      <Check size={12} /> Guardar
                    </button>
                    <button onClick={() => setEditingLineIdx(null)} className="btn-secondary py-1 px-3 text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-300 leading-relaxed">{line}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => handleMoveLine(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30">
                      <ChevronUp size={13} />
                    </button>
                    <button onClick={() => handleMoveLine(idx, 'down')} disabled={idx === lines.length - 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30">
                      <ChevronDown size={13} />
                    </button>
                    <button onClick={() => handleEditLine(idx)} className="p-1 text-slate-400 hover:text-blue-400">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDeleteLine(idx)} className="p-1 text-slate-400 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button onClick={handleAddLine} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2">
            <Plus size={14} /> Agregar frase
          </button>
        </div>
      )}
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
      .filter(c => c.applies && c.points !== null)
      .reduce((s, c) => s + (c.points ?? 0), 0);
    return sum + blockPts;
  }, 0);

  const handleAddBlock = async () => {
    const newOrder = currentBlocks.length > 0
      ? Math.max(...currentBlocks.map(b => b.block_order)) + 1
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Selector */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {CALL_TYPES.map(ct => (
            <button
              key={ct}
              onClick={() => setSelectedCallType(ct)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCallType === ct
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {ct}
            </button>
          ))}
        </div>
        <div className="text-sm text-slate-400">
          Puntaje máximo total: <span className="text-white font-semibold">{totalPoints} pts</span>
        </div>
      </div>

      <div className="space-y-4">
        {currentBlocks.map(block => (
          <CriteriaBlockCard key={block.id} block={block} onUpdate={load} />
        ))}

        {currentBlocks.length === 0 && (
          <div className="card p-8 text-center text-slate-400">
            No hay bloques definidos para {selectedCallType}. Agrega el primero.
          </div>
        )}

        <button onClick={handleAddBlock} className="btn-secondary flex items-center gap-2 w-full justify-center py-3">
          <Plus size={16} />
          Agregar bloque
        </button>
      </div>
    </div>
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
  const blockPoints = criteria.filter(c => c.applies && c.points !== null).reduce((s, c) => s + (c.points ?? 0), 0);
  const criticalCount = criteria.filter(c => c.criticality === 'Crítico' && c.applies).length;

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
    if (!confirm(`¿Eliminar el bloque "${block.block_name}" y todos sus criterios? Esta acción no se puede deshacer.`)) return;
    try {
      await criteriaService.removeBlock(block.id);
      toast.success('Bloque eliminado');
      onUpdate();
    } catch {
      toast.error('Error al eliminar bloque');
    }
  };

  const handleAddCriteria = async () => {
    const newOrder = criteria.length > 0 ? Math.max(...criteria.map(c => c.criteria_order)) + 1 : 1;
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
    <div className="card border border-slate-700/50">
      {/* Header bloque */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameValue(block.block_name); } }}
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
              />
              <button onClick={handleSaveName} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
              <button onClick={() => { setEditingName(false); setNameValue(block.block_name); }} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
          ) : (
            <span className="font-semibold text-white">{block.block_name}</span>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="badge badge-info text-xs">{blockPoints} pts</span>
            {criticalCount > 0 && (
              <span className="badge badge-danger flex items-center gap-1 text-xs">
                <AlertTriangle size={10} /> {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-slate-400 text-xs">{criteria.filter(c => c.applies).length} criterios</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button onClick={() => setEditingName(true)} className="p-1.5 text-slate-400 hover:text-blue-400">
            <Pencil size={16} />
          </button>
          <button onClick={handleDeleteBlock} className="p-1.5 text-slate-400 hover:text-red-400">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:text-white ml-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Tabla de criterios */}
      {expanded && (
        <div className="border-t border-slate-700/50">
          {criteria.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/30">
                    <th className="text-left py-2 px-4 text-slate-400 font-medium">Criterio</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-20">Puntos</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-24">Criticidad</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-16">Aplica</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map(c => (
                    editingCriteriaId === c.id
                      ? <CriteriaEditRow key={c.id} item={c} onSave={() => { setEditingCriteriaId(null); onUpdate(); }} onCancel={() => setEditingCriteriaId(null)} />
                      : <CriteriaViewRow key={c.id} item={c} onEdit={() => setEditingCriteriaId(c.id)} onUpdate={onUpdate} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4">
            <button onClick={handleAddCriteria} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
              <Plus size={14} /> Agregar criterio
            </button>
          </div>
        </div>
      )}
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
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/20 group">
      <td className="py-2 px-4 text-slate-300 max-w-xs">
        <div className="flex flex-col gap-0.5">
          <span className={item.applies ? '' : 'line-through opacity-40'}>{item.topic}</span>
          {item.what_to_look_for && (
            <span className="text-xs text-slate-500 truncate max-w-xs" title={item.what_to_look_for}>
              {item.what_to_look_for.substring(0, 80)}{item.what_to_look_for.length > 80 ? '…' : ''}
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-center">
        {item.points === null
          ? <span className="text-slate-500 text-xs">n/a</span>
          : <span className="font-medium text-white">{item.points}</span>}
      </td>
      <td className="py-2 px-3 text-center">
        {item.criticality === 'Crítico'
          ? <span className="badge badge-danger text-xs flex items-center gap-1 justify-center"><AlertTriangle size={10} /> Crítico</span>
          : <span className="text-slate-500 text-xs">-</span>}
      </td>
      <td className="py-2 px-3 text-center">
        <button
          onClick={handleToggleApplies}
          title={item.applies ? 'Deshabilitar' : 'Habilitar'}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
            item.applies
              ? 'bg-green-600 border-green-500'
              : 'bg-transparent border-slate-600 hover:border-slate-400'
          }`}
        >
          {item.applies && <Check size={10} />}
        </button>
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-400">
            <Pencil size={14} />
          </button>
          <button onClick={handleDelete} className="p-1 text-slate-400 hover:text-red-400">
            <Trash2 size={14} />
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
    <tr className="border-b border-blue-500/30 bg-blue-950/20">
      <td className="py-3 px-4" colSpan={5}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Criterio (tema)</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Puntos (o "n/a")</label>
              <input
                value={points}
                onChange={e => setPoints(e.target.value)}
                placeholder="5 o n/a"
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Criticidad</label>
              <select
                value={criticality}
                onChange={e => setCriticality(e.target.value as 'Crítico' | '-')}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white"
              >
                <option value="-">-</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applies}
                  onChange={e => setApplies(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                Aplica
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Qué buscar (instrucciones para la IA)</label>
            <textarea
              value={whatToLookFor}
              onChange={e => setWhatToLookFor(e.target.value)}
              rows={3}
              placeholder="Describe dónde y qué debe buscar la IA para evaluar este criterio..."
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary py-1.5 px-4 text-sm flex items-center gap-1.5">
              {saving ? <RotateCcw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={onCancel} disabled={saving} className="btn-secondary py-1.5 px-4 text-sm flex items-center gap-1">
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Spinner ─────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}
