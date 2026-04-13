// frontend/src/components/ModeSelector.tsx

export type AdminMode = 'INBOUND' | 'MONITOREO';

interface ModeSelectorProps {
  selected: AdminMode;
  onChange: (mode: AdminMode) => void;
}

const MODES: { value: AdminMode; label: string }[] = [
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'MONITOREO', label: 'Monitoreo' },
];

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
            selected === value
              ? value === 'INBOUND'
                ? 'bg-teal-500/10 border-teal-600/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                : 'bg-violet-500/10 border-violet-600/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
              : 'bg-transparent border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
