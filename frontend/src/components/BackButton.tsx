import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

export default function BackButton({ onClick, label = 'Volver' }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className="btn-ghost flex items-center gap-2"
    >
      <ArrowLeft className="w-5 h-5" />
      {label}
    </button>
  );
}
