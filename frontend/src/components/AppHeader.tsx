// frontend/src/components/AppHeader.tsx
// Apple UINavigationBar-style header — 44px, título centrado absolutamente.

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface AppHeaderProps {
  /** Mostrar botón ‹ Volver en la izquierda (oculta el logo). */
  showBack?: boolean;
  /** Handler del botón volver. Default: navigate(-1). */
  onBack?: () => void;
  /** Etiqueta del botón volver. Default: 'Volver'. */
  backLabel?: string;
  /** Título centrado en el nav (absolutamente centrado). */
  title?: string;
  /** Subtítulo opcional bajo el título (10px, slate-400). */
  subtitle?: string;
  /** Slot derecho: botones de logout, acciones, etc. */
  rightContent?: ReactNode;
}

export default function AppHeader({
  showBack = false,
  onBack,
  backLabel = 'Volver',
  title,
  subtitle,
  rightContent,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <header
      className="sticky top-0 z-50 shadow-header"
      style={{
        background: 'rgba(10, 10, 18, 0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(30, 30, 50, 0.8)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-[44px]">

          {/* IZQUIERDA: ‹ Volver ó Logo */}
          <div className="flex items-center gap-2 flex-shrink-0 z-10">
            {showBack ? (
              <button
                onClick={handleBack}
                className="btn-ghost flex items-center gap-0.5 text-xs py-1 px-2 -ml-1"
              >
                <ChevronLeft className="w-4 h-4 -mr-0.5" />
                {backLabel}
              </button>
            ) : (
              /* Logo S+ — visible solo en dashboards (sin botón Volver) */
              <div className="relative flex-shrink-0">
                <div
                  className="absolute inset-0 rounded-lg blur-sm"
                  style={{ background: 'rgba(0, 214, 50, 0.18)' }}
                />
                <div className="relative w-7 h-7 rounded-lg overflow-hidden ring-1 ring-brand-500/30">
                  <img src="/logo.jpg" alt="S+" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>

          {/* CENTRO: título absolutamente centrado — independiente del ancho de botones */}
          {(title || subtitle) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none animate-fadeIn">
              {title && (
                <span className="text-[14px] font-semibold text-white tracking-tight leading-tight">
                  {title}
                </span>
              )}
              {subtitle && (
                <span className="text-[10px] text-slate-400 tracking-tight mt-px">
                  {subtitle}
                </span>
              )}
            </div>
          )}

          {/* DERECHA: acciones específicas de la página */}
          {rightContent ? (
            <div className="flex items-center gap-2 flex-shrink-0 z-10">
              {rightContent}
            </div>
          ) : (
            /* Spacer invisible para mantener el título centrado cuando no hay acciones */
            <div className="w-16 flex-shrink-0" />
          )}

        </div>
      </div>
    </header>
  );
}
