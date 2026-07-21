// frontend/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE } from './lib/motion';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AnalystDashboard from './pages/AnalystDashboard';
import NewAuditPage from './pages/NewAuditPage';
import AuditDetailPage from './pages/AuditDetailPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import ReportsPage from './pages/ReportsPage';
import AuditsViewPage from './pages/AuditsViewPage';
import AiAnalysisPage from './pages/AiAnalysisPage';
import ScriptsAdminPage from './pages/ScriptsAdminPage';
import ScriptsReferencePage from './pages/ScriptsReferencePage';
import BatchPage from './pages/BatchPage';
import CompaniesPage from './pages/CompaniesPage';
import { useVersionCheck } from './hooks/useVersionCheck';

function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <Routes location={location}>
          {/* Ruta pÃºblica */}
          <Route path="/login" element={<LoginPage />} />

          {/* Dashboard - Todos los roles autenticados */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Dashboard especÃ­fico para Supervisor (Solo lectura con costos) */}
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider']}>
                <SupervisorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Dashboard especÃ­fico para Analista (Operaciones completas) */}
          <Route
            path="/analyst"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <AnalystDashboard />
              </ProtectedRoute>
            }
          />

          {/* Nueva AuditorÃ­a - Solo Admin y Analyst */}
          <Route
            path="/audit/new"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <NewAuditPage />
              </ProtectedRoute>
            }
          />

          {/* AnÃ¡lisis de Calidad IA (nueva pestaÃ±a) - Admin y Analyst */}
          <Route
            path="/ai-analysis"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <AiAnalysisPage />
              </ProtectedRoute>
            }
          />

          {/* Detalle de AuditorÃ­a - Todos pueden ver (filtrado en backend) */}
          <Route
            path="/audit/:auditId"
            element={
              <ProtectedRoute>
                <AuditDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Explorador de AuditorÃ­as - Admin, Supervisor y Analyst */}
          <Route
            path="/audits"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <AuditsViewPage />
              </ProtectedRoute>
            }
          />

          {/* GestiÃ³n de Usuarios - Admin, Supervisor y Analyst */}
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* Reportes y AnÃ¡lisis - Admin, Supervisor y Analyst */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* ConfiguraciÃ³n - Solo Admin */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Integraciones internas por empresa - Superadmin y Lider */}
          <Route
            path="/integrations"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider']}>
                <IntegrationsPage />
              </ProtectedRoute>
            }
          />

          {/* AdministraciÃ³n de Scripts y Criterios - Admin y Analyst */}
          <Route
            path="/scripts-admin"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <ScriptsAdminPage />
              </ProtectedRoute>
            }
          />

          {/* Consulta de Criterios, Scripts y Plantilla GPF - Solo lectura */}
          <Route
            path="/referencia"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <ScriptsReferencePage />
              </ProtectedRoute>
            }
          />

          {/* Cola Nocturna â€” Admin y Analyst */}
          <Route
            path="/batch"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'lider', 'auditor']}>
                <BatchPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/companies"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <CompaniesPage />
              </ProtectedRoute>
            }
          />

          {/* Redirect por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  useVersionCheck();
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'bg-slate-900 text-white border border-slate-700',
            style: {
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155'
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
