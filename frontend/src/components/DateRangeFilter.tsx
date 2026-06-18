// frontend/src/components/DateRangeFilter.tsx
// Filtro de rango de fechas compacto: un solo botón que abre un popover
// con presets rápidos + rango personalizado. Valores en formato yyyy-mm-dd.

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronDown } from 'lucide-react';

interface Props {
  from: string;            // yyyy-mm-dd | ''
  to: string;              // yyyy-mm-dd | ''
  onChange: (from: string, to: string) => void;
  className?: string;      // clases del botón disparador (para encajar con cada vista)
}

const todayStr = () => new Date().toLocaleDateString('en-CA');
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
const monthStart = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA');

export default function DateRangeFilter({ from, to, onChange, className = '' }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fmt = (s: string) => {
    if (s === todayStr()) return t('dateRange.today');
    if (s === addDays(-1)) return t('dateRange.yesterday');
    const d = new Date(s + 'T00:00:00');
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
    });
  };

  const label = (() => {
    if (!from && !to) return t('dateRange.all');
    if (from && to && from === to) return fmt(from);
    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    if (from) return `${t('dateRange.fromShort')} ${fmt(from)}`;
    return `${t('dateRange.toShort')} ${fmt(to)}`;
  })();

  const presets = [
    { label: t('dateRange.today'), from: todayStr(), to: todayStr() },
    { label: t('dateRange.yesterday'), from: addDays(-1), to: addDays(-1) },
    { label: t('dateRange.last7'), from: addDays(-6), to: todayStr() },
    { label: t('dateRange.last30'), from: addDays(-29), to: todayStr() },
    { label: t('dateRange.thisMonth'), from: monthStart(), to: todayStr() },
    { label: t('dateRange.all'), from: '', to: '' },
  ];

  const active = !!(from || to);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={className}>
        <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-brand-400' : 'text-slate-500'}`} />
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 left-0 w-64 rounded-xl border border-slate-700 bg-slate-800 shadow-xl p-3 space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map(p => {
              const isActive = p.from === from && p.to === to;
              return (
                <button key={p.label}
                  onClick={() => { onChange(p.from, p.to); setOpen(false); }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all border ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                      : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 border-transparent'
                  }`}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-700/60 pt-3 space-y-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {t('dateRange.custom')}
            </p>
            <div className="flex items-center gap-2">
              <input type="date" value={from} max={to || undefined}
                onChange={e => onChange(e.target.value, to || e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
              <span className="text-slate-600 text-xs">–</span>
              <input type="date" value={to} min={from || undefined}
                onChange={e => onChange(from || e.target.value, e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
