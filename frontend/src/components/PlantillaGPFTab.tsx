// frontend/src/components/PlantillaGPFTab.tsx
// Plantilla Cierre de GPF — editable (CRUD completo)

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronDown, Loader2, Power, RotateCcw, EyeOff, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { plantillaService, type PlantillaGPFItem } from '../services/api';
import ModeSelector, { type AdminMode } from './ModeSelector';
import CallTypeSelector from './CallTypeSelector';
import { useCallTypesConfig } from '../hooks/useCallTypesConfig';

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
  const { t } = useTranslation();
  const [items, setItems] = useState<PlantillaGPFItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('INBOUND');
  const [callType, setCallType] = useState('');
  const [showInactive, setShowInactive] = useState(true);
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
      toast.error(t('plantilla.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const scopedItems = items.filter((i) => i.mode === mode && i.call_type === callType);
  const inactiveCount = scopedItems.filter((i) => i.is_active === false).length;
  const filteredItems = showInactive ? scopedItems : scopedItems.filter((i) => i.is_active !== false);
  const grouped = groupByCategoria(filteredItems);

  const nextCategoriaOrden = () => {
    if (filteredItems.length === 0) return 1;
    return Math.max(...filteredItems.map((i) => i.categoria_orden)) + 1;
  };

  const handleAddCategoria = async () => {
    const nombre = prompt(t('plantilla.newCategoryPrompt'));
    if (!nombre?.trim()) return;
    try {
      await plantillaService.create({
        categoria: nombre.trim(),
        tipo_cierre: t('plantilla.newClosureTypeDefault'),
        descripcion: '',
        categoria_orden: nextCategoriaOrden(),
        tipo_orden: 1,
        call_type: callType,
        mode,
      });
      toast.success(t('plantilla.categoryAdded'));
      load();
    } catch {
      toast.error(t('plantilla.categoryAddError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        {t('plantilla.loading')}
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
        {t('plantilla.introTable')}{' '}
        <span className={mode === 'INBOUND' ? 'text-teal-400 font-medium' : 'text-violet-400 font-medium'}>
          {mode === 'INBOUND' ? t('plantilla.inbound') : t('plantilla.monitoring')}
        </span>
        {' — '}
        <span className="text-brand-300 font-medium">{callType}</span>.
        {' '}{t('plantilla.introQual1')} <span className="text-teal-400 font-medium">{t('plantilla.qualificationLabel')}</span> {t('plantilla.introQual2')}{' '}
        <span className="text-teal-400 font-medium">{t('plantilla.subQualificationLabel')}</span> {t('plantilla.introQual3')}
      </p>

      {/* Toggle de inactivas — las que GPF dejó de entregar (reversible) */}
      {inactiveCount > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-2.5">
          <span className="text-xs text-slate-400">
            {t('plantilla.inactiveInfo', { count: inactiveCount })}
          </span>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-slate-800/60 border border-slate-700/50 text-slate-300
                       hover:bg-slate-800 hover:text-white transition-all duration-150"
          >
            {showInactive ? <EyeOff size={13} /> : <Eye size={13} />}
            {showInactive ? t('plantilla.hideInactive') : t('plantilla.showInactive')}
          </button>
        </div>
      )}

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
            <p className="text-sm">{t('plantilla.noCategories', { mode: mode === 'INBOUND' ? t('plantilla.inbound') : t('plantilla.monitoring'), callType })}</p>
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
          {t('plantilla.addCategory')}
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(categoria);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.tipo_orden - b.tipo_orden);
  const inactiveInCat = items.filter((i) => i.is_active === false).length;

  const handleSaveName = async () => {
    setEditingName(false);
    if (nameValue.trim() === categoria) return;
    try {
      await plantillaService.renameCategoria(categoria, nameValue.trim(), callType, mode);
      toast.success(t('plantilla.categoryRenamed'));
      onUpdate();
    } catch {
      toast.error(t('plantilla.renameError'));
      setNameValue(categoria);
    }
  };

  const handleDeleteCategoria = async () => {
    if (!confirm(t('plantilla.deleteCategoryConfirm', { name: categoria }))) return;
    try {
      await Promise.all(items.map((item) => plantillaService.remove(item.id)));
      toast.success(t('plantilla.categoryDeleted'));
      onUpdate();
    } catch {
      toast.error(t('plantilla.deleteCategoryError'));
    }
  };

  const handleAddItem = async () => {
    const nextOrder = sorted.length > 0 ? Math.max(...sorted.map((i) => i.tipo_orden)) + 1 : 1;
    try {
      await plantillaService.create({
        categoria,
        tipo_cierre: t('plantilla.newClosureTypeDefault'),
        descripcion: '',
        categoria_orden: items[0]?.categoria_orden ?? 0,
        tipo_orden: nextOrder,
        call_type: callType,
        mode,
      });
      toast.success(t('plantilla.closureAdded'));
      onUpdate();
    } catch {
      toast.error(t('plantilla.closureAddError'));
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

        {inactiveInCat > 0 && (
          <span
            title={t('plantilla.inactiveBadgeHint')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                       bg-slate-700/40 border border-slate-600/40 text-slate-400 text-[11px] font-medium tabular-nums"
          >
            <Power size={10} />
            {inactiveInCat}
          </span>
        )}
        <span className="flex-shrink-0 text-slate-500 text-xs tabular-nums">
          {t('plantilla.typesCount', { count: sorted.length })}
        </span>

        <div
          className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setEditingName(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all duration-150"
            title={t('plantilla.renameCategory')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDeleteCategoria}
            className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
            title={t('plantilla.deleteCategory')}
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
            <span className="text-xs font-semibold text-teal-400/70 uppercase tracking-wider">{t('plantilla.colClosureType')}</span>
            <span className="text-xs font-semibold text-teal-400/70 uppercase tracking-wider">{t('plantilla.colDescription')}</span>
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
              {t('plantilla.addClosureType')}
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
  const { t } = useTranslation();
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
      toast.success(t('plantilla.saved'));
      onSaved();
    } catch {
      toast.error(t('plantilla.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('plantilla.deleteItemConfirm', { name: item.tipo_cierre }))) return;
    try {
      await plantillaService.remove(item.id);
      toast.success(t('plantilla.deleted'));
      onDeleted();
    } catch {
      toast.error(t('plantilla.deleteError'));
    }
  };

  const inactive = item.is_active === false;

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      await plantillaService.update(item.id, { is_active: inactive });
      toast.success(inactive ? t('plantilla.reactivated') : t('plantilla.deactivated'));
      onDeleted(); // recarga la lista
    } catch {
      toast.error(t('plantilla.toggleError'));
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="px-5 py-3 bg-slate-800/20 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{t('plantilla.colClosureType')}</label>
            <input
              autoFocus
              value={tipoCierre}
              onChange={(e) => setTipoCierre(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600/60 rounded-xl px-3 py-2
                         text-sm text-white focus:outline-none focus:border-teal-700/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{t('plantilla.colDescription')}</label>
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
            {t('common.save')}
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 rounded-xl text-slate-400 text-xs font-medium
                       hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-150"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group/row grid grid-cols-[2fr_3fr_auto] gap-3 items-center px-5 py-3
                    hover:bg-slate-800/20 transition-colors ${inactive ? 'opacity-50' : ''}`}>
      <span className="flex items-center gap-2 min-w-0">
        <span className={`text-sm truncate ${inactive ? 'text-slate-400 line-through' : 'text-slate-300'}`}>{item.tipo_cierre}</span>
        {inactive && (
          <span
            title={t('plantilla.inactiveBadgeHint')}
            className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full
                       bg-slate-700/50 border border-slate-600/40 text-slate-400 text-[10px] font-semibold uppercase tracking-wide"
          >
            {t('plantilla.inactiveBadge')}
          </span>
        )}
      </span>
      <span className="text-sm text-slate-400 truncate">{item.descripcion}</span>
      <div className="flex items-center gap-0.5">
        {/* Reactivar/Desactivar — reversible, no borra (alinea con GPF) */}
        <button
          onClick={handleToggleActive}
          disabled={saving}
          className={`p-1.5 rounded-lg transition-all duration-150 disabled:opacity-50 ${
            inactive
              ? 'text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 opacity-100'
              : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100'
          }`}
          title={inactive ? t('plantilla.reactivate') : t('plantilla.deactivate')}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : inactive ? <RotateCcw size={13} /> : <Power size={13} />}
        </button>
        <button
          onClick={onStartEdit}
          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all duration-150 opacity-0 group-hover/row:opacity-100"
          title={t('common.edit')}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover/row:opacity-100"
          title={t('common.delete')}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
