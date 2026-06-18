// frontend/src/pages/SupervisorDashboard.tsx
// Dashboard para Supervisor (Consulta Amplia) Puede ELIMINAR auditorías, acceso a costos

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useRole } from '../contexts/AuthContext';
import { auditService, getAuditTotalCost, type Audit } from '../services/api';
import {
 Shield,
 LogOut,
 FileText,
 TrendingUp,
 Clock,
 CheckCircle2,
 AlertCircle,
 Eye,
 BarChart3,
 Calendar,
 Users,
 DollarSign,
 Download,
 Sparkles,
 Loader2,
 RefreshCw,
 PhoneIncoming,
 Monitor,
 Trash2,
 UserCheck,
 BookOpen,
 Plug
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import toast from 'react-hot-toast';

interface Stats {
 totalAudits: number;
 completedAudits: number;
 processingAudits: number;
 errorAudits: number;
 averageScore: number;
 totalExecutives: number;
 thisMonthAudits: number;
 totalCosts: number;
}

export default function SupervisorDashboard() {
 const { t } = useTranslation();
 const { user, profile, signOut } = useAuth();
 const { isAdmin, isSupervisor } = useRole();
 const navigate = useNavigate();
 const [audits, setAudits] = useState<Audit[]>([]);
 const [stats, setStats] = useState<Stats | null>(null);
 const [loading, setLoading] = useState(true);
 const [loadingStats, setLoadingStats] = useState(true);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 // âœ… HELPER para obtener evaluations de forma segura
 const getEvaluations = (audit: Audit | null | undefined) => {
 if (!audit || !audit.evaluations) return [];
 if (Array.isArray(audit.evaluations)) return audit.evaluations;
 return [audit.evaluations];
 };

 useEffect(() => {
 loadData();
 }, []);

 const loadData = async () => {
 await Promise.all([
 loadAudits(),
 loadStats()
 ]);
 };

 const loadAudits = async () => {
 try {
 setLoading(true);
 const response = await auditService.getUserAudits();
 
 // âœ… Verificar que response y response.audits existen
 if (!response || !response.audits) {
 setAudits([]);
 return;
 }
 
 // âœ… Asegurar que audits es un array
 const auditsArray = Array.isArray(response.audits) ? response.audits : [];
 setAudits(auditsArray);
 } catch (error: any) {
 toast.error(t('supervisor.loadError'));
 setAudits([]); // âœ… Asegurar array vacío en caso de error
 } finally {
 setLoading(false);
 }
 };

 const loadStats = async () => {
 try {
 setLoadingStats(true);
 const statsData = await auditService.getStats();
 
 // âœ… Verificar que statsData existe
 if (!statsData || typeof statsData !== 'object') {
 setStats({
 totalAudits: 0,
 completedAudits: 0,
 processingAudits: 0,
 errorAudits: 0,
 averageScore: 0,
 totalExecutives: 0,
 thisMonthAudits: 0,
 totalCosts: 0
 });
 return;
 }
 
 setStats({
 totalAudits: statsData.totalAudits || 0,
 completedAudits: statsData.completedAudits || 0,
 processingAudits: statsData.processingAudits || 0,
 errorAudits: statsData.errorAudits || 0,
 averageScore: statsData.averageScore || 0,
 totalExecutives: statsData.totalExecutives || 0,
 thisMonthAudits: statsData.thisMonthAudits || 0,
 totalCosts: statsData.totalCosts || 0
 });
 } catch (error: any) {
 toast.error(t('supervisor.statsLoadError'));
 // âœ… Valores por defecto en caso de error
 setStats({
 totalAudits: 0,
 completedAudits: 0,
 processingAudits: 0,
 errorAudits: 0,
 averageScore: 0,
 totalExecutives: 0,
 thisMonthAudits: 0,
 totalCosts: 0
 });
 } finally {
 setLoadingStats(false);
 }
 };

 const handleLogout = async () => {
 await signOut();
 navigate('/login');
 };

 // âœ… NUEVO: Funcion para eliminar auditorías (Supervisores SI pueden eliminar)
 const handleDeleteAudit = async (auditId: string) => {
 if (!confirm(t('supervisor.deleteConfirm'))) {
 return;
 }

 try {
 setDeletingId(auditId);
 await auditService.deleteAudit(auditId);
 toast.success(t('supervisor.deleted'));
 await loadData();
 } catch (error) {
 toast.error(t('supervisor.deleteError'));
 console.error(error);
 } finally {
 setDeletingId(null);
 }
 };

 const handleDownloadExcel = async (filename: string) => {
 try {
 toast.loading(t('supervisor.downloadingExcel'), { id: 'download' });
 const blob = await auditService.downloadExcel(filename);
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 window.URL.revokeObjectURL(url);
 document.body.removeChild(a);
 toast.success(t('supervisor.excelDownloaded'), { id: 'download' });
 } catch (error) {
 toast.error(t('audits.loadError'), { id: 'download' });
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case 'completed':
 return (
 <span className="badge badge-success">
 <CheckCircle2 className="w-3 h-3 mr-1" />
 {t('supervisor.statusCompleted')}
 </span>
 );
 case 'processing':
 return (
 <span className="badge badge-info">
 <Clock className="w-3 h-3 mr-1" />
 {t('supervisor.statusProcessing')}
 </span>
 );
 case 'error':
 return (
 <span className="badge badge-danger">
 <AlertCircle className="w-3 h-3 mr-1" />
 {t('supervisor.statusError')}
 </span>
 );
 default:
 return null;
 }
 };

 const formatDate = (dateString: string) => {
 try {
 return new Date(dateString).toLocaleDateString('es-MX', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 });
 } catch (error) {
 return dateString;
 }
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('es-MX', {
 style: 'currency',
 currency: 'USD',
 minimumFractionDigits: 4,
 maximumFractionDigits: 4
 }).format(amount);
 };

 return (
 <div className="min-h-screen">
 <AppHeader
   title={t('supervisor.pageTitle')}
   rightContent={
     <>
       <button onClick={() => loadData()} className="btn-ghost flex items-center gap-1.5 text-xs" title={t('supervisor.reloadData')}>
         <RefreshCw className="w-3.5 h-3.5" />
         {t('supervisor.refresh')}
       </button>
       <button onClick={handleLogout} className="btn-ghost flex items-center gap-1.5 text-xs">
         <LogOut className="w-3.5 h-3.5" />
         {t('supervisor.logout')}
       </button>
     </>
   }
 />

 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
 {/* Stats Cards - CON COSTOS */}
 {loadingStats ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
 </div>
 ) : stats ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('supervisor.totalAudits')}</span>
 <FileText className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-white">{stats.totalAudits}</div>
 <div className="text-sm text-slate-500 mt-1">
 {stats.completedAudits} {t('supervisor.completed')}
 </div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('supervisor.avgScore')}</span>
 <TrendingUp className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-white">
 {Math.round(stats.averageScore)}%
 </div>
 <div className="text-sm text-slate-500 mt-1">
 {t('supervisor.ofCompletedAudits')}
 </div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('supervisor.thisMonth')}</span>
 <Calendar className="w-5 h-5 text-cyan-400" />
 </div>
 <div className="text-2xl font-bold text-white">{stats.thisMonthAudits}</div>
 <div className="text-sm text-slate-500 mt-1">
 {t('supervisor.auditsDone')}
 </div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">{t('supervisor.totalCosts')}</span>
 <DollarSign className="w-5 h-5 text-green-400" />
 </div>
 <div className="text-2xl font-bold text-white">
 {formatCurrency(stats.totalCosts)}
 </div>
 <div className="text-sm text-slate-500 mt-1">
 {t('supervisor.apiInvestment')}
 </div>
 </div>
 </div>
 ) : (
 <div className="text-center py-8 text-slate-400">
 {t('supervisor.statsError')}
 </div>
 )}

 {/* Action Buttons */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
 <button
 onClick={() => navigate('/audits')}
 className="stat-card hover:scale-[1.02] transition-all duration-200 cursor-pointer bg-gradient-to-br from-brand-900/40 to-brand-800/40 border-brand-700/40"
 >
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-brand-500/10 rounded-lg">
 <FileText className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('supervisor.viewAllAudits')}</h3>
 <p className="text-sm text-slate-400">{t('supervisor.exploreHistory')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/reports')}
 className="stat-card hover:scale-[1.02] transition-all duration-200 cursor-pointer bg-gradient-to-br from-green-900/40 to-green-800/40 border-green-500/30"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-green-600/20 rounded-xl">
 <BarChart3 className="w-5 h-5 text-green-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('supervisor.generateReports')}</h3>
 <p className="text-sm text-slate-400">{t('supervisor.analysisExport')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/referencia')}
 className="stat-card hover:scale-[1.02] transition-all duration-200 cursor-pointer bg-gradient-to-br from-violet-900/40 to-violet-800/40 border-violet-700/40"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-violet-600/20 rounded-xl">
 <BookOpen className="w-5 h-5 text-violet-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('supervisor.criteriaScripts')}</h3>
 <p className="text-sm text-slate-400">{t('supervisor.referenceConsult')}</p>
 </div>
 </div>
 </button>

 <button
 onClick={() => navigate('/integrations')}
 className="stat-card hover:scale-[1.02] transition-all duration-200 cursor-pointer bg-gradient-to-br from-amber-900/40 to-amber-800/40 border-amber-700/40"
 >
 <div className="flex items-center gap-4">
 <div className="p-3 bg-amber-600/20 rounded-xl">
 <Plug className="w-5 h-5 text-amber-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">{t('supervisor.integrations')}</h3>
 <p className="text-sm text-slate-400">{t('supervisor.integrationsDesc')}</p>
 </div>
 </div>
 </button>
 </div>

 {/* Recent Audits List */}
 <div className="card">
 <h2 className="section-header">
 <Clock className="w-5 h-5 text-green-400" />
 {t('supervisor.recentAudits')}
 </h2>

 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
 </div>
 ) : !audits || audits.length === 0 ? (
 <div className="text-center py-8">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
 <FileText className="w-8 h-8 text-slate-600" />
 </div>
 <p className="text-slate-400">
 {t('supervisor.noAudits')}
 </p>
 </div>
 ) : (
 <div className="space-y-4">
 {audits.slice(0, 10).map((audit) => {
 const evaluations = getEvaluations(audit);
 
 return (
 <div
 key={audit.id}
 className="audit-card"
 >
 <div className="flex items-start justify-between">
 <div className="flex-1" onClick={() => navigate(`/audit/${audit.id}`)} style={{ cursor: 'pointer' }}>
 <div className="flex items-center gap-3 mb-2">
 <h3 className="text-sm font-semibold text-white">
 {audit.executive_name}
 </h3>
 {getStatusBadge(audit.status)}
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
 <div>
 <span className="text-slate-500">{t('supervisor.idExecutive')}</span>
 <p className="text-slate-300 font-medium break-all">{audit.executive_id}</p>
 </div>
 <div>
 <span className="text-slate-500">{t('supervisor.client')}</span>
 <p className="text-slate-300 font-medium break-all">{audit.client_id}</p>
 </div>
 <div>
 <span className="text-slate-500">{t('supervisor.type')}</span>
 <div className="mt-1">
 {(audit.call_type || '').toUpperCase() === 'MONITOREO' ? (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
 <Monitor className="w-3 h-3" />
 {t('supervisor.badgeMonitoreo')}
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-700/40">
 <PhoneIncoming className="w-3 h-3" />
 {t('supervisor.badgeInbound')}
 </span>
 )}
 </div>
 </div>
 <div>
 <span className="text-slate-500">{t('supervisor.date')}</span>
 <p className="text-slate-300 font-medium">{formatDate(audit.created_at)}</p>
 </div>
 <div>
 <span className="text-slate-500 flex items-center gap-1"><UserCheck className="w-3 h-3" /> {t('supervisor.createdBy')}</span>
 <p className="text-cyan-300 font-medium truncate">{audit.created_by_name || t('supervisor.unknown')}</p>
 </div>
 </div>

 {/* âœ… RENDERIZADO SEGURO de evaluations y costos */}
 {evaluations.length > 0 && (
 <div className="mt-4 flex items-center gap-4">
 <div className="flex items-center gap-2">
 <TrendingUp className="w-4 h-4 text-brand-400" />
 <span className="text-slate-400 text-sm">{t('supervisor.score')}</span>
 <span className="text-xl font-bold text-brand-400">
 {evaluations[0].percentage.toFixed(2)}%
 </span>
 <span className="text-sm text-slate-500">
 ({evaluations[0].total_score}/{evaluations[0].max_possible_score} pts)
 </span>
 </div>
 
 {/* âœ… Mostrar costos para supervisor */}
 <div className="flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-emerald-400" />
 <span className="text-slate-400 text-sm">{t('supervisor.cost')}</span>
 <span className="text-sm font-semibold text-emerald-400">
 {formatCurrency(getAuditTotalCost(audit))}
 </span>
 </div>
 </div>
 )}
 </div>

 <div className="flex items-center gap-2 ml-4">
 <button
 onClick={(e) => {
 e.stopPropagation();
 navigate(`/audit/${audit.id}`);
 }}
 className="btn-icon"
 title={t('supervisor.viewDetails')}
 >
 <Eye className="w-4 h-4" />
 </button>

 {evaluations.length > 0 && evaluations[0].excel_filename && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDownloadExcel(evaluations[0].excel_filename);
 }}
 className="btn-icon"
 title={t('supervisor.downloadExcel')}
 >
 <Download className="w-4 h-4" />
 </button>
 )}

 {/* âœ… NUEVO: Boton de eliminar para Supervisores y Admins */}
 {(isAdmin || isSupervisor) && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteAudit(audit.id);
 }}
 disabled={deletingId === audit.id}
 className="btn-icon-danger"
 title={t('common.delete')}
 >
 {deletingId === audit.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 </button>
 )}
 </div>
 </div>
 </div>
 );
 })}
 
 {audits.length > 10 && (
 <div className="text-center pt-4">
 <button
 onClick={() => navigate('/audits')}
 className="btn-secondary"
 >
 Ver todas las {audits.length} auditorías
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 </main>
 </div>
 );
}