// frontend/src/pages/DashboardPage.tsx
// Dashboard inteligente que renderiza la vista correcta según el rol del usuario

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AnalystDashboard from './AnalystDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import AdminDashboard from './AdminDashboard';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { profile, loading } = useAuth();
  const { t } = useTranslation();

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-4" />
          <p className="text-white">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  switch (profile.role) {
    case 'superadmin':
      return <AdminDashboard />;
    case 'auditor':
      return <AnalystDashboard />;
    case 'lider':
      return <SupervisorDashboard />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="text-center">
            <p className="text-red-400 mb-4">{t('dashboard.unknownRole')}: {profile.role}</p>
            <p className="text-slate-400">{t('auth.contactAdmin')}</p>
          </div>
        </div>
      );
  }
}