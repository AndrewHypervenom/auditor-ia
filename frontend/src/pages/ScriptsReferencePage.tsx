// frontend/src/pages/ScriptsReferencePage.tsx
// Vista de consulta (solo lectura) — Criterios, Scripts y Plantilla GPF

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import toast from 'react-hot-toast';
import {
  BookOpen,
  ClipboardList,
  Table,
  BarChart2,
  AlertTriangle,
  ListChecks,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  scriptsService,
  criteriaService,
  plantillaService,
  type ScriptStep,
  type CriteriaBlock,
  type CriteriaItem,
  type PlantillaGPFItem,
} from '../services/api';
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

function groupByCategoria(items: PlantillaGPFItem[]): Map<string, PlantillaGPFItem[]> {
  const map = new Map<string, PlantillaGPFItem[]>();
  for (const item of items) {
    const list = map.get(item.categoria) ?? [];
    list.push(item);
    map.set(item.categoria, list);
  }
  return map;
}

// ─── Skeleton ────────────────────────────────────────────────

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

// ─── Componente principal ────────────────────────────────────

export default function ScriptsReferencePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'criteria' | 'scripts' | 'plantilla'>('criteria');

  return (
    <div className="min-h-screen text-white">
      <AppHeader showBack onBack={() => navigate(-1)} title="Criterios, Scripts y Plantilla GPF" subtitle="Solo lectura" />
      <div className="max-w-5xl mx-auto px-6 py-6">

        <p className="mb-4 text-sm text-slate-400 leading-relaxed">
          Consulta los criterios de evaluación, scripts de agentes y la plantilla de cierre GPF configurados por el administrador.
        </p>

        {/* ── Tab Selector ── */}
        <div className="grid grid-cols-3 gap-3 mb-5">
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
                                : 'bg-violet-600/10 border-violet-500/40 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
                              : 'bg-slate-900/50 border-slate-800/60 hover:bg-slate-900/80 hover:border-slate-700/60'
                            }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 opacity-5 pointer-events-none
                    ${color === 'blue'
                      ? 'bg-gradient-to-br from-brand-900/30 to-brand-800/30'
                      : color === 'teal'
                      ? 'bg-gradient-to-br from-teal-400 to-teal-600'
                      : 'bg-gradient-to-br from-violet-400 to-violet-600'
                    }`}
                  />
                )}

                <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                                 transition-all duration-300
                                 ${isActive
                                   ? color === 'blue'
                                     ? 'bg-brand-500/10 border border-brand-700/40'
                                     : color === 'teal'
                                     ? 'bg-teal-500/20 border border-teal-500/30'
                                     : 'bg-violet-500/20 border border-violet-500/30'
                                   : 'bg-slate-800/60 border border-slate-700/40 group-hover:bg-slate-800'
                                 }`}>
                  <Icon
                    size={18}
                    className={`transition-colors duration-300
                      ${isActive
                        ? color === 'blue' ? 'text-brand-400' : color === 'teal' ? 'text-teal-400' : 'text-violet-400'
                        : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                  />
                </div>

                <div className="relative flex flex-col min-w-0">
                  <span className={`text-sm font-semibold transition-colors duration-200 truncate
                    ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    {label}
                  </span>
                  <span className={`text-xs mt-0.5 transition-colors duration-200 truncate
                    ${isActive
                      ? color === 'blue' ? 'text-brand-400/70' : color === 'teal' ? 'text-teal-400/70' : 'text-violet-400/70'
                      : 'text-slate-600 group-hover:text-slate-500'
                    }`}>
                    {description}
                  </span>
                </div>

                {isActive && (
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full
                    ${color === 'blue' ? 'bg-brand-400' : color === 'teal' ? 'bg-teal-400' : 'bg-violet-400'}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div key={activeTab} className="animate-fadeIn">
          {activeTab === 'criteria'
            ? <CriteriaRefTab />
            : activeTab === 'scripts'
            ? <ScriptsRefTab />
            : <PlantillaRefTab />
          }
        </div>

      </div>
    </div>
  );
}

// ─── Tab: Criterios (solo lectura) ───────────────────────────

function CriteriaRefTab() {
  const [blocks, setBlocks] = useState<CriteriaBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  const { callTypeNames: availableCallTypes } = useCallTypesConfig();

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
    return sum + (block.criteria || []).filter((c) => c.applies && c.points !== null).reduce((s, c) => s + (c.points ?? 0), 0);
  }, 0);
  const criticalCount = currentBlocks.reduce((sum, block) => {
    return sum + (block.criteria || []).filter((c) => c.criticality === 'Crítico' && c.applies).length;
  }, 0);
  const totalCriteria = currentBlocks.reduce((sum, block) => {
    return sum + (block.criteria || []).filter((c) => c.applies).length;
  }, 0);

  if (loading) return <SkeletonLoader />;

  return (
    <div>
      <div className="mb-4">
        <ModeSelector selected={mode} onChange={setMode} />
      </div>

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
          <CriteriaBlockReadCard key={block.id} block={block} />
        ))}
        {currentBlocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center">
              <ClipboardList size={28} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-medium">Sin criterios configurados</p>
              <p className="text-slate-600 text-sm mt-1">El administrador aún no ha cargado criterios para {selectedCallType}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CriteriaBlockReadCard({ block }: { block: CriteriaBlock }) {
  const [expanded, setExpanded] = useState(false);
  const criteria = (block.criteria || []).sort((a, b) => a.criteria_order - b.criteria_order);
  const blockPoints = criteria.filter((c) => c.applies && c.points !== null).reduce((s, c) => s + (c.points ?? 0), 0);
  const criticalCount = criteria.filter((c) => c.criticality === 'Crítico' && c.applies).length;
  const appliedCount = criteria.filter((c) => c.applies).length;

  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700/60">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-white text-[15px] truncate block">{block.block_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-700/15 text-brand-300 text-xs font-semibold tabular-nums">
            <BarChart2 size={10} />
            {blockPoints} pts
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/15 text-red-300 text-xs font-medium">
              <AlertTriangle size={10} />
              {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-slate-500 text-xs tabular-nums">{appliedCount} criterios</span>
        </div>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && criteria.length > 0 && (
        <div className="border-t border-slate-800/60">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-950/70">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Criterio</th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-20">Pts</th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-24">Criticidad</th>
                  <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 w-16">Aplica</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <CriteriaReadRow key={c.id} item={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CriteriaReadRow({ item }: { item: CriteriaItem }) {
  return (
    <tr className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors duration-150">
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
      <td className="py-3 px-3 text-center">
        {item.points === null ? (
          <span className="text-slate-600 text-xs">—</span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-700/15 text-brand-300 text-xs font-semibold tabular-nums">
            {item.points}
          </span>
        )}
      </td>
      <td className="py-3 px-3 text-center">
        {item.criticality === 'Crítico' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/15 text-red-300 text-xs font-medium">
            <AlertTriangle size={10} />
            Crítico
          </span>
        ) : (
          <span className="text-slate-700 text-sm">—</span>
        )}
      </td>
      <td className="py-3 px-3 text-center">
        <span className={`inline-block w-4 h-4 rounded-full border ${item.applies ? 'bg-brand-500/40 border-brand-500/60' : 'bg-slate-800 border-slate-700'}`} />
      </td>
    </tr>
  );
}

// ─── Tab: Scripts (solo lectura) ─────────────────────────────

function ScriptsRefTab() {
  const [scripts, setScripts] = useState<ScriptStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  const { callTypeNames: availableCallTypes } = useCallTypesConfig();

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

  if (loading) return <SkeletonLoader />;

  return (
    <div>
      <div className="mb-4">
        <ModeSelector selected={mode} onChange={setMode} />
      </div>
      <div className="mb-4">
        <CallTypeSelectorShared selected={selectedCallType} onChange={setSelectedCallType} />
      </div>

      <div className="space-y-3">
        {currentSteps.map((step) => (
          <ScriptStepReadCard key={step.id} step={step} />
        ))}
        {currentSteps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center">
              <BookOpen size={28} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-medium">Sin pasos definidos</p>
              <p className="text-slate-600 text-sm mt-1">El administrador aún no ha cargado scripts para {selectedCallType}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScriptStepReadCard({ step }: { step: ScriptStep }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700/60">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand-900/30 to-brand-800/30 border border-brand-700/40 text-brand-300 text-sm font-bold flex items-center justify-center tabular-nums">
          {step.step_order}
        </div>
        <span className="flex-1 font-semibold text-white text-[15px] truncate">{step.step_label}</span>
        <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-400 text-xs tabular-nums">
          {step.lines.length} {step.lines.length === 1 ? 'frase' : 'frases'}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && (
        <div className="border-t border-slate-800/60 px-5 py-4 space-y-2">
          {step.lines.map((line, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-lg bg-slate-800/60 text-slate-500 text-[11px] font-medium flex items-center justify-center tabular-nums">
                {idx + 1}
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Plantilla GPF (solo lectura) ───────────────────────

function PlantillaRefTab() {
  const [items, setItems] = useState<PlantillaGPFItem[]>([]);
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
      const data = await plantillaService.getAll();
      setItems(data);
    } catch {
      toast.error('Error al cargar Plantilla GPF');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredItems = items.filter((i) => i.mode === mode && i.call_type === callType);
  const grouped = groupByCategoria(filteredItems);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        Cargando plantilla...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <ModeSelector selected={mode} onChange={setMode} />
      </div>
      <div className="mb-5">
        <CallTypeSelectorShared selected={callType} onChange={setCallType} />
      </div>

      <p className="mb-5 text-sm text-slate-400 leading-relaxed">
        Plantilla de Cierre de GPF para{' '}
        <span className={mode === 'INBOUND' ? 'text-teal-400 font-medium' : 'text-violet-400 font-medium'}>
          {mode === 'INBOUND' ? 'Inbound' : 'Monitoreo'}
        </span>
        {' — '}
        <span className="text-brand-300 font-medium">{callType}</span>.
        La <span className="text-teal-400 font-medium">Calificación</span> corresponde a la Categoría y la{' '}
        <span className="text-teal-400 font-medium">Sub-calificación</span> al Tipo de Cierre.
      </p>

      <div className="space-y-3">
        {[...grouped.entries()].map(([categoria, catItems]) => (
          <CategoriaReadCard key={categoria} categoria={categoria} items={catItems} />
        ))}
        {grouped.size === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center">
              <Table size={28} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-slate-400 font-medium">Sin categorías configuradas</p>
              <p className="text-slate-600 text-sm mt-1">
                No hay plantilla para {mode === 'INBOUND' ? 'Inbound' : 'Monitoreo'} — {callType}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriaReadCard({ categoria, items }: { categoria: string; items: PlantillaGPFItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...items].sort((a, b) => a.tipo_orden - b.tipo_orden);

  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700/60">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex-1 font-semibold text-white text-[15px] truncate">{categoria}</span>
        <span className="flex-shrink-0 text-slate-500 text-xs tabular-nums">
          {sorted.length} {sorted.length === 1 ? 'tipo' : 'tipos'}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && (
        <div className="border-t border-slate-800/60">
          <div className="grid grid-cols-[2fr_3fr] gap-3 px-5 py-2 bg-slate-800/30">
            <span className="text-xs font-semibold text-teal-400/70 uppercase tracking-wider">Tipo de Cierre</span>
            <span className="text-xs font-semibold text-teal-400/70 uppercase tracking-wider">Descripción</span>
          </div>
          <div className="divide-y divide-slate-800/40">
            {sorted.map((item) => (
              <div key={item.id} className="grid grid-cols-[2fr_3fr] gap-3 px-5 py-3 hover:bg-slate-800/20 transition-colors duration-150">
                <span className="text-sm text-slate-200 leading-relaxed">{item.tipo_cierre}</span>
                <span className="text-sm text-slate-400 leading-relaxed">{item.descripcion || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
