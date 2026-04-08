// frontend/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
import ReportsPage from './pages/ReportsPage';
import AuditsViewPage from './pages/AuditsViewPage';
import BaseInboundPage from './pages/BaseInboundPage';
import AiAnalysisPage from './pages/AiAnalysisPage';

function App() {
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

        <Routes>
          {/* Ruta pública */}
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
          
          {/* Dashboard específico para Supervisor (Solo lectura con costos) */}
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
                <SupervisorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Dashboard específico para Analista (Operaciones completas) */}
          <Route
            path="/analyst"
            element={
              <ProtectedRoute allowedRoles={['admin', 'analyst']}>
                <AnalystDashboard />
              </ProtectedRoute>
            }
          />
          
          {/* Nueva Auditoría - Solo Admin y Analyst */}
          <Route
            path="/audit/new"
            element={
              <ProtectedRoute allowedRoles={['admin', 'analyst']}>
                <NewAuditPage />
              </ProtectedRoute>
            }
          />

          {/* Análisis de Calidad IA (nueva pestaña) - Admin y Analyst */}
          <Route
            path="/ai-analysis"
            element={
              <ProtectedRoute allowedRoles={['admin', 'analyst']}>
                <AiAnalysisPage />
              </ProtectedRoute>
            }
          />
          
          {/* Detalle de Auditoría - Todos pueden ver (filtrado en backend) */}
          <Route
            path="/audit/:auditId"
            element={
              <ProtectedRoute>
                <AuditDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Explorador de Auditorías - Admin, Supervisor y Analyst */}
          <Route
            path="/audits"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor', 'analyst']}>
                <AuditsViewPage />
              </ProtectedRoute>
            }
          />
          
          {/* Gestión de Usuarios - Admin, Supervisor y Analyst */}
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor', 'analyst']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />

          {/* Reportes y Análisis - Admin, Supervisor y Analyst */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor', 'analyst']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Base Inbound - Admin, Supervisor y Analyst */}
          <Route
            path="/base-inbound"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor', 'analyst']}>
                <BaseInboundPage />
              </ProtectedRoute>
            }
          />

          {/* Configuración - Solo Admin */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Redirect por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;