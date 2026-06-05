// frontend/src/components/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/auth.types';

interface ProtectedRouteProps {
 children: React.ReactNode;
 allowedRoles?: UserRole[];
 requirePermission?: string;
}

export function ProtectedRoute({
 children,
 allowedRoles,
 requirePermission,
}: ProtectedRouteProps) {
 const { t } = useTranslation();
 const { user, profile, loading, hasPermission } = useAuth();
 const location = useLocation();

 // Spinner solo durante la carga inicial (primer login o caché expirada)
 // Para usuarios con sesión cacheada, loading=false desde el primer render → sin spinner
 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
 <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-brand-500/50 border-r-transparent" />
 </div>
 );
 }

 // Sin sesión activa ni caché de perfil → redirigir al login
 if (!user && !profile) {
 return <Navigate to="/login" state={{ from: location }} replace />;
 }

 // Si no hay perfil (caché expirada y fallo de carga desde DB), mostrar error
 if (!profile) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
 <div className="max-w-md mx-auto text-center bg-slate-800/50 backdrop-blur-lg p-8 rounded-2xl border border-yellow-500/20">
 <div className="text-yellow-400 text-6xl mb-4"></div>
 <h2 className="text-2xl font-bold text-white mb-2">{t('errors.serverError')}</h2>
 <p className="text-slate-300 mb-4">
 {t('errors.profileLoadFailed')}
 </p>
 <div className="flex gap-3 justify-center">
 <button
 onClick={() => window.location.reload()}
 className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-lg transition-colors"
 >
 {t('errors.retry')}
 </button>
 <button
 onClick={() => window.location.href = '/login'}
 className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
 >
 {t('errors.goHome')}
 </button>
 </div>
 </div>
 </div>
 );
 }

 // admin bypasea todos los role checks (acceso total a la plataforma)
 if (profile.role === 'admin') {
 return <>{children}</>;
 }

 // Verificar roles permitidos si se especificaron
 if (allowedRoles && !allowedRoles.includes(profile.role)) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
 <div className="max-w-md mx-auto text-center bg-slate-800/50 backdrop-blur-lg p-8 rounded-2xl border border-yellow-500/20">
 <div className="text-yellow-400 text-6xl mb-4"></div>
 <h2 className="text-2xl font-bold text-white mb-2">{t('errors.accessDenied')}</h2>
 <p className="text-slate-300 mb-4">
 {t('errors.accessDenied')}
 </p>
 <button
 onClick={() => window.location.href = '/dashboard'}
 className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
 >
 {t('errors.goHome')}
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
 <div className="text-yellow-400 text-6xl mb-4"></div>
 <h2 className="text-2xl font-bold text-white mb-2">{t('errors.accessDenied')}</h2>
 <p className="text-slate-300 mb-4">
 {t('errors.accessDenied')}
 </p>
 <button
 onClick={() => window.location.href = '/dashboard'}
 className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
 >
 {t('errors.goHome')}
 </button>
 </div>
 </div>
 );
 }

 // Todo OK - renderizar contenido
 return <>{children}</>;
}
