// frontend/src/components/CallTypeSelector.tsx

import { useCallTypesConfig } from '../hooks/useCallTypesConfig';

export type CallType = string;

interface CallTypeSelectorProps {
  selected: string;
  onChange: (ct: string) => void;
}

export default function CallTypeSelector({ selected, onChange }: CallTypeSelectorProps) {
  const { callTypeNames, loading } = useCallTypesConfig();

  if (loading && callTypeNames.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {[28, 36, 24, 32, 26].map((w, i) => (
          <div
            key={i}
            className="h-7 bg-slate-700/40 rounded-full animate-pulse"
            style={{ width: `${w * 4}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {callTypeNames.map((ct) => {
        const active = selected === ct;
        return (
          <button
            key={ct}
            onClick={() => onChange(ct)}
            title={ct}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap max-w-[240px] truncate transition-all duration-200 ${
              active
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                : 'bg-slate-900/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800/40'
            }`}
          >
            {ct}
          </button>
        );
      })}
    </div>
  );
}
