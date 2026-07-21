// frontend/src/pages/AdminDashboard.tsx
import { motion } from 'motion/react';
import { CountUp, Stagger, fadeUp, EASE_SPRING } from '../lib/motion';
// Dashboard para Administrador - Control total del sistema con datos reales

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { auditService, gpfService, getAuditTotalCost, type Audit, type GpfProxyResponse } from '../services/api';
import { FileDown, CalendarRange } from 'lucide-react';
import AppHeader from '../components/AppHeader';
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
 AlertTriangle,
 Loader2,
 XCircle,
 TrendingUp,
 DollarSign,
 Users,
 Settings,
 Shield,
 BarChart3,
 FileSpreadsheet,
 RefreshCw,
 PhoneIncoming,
 Monitor,
 Globe,
 Key,
 Send,
 Terminal,
 Activity,
 Copy,
 ChevronDown,
 BookOpen,
 Moon,
 Building2,
 Search,
 Plug,
} from 'lucide-react';
import DateRangeFilter from '../components/DateRangeFilter';

const isBatchAudit = (audit: Audit) => audit.audio_filename === 'gpf-batch';

// yyyy-mm-dd en hora local (coincide con el valor de <input type="date">)
const localDateStr = (s: string) => { try { return new Date(s).toLocaleDateString('en-CA'); } catch { return ''; } };

type ScoreFilter = 'all' | 'excellent' | 'good' | 'regular' | 'low';

const matchesScore = (pct: number | undefined, sf: ScoreFilter) => {
 if (sf === 'all') return true;
 if (pct === undefined) return false;
 if (sf === 'excellent') return pct >= 90;
 if (sf === 'good') return pct >= 75 && pct < 90;
 if (sf === 'regular') return pct >= 60 && pct < 75;
 return pct < 60;
};
const isEmptyBatchEval = (audit: Audit) => {
  if (!isBatchAudit(audit) || audit.status !== 'completed') return false;
  const evals = Array.isArray(audit.evaluations) ? audit.evaluations : [];
  const score = evals[0];
  return !score || (score.total_score === 0 && score.max_possible_score > 0);
};
import toast from 'react-hot-toast';


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
 const { t } = useTranslation();
 const [audits, setAudits] = useState<Audit[]>([]);
 const [loading, setLoading] = useState(true);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 // Filtros de la lista de auditorías
 const [search, setSearch] = useState('');
 const [dateFrom, setDateFrom] = useState(() => new Date().toLocaleDateString('en-CA'));
 const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA'));
 const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all');
 const [categoryFilter, setCategoryFilter] = useState('all');
 
 // Estados para integración GPF
 const [showGpfPanel, setShowGpfPanel] = useState(false);
 const [gpfEnv, setGpfEnv] = useState<'test' | 'prod'>('test');
 const [gpfToken, setGpfToken] = useState('');
 const [gpfTokenUser, setGpfTokenUser] = useState<{ id: number; name: string; email: string } | null>(null);
 const [gpfLoginLoading, setGpfLoginLoading] = useState(false);
 const [gpfEndpoint, setGpfEndpoint] = useState('/api/login');
 const [gpfMethod, setGpfMethod] = useState('POST');
 const [gpfBody, setGpfBody] = useState('');
 const [gpfQueryString, setGpfQueryString] = useState('');
 const [gpfResponse, setGpfResponse] = useState<GpfProxyResponse | null>(null);
 const [gpfRequestLoading, setGpfRequestLoading] = useState(false);
 const [gpfTableView, setGpfTableView] = useState(false);
 const [gpfEndpointNeedsId, setGpfEndpointNeedsId] = useState(false);
 const [gpfIdAtencion, setGpfIdAtencion] = useState('');

 // Estados para exportación Excel GPF
 const [gpfExportId, setGpfExportId] = useState<number | null>(null);
 const [gpfExportIdInput, setGpfExportIdInput] = useState('');
 const [gpfExportProgress, setGpfExportProgress] = useState<number | null>(null);
 const [gpfExportLoading, setGpfExportLoading] = useState(false);
 const [gpfDownloadLoading, setGpfDownloadLoading] = useState(false);
 const [gpfGenerateRawResponse, setGpfGenerateRawResponse] = useState<any>(null);
 const [gpfDownloadError, setGpfDownloadError] = useState<string | null>(null);
 const [gpfExportForm, setGpfExportForm] = useState({
 initial_date: '',
 final_date: '',
 phone: '',
 case_number: '',
 qualification: '',
 agent: '',
 date_type: '' as '' | 'alta' | 'edicion'
 });

 const [systemStats, setSystemStats] = useState<SystemStats>({
 totalUsers: 0,
 activeUsers: 0,
 totalAudits: 0,
 completedAudits: 0,
 averageScore: 0,
 totalCosts: 0
 });

 useEffect(() => {
 loadAudits();
 loadSystemStats();
 }, []);

 // HELPER para obtener evaluations de forma segura
 const getEvaluations = (audit: Audit | null | undefined) => {
 if (!audit || !audit.evaluations) return [];
 if (Array.isArray(audit.evaluations)) return audit.evaluations;
 return [audit.evaluations];
 };

 const categories = useMemo(() => {
 const set = new Set<string>();
 audits.forEach(a => { if (a?.call_type) set.add(a.call_type); });
 return [...set].sort();
 }, [audits]);

 const filteredAudits = useMemo(() => {
 let list = audits.filter(Boolean);
 if (dateFrom) list = list.filter(a => localDateStr(a.created_at) >= dateFrom);
 if (dateTo) list = list.filter(a => localDateStr(a.created_at) <= dateTo);
 if (categoryFilter !== 'all') list = list.filter(a => a.call_type === categoryFilter);
 if (scoreFilter !== 'all') {
 list = list.filter(a => matchesScore(getEvaluations(a)[0]?.percentage, scoreFilter));
 }
 if (search.trim()) {
 const q = search.toLowerCase();
 list = list.filter(a =>
 a.executive_name?.toLowerCase().includes(q) ||
 a.executive_id?.toLowerCase().includes(q) ||
 a.client_id?.toLowerCase().includes(q) ||
 a.created_by_name?.toLowerCase().includes(q)
 );
 }
 return list;
 }, [audits, search, dateFrom, dateTo, scoreFilter, categoryFilter]);

 const loadAudits = async () => {
 try {
 setLoading(true);
 const response = await auditService.getUserAudits();
 
 // Verificar que response y response.audits existen
 if (!response || !response.audits) {
 console.warn(' Invalid response from getUserAudits:', response);
 setAudits([]);
 return;
 }
 
 // Asegurar que audits es un array
 const auditsArray = Array.isArray(response.audits) ? response.audits : [];
 setAudits(auditsArray);
 } catch (error: any) {
 toast.error(t('adminDash.loadError'));
 console.error(error);
 setAudits([]); // Asegurar array vacío en caso de error
 } finally {
 setLoading(false);
 }
 };

 const loadSystemStats = async () => {
 try {
 const stats = await auditService.getStats();

 if (!stats || typeof stats !== 'object') {
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
 const totalCosts = allAudits.reduce((sum, audit) => sum + getAuditTotalCost(audit), 0);

 setSystemStats({
 totalUsers: stats.totalExecutives || 0,
 activeUsers: Math.floor((stats.totalExecutives || 0) * 0.6),
 totalAudits: stats.totalAudits || 0,
 completedAudits: stats.completedAudits || 0,
 averageScore: Math.round(stats.averageScore || 0),
 totalCosts: totalCosts
 });
 } catch (error) {
 toast.error(t('adminDash.statsError'));
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
 if (!confirm(t('adminDash.confirmDelete'))) {
 return;
 }

 try {
 setDeletingId(auditId);
 await auditService.deleteAudit(auditId);
 toast.success(t('adminDash.deleteSuccess'));
 await loadAudits();
 await loadSystemStats(); // Recargar estadísticas después de eliminar
 } catch (error) {
 toast.error(t('audits.deleteError'));
 } finally {
 setDeletingId(null);
 }
 };

 const handleDownloadExcel = async (filename: string) => {
 try {
 toast.loading(t('adminDash.downloadingExcel'), { id: 'download' });
 const blob = await auditService.downloadExcel(filename);
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 window.URL.revokeObjectURL(url);
 document.body.removeChild(a);
 toast.success(t('adminDash.downloadSuccess'), { id: 'download' });
 } catch (error) {
 toast.error(t('adminDash.downloadError'), { id: 'download' });
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
 toast.success(t('gpfConsole.tokenObtained'));
 } else {
 const err = result.data?.error;
 const msg = (typeof err === 'string' ? err : err?.message) || t('gpfConsole.invalidCredentials');
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
 toast.error(t('gpfConsole.invalidJsonBody'));
 setGpfRequestLoading(false);
 return;
 }
 }

 if (gpfEndpointNeedsId && !gpfIdAtencion.trim()) {
 toast.error(t('gpfConsole.enterAttentionId'));
 setGpfRequestLoading(false);
 return;
 }

 const finalEndpoint = gpfEndpointNeedsId
 ? `${gpfEndpoint}${gpfIdAtencion.trim()}`
 : gpfEndpoint;

 const result = await gpfService.proxy({
 env: gpfEnv,
 endpoint: finalEndpoint,
 method: gpfMethod,
 token: gpfToken || undefined,
 body: parsedBody,
 queryString: gpfQueryString || undefined
 });

 setGpfResponse(result);

 if (result.data?.is_success === true) {
 toast.success(t('gpfConsole.responseOk', { status: result.gpf_status }));
 } else if (result.gpf_status >= 400 || result.data?.is_success === false) {
 toast.error(`Error ${result.gpf_status}`);
 } else {
 toast.success(t('gpfConsole.responseStatus', { status: result.gpf_status }));
 }
 } catch (error: any) {
 const msg = error?.response?.data?.error || error.message || 'Error de conexión';
 toast.error(msg);
 setGpfResponse({ gpf_status: 0, elapsed_ms: 0, data: null, error: msg });
 } finally {
 setGpfRequestLoading(false);
 }
 };

 const handleGpfEndpointPreset = (preset: string, method: string, sampleBody?: string, needsId?: boolean) => {
 setGpfEndpoint(preset);
 setGpfMethod(method);
 if (sampleBody !== undefined) setGpfBody(sampleBody);
 setGpfResponse(null);
 setGpfTableView(false);
 setGpfEndpointNeedsId(!!needsId);
 setGpfIdAtencion('');
 };

 const handleGpfGenerateExport = async () => {
 if (!gpfExportForm.initial_date || !gpfExportForm.final_date) {
 toast.error(t('gpfConsole.datesRequired'));
 return;
 }
 try {
 setGpfExportLoading(true);
 setGpfExportId(null);
 setGpfExportIdInput('');
 setGpfExportProgress(null);
 setGpfGenerateRawResponse(null);
 setGpfDownloadError(null);
 const result = await gpfService.proxy({
 env: gpfEnv,
 endpoint: '/api/quality-control/v1/generate-report',
 method: 'POST',
 token: gpfToken || undefined,
 body: Object.fromEntries(
 Object.entries(gpfExportForm).filter(([, v]) => v !== '')
 )
 });
 setGpfGenerateRawResponse(result);
 if (result.data?.is_success && result.data?.data?.export_id != null) {
 const id = result.data.data.export_id;
 setGpfExportId(id);
 setGpfExportIdInput(String(id));
 toast.success(t('gpfConsole.exportGenerated', { id }));
 } else {
 const err = result.data?.error;
 toast.error((typeof err === 'string' ? err : err?.message) || 'Error al generar exportación');
 }
 } catch (error: any) {
 toast.error(error?.response?.data?.error || error.message || 'Error de conexión');
 } finally {
 setGpfExportLoading(false);
 }
 };

 const handleGpfDownloadExport = async () => {
 const idToUse = gpfExportId ?? (gpfExportIdInput.trim() ? parseInt(gpfExportIdInput.trim(), 10) : null);
 if (idToUse === null || isNaN(idToUse)) {
 toast.error(t('gpfConsole.enterValidExportId'));
 return;
 }
 try {
 setGpfDownloadLoading(true);
 setGpfExportProgress(null);
 setGpfDownloadError(null);
 const result = await gpfService.downloadReport({
 env: gpfEnv,
 token: gpfToken || undefined,
 export_id: idToUse
 });
 if (result.isFile) {
 const url = window.URL.createObjectURL(result.blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = result.filename;
 document.body.appendChild(a);
 a.click();
 window.URL.revokeObjectURL(url);
 document.body.removeChild(a);
 toast.success(t('gpfConsole.fileDownloaded', { filename: result.filename }));
 setGpfExportProgress(100);
 setGpfDownloadError(null);
 } else {
 // result.data = respuesta del backend { gpf_status, elapsed_ms, data: <GPF body> }
 // result.data.data = GPF body { data: { export_progress }, is_success, ... }
 const gpfBody = (result as any).data?.data;
 const gpfStatus: number = (result as any).data?.gpf_status ?? 0;
 const progress: number | null = gpfBody?.data?.export_progress ?? null;
 const isSuccess: boolean = gpfBody?.is_success ?? false;

 if (progress !== null) {
 setGpfExportProgress(progress);
 setGpfDownloadError(null);
 toast(t('gpfConsole.processing', { percent: progress }), { icon: '' });
 } else if (isSuccess) {
 setGpfExportProgress(null);
 setGpfDownloadError(null);
 toast.success(t('gpfConsole.responseNoProgress'));
 } else {
 // Error de GPF — mostrar completo
 const errObj = gpfBody?.error;
 const errMsg = typeof errObj === 'string'
 ? errObj
 : errObj?.message || JSON.stringify(errObj) || 'Error desconocido';
 const fullError = `GPF ${gpfStatus}: ${errMsg}`;
 setGpfDownloadError(JSON.stringify({ gpf_status: gpfStatus, gpfBody }, null, 2));
 toast.error(fullError);
 }
 }
 } catch (error: any) {
 toast.error(error?.response?.data?.error || error.message || 'Error al descargar');
 } finally {
 setGpfDownloadLoading(false);
 }
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
 { label: t('gpfConsole.epDetalleLlamadas'), path: '/api/quality-control/v1/attentions-quality-control', method: 'GET', body: '', needsId: false, confirmed: true },
 { label: t('gpfConsole.epCapturasComentarios'), path: '/api/quality-control/v1/captures-comments/', method: 'GET', body: '', needsId: true, confirmed: true },
 { label: t('gpfConsole.epTransacciones'), path: '/api/quality-control/v1/transactions/', method: 'GET', body: '', needsId: true, confirmed: true },
 { label: t('gpfConsole.epComentarios'), path: '/api/quality-control/v1/comments/', method: 'GET', body: '', needsId: true, confirmed: true },
 { label: t('gpfConsole.epValidacionesOtp'), path: '/api/quality-control/v1/otp-validations/', method: 'GET', body: '', needsId: true, confirmed: true },
 ];

 const isSuccess = gpfResponse?.data?.is_success === true;
 const hasResponse = gpfResponse !== null;
 const responseData = gpfResponse?.data?.data;

 // Detectar tipo de respuesta según la estructura documentada en la API GPF
 const isArray = Array.isArray(responseData);
 const responseArray: any[] = isArray ? responseData : [];
 const tableColumns: string[] = responseArray.length > 0 ? Object.keys(responseArray[0]) : [];
 const canShowTable = responseArray.length > 0 && tableColumns.length > 0;

 // Detectar respuestas estructuradas (no-array) según doc:
 // captures-comments → { captures: string[], comments: string[] }
 // transactions → { transactions: { date, commerce_name, amount }[] }
 // comments → { comments: { date, comment, agent }[] }
 const hasCaptures = !isArray && responseData != null && Array.isArray(responseData?.captures);
 const hasTransactions = !isArray && Array.isArray(responseData?.transactions);
 const hasCommentsObj = !isArray && Array.isArray(responseData?.comments) && responseData.comments.length > 0 && typeof responseData.comments[0] === 'object';
 const hasOtpValidations = !isArray && Array.isArray(responseData?.otpValidations);

 return (
 <div className="space-y-6">
 {/* Banner de sección */}
 <div className="p-5 bg-gradient-to-r from-brand-900/30 to-emerald-900/20 border border-brand-500/30 rounded-xl">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-brand-500/20 rounded-lg">
 <Globe className="w-6 h-6 text-brand-400" />
 </div>
 <div>
 <h2 className="text-lg font-bold text-white">{t('adminDash.gpfApiTitle')}</h2>
 <p className="text-slate-400 text-sm">{t('gpfConsole.bannerSubtitle')}</p>
 </div>
 <div className="ml-auto flex items-center gap-2">
 {gpfToken ? (
 <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-xs font-semibold text-emerald-400">
 <CheckCircle2 className="w-3 h-3" />
 {t('adminDash.authenticated')}
 </span>
 ) : (
 <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 border border-slate-600 rounded-full text-xs font-medium text-slate-400">
 <XCircle className="w-3 h-3" />
 {t('adminDash.noToken')}
 </span>
 )}
 </div>
 </div>
 </div>

 {/* Guía de uso */}
 <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
 <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">{t('gpfConsole.guideTitle')}</p>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
 <div className="flex items-start gap-2">
 <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">1</span>
 <div>
 <p className="text-xs font-medium text-slate-300">{t('gpfConsole.step1Title')}</p>
 <p className="text-xs text-slate-500">{t('gpfConsole.step1Desc')}</p>
 </div>
 </div>
 <div className="flex items-start gap-2">
 <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">2</span>
 <div>
 <p className="text-xs font-medium text-slate-300">{t('gpfConsole.step2Title')}</p>
 <p className="text-xs text-slate-500">{t('gpfConsole.step2Desc')}</p>
 </div>
 </div>
 <div className="flex items-start gap-2">
 <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">3</span>
 <div>
 <p className="text-xs font-medium text-slate-300">{t('gpfConsole.step3Title')}</p>
 <p className="text-xs text-slate-500">{t('gpfConsole.step3Desc')}</p>
 </div>
 </div>
 <div className="flex items-start gap-2">
 <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">4</span>
 <div>
 <p className="text-xs font-medium text-slate-300">{t('gpfConsole.step4Title')}</p>
 <p className="text-xs text-slate-500">{t('gpfConsole.step4Desc')}</p>
 </div>
 </div>
 </div>
 <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500">
 <div><span className="text-slate-400 font-medium">{t('gpfConsole.testLabel')}</span> classic-routinely-beagle.ngrok-free.app</div>
 <div><span className="text-slate-400 font-medium">{t('gpfConsole.prodLabel')}</span> gpf.prevencion.algartech.com.mx:6443</div>
 <div><span className="text-slate-400 font-medium">{t('gpfConsole.authLabel')}</span> X-App-Token + Bearer token (obtenido en paso 2)</div>
 <div><span className="text-slate-400 font-medium">{t('gpfConsole.formatLabel')}</span> {t('gpfConsole.formatDesc')} <code className="text-brand-400">data</code>, <code className="text-brand-400">error</code>, <code className="text-brand-400">is_success</code>, <code className="text-brand-400">status</code></div>
 </div>
 </div>

 {/* PASO 1: Ambiente y Autenticación */}
 <div className="card">
 <h3 className="section-header">
 <Key className="w-5 h-5 text-brand-400" />
 <span>{t('gpfConsole.step1Header')}</span>
 </h3>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
 {/* Selector de ambiente */}
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.environment')}</label>
 <div className="flex rounded-lg overflow-hidden border border-slate-700">
 <button
 onClick={() => { setGpfEnv('test'); setGpfToken(''); setGpfTokenUser(null); setGpfResponse(null); }}
 className={`flex-1 py-2 text-sm font-medium transition-all ${gpfEnv === 'test' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
 >
 {t('adminDash.testEnv')}
 </button>
 <button
 onClick={() => { setGpfEnv('prod'); setGpfToken(''); setGpfTokenUser(null); setGpfResponse(null); }}
 className={`flex-1 py-2 text-sm font-medium transition-all ${gpfEnv === 'prod' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
 >
 {t('adminDash.prodEnv')}
 </button>
 </div>
 <p className="text-xs text-slate-500 mt-1">
 {gpfEnv === 'test' ? 'ngrok · classic-routinely-beagle' : 'gpf.prevencion.algartech.com.mx:6443'}
 </p>
 </div>

 {/* Token actual */}
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-slate-400 mb-1.5">
 {t('gpfConsole.sessionToken')} {gpfTokenUser && <span className="text-brand-400 ml-1">· {gpfTokenUser.name} ({gpfTokenUser.email})</span>}
 </label>
 <div className="flex gap-2">
 <div className="flex-1 relative">
 <input
 type="text"
 value={gpfToken}
 onChange={(e) => setGpfToken(e.target.value)}
 placeholder={t('gpfConsole.tokenPlaceholder')}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500"
 />
 </div>
 {gpfToken && (
 <button
 onClick={() => { navigator.clipboard.writeText(gpfToken); toast.success(t('gpfConsole.tokenCopied')); }}
 className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-all"
 title={t('adminDash.copyToken')}
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
 className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 active:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all duration-200 shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98]"
 >
 {gpfLoginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
 {gpfLoginLoading ? t('adminDash.authenticating') : t('adminDash.getToken')}
 </button>
 </div>

 {/* PASO 2: Probar Endpoints */}
 <div className="card">
 <h3 className="section-header">
 <Terminal className="w-5 h-5 text-brand-400" />
 <span>{t('gpfConsole.step2Header')}</span>
 {!gpfToken && <span className="ml-auto text-xs text-yellow-400 font-normal flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('gpfConsole.requiresToken')}</span>}
 </h3>

 {/* Presets de endpoints */}
 <div className="mb-4">
 <label className="block text-xs font-medium text-slate-400 mb-2">{t('gpfConsole.knownEndpoints')}</label>
 <div className="flex flex-wrap gap-2">
 {GPF_ENDPOINTS.map((ep) => (
 <button
 key={ep.path}
 onClick={() => handleGpfEndpointPreset(ep.path, ep.method, ep.body, ep.needsId)}
 title={ep.confirmed ? ep.path : t('gpfConsole.unconfirmedRoute', { path: ep.path })}
 className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
 gpfEndpoint === ep.path
 ? 'bg-brand-500/20 border-brand-500/60 text-brand-300'
 : ep.confirmed
 ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-brand-500/40 hover:text-slate-300'
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
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.method')}</label>
 <select
 value={gpfMethod}
 onChange={(e) => setGpfMethod(e.target.value)}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 >
 <option value="GET">GET</option>
 <option value="POST">POST</option>
 </select>
 </div>
 <div className="md:col-span-3">
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.endpoint')}</label>
 <input
 type="text"
 value={gpfEndpoint}
 onChange={(e) => setGpfEndpoint(e.target.value)}
 placeholder="/api/login"
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:border-brand-500"
 />
 </div>
 </div>

 {/* Query params */}
 <div className="mb-3">
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.queryString')}</label>
 <input
 type="text"
 value={gpfQueryString}
 onChange={(e) => setGpfQueryString(e.target.value)}
 placeholder={t('gpfConsole.queryPlaceholder')}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:border-brand-500"
 />
 </div>

 {/* ID de Atención (para endpoints que lo requieren) */}
 {gpfEndpointNeedsId && (
 <div className="mb-4">
 <label className="block text-xs font-medium text-slate-400 mb-1.5">
 {t('gpfConsole.attentionId')} <span className="text-red-400">*</span>
 <span className="ml-2 text-slate-500 font-normal">{t('gpfConsole.attentionIdHint')}</span>
 </label>
 <input
 type="text"
 value={gpfIdAtencion}
 onChange={(e) => setGpfIdAtencion(e.target.value)}
 placeholder={t('gpfConsole.egId')}
 className="w-full px-3 py-2 bg-slate-800 border border-brand-500/50 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:border-brand-400"
 />
 {gpfIdAtencion && (
 <p className="text-xs text-slate-500 mt-1 font-mono">
 {t('gpfConsole.finalUrl')} <span className="text-brand-400">{gpfEndpoint}{gpfIdAtencion}</span>
 </p>
 )}
 </div>
 )}

 {/* Body */}
 {!['GET', 'HEAD'].includes(gpfMethod) && (
 <div className="mb-4">
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.bodyJson')}</label>
 <textarea
 value={gpfBody}
 onChange={(e) => setGpfBody(e.target.value)}
 rows={6}
 spellCheck={false}
 className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-brand-500 resize-y"
 />
 </div>
 )}

 <button
 onClick={handleGpfRequest}
 disabled={gpfRequestLoading || !gpfEndpoint}
 className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 active:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all duration-200 shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98]"
 >
 {gpfRequestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
 {gpfRequestLoading ? t('adminDash.executing') : t('adminDash.executeRequest')}
 </button>
 </div>

 {/* Respuesta */}
 {hasResponse && gpfResponse && (
 <motion.div
 className="card"
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
 >
 <div className="flex items-center justify-between mb-4">
 <h3 className="section-header mb-0">
 <Activity className="w-5 h-5 text-brand-400" />
 <span>{t('adminDash.response')}</span>
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
 {t('gpfConsole.networkError')}
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
 ? (() => {
 if (canShowTable) return t('gpfConsole.recordsFound', { count: responseArray.length });
 if (hasCaptures) return t('gpfConsole.capturesComments', { captures: responseData.captures.length, comments: (responseData.comments as string[]).length });
 if (hasTransactions) return t('gpfConsole.transactionsFound', { count: responseData.transactions.length });
 if (hasCommentsObj) return t('gpfConsole.commentsFound', { count: responseData.comments.length });
 if (hasOtpValidations) return t('gpfConsole.otpFound', { count: responseData.otpValidations.length });
 return t('gpfConsole.requestSuccess');
 })()
 : (() => {
 const err = gpfResponse.data?.error;
 return (typeof err === 'string' ? err : err?.message) || t('gpfConsole.requestFailed');
 })()}
 </span>
 {(canShowTable || hasTransactions || hasCommentsObj || hasOtpValidations) && (
 <div className="ml-auto flex items-center rounded-lg overflow-hidden border border-slate-700">
 <button
 onClick={() => setGpfTableView(false)}
 className={`px-3 py-1 text-xs font-medium transition-all ${!gpfTableView ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
 >
 JSON
 </button>
 <button
 onClick={() => setGpfTableView(true)}
 className={`px-3 py-1 text-xs font-medium transition-all ${gpfTableView ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
 >
 Tabla
 </button>
 </div>
 )}
 </div>
 )}

 {/* Vista estructurada: captures-comments */}
 {isSuccess && hasCaptures && (
 <div className="space-y-4">
 {/* Capturas (imágenes) */}
 <div>
 <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
 {t('gpfConsole.capturesLabel', { count: (responseData.captures as string[]).length })}
 </p>
 {(responseData.captures as string[]).length === 0 ? (
 <p className="text-slate-500 text-sm italic">{t('gpfConsole.noCaptures')}</p>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
 {(responseData.captures as string[]).map((url: string, idx: number) => (
 <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
 className="block rounded-lg overflow-hidden border border-slate-700 hover:border-brand-500/60 transition-all group"
 >
 <img
 src={url}
 alt={t('newAudit.captureAlt', { n: idx + 1 })}
 className="w-full h-32 object-cover group-hover:opacity-90 transition-opacity"
 onError={(e) => {
 (e.target as HTMLImageElement).style.display = 'none';
 (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
 }}
 />
 <div className="hidden px-2 py-3 text-xs text-brand-400 font-mono break-all bg-slate-800/80">
 {url}
 </div>
 <p className="text-xs text-slate-500 px-2 py-1 bg-slate-900 truncate" title={url}>
 {idx + 1} · {url.split('/').pop()}
 </p>
 </a>
 ))}
 </div>
 )}
 </div>
 {/* Comentarios de captures-comments (strings) */}
 <div>
 <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
 {t('gpfConsole.commentsLabel', { count: (responseData.comments as string[]).length })}
 </p>
 {(responseData.comments as string[]).length === 0 ? (
 <p className="text-slate-500 text-sm italic">{t('gpfConsole.noComments')}</p>
 ) : (
 <ul className="space-y-1">
 {(responseData.comments as string[]).map((c: string, idx: number) => (
 <li key={idx} className="flex items-start gap-2 px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700 text-sm text-slate-300">
 <span className="text-slate-600 font-mono text-xs mt-0.5">{idx + 1}.</span>
 {c}
 </li>
 ))}
 </ul>
 )}
 </div>
 <div className="flex justify-end">
 <button
 onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse!.data, null, 2)); toast.success(t('gpfConsole.jsonCopied')); }}
 className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all"
 >
 <Copy className="w-3 h-3" />
 {t('adminDash.copyJson')}
 </button>
 </div>
 </div>
 )}

 {/* Vista tabla: attentions-quality-control (array plano) */}
 {isSuccess && canShowTable && gpfTableView && !hasCaptures && (
 <div className="overflow-x-auto rounded-lg border border-slate-700">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-slate-800 border-b border-slate-700">
 <th className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">#</th>
 {tableColumns.map((col) => (
 <th key={col} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">
 {col}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {responseArray.map((row: any, idx: number) => (
 <tr key={idx} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
 <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
 {tableColumns.map((col) => (
 <td key={col} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[200px] truncate" title={String(row[col] ?? '')}>
 {row[col] != null ? String(row[col]) : <span className="text-slate-600">—</span>}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
 <span className="text-xs text-slate-500">{t('gpfConsole.recordsCols', { rows: responseArray.length, cols: tableColumns.length })}</span>
 <button
 onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse!.data, null, 2)); toast.success(t('gpfConsole.jsonCopied')); }}
 className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all"
 >
 <Copy className="w-3 h-3" />
 {t('adminDash.copyJson')}
 </button>
 </div>
 </div>
 )}

 {/* Vista tabla: transactions */}
 {isSuccess && hasTransactions && gpfTableView && (
 <div className="overflow-x-auto rounded-lg border border-slate-700">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-slate-800 border-b border-slate-700">
 <th className="px-3 py-2 text-left text-slate-400 font-medium">#</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.date')}</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.merchant')}</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.amount')}</th>
 </tr>
 </thead>
 <tbody>
 {responseData.transactions.map((t: any, idx: number) => (
 <tr key={idx} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
 <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
 <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{t.date ?? '—'}</td>
 <td className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-[200px] truncate" title={t.commerce_name}>{t.commerce_name ?? '—'}</td>
 <td className="px-3 py-2 text-emerald-400 font-semibold whitespace-nowrap">{t.amount ?? '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
 <span className="text-xs text-slate-500">{t('gpfConsole.transactionsFound', { count: responseData.transactions.length })}</span>
 <button
 onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse!.data, null, 2)); toast.success(t('gpfConsole.jsonCopied')); }}
 className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all"
 >
 <Copy className="w-3 h-3" />
 {t('adminDash.copyJson')}
 </button>
 </div>
 </div>
 )}

 {/* Vista tabla: comments (objetos con date, comment, agent) */}
 {isSuccess && hasCommentsObj && gpfTableView && (
 <div className="overflow-x-auto rounded-lg border border-slate-700">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-slate-800 border-b border-slate-700">
 <th className="px-3 py-2 text-left text-slate-400 font-medium">#</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.date')}</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.agent')}</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.comment')}</th>
 </tr>
 </thead>
 <tbody>
 {responseData.comments.map((c: any, idx: number) => (
 <tr key={idx} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
 <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
 <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{c.date ?? '—'}</td>
 <td className="px-3 py-2 text-brand-400 whitespace-nowrap">{c.agent ?? '—'}</td>
 <td className="px-3 py-2 text-slate-300">{c.comment ?? '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
 <span className="text-xs text-slate-500">{t('gpfConsole.commentsFound', { count: responseData.comments.length })}</span>
 <button
 onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse!.data, null, 2)); toast.success(t('gpfConsole.jsonCopied')); }}
 className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all"
 >
 <Copy className="w-3 h-3" />
 {t('adminDash.copyJson')}
 </button>
 </div>
 </div>
 )}

 {/* Vista tabla: validaciones OTP { date, agent, resultado: boolean } */}
 {isSuccess && hasOtpValidations && gpfTableView && (
 <div className="overflow-x-auto rounded-lg border border-slate-700">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-slate-800 border-b border-slate-700">
 <th className="px-3 py-2 text-left text-slate-400 font-medium">#</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.date')}</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.agent')}</th>
 <th className="px-3 py-2 text-left text-slate-400 font-medium">{t('newAudit.result')}</th>
 </tr>
 </thead>
 <tbody>
 {responseData.otpValidations.map((v: any, idx: number) => (
 <tr key={idx} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
 <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
 <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{v.date ?? '—'}</td>
 <td className="px-3 py-2 text-brand-400 whitespace-nowrap">{v.agent ?? '—'}</td>
 <td className="px-3 py-2">
 {v.resultado === true || v.resultado === 'true' ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
 <CheckCircle2 className="w-3 h-3" /> {t('newAudit.validated')}
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-semibold">
 <XCircle className="w-3 h-3" /> {t('newAudit.failed')}
 </span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
 <span className="text-xs text-slate-500">{t('gpfConsole.validationsCount', { count: responseData.otpValidations.length })}</span>
 <button
 onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse!.data, null, 2)); toast.success(t('gpfConsole.jsonCopied')); }}
 className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all"
 >
 <Copy className="w-3 h-3" />
 {t('adminDash.copyJson')}
 </button>
 </div>
 </div>
 )}

 {/* JSON viewer — se muestra cuando no hay vista estructurada o el usuario eligió JSON */}
 {(!isSuccess || (!hasCaptures && !gpfTableView)) && (
 <div className="relative">
 <button
 onClick={() => { navigator.clipboard.writeText(JSON.stringify(gpfResponse.data, null, 2)); toast.success(t('gpfConsole.jsonCopied')); }}
 className="absolute top-3 right-3 px-2 py-1 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1 z-10"
 >
 <Copy className="w-3 h-3" />
 {t('gpfConsole.copy')}
 </button>
 <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
 {JSON.stringify(gpfResponse.data, null, 2)}
 </pre>
 </div>
 )}
 </>
 )}
 </motion.div>
 )}

 {/* PASO 3: Exportación Excel */}
 <div className="card">
 <h3 className="section-header">
 <FileDown className="w-5 h-5 text-brand-400" />
 <span>{t('gpfConsole.step3Header')}</span>
 {!gpfToken && <span className="ml-auto text-xs text-yellow-400 font-normal flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('gpfConsole.requiresToken')}</span>}
 </h3>
 <p className="text-xs text-slate-500 mb-4">
 {t('gpfConsole.exportDescPre')} <span className="text-brand-400 font-medium">initial_date</span> {t('gpfConsole.exportDescAnd')} <span className="text-brand-400 font-medium">final_date</span> {t('gpfConsole.exportDescPost')}
 </p>

 {/* Fechas */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">
 {t('gpfConsole.initialDate')} <span className="text-red-400">*</span>
 </label>
 <div className="relative">
 <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
 <input
 type="date"
 value={gpfExportForm.initial_date}
 onChange={(e) => setGpfExportForm(f => ({ ...f, initial_date: e.target.value }))}
 className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">
 {t('gpfConsole.finalDate')} <span className="text-red-400">*</span>
 </label>
 <div className="relative">
 <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
 <input
 type="date"
 value={gpfExportForm.final_date}
 onChange={(e) => setGpfExportForm(f => ({ ...f, final_date: e.target.value }))}
 className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 />
 </div>
 </div>
 </div>

 {/* Filtros opcionales */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.phone')}</label>
 <input
 type="text"
 value={gpfExportForm.phone}
 onChange={(e) => setGpfExportForm(f => ({ ...f, phone: e.target.value }))}
 placeholder={t('common.optional')}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.caseNumber')}</label>
 <input
 type="text"
 value={gpfExportForm.case_number}
 onChange={(e) => setGpfExportForm(f => ({ ...f, case_number: e.target.value }))}
 placeholder={t('common.optional')}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('newAudit.qualification')}</label>
 <input
 type="text"
 value={gpfExportForm.qualification}
 onChange={(e) => setGpfExportForm(f => ({ ...f, qualification: e.target.value }))}
 placeholder={t('gpfConsole.qualNamePlaceholder')}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.agentEmail')}</label>
 <input
 type="text"
 value={gpfExportForm.agent}
 onChange={(e) => setGpfExportForm(f => ({ ...f, agent: e.target.value }))}
 placeholder="email@ejemplo.com"
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('gpfConsole.dateType')}</label>
 <select
 value={gpfExportForm.date_type}
 onChange={(e) => setGpfExportForm(f => ({ ...f, date_type: e.target.value as '' | 'alta' | 'edicion' }))}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500"
 >
 <option value="">{t('gpfConsole.noFilter')}</option>
 <option value="alta">alta</option>
 <option value="edicion">edicion</option>
 </select>
 </div>
 </div>

 {/* Botón generar */}
 <button
 onClick={handleGpfGenerateExport}
 disabled={gpfExportLoading || !gpfExportForm.initial_date || !gpfExportForm.final_date}
 className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 active:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all duration-200 shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98]"
 >
 {gpfExportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
 {gpfExportLoading ? t('reportsPage.generating') : t('gpfConsole.generateExport')}
 </button>

 {/* Respuesta de generate-report */}
 {gpfGenerateRawResponse !== null && (
 <div className={`mt-4 p-3 rounded-lg border text-xs ${gpfGenerateRawResponse?.data?.is_success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
 <p className="font-semibold text-slate-300 mb-1">
 {gpfGenerateRawResponse?.data?.is_success
 ? t('gpfConsole.exportCreated', { id: gpfGenerateRawResponse?.data?.data?.export_id })
 : t('gpfConsole.exportGenError', { status: gpfGenerateRawResponse?.gpf_status })}
 </p>
 <pre className="text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
 {JSON.stringify(gpfGenerateRawResponse?.data, null, 2)}
 </pre>
 </div>
 )}

 {/* Sección de descarga — export_id manual o automático */}
 <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
 <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{t('gpfConsole.downloadExport')}</p>
 <div className="flex gap-2 items-end">
 <div className="flex-1">
 <label className="block text-xs font-medium text-slate-400 mb-1.5">
 export_id <span className="text-slate-500 font-normal">{t('gpfConsole.exportIdHint')}</span>
 </label>
 <input
 type="number"
 value={gpfExportIdInput}
 onChange={(e) => { setGpfExportIdInput(e.target.value); setGpfExportId(null); }}
 placeholder={t('gpfConsole.egExportId')}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono focus:outline-none focus:border-brand-500"
 />
 </div>
 <button
 onClick={handleGpfDownloadExport}
 disabled={gpfDownloadLoading || gpfExportProgress === 100 || (!gpfExportId && !gpfExportIdInput.trim())}
 className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
 >
 {gpfDownloadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 {gpfDownloadLoading ? t('gpfConsole.querying') : t('common.download')}
 </button>
 </div>

 {/* Barra de progreso */}
 {gpfExportProgress !== null && gpfExportProgress < 100 && (
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-yellow-400 font-medium">{t('gpfConsole.processing', { percent: gpfExportProgress })}</span>
 <span className="text-xs text-slate-500">{t('gpfConsole.clickDownloadAgain')}</span>
 </div>
 <div className="w-full bg-slate-700 rounded-full h-1.5">
 <div className="bg-brand-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${gpfExportProgress}%` }} />
 </div>
 </div>
 )}
 {gpfExportProgress === 100 && (
 <p className="text-xs text-emerald-400 font-semibold"> {t('gpfConsole.downloadComplete')}</p>
 )}

 {/* Error detallado de download-report */}
 {gpfDownloadError && (
 <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
 <p className="text-xs font-semibold text-red-400 mb-1">{t('gpfConsole.gpfDownloadResponse')}</p>
 <pre className="text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
 {gpfDownloadError}
 </pre>
 </div>
 )}
 </div>
 </div>
 </div>
 );
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case 'completed':
 return (
 <span className="badge badge-success">
 <CheckCircle2 className="w-3 h-3 mr-1" />
 {t('adminDash.statusCompleted')}
 </span>
 );
 case 'processing':
 return (
 <span className="badge badge-info">
 <Clock className="w-3 h-3 mr-1" />
 {t('adminDash.statusProcessing')}
 </span>
 );
 case 'error':
 return (
 <span className="badge badge-danger">
 <AlertCircle className="w-3 h-3 mr-1" />
 {t('adminDash.statusError')}
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

 const renderNormalView = () => (
 <>
 {/* Quick Actions - Ampliado */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <button
 onClick={() => navigate('/users')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-brand-900/20 to-brand-800/20 border-brand-700/40"
 >
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-brand-500/10 rounded-lg">
 <Users className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.users')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.manageTeam')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/settings')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-700/40 border-slate-600/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-slate-600/20 rounded-xl">
 <Settings className="w-6 h-6 text-slate-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.settings')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.systemAndApis')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/scripts-admin')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 border-emerald-500/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-emerald-500/20 rounded-xl">
 <BookOpen className="w-6 h-6 text-emerald-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.scriptsAndCriteria')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.guidelinesAndRubrics')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/reports')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-purple-500/20 rounded-xl">
 <BarChart3 className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.reports')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.advancedAnalysis')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/audits')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-green-500/20 rounded-xl">
 <FileSpreadsheet className="w-5 h-5 text-green-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.audits')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.viewAll')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/companies')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-cyan-900/20 to-cyan-800/20 border-cyan-500/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-cyan-500/20 rounded-xl">
 <Building2 className="w-5 h-5 text-cyan-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.companies')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.multiTenant')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/integrations')}
 className="stat-card hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 cursor-pointer bg-gradient-to-br from-amber-900/20 to-amber-800/20 border-amber-500/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-amber-500/20 rounded-xl">
 <Plug className="w-5 h-5 text-amber-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('adminDash.integrations')}</h3>
 <p className="text-sm text-slate-400">{t('adminDash.integrationsDesc')}</p>
 </div>
 </div>
 </button>
 </div>

 {/* Stats Cards - Solo las 4 tarjetas con datos reales */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <div className="stat-card bg-gradient-to-br from-indigo-900/20 to-indigo-800/20 border-indigo-500/30">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('adminDash.totalUsers')}</span>
 <Users className="w-5 h-5 text-indigo-400" />
 </div>
 <div className="text-2xl font-bold text-white tabular-nums"><CountUp value={systemStats.totalUsers} /></div>
 <div className="text-xs text-slate-500 mt-1">{systemStats.activeUsers} {t('adminDash.activeUsers')}</div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('adminDash.totalAudits')}</span>
 <FileText className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-white tabular-nums"><CountUp value={systemStats.totalAudits} /></div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('adminDash.completedAudits')}</span>
 <CheckCircle2 className="w-5 h-5 text-green-400" />
 </div>
 <div className="text-2xl font-bold text-white tabular-nums"><CountUp value={systemStats.completedAudits} /></div>
 </div>

 <div className="stat-card bg-gradient-to-br from-emerald-900/20 to-green-900/20 border-emerald-500/30">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('adminDash.totalCosts')}</span>
 <DollarSign className="w-5 h-5 text-emerald-400" />
 </div>
 <div className="text-2xl font-bold text-emerald-400 tabular-nums">
 <CountUp value={systemStats.totalCosts} prefix="$" decimals={4} />
 </div>
 <div className="text-xs text-slate-500 mt-1">{t('adminDash.usd')}</div>
 </div>
 </div>

 {/* Score Promedio - Mostrar solo si hay datos */}
 {systemStats.averageScore > 0 && (
 <div className="grid grid-cols-1 mb-5">
 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('adminDash.averageScore')}</span>
 <TrendingUp className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-white tabular-nums"><CountUp value={systemStats.averageScore} suffix="%" /></div>
 </div>
 </div>
 )}

 {/* Aviso de precio introductorio de Claude Sonnet 5 (se auto-oculta tras el 31-ago-2026) */}
 {new Date() < new Date('2026-09-01T00:00:00Z') && (
 <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 flex items-start gap-2.5">
 <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
 <p className="text-xs text-slate-400 leading-relaxed">
 <span className="text-amber-300 font-semibold">Precio de Claude Sonnet 5:</span> ahora usa el
 <span className="text-slate-200 font-medium"> introductorio $2 in / $10 out por 1M tokens</span>, vigente
 <span className="text-amber-300 font-semibold"> hasta el 31 de agosto de 2026</span>. Desde el
 <span className="text-amber-300 font-semibold"> 1 de septiembre de 2026</span> aplica el de lista
 <span className="text-slate-200 font-medium"> $3 in / $15 out</span> — la parte de Claude de los costos subirá
 <span className="text-amber-300 font-semibold"> ~1.5×</span> (AssemblyAI no cambia). Es el costo real de ahí en adelante,
 lo avisamos para que no haya sorpresas.
 </p>
 </div>
 )}

 {/* Audits List */}
 <div className="card">
 <h2 className="section-header">
 <FileText className="w-5 h-5 text-brand-400" />
 {t('adminDash.auditManagement')}
 </h2>

 {/* Filtros */}
 <div className="flex items-center gap-3 flex-wrap mb-4">
 <div className="flex-1 min-w-[180px] relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
 <input
 type="text"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder={t('adminDash.searchPlaceholder')}
 className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500"
 />
 </div>
 <DateRangeFilter
 from={dateFrom} to={dateTo}
 onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }}
 className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500 min-w-[170px]"
 />
 <div className="relative">
 <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
 <select
 value={scoreFilter}
 onChange={e => setScoreFilter(e.target.value as ScoreFilter)}
 className="pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500 appearance-none"
 title={t('adminDash.filterScore')}
 >
 <option value="all">{t('adminDash.scoreAll')}</option>
 <option value="excellent">{t('adminDash.scoreExcellent')}</option>
 <option value="good">{t('adminDash.scoreGood')}</option>
 <option value="regular">{t('adminDash.scoreRegular')}</option>
 <option value="low">{t('adminDash.scoreLow')}</option>
 </select>
 </div>
 <div className="relative">
 <PhoneIncoming className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
 <select
 value={categoryFilter}
 onChange={e => setCategoryFilter(e.target.value)}
 className="pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-500 appearance-none"
 title={t('adminDash.filterCategory')}
 >
 <option value="all">{t('adminDash.categoryAll')}</option>
 {categories.map(c => (
 <option key={c} value={c}>{c}</option>
 ))}
 </select>
 </div>
 {(search || dateFrom || dateTo || scoreFilter !== 'all' || categoryFilter !== 'all') && (
 <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setScoreFilter('all'); setCategoryFilter('all'); }}
 className="text-xs text-brand-400 hover:text-brand-300 whitespace-nowrap">
 {t('adminDash.clearFilters')}
 </button>
 )}
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
 </div>
 ) : audits.length === 0 ? (
 <div className="text-center py-8">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
 <FileText className="w-8 h-8 text-slate-600" />
 </div>
 <p className="text-slate-400 mb-4">
 {t('adminDash.noAudits')}
 </p>
 <button
 onClick={() => navigate('/audit/new')}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="w-5 h-5" />
 {t('adminDash.createFirst')}
 </button>
 </div>
 ) : filteredAudits.length === 0 ? (
 <div className="text-center py-8">
 <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
 <p className="text-slate-400 text-sm">{t('adminDash.noResults')}</p>
 <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setScoreFilter('all'); setCategoryFilter('all'); }}
 className="mt-2 text-xs text-brand-400 hover:text-brand-300">
 {t('adminDash.clearFilters')}
 </button>
 </div>
 ) : (
 <Stagger className="space-y-4">
 {filteredAudits.map((audit) => {
 if (!audit) return null; // Protección adicional

 return (
 <motion.div
 key={audit.id}
 variants={fadeUp}
 whileHover={{ y: -2 }}
 whileTap={{ scale: 0.995 }}
 transition={EASE_SPRING}
 className={`audit-card border transition-colors ${
   isEmptyBatchEval(audit)
     ? 'border-amber-500/25 bg-amber-500/5'
     : isBatchAudit(audit)
     ? 'border-indigo-500/20 bg-indigo-500/5'
     : ''
 }`}
 onClick={() => navigate(`/audit/${audit.id}`)}
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <h3 className="text-sm font-semibold text-white">
 {audit.executive_name}
 </h3>
 {getStatusBadge(audit.status)}
 {isBatchAudit(audit) && (
   <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
     <Moon className="w-2.5 h-2.5" />
     {t('adminDash.badgeNight')}
   </span>
 )}
 {isEmptyBatchEval(audit) && (
   <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
     <AlertTriangle className="w-2.5 h-2.5" />
     {t('adminDash.badgeNoEval')}
   </span>
 )}
 </div>

 {isEmptyBatchEval(audit) && (
   <div className="mb-3 flex items-start gap-2 text-[11px] text-amber-400/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
     <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
     <span>{t('adminDash.legacyWarning')}</span>
   </div>
 )}

 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
 <div>
 <span className="text-slate-500">{t('adminDash.executiveId')}</span>
 <p className="text-slate-300 font-medium">{audit.executive_id}</p>
 </div>
 <div>
 <span className="text-slate-500">{t('adminDash.client')}</span>
 {audit.client_id ? (
 <p className="mt-0.5">
 <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/30 text-brand-300 font-semibold">
 {audit.client_id}
 </span>
 </p>
 ) : (
 <p className="text-slate-300 font-medium">—</p>
 )}
 </div>
 <div>
 <span className="text-slate-500">{t('adminDash.type')}</span>
 <div className="mt-1">
 {(audit.call_type || '').toUpperCase() === 'MONITOREO' ? (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
 <Monitor className="w-3 h-3" />
 {t('adminDash.badgeMonitoreo')}
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-700/40">
 <PhoneIncoming className="w-3 h-3" />
 {t('adminDash.badgeInbound')}
 </span>
 )}
 </div>
 </div>
 <div>
 <span className="text-slate-500">{t('adminDash.date')}</span>
 <p className="text-slate-300 font-medium">{formatDate(audit.created_at)}</p>
 </div>
 <div>
 <span className="text-slate-500">{t('adminDash.auditor')}</span>
 <p className="text-slate-300 font-medium truncate" title={audit.created_by_email || ''}>
 {audit.created_by_name || t('adminDash.unknown')}
 </p>
 </div>
 </div>

 {(() => {
 const evaluations = getEvaluations(audit);
 return evaluations.length > 0 && !isEmptyBatchEval(audit) && (
 <div className="mt-4 flex items-center gap-4">
 <div className="flex items-center gap-2">
 <TrendingUp className="w-4 h-4 text-brand-400" />
 <span className="text-slate-400 text-sm">{t('adminDash.score')}</span>
 <span className="text-xl font-bold text-brand-400">
 {evaluations[0].percentage.toFixed(2)}%
 </span>
 <span className="text-sm text-slate-500">
 ({evaluations[0].total_score}/{evaluations[0].max_possible_score} pts)
 </span>
 </div>

 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-emerald-400" />
 <span className="text-slate-400 text-sm">{t('adminDash.cost')}</span>
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
 title={t('adminDash.downloadExcel')}
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
 title={t('adminDash.deleteAudit')}
 >
 {deletingId === audit.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 </button>
 </div>
 </div>
 </motion.div>
 );
 })}
 </Stagger>
 )}
 </div>
 </>
 );

 return (
 <div className="min-h-screen">
 <AppHeader
   title={t('adminDash.pageTitle')}
   rightContent={
     <>
       <button
         onClick={() => setShowGpfPanel(!showGpfPanel)}
         className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
           showGpfPanel
             ? 'bg-brand-500/20 border border-brand-500/50 text-brand-300'
             : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-brand-500/50'
         }`}
         title={t('adminDash.gpfApiTitle')}
       >
         <Globe className="w-3.5 h-3.5" />
         API GPF
       </button>
       <button onClick={() => navigate('/batch')} className="btn-ghost flex items-center gap-1.5 text-xs py-1 px-3 text-brand-400 border border-brand-700/40 bg-brand-500/10 hover:bg-brand-500/20">
         <Moon className="w-3.5 h-3.5" />
         {t('adminDash.batchQueue')}
       </button>
       <button onClick={() => navigate('/audit/new')} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
         <Plus className="w-3.5 h-3.5" />
         {t('adminDash.newAudit')}
       </button>
       <button onClick={handleLogout} className="btn-ghost flex items-center gap-1.5 text-xs">
         <LogOut className="w-3.5 h-3.5" />
         {t('adminDash.logout')}
       </button>
     </>
   }
 />

 {/* Main Content */}
 <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.06 }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
 {showGpfPanel ? renderGpfPanel() : renderNormalView()}
 </motion.main>
 </div>
 );
}