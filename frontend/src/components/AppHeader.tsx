// frontend/src/components/AppHeader.tsx
// Compact Apple-style navigation header — 44px height, used across all authenticated pages.

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  /** Show the back arrow + "Volver" on the left (before the logo) */
  showBack?: boolean;
  /** Custom back handler. Defaults to navigate(-1). */
  onBack?: () => void;
  /** Label for the back button. Defaults to 'Volver'. */
  backLabel?: string;
  /** Right-side slot: logout button, action buttons, etc. */
  rightContent?: ReactNode;
}

export default function AppHeader({
  showBack = false,
  onBack,
  backLabel = 'Volver',
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
        <div className="flex items-center justify-between h-[44px]">

          {/* LEFT: back button (optional) + logo */}
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={handleBack}
                className="btn-ghost flex items-center gap-1.5 text-xs py-1 px-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {backLabel}
              </button>
            )}

            {/* Logo S+ — 28px, compact with green glow */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-lg blur-sm"
                style={{ background: 'rgba(0, 214, 50, 0.18)' }}
              />
              <div className="relative w-7 h-7 rounded-lg overflow-hidden ring-1 ring-brand-500/30">
                <img src="/logo.jpg" alt="S+" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* RIGHT: page-specific actions */}
          {rightContent && (
            <div className="flex items-center gap-2">
              {rightContent}
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
