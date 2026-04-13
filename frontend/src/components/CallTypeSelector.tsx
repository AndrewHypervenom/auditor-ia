// frontend/src/components/CallTypeSelector.tsx

export const INBOUND_CALL_TYPES = ['FRAUDE', 'TH CONFIRMA'] as const;
export type CallType = typeof INBOUND_CALL_TYPES[number];

interface CallTypeSelectorProps {
  selected: string;
  onChange: (ct: string) => void;
}

export default function CallTypeSelector({ selected, onChange }: CallTypeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {INBOUND_CALL_TYPES.map((ct) => (
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
