// frontend/src/components/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/auth.types';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requirePermission?: string;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requirePermission 
}: ProtectedRouteProps) {
  const { user, profile, loading, hasPermission } = useAuth();
  const location = useLocation();
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // Mostrar advertencia si tarda demasiado
  useEffect(() => {
    if (loading) {
      const warningTimer = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, 8000);

      return () => clearTimeout(warningTimer);
    } else {
      setShowTimeoutWarning(false);
    }
  }, [loading]);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center max-w-md px-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
          <p className="mt-4 text-white text-lg">Verificando autenticación...</p>
          
          {showTimeoutWarning && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm mb-2">
                ⚠️ La verificación está tomando más tiempo de lo esperado
              </p>
              <p className="text-slate-300 text-xs mb-3">
                Esto puede deberse a una conexión lenta. Si el problema persiste:
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-sm transition-colors"
              >
                Recargar página
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Redirigir a login si no está autenticado
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si no hay perfil pero hay usuario, mostrar error
  // NOTA: Si la cuenta está desactivada, AuthContext ya cerró la sesión
  // automáticamente, por lo que nunca llegaremos aquí con is_active=false
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md mx-auto text-center bg-slate-800/50 backdrop-blur-lg p-8 rounded-2xl border border-yellow-500/20">
          <div className="text-yellow-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Error de Perfil</h2>
          <p className="text-slate-300 mb-6">
            No se pudo cargar tu perfil de usuario. Esto puede deberse a un problema de conexión.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Verificar roles permitidos si se especificaron
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md mx-auto text-center bg-slate-800/50 backdrop-blur-lg p-8 rounded-2xl border border-yellow-500/20">
          <div className="text-yellow-400 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h2>
          <p className="text-slate-300 mb-6">
            No tienes permisos para acceder a esta sección.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Ir al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Verificar permiso específico si se especificó
  if (requirePermission && !hasPermission(requirePermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md mx-auto text-center bg-slate-800/50 backdrop-blur-lg p-8 rounded-2xl border border-yellow-500/20">
          <div className="text-yellow-400 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Permiso Requerido</h2>
          <p className="text-slate-300 mb-6">
            No tienes el permiso necesario para acceder a esta funcionalidad.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Ir al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Todo OK - renderizar children
  return <>{children}</>;
}