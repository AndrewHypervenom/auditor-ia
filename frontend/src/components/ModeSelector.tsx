// frontend/src/components/ModeSelector.tsx

import { useCallTypesConfig } from '../hooks/useCallTypesConfig';

export type AdminMode = string;

interface ModeSelectorProps {
  selected: AdminMode;
  onChange: (mode: AdminMode) => void;
}

const MODE_STYLES: Record<string, string> = {
  INBOUND: 'bg-teal-500/10 border-teal-600/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]',
  MONITOREO: 'bg-violet-500/10 border-violet-600/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]',
};

const DEFAULT_ACTIVE_STYLE = 'bg-brand-500/10 border-brand-700/40 text-brand-300';

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  const { modes, loading } = useCallTypesConfig();

  if (loading && modes.length === 0) {
    return <div className="h-8 w-40 bg-slate-700/40 rounded-full animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-2">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
            selected === mode
              ? (MODE_STYLES[mode] ?? DEFAULT_ACTIVE_STYLE)
              : 'bg-transparent border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          {mode.charAt(0) + mode.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}
