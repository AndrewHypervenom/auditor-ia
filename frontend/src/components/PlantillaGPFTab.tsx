// frontend/src/components/PlantillaGPFTab.tsx
// Plantilla Cierre de GPF — editable (CRUD completo)

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { plantillaService, type PlantillaGPFItem } from '../services/api';
import ModeSelector, { type AdminMode } from './ModeSelector';
import CallTypeSelector from './CallTypeSelector';

// ── Helpers ──────────────────────────────────────────────────

function groupByCategoria(items: PlantillaGPFItem[]): Map<string, PlantillaGPFItem[]> {
  const map = new Map<string, PlantillaGPFItem[]>();
  for (const item of items) {
    const list = map.get(item.categoria) ?? [];
    list.push(item);
    map.set(item.categoria, list);
  }
  return map;
}

// ── Componente principal ─────────────────────────────────────

export default function PlantillaGPFTab() {
  const [items, setItems] = useState<PlantillaGPFItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [callType, setCallType] = useState('FRAUDE');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await plantillaService.getAll();
      setItems(data);
    } catch {
      toast.error('Error al cargar la Plantilla GPF');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredItems = items.filter((i) => i.mode === mode && i.call_type === callType);
  const grouped = groupByCategoria(filteredItems);

  const nextCategoriaOrden = () => {
    if (filteredItems.length === 0) return 1;
    return Math.max(...filteredItems.map((i) => i.categoria_orden)) + 1;
  };

  const handleAddCategoria = async () => {
    const nombre = prompt('Nombre de la nueva categoría:');
    if (!nombre?.trim()) return;
    try {
      await plantillaService.create({
        categoria: nombre.trim(),
        tipo_cierre: 'Nuevo tipo de cierre',
        descripcion: '',
        categoria_orden: nextCategoriaOrden(),
        tipo_orden: 1,
        call_type: callType,
        mode,
      });
      toast.success('Categoría agregada');
      load();
    } catch {
      toast.error('Error al agregar categoría');
    }
  };

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
      {/* Selector de modo */}
      <div className="mb-4">
        <ModeSelector selected={mode} onChange={setMode} />
      </div>

      {/* Selector de call type */}
      <div className="mb-5">
        <CallTypeSelector selected={callType} onChange={setCallType} />
      </div>

      <p className="mb-5 text-sm text-slate-400 leading-relaxed">
        Tabla editable de Cierre de GPF para{' '}
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
          <CategoriaCard
            key={categoria}
            categoria={categoria}
            items={catItems}
            callType={callType}
            mode={mode}
            onUpdate={load}
          />
        ))}

        {grouped.size === 0 && (
          <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
            <p className="text-sm">Sin categorías para {mode === 'INBOUND' ? 'Inbound' : 'Monitoreo'} — {callType}</p>
          </div>
        )}

        <button
          onClick={handleAddCategoria}
          className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl
                     border border-dashed border-slate-700/60 text-slate-500
                     hover:text-teal-400 hover:border-teal-700/50 hover:bg-teal-900/10
                     transition-all duration-200 text-sm"
        >
          <Plus size={15} />
          Agregar categoría
        </button>
      </div>
    </div>
  );
}

// ── Card de categoría ─────────────────────────────────────────

interface CategoriaCardProps {
  categoria: string;
  items: PlantillaGPFItem[];
  callType: string;
  mode: string;
  onUpdate: () => void;
}

function CategoriaCard({ categoria, items, callType, mode, onUpdate }: CategoriaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(categoria);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.tipo_orden - b.tipo_orden);

  const handleSaveName = async () => {
    setEditingName(false);
    if (nameValue.trim() === categoria) return;
    try {
      await plantillaService.renameCategoria(categoria, nameValue.trim(), callType, mode);
      toast.success('Categoría renombrada');
      onUpdate();
    } catch {
      toast.error('Error al renombrar categoría');
      setNameValue(categoria);
    }
  };

  const handleDeleteCategoria = async () => {
    if (!confirm(`¿Eliminar la categoría "${categoria}" y todos sus tipos de cierre?`)) return;
    try {
      await Promise.all(items.map((item) => plantillaService.remove(item.id)));
      toast.success('Categoría eliminada');
      onUpdate();
    } catch {
      toast.error('Error al eliminar categoría');
    }
  };

  const handleAddItem = async () => {
    const nextOrder = sorted.length > 0 ? Math.max(...sorted.map((i) => i.tipo_orden)) + 1 : 1;
    try {
      await plantillaService.create({
        categoria,
        tipo_cierre: 'Nuevo tipo de cierre',
        descripcion: '',
        categoria_orden: items[0]?.categoria_orden ?? 0,
        tipo_orden: nextOrder,
        call_type: callType,
        mode,
      });
      toast.success('Tipo de cierre agregado');
      onUpdate();
    } catch {
      toast.error('Error al agregar tipo de cierre');
    }
  };

  return (
    <div className="group bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden
                   transition-all duration-300 hover:border-slate-700/60 hover:bg-slate-900/80">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => !editingName && setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setEditingName(false); setNameValue(categoria); }
                }}
                className="flex-1 bg-slate-800/80 border border-slate-600/60 rounded-xl px-3 py-1.5
                           text-sm text-white focus:outline-none focus:border-teal-700/60"
              />
              <button onClick={handleSaveName} className="p-1.5 text-green-400 hover:text-green-300 transition-colors">
                <Check size={15} />
              </button>
              <button
                onClick={() => { setEditingName(false); setNameValue(categoria); }}
                className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <span className="font-semibold text-white text-[15px] truncate block">{categoria}</span>
          )}
        </div>

        <span className="flex-shrink-0 text-slate-500 text-xs tabular-nums">
          {sorted.length} {sorted.length === 1 ? 'tipo' : 'tipos'}
        </span>

        <div
          className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setEditingName(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all duration-150"
            title="Renombrar categoría"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDeleteCategoria}
            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
            title="Eliminar categoría"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {expanded && (
        <div className="border-t border-slate-800/60">
          <div className="grid grid-cols-[2fr_3fr_auto] gap-3 px-5 py-2 bg-slate-800/30">
            <span className="text-xs font-semibold text-teal-400/70 uppercase tracking-wider">Tipo de Cierre</span>
            <span className="text-xs font-semibold text-teal-400/70 uppercase tracking-wider">Descripción</span>
            <span className="w-16" />
          </div>

          <div className="divide-y divide-slate-800/40">
            {sorted.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                onStartEdit={() => setEditingId(item.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaved={() => { setEditingId(null); onUpdate(); }}
                onDeleted={() => onUpdate()}
              />
            ))}
          </div>

          <div className="px-5 py-3">
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500
                         border border-dashed border-slate-700/50
                         hover:text-teal-400 hover:border-teal-700/50 hover:bg-teal-900/10
                         transition-all duration-200"
            >
              <Plus size={13} />
              Agregar tipo de cierre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fila editable ─────────────────────────────────────────────

interface ItemRowProps {
  item: PlantillaGPFItem;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function ItemRow({ item, isEditing, onStartEdit, onCancelEdit, onSaved, onDeleted }: ItemRowProps) {
  const [tipoCierre, setTipoCierre] = useState(item.tipo_cierre);
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTipoCierre(item.tipo_cierre);
    setDescripcion(item.descripcion);
  }, [item]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await plantillaService.update(item.id, { tipo_cierre: tipoCierre.trim(), descripcion: descripcion.trim() });
      toast.success('Guardado');
      onSaved();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${item.tipo_cierre}"?`)) return;
    try {
      await plantillaService.remove(item.id);
      toast.success('Eliminado');
      onDeleted();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  if (isEditing) {
    return (
      <div className="px-5 py-3 bg-slate-800/20 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tipo de Cierre</label>
            <input
              autoFocus
              value={tipoCierre}
              onChange={(e) => setTipoCierre(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600/60 rounded-xl px-3 py-2
                         text-sm text-white focus:outline-none focus:border-teal-700/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descripción</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600/60 rounded-xl px-3 py-2
                         text-sm text-white focus:outline-none focus:border-teal-700/60"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10
                       border border-teal-700/40 text-teal-300 text-xs font-medium
                       hover:bg-teal-500/20 disabled:opacity-50 transition-all duration-150"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Guardar
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 rounded-xl text-slate-400 text-xs font-medium
                       hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-150"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/row grid grid-cols-[2fr_3fr_auto] gap-3 items-center px-5 py-3
                    hover:bg-slate-800/20 transition-colors">
      <span className="text-sm text-slate-300">{item.tipo_cierre}</span>
      <span className="text-sm text-slate-400">{item.descripcion}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150">
        <button
          onClick={onStartEdit}
          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all duration-150"
          title="Editar"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          title="Eliminar"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
