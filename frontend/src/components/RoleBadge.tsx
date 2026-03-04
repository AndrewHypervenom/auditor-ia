// frontend/src/components/RoleBadge.tsx

import type { UserRole } from '../types/auth.types';
import { Shield, Star, Eye, User } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const ROLE_CONFIG = {
  admin: {
    label: 'Administrador',
    icon: Shield,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/20',
    dotColor: 'bg-red-500',
  },
  supervisor: {
    label: 'Supervisor',
    icon: Star,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
  analyst: {
    label: 'Analista',
    icon: Eye,
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/20',
    dotColor: 'bg-green-500',
  },
  executive: {
    label: 'Ejecutivo',
    icon: User,
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-500/20',
    dotColor: 'bg-slate-500',
  },
};

const SIZE_CONFIG = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'w-3 h-3',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    padding: 'px-3 py-1',
    text: 'text-sm',
    icon: 'w-4 h-4',
    dot: 'w-2 h-2',
  },
  lg: {
    padding: 'px-4 py-2',
    text: 'text-base',
    icon: 'w-5 h-5',
    dot: 'w-2.5 h-2.5',
  },
};

export function RoleBadge({ role, size = 'md', showIcon = true }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-lg border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${sizeConfig.padding}
      `}
    >
      {showIcon && <Icon className={sizeConfig.icon} />}
      <span className={`font-medium ${sizeConfig.text}`}>{config.label}</span>
      <div className={`${sizeConfig.dot} ${config.dotColor} rounded-full animate-pulse`} />
    </div>
  );
}

// Variante más simple
export function SimpleRoleBadge({ role }: { role: UserRole }) {
  const config = ROLE_CONFIG[role];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium
        ${config.bgColor} ${config.textColor} ${config.borderColor} border
      `}
    >
      <div className={`w-1.5 h-1.5 ${config.dotColor} rounded-full`} />
      {config.label}
    </span>
  );
}

// Para usar en headers
export function RoleHeader({ role, userName }: { role: UserRole; userName?: string }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
      <div className={`p-3 rounded-lg ${config.bgColor}`}>
        <Icon className={`w-6 h-6 ${config.textColor}`} />
      </div>
      <div className="flex-1">
        {userName && (
          <p className="text-white font-semibold">{userName}</p>
        )}
        <p className={`text-sm ${config.textColor}`}>{config.label}</p>
      </div>
      <div className={`px-3 py-1 rounded-full ${config.bgColor} ${config.borderColor} border`}>
        <span className={`text-xs font-medium ${config.textColor}`}>Activo</span>
      </div>
    </div>
  );
}