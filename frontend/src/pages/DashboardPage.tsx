// frontend/src/pages/DashboardPage.tsx
// Dashboard inteligente que renderiza la vista correcta según el rol del usuario

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AnalystDashboard from './AnalystDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import AdminDashboard from './AdminDashboard';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  // Mostrar loading mientras se carga el perfil
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-4" />
          <p className="text-white">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  // Renderizar el dashboard específico según el rol
  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'analyst':
      return <AnalystDashboard />;
    case 'supervisor':
      return <SupervisorDashboard />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="text-center">
            <p className="text-red-400 mb-4">Rol no reconocido: {profile.role}</p>
            <p className="text-slate-400">Por favor, contacta al administrador</p>
          </div>
        </div>
      );
  }
}