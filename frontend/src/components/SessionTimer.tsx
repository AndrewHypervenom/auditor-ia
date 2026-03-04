// frontend/src/components/SessionTimer.tsx

import { useAuth } from '../contexts/AuthContext';
import { Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SessionTimerProps {
  showInHeader?: boolean;
  warningThreshold?: number; // segundos
}

export default function SessionTimer({ 
  showInHeader = false,
  warningThreshold = 30 * 60 // 30 minutos por defecto
}: SessionTimerProps) {
  const { sessionTimeRemaining, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Mostrar warning si queda menos del threshold
    if (sessionTimeRemaining > 0 && sessionTimeRemaining <= warningThreshold) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }

    // Auto-logout si la sesión expiró
    if (sessionTimeRemaining === 0) {
      console.warn('⚠️  Session expired, logging out...');
      signOut();
    }
  }, [sessionTimeRemaining, warningThreshold, signOut]);

  // No mostrar si no hay sesión
  if (sessionTimeRemaining === 0) return null;

  // Formatear tiempo
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const timeFormatted = formatTime(sessionTimeRemaining);
  const isWarning = showWarning;

  // Versión para header (compacta)
  if (showInHeader) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
          isWarning 
            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' 
            : 'bg-slate-800/50 text-slate-400'
        }`}
        title={isWarning ? 'Tu sesión expirará pronto' : 'Tiempo restante de sesión'}
      >
        {isWarning ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">{timeFormatted}</span>
      </div>
    );
  }

  // Versión completa (warning modal)
  if (!isWarning) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-slide-up">
      <div className="bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/30 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1">
              Tu sesión está por expirar
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              Tu sesión expirará en aproximadamente <strong>{timeFormatted}</strong>. 
              Guarda tu trabajo para evitar perder cambios.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium transition-colors"
              >
                Extender sesión
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}