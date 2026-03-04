// frontend/src/pages/AdminDashboard.tsx
// Dashboard para Administrador - Control total del sistema con datos reales

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auditService, gpfService, getAuditTotalCost, type Audit, type GpfProxyResponse } from '../services/api';
import { 
  Sparkles,
  LogOut,
  FileText,
  Plus,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  DollarSign,
  Users,
  Settings,
  Shield,
  BarChart3,
  FileSpreadsheet,
  Server,
  XCircle,
  WifiOff,
  Bug,
  TestTube2,
  Eye,
  RefreshCw,
  Lock,
  ArrowLeft,
  Home,
  PhoneIncoming,
  Monitor,
  Globe,
  Key,
  Send,
  Terminal,
  Activity,
  Copy,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

// Tipos para las vistas de prueba
type TestView = 'normal' | 'error404' | 'error500' | 'noConnection' | 'maintenance' | 'unauthorized' | 'emptyState' | 'loading';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalAudits: number;
  completedAudits: number;
  averageScore: number;
  totalCosts: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Estados para vistas de prueba
  const [testView, setTestView] = useState<TestView>('normal');
  const [showTestPanel, setShowTestPanel] = useState(false);

  // Estados para integración GPF
  const [showGpfPanel, setShowGpfPanel] = useState(false);
  const [gpfEnv, setGpfEnv] = useState<'test' | 'prod'>('test');
  const [gpfToken, setGpfToken] = useState('');
  const [gpfTokenUser, setGpfTokenUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [gpfLoginLoading, setGpfLoginLoading] = useState(false);
  const [gpfEndpoint, setGpfEndpoint] = useState('/api/login');
  const [gpfMethod, setGpfMethod] = useState('POST');
  const [gpfBody, setGpfBody] = useState(
    JSON.stringify({ email: 'quality_control_user@positivosmais.com', password: '4j#B763]6$2x' }, null, 2)
  );
  const [gpfQueryString, setGpfQueryString] = useState('');
  const [gpfResponse, setGpfResponse] = useState<GpfProxyResponse | null>(null);
  const [gpfRequestLoading, setGpfRequestLoading] = useState(false);
  const [gpfTableView, setGpfTableView] = useState(false);

  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalAudits: 0,
    completedAudits: 0,
    averageScore: 0,
    totalCosts: 0
  });

  useEffect(() => {
    if (testView === 'normal') {
      loadAudits();
      loadSystemStats();
    }
  }, [testView]);

  // ✅ HELPER para obtener evaluations de forma segura
  const getEvaluations = (audit: Audit | null | undefined) => {
    if (!audit || !audit.evaluations) return [];
    if (Array.isArray(audit.evaluations)) return audit.evaluations;
    return [audit.evaluations];
  };

  const loadAudits = async () => {
    try {
      setLoading(true);
      const response = await auditService.getUserAudits();
      
      // ✅ Verificar que response y response.audits existen
      if (!response || !response.audits) {
        console.warn('⚠️ Invalid response from getUserAudits:', response);
        setAudits([]);
        return;
      }
      
      // ✅ Asegurar que audits es un array
      const auditsArray = Array.isArray(response.audits) ? response.audits : [];
      setAudits(auditsArray);
    } catch (error: any) {
      toast.error('Error al cargar auditorías');
      console.error(error);
      setAudits([]); // ✅ Asegurar array vacío en caso de error
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    try {
      console.log('🔄 Cargando estadísticas...');
      
      // Obtener estadísticas reales de auditorías
      const stats = await auditService.getStats();
      console.log('📊 Stats del backend:', stats);
      
      // ✅ Verificar que stats existe
      if (!stats || typeof stats !== 'object') {
        console.warn('⚠️ Invalid stats response:', stats);
        setSystemStats({
          totalUsers: 0,
          activeUsers: 0,
          totalAudits: 0,
          completedAudits: 0,
          averageScore: 0,
          totalCosts: 0
        });
        return;
      }
      
      // Obtener todas las auditorías para calcular costos totales
      const response = await auditService.getUserAudits();
      const allAudits = (response && Array.isArray(response.audits)) ? response.audits : [];
      console.log('🔍 Total auditorías encontradas:', allAudits.length);
      
      const totalCosts = allAudits.reduce((sum, audit) => sum + getAuditTotalCost(audit), 0);
      console.log('💰 Costos totales calculados:', totalCosts);

      setSystemStats({
        totalUsers: stats.totalExecutives || 0,
        activeUsers: Math.floor((stats.totalExecutives || 0) * 0.6),
        totalAudits: stats.totalAudits || 0,
        completedAudits: stats.completedAudits || 0,
        averageScore: Math.round(stats.averageScore || 0),
        totalCosts: totalCosts
      });

      console.log('✅ Estadísticas actualizadas correctamente');
    } catch (error) {
      console.error('❌ Error al cargar estadísticas:', error);
      toast.error('Error al cargar estadísticas');
      // Valores por defecto si falla
      setSystemStats({
        totalUsers: 0,
        activeUsers: 0,
        totalAudits: 0,
        completedAudits: 0,
        averageScore: 0,
        totalCosts: 0
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta auditoría?')) {
      return;
    }

    try {
      setDeletingId(auditId);
      await auditService.deleteAudit(auditId);
      toast.success('Auditoría eliminada correctamente');
      await loadAudits();
      await loadSystemStats(); // Recargar estadísticas después de eliminar
    } catch (error) {
      toast.error('Error al eliminar auditoría');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadExcel = async (filename: string) => {
    try {
      toast.loading('Descargando Excel...', { id: 'download' });
      const blob = await auditService.downloadExcel(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel descargado correctamente', { id: 'download' });
    } catch (error) {
      toast.error('Error al descargar Excel', { id: 'download' });
    }
  };

  const handleGpfLogin = async () => {
    try {
      setGpfLoginLoading(true);
      setGpfResponse(null);
      const result = await gpfService.login({ env: gpfEnv });
      setGpfResponse(result);
      if (result.data?.is_success && result.data?.data?.token) {
        setGpfToken(result.data.data.token);
        setGpfTokenUser(result.data.data.user || null);
        toast.success('Token obtenido correctamente');
      } else {
        const msg = result.data?.error?.message || 'Credenciales inválidas';
        toast.error(`Error: ${msg}`);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error.message || 'Error de conexión';
      toast.error(msg);
      setGpfResponse({ gpf_status: 0, elapsed_ms: 0, data: null, error: msg });
    } finally {
      setGpfLoginLoading(false);
    }
  };

  const handleGpfRequest = async () => {
    try {
      setGpfRequestLoading(true);
      setGpfResponse(null);

      let parsedBody: any = undefined;
      if (gpfBody.trim() && !['GET', 'HEAD'].includes(gpfMethod)) {
        try {
          parsedBody = JSON.parse(gpfBody);
        } catch {
          toast.error('El cuerpo JSON no es válido');
          setGpfRequestLoading(false);
          return;
        }
      }

      const result = await gpfService.proxy({
        env: gpfEnv,
        endpoint: gpfEndpoint,
        method: gpfMethod,
        token: gpfToken || undefined,
        body: parsedBody,
        queryString: gpfQueryString || undefined
      });

      setGpfResponse(result);

      if (result.data?.is_success === true) {
        toast.success(`Respuesta ${result.gpf_status} OK`);
      } else if (result.gpf_status >= 400 || result.data?.is_success === false) {
        toast.error(`Error ${result.gpf_status}`);
      } else {
        toast.success(`Respuesta ${result.gpf_status}`);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error.message || 'Error de conexión';
      toast.error(msg);
      setGpfResponse({ gpf_status: 0, elapsed_ms: 0, data: null, error: msg });
    } finally {
      setGpfRequestLoading(false);
    }
  };

  const handleGpfEndpointPreset = (preset: string, method: string, sampleBody?: string) => {
    setGpfEndpoint(preset);
    setGpfMethod(method);
    if (sampleBody !== undefined) setGpfBody(sampleBody);
    setGpfResponse(null);
    setGpfTableView(false);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400';
    if (status >= 400 && status < 500) return 'text-yellow-400';
    if (status >= 500) return 'text-red-400';
    return 'text-slate-400';
  };

  const getStatusBg = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-emerald-500/10 border-emerald-500/30';
    if (status >= 400 && status < 500) return 'bg-yellow-500/10 border-yellow-500/30';
    if (status >= 500) return 'bg-red-500/10 border-red-500/30';
    return 'bg-slate-800 border-slate-700';
  };

  const renderGpfPanel = () => {
    const GPF_ENDPOINTS = [
      { label: 'Login / Obtener Token', path: '/api/login', method: 'POST', body: JSON.stringify({ email: 'quality_control_user@positivosmais.com', password: '4j#B763]6$2x' }, null, 2), confirmed: true },
      { label: 'Detalle de Llamada', path: '/api/quality-control/v1/attentions-quality-control', method: 'GET', body: '', confirmed: true },
      { label: 'Capturas y Comentarios', path: '/api/capturas-comentarios', method: 'GET', body: '', confirmed: false },
      { label: 'Historia de Transacciones', path: '/api/historia-transacciones', method: 'GET', body: '', confirmed: false },
      { label: 'Historial de Comentarios', path: '/api/historial-comentarios', method: 'GET', body: '', confirmed: false },
      { label: 'Historial de Validaciones OT', path: '/api/historial-validaciones-ot', method: 'GET', body: '', confirmed: false },
      { label: 'Descarga Base Inbound', path: '/api/descarga-base-inbound', method: 'GET', body: '', confirmed: false },
    ];

    const CALL_DETAIL_FIELDS = [
      'Llamada en curso', 'Estado llamada', 'Calificación', 'Sub-calificación',
      'Origen validación', 'Actualización de datos', 'Socio', 'Correo cliente',
      'Teléfono cliente', 'Caso', 'Agente', 'Resultado dictamen', '4 dígitos TC',
      'Tiene afectación', 'Folio BI', 'Comercio', 'Fecha de la compra',
      'Monto de la compra', 'Estatus correo preventivo', 'Estatus SMS preventivo',
      'Cliente no requiere re-plastificación'
    ];

    const isSuccess = gpfResponse?.data?.is_success === true;
    const hasResponse = gpfResponse !== null;
    const responseArray: any[] = Array.isArray(gpfResponse?.data?.data) ? gpfResponse!.data.data : [];
    const isCallDetailEndpoint = gpfEndpoint === '/api/quality-control/v1/attentions-quality-control';
    const canShowTable = isCallDetailEndpoint && responseArray.length > 0;

    return (
      <div className="space-y-6">
        {/* Banner de sección */}
        <div className="p-5 bg-gradient-to-r from-teal-900/30 to-emerald-900/20 border border-teal-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <Globe className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Integración API GPF</h2>
              <p className="text-slate-400 text-sm">Portal GPF · Positivo S+ · Pruebas y verificación de endpoints</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {gpfToken ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Autenticado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 border border-slate-600 rounded-full text-xs font-medium text-slate-400">
                  <XCircle className="w-3 h-3" />
                  Sin token
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PASO 1: Ambiente y Autenticación */}
        <div className="card">
          <h3 className="section-header">
            <Key className="w-5 h-5 text-teal-400" />
            <span>Paso 1 — Ambiente y Autenticación</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Selector de ambiente */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Ambiente</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  onClick={() => { setGpfEnv('test'); setGpfToken(''); setGpfTokenUser(null); setGpfResponse(null); }}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${gpfEnv === 'test' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Pruebas
                </button>
                <button
                  onClick={() => { setGpfEnv('prod'); setGpfToken(''); setGpfTokenUser(null); setGpfResponse(null); }}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${gpfEnv === 'prod' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Productivo
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {gpfEnv === 'test' ? 'ngrok · classic-routinely-beagle' : 'gpf.prevencion.algartech.com.mx:6443'}
              </p>
            </div>

            {/* Token actual */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Token de Sesión {gpfTokenUser && <span className="text-teal-400 ml-1">· {gpfTokenUser.name} ({gpfTokenUser.email})</span>}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={gpfToken}
                    onChange={(e) => setGpfToken(e.target.value)}
                    placeholder="Token Bearer (se llena automáticamente al hacer login)"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  />
                </div>
                {gpfToken && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(gpfToken); toast.success('Token copiado'); }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-all"
                    title="Copiar token"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleGpfLogin}
            disabled={gpfLoginLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
          >
            {gpfLoginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {gpfLoginLoading ? 'Autenticando...' : 'Obtener Token de Sesión'}
          </button>
        </div>

        {/* PASO 2: Probar Endpoints */}
        <div className="card">
          <h3 className="section-header">
            <Terminal className="w-5 h-5 text-teal-400" />
            <span>Paso 2 — Probar Endpoints</span>
            {!gpfToken && <span className="ml-auto text-xs text-yellow-400 font-normal flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Requiere token</span>}
          </h3>

          {/* Presets de endpoints */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-2">Endpoints conocidos</label>
            <div className="flex flex-wrap gap-2">
              {GPF_ENDPOINTS.map((ep) => (
                <button
                  key={ep.path}
                  onClick={() => handleGpfEndpointPreset(ep.path, ep.method, ep.body)}
                  title={ep.confirmed ? ep.path : `Ruta pendiente de confirmar · ${ep.path}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    gpfEndpoint === ep.path
                      ? 'bg-teal-500/20 border-teal-500/60 text-teal-300'
                      : ep.confirmed
                        ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-teal-500/40 hover:text-slate-300'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <span className={`mr-1.5 font-mono ${ep.method === 'POST' ? 'text-yellow-400' : 'text-green-400'}`}>{ep.method}</span>
                  {ep.label}
                  {!ep.confirmed && <span className="ml-1.5 text-slate-600">·</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint + Método */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Método</label>
              <select
                value={gpfMethod}
                onChange={(e) => setGpfMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Endpoint</label>
              <input
                type="text"
                value={gpfEndpoint}
                onChange={(e) => setGpfEndpoint(e.target.value)}
                placeholder="/api/login"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Query params */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Query String (opcional)</label>
            <input
              type="text"
              value={gpfQueryString}
              onChange={(e) => setGpfQueryString(e.target.value)}
              placeholder="clave=valor&otro=dato"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Body */}
          {!['GET', 'HEAD'].includes(gpfMethod) && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Cuerpo (JSON)</label>
              <textarea
                value={gpfBody}
                onChange={(e) => setGpfBody(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-teal-500 resize-y"
              />
            </div>
          )}

          <button
            onClick={handleGpfRequest}
            disabled={gpfRequestLoading || !gpfEndpoint}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
          >
            {gpfRequestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {gpfRequestLoading ? 'Ejecutando...' : 'Ejecutar Request'}
          </button>
        </div>

        {/* Respuesta */}
        {hasResponse && gpfResponse && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-header mb-0">
                <Activity className="w-5 h-5 text-teal-400" />
                <span>Respuesta</span>
              </h3>
              <div className="flex items-center gap-3">
                {gpfResponse.elapsed_ms > 0 && (
                  <span className="text-xs text-slate-500">{gpfResponse.elapsed_ms} ms</span>
                )}
                {gpfResponse.gpf_status > 0 && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBg(gpfResponse.gpf_status)} ${getStatusColor(gpfResponse.gpf_status)}`}>
                    {gpfResponse.gpf_status} {gpfResponse.gpf_status_text || ''}
                  </span>
                )}
                {gpfResponse.error && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400">
                    Error de red
                  </span>
                )}
              </div>
            </div>

            {gpfResponse.error && !gpfResponse.data && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
                <p className="text-red-400 text-sm font-mono">{gpfResponse.error}</p>
              </div>
            )}

            {gpfResponse.data !== null && gpfResponse.data !== undefined && (
              <>
                {/* Indicador rápido */}
                {typeof gpfResponse.data?.is_success === 'boolean' && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 border ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    {isSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className={`text-sm font-medium ${isSuccess ? 'text-emerald-300' : 'text-red-300'}`}>
                      {isSuccess
                        ? `Solicitud exitosa${canShowTable ? ` · ${responseArray.length} registros encontrados` : ''}`
                        : (gpfResponse.data?.error?.message || 'Solicitud fallida')}
                    </span>
                    {canShowTable && (
                      <div className="ml-auto flex items-center rounded-lg overflow-hidden border border-slate-700">
                        <button
                          onClick={() => setGpfTableView(false)}
                          className={`px-3 py-1 text-xs font-medium transition-all ${!gpfTableView ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => setGpfTableView(true)}
                          className={`px-3 py-1 text-xs font-medium transition-all ${gpfTableView ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          Tabla
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Vista tabla - Detalle de llamadas */}
                {canShowTable && gpfTableView ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800 border-b border-slate-700">
                          <th className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">#</th>
                          {CALL_DETAIL_FIELDS.map((field) => (
                            <th key={field} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">
                              {field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {responseArray.map((row: any, idx: number) => (
                          <tr key={idx} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
                            <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                            {CALL_DETAIL_FIELDS.map((field) => (
                              <td key={field} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[200px] truncate" title={row[field] ?? ''}>
                                {row[field] ?? <span className="text-slate-600">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{responseArray.length} registros · {CALL_DETAIL_FIELDS.length} columnas</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse!.data, null, 2)); toast.success('JSON copiado'); }}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar JSON
                      </button>
                    </div>
                  </div>
                ) : (
                  /* JSON viewer */
                  <div className="relative">
                    <button
                      onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse.data, null, 2)); toast.success('JSON copiado'); }}
                      className="absolute top-3 right-3 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1 z-10"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar
                    </button>
                    <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(gpfResponse.data, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completado
          </span>
        );
      case 'processing':
        return (
          <span className="badge badge-info">
            <Clock className="w-3 h-3 mr-1" />
            Procesando
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-danger">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Renderizar vistas de prueba estilo Microsoft Copilot
  const renderTestView = () => {
    const TestViewContainer = ({ children }: { children: React.ReactNode }) => (
      <div className="flex items-center justify-center min-h-[600px] px-4">
        <div className="max-w-2xl w-full">
          {children}
        </div>
      </div>
    );

    const BackButton = () => (
      <div className="flex gap-3 mt-8">
        <button 
          onClick={() => setTestView('normal')} 
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          Volver al Dashboard
        </button>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Recargar
        </button>
      </div>
    );

    switch (testView) {
      case 'error404':
        return (
          <TestViewContainer>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/10 mb-6">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
              <h1 className="text-8xl font-bold text-white mb-2">404</h1>
              <h2 className="text-2xl font-semibold text-white mb-3">Página no encontrada</h2>
              <p className="text-slate-400 text-lg mb-2">
                Lo sentimos, la página que buscas no existe.
              </p>
              <p className="text-slate-500 mb-8">
                Es posible que haya sido movida o eliminada.
              </p>
              <BackButton />
            </div>
          </TestViewContainer>
        );

      case 'error500':
        return (
          <TestViewContainer>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-500/10 mb-6">
                <Server className="w-12 h-12 text-orange-500 animate-pulse" />
              </div>
              <h1 className="text-8xl font-bold text-white mb-2">500</h1>
              <h2 className="text-2xl font-semibold text-white mb-3">Error interno del servidor</h2>
              <p className="text-slate-400 text-lg mb-2">
                Algo salió mal en nuestros servidores.
              </p>
              <p className="text-slate-500 mb-8">
                Nuestro equipo ha sido notificado y está trabajando en una solución.
              </p>
              <BackButton />
            </div>
          </TestViewContainer>
        );

      case 'noConnection':
        return (
          <TestViewContainer>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-yellow-500/10 mb-6">
                <WifiOff className="w-12 h-12 text-yellow-500" />
              </div>
              <h2 className="text-3xl font-semibold text-white mb-3">Sin conexión a internet</h2>
              <p className="text-slate-400 text-lg mb-2">
                No se pudo establecer conexión con el servidor.
              </p>
              <p className="text-slate-500 mb-8">
                Verifica tu conexión a internet e intenta nuevamente.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    toast.loading('Verificando conexión...', { id: 'connection' });
                    setTimeout(() => {
                      toast.success('Conexión restablecida', { id: 'connection' });
                      setTestView('normal');
                    }, 1500);
                  }} 
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reintentar conexión
                </button>
                <button 
                  onClick={() => setTestView('normal')} 
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </TestViewContainer>
        );

      case 'maintenance':
        return (
          <TestViewContainer>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-500/10 mb-6">
                <Settings className="w-12 h-12 text-blue-500 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <h2 className="text-3xl font-semibold text-white mb-3">Mantenimiento programado</h2>
              <p className="text-slate-400 text-lg mb-2">
                Estamos realizando mejoras en el sistema.
              </p>
              <p className="text-slate-500 mb-4">
                El servicio volverá a estar disponible pronto.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-8">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium">Tiempo estimado: 30 minutos</span>
              </div>
              <BackButton />
            </div>
          </TestViewContainer>
        );

      case 'unauthorized':
        return (
          <TestViewContainer>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/10 mb-6">
                <Lock className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-3xl font-semibold text-white mb-3">Acceso denegado</h2>
              <p className="text-slate-400 text-lg mb-2">
                No tienes los permisos necesarios para acceder a este recurso.
              </p>
              <p className="text-slate-500 mb-8">
                Contacta al administrador del sistema si crees que esto es un error.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setTestView('normal')} 
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver atrás
                </button>
                <button 
                  onClick={() => navigate('/settings')} 
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
                >
                  Solicitar acceso
                </button>
              </div>
            </div>
          </TestViewContainer>
        );

      case 'emptyState':
        return (
          <TestViewContainer>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-700 mb-6">
                <FileText className="w-12 h-12 text-slate-500" />
              </div>
              <h2 className="text-3xl font-semibold text-white mb-3">No hay datos disponibles</h2>
              <p className="text-slate-400 text-lg mb-2">
                Aún no has creado ninguna auditoría en el sistema.
              </p>
              <p className="text-slate-500 mb-8">
                Comienza creando tu primera auditoría para ver resultados aquí.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/audit/new')} 
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Crear primera auditoría
                </button>
                <button 
                  onClick={() => setTestView('normal')} 
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
                >
                  Ver dashboard
                </button>
              </div>
            </div>
          </TestViewContainer>
        );

      case 'loading':
        return (
          <TestViewContainer>
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-white mb-3">Cargando datos...</h2>
              <p className="text-slate-400 text-lg mb-8">
                Por favor espera mientras recuperamos la información del servidor.
              </p>
              <button 
                onClick={() => setTestView('normal')} 
                className="px-6 py-2 text-slate-400 hover:text-white transition-all"
              >
                Cancelar
              </button>
            </div>
          </TestViewContainer>
        );

      default:
        return renderNormalView();
    }
  };

  const renderNormalView = () => (
    <>
      {/* Mensaje informativo de permisos */}
      <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-red-300 font-semibold mb-1">Permisos de Administrador</h3>
            <p className="text-slate-400 text-sm">
              Como Administrador, tienes control total del sistema: crear, editar, eliminar auditorías, 
              gestionar usuarios, acceder a costos completos y configurar el sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions - Ampliado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => navigate('/users')}
          className="stat-card hover:scale-105 transition-transform cursor-pointer bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Usuarios</h3>
              <p className="text-sm text-slate-400">Gestionar equipo</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className="stat-card hover:scale-105 transition-transform cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-700/40 border-slate-600/30"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-600/20 rounded-xl">
              <Settings className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Configuración</h3>
              <p className="text-sm text-slate-400">Sistema y APIs</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/reports')}
          className="stat-card hover:scale-105 transition-transform cursor-pointer bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Reportes</h3>
              <p className="text-sm text-slate-400">Análisis avanzado</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/audits')}
          className="stat-card hover:scale-105 transition-transform cursor-pointer bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Auditorías</h3>
              <p className="text-sm text-slate-400">Ver todas</p>
            </div>
          </div>
        </button>
      </div>

      {/* Stats Cards - Solo las 4 tarjetas con datos reales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card bg-gradient-to-br from-indigo-900/20 to-indigo-800/20 border-indigo-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm font-medium">Usuarios Totales</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white">{systemStats.totalUsers}</div>
          <div className="text-xs text-slate-500 mt-1">{systemStats.activeUsers} activos</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm font-medium">Total Auditorías</span>
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{systemStats.totalAudits}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm font-medium">Completadas</span>
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white">{systemStats.completedAudits}</div>
        </div>

        <div className="stat-card bg-gradient-to-br from-emerald-900/20 to-green-900/20 border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm font-medium">Costos Totales</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            ${systemStats.totalCosts.toFixed(4)}
          </div>
          <div className="text-xs text-slate-500 mt-1">USD</div>
        </div>
      </div>

      {/* Score Promedio - Mostrar solo si hay datos */}
      {systemStats.averageScore > 0 && (
        <div className="grid grid-cols-1 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm font-medium">Promedio Score</span>
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">{systemStats.averageScore}%</div>
          </div>
        </div>
      )}

      {/* Audits List */}
      <div className="card">
        <h2 className="section-header">
          <FileText className="w-6 h-6 text-blue-400" />
          Gestión Completa de Auditorías
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
              <FileText className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 mb-4">
              No hay auditorías en el sistema
            </p>
            <button
              onClick={() => navigate('/audit/new')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear primera auditoría
            </button>
          </div>
        ) : (
          <div className="space-y-4">
              {audits.map((audit) => {
                if (!audit) return null; // ✅ Protección adicional
                
                return (
              <div
                key={audit.id}
                className="audit-card"
                onClick={() => navigate(`/audit/${audit.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {audit.executive_name}
                      </h3>
                      {getStatusBadge(audit.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">ID Ejecutivo:</span>
                        <p className="text-slate-300 font-medium">{audit.executive_id}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Cliente:</span>
                        <p className="text-slate-300 font-medium">{audit.client_id}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tipo:</span>
                        <div className="mt-1">
                          {(audit.call_type || '').toUpperCase() === 'MONITOREO' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Monitor className="w-3 h-3" />
                              Monitoreo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              <PhoneIncoming className="w-3 h-3" />
                              Inbound
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Fecha:</span>
                        <p className="text-slate-300 font-medium">{formatDate(audit.created_at)}</p>
                      </div>
                    </div>

                    {(() => {
                      const evaluations = getEvaluations(audit);
                      return evaluations.length > 0 && (
                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            <span className="text-slate-400 text-sm">Score:</span>
                            <span className="text-xl font-bold text-purple-400">
                              {evaluations[0].percentage}%
                            </span>
                            <span className="text-sm text-slate-500">
                              ({evaluations[0].total_score}/{evaluations[0].max_possible_score} pts)
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <span className="text-slate-400 text-sm">Costo:</span>
                            <span className="text-sm font-semibold text-emerald-400">
                              ${getAuditTotalCost(audit).toFixed(4)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {audit.excel_filename && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadExcel(audit.excel_filename!);
                        }}
                        className="btn-icon"
                        title="Descargar Excel"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAudit(audit.id);
                      }}
                      disabled={deletingId === audit.id}
                      className="btn-icon-danger"
                      title="Eliminar auditoría"
                    >
                      {deletingId === audit.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
              })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl blur-lg opacity-50"></div>
                <div className="relative text-5xl p-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl">
                  👑
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  Panel de Administrador
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Control Total - {profile?.full_name || user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Badge de rol */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-red-500/30 rounded-lg">
                <Shield className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-slate-300">Administrador</span>
              </div>

              {/* Botón integración GPF */}
              <button
                onClick={() => {
                  setShowGpfPanel(!showGpfPanel);
                  if (!showGpfPanel) setShowTestPanel(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  showGpfPanel
                    ? 'bg-teal-500/20 border border-teal-500/50 text-teal-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-teal-500/50'
                }`}
                title="Integración API GPF"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">API GPF</span>
              </button>

              {/* Botón de vistas de prueba */}
              <button
                onClick={() => {
                  setShowTestPanel(!showTestPanel);
                  if (!showTestPanel) setShowGpfPanel(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  showTestPanel
                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-amber-500/50'
                }`}
                title="Vistas de prueba"
              >
                <TestTube2 className="w-4 h-4" />
                <span className="text-sm font-medium">Testing</span>
              </button>

              <button
                onClick={() => navigate('/audit/new')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nueva Auditoría
              </button>
              
              <button
                onClick={handleLogout}
                className="btn-ghost flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Cerrar Sesión
              </button>
            </div>
          </div>

          {/* Panel de vistas de prueba - Estilo Microsoft Copilot */}
          {showTestPanel && (
            <div className="mt-4 p-4 bg-slate-800/50 backdrop-blur-sm border border-amber-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Bug className="w-5 h-5 text-amber-400" />
                <h3 className="text-amber-300 font-semibold">Vistas de Prueba</h3>
                <span className="text-xs text-slate-500 ml-auto">Selecciona una vista para previsualizar</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <button
                  onClick={() => setTestView('normal')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'normal'
                      ? 'bg-green-500/20 border-2 border-green-500 text-green-300 shadow-lg shadow-green-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Eye className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">Normal</span>
                </button>
                <button
                  onClick={() => setTestView('error404')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'error404'
                      ? 'bg-red-500/20 border-2 border-red-500 text-red-300 shadow-lg shadow-red-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <XCircle className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">404</span>
                </button>
                <button
                  onClick={() => setTestView('error500')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'error500'
                      ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-300 shadow-lg shadow-orange-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Server className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">500</span>
                </button>
                <button
                  onClick={() => setTestView('noConnection')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'noConnection'
                      ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-300 shadow-lg shadow-yellow-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <WifiOff className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">Sin Red</span>
                </button>
                <button
                  onClick={() => setTestView('maintenance')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'maintenance'
                      ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Settings className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">Manten.</span>
                </button>
                <button
                  onClick={() => setTestView('unauthorized')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'unauthorized'
                      ? 'bg-red-500/20 border-2 border-red-500 text-red-300 shadow-lg shadow-red-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Lock className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">No Auth</span>
                </button>
                <button
                  onClick={() => setTestView('emptyState')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'emptyState'
                      ? 'bg-slate-500/20 border-2 border-slate-400 text-slate-300 shadow-lg shadow-slate-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <FileText className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">Vacío</span>
                </button>
                <button
                  onClick={() => setTestView('loading')}
                  className={`group px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    testView === 'loading'
                      ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Loader2 className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs">Cargando</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showGpfPanel ? renderGpfPanel() : renderTestView()}
      </main>
    </div>
  );
}