// frontend/src/pages/AnalystDashboard.tsx
// Dashboard para Analista (Operador Principal) Crear, editar, eliminar auditorías. SIN acceso a costos.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRole } from '../contexts/AuthContext';
import { auditService, type Audit } from '../services/api';
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
 Edit3,
 Shield,
 Eye,
 BarChart3,
 PhoneIncoming,
 Monitor,
 UserCheck,
 BookOpen
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import toast from 'react-hot-toast';

export default function AnalystDashboard() {
 const navigate = useNavigate();
 const { user, profile, signOut } = useAuth();
 const { isAdmin, isAnalyst } = useRole();
 const [audits, setAudits] = useState<Audit[]>([]);
 const [loading, setLoading] = useState(true);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 useEffect(() => {
 loadAudits();
 }, []);

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
 toast.error('Error al cargar auditorías');
 console.error(error);
 setAudits([]); // Asegurar array vacío en caso de error
 } finally {
 setLoading(false);
 }
 };

 const handleLogout = async () => {
 await signOut();
 navigate('/login');
 };

 const handleDeleteAudit = async (auditId: string) => {
 if (!confirm('Â¿Estás seguro de eliminar esta auditoría?')) {
 return;
 }

 try {
 setDeletingId(auditId);
 await auditService.deleteAudit(auditId);
 toast.success('Auditoría eliminada correctamente');
 await loadAudits();
 } catch (error) {
 toast.error('Error al eliminar auditoría');
 console.error(error);
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

 // HELPER para obtener evaluations de forma segura
 const getEvaluations = (audit: Audit | null | undefined) => {
 if (!audit || !audit.evaluations) return [];
 if (Array.isArray(audit.evaluations)) return audit.evaluations;
 return [audit.evaluations];
 };

 // CALCULO SEGURO del promedio de score
 const calculateAverageScore = () => {
 if (!audits || audits.length === 0) return 0;
 
 const completedWithEval = audits.filter(a => {
 const evals = getEvaluations(a);
 return a && a.status === 'completed' && evals.length > 0;
 });

 if (completedWithEval.length === 0) return 0;

 const totalScore = completedWithEval.reduce((acc, a) => {
 const evals = getEvaluations(a);
 return acc + (evals[0]?.percentage || 0);
 }, 0);

 return Math.round(totalScore / completedWithEval.length);
 };

 return (
 <div className="min-h-screen">
 <AppHeader
   title="Panel de Analista"
   rightContent={
     <button onClick={handleLogout} className="btn-ghost flex items-center gap-1.5 text-xs">
       <LogOut className="w-3.5 h-3.5" />
       Salir
     </button>
   }
 />

 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
 {/* Action Buttons */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
 <button
 onClick={() => navigate('/audit/new')}
 className="stat-card hover:scale-[1.02] transition-all duration-200 cursor-pointer bg-gradient-to-br from-brand-900/40 to-brand-800/40 border-brand-700/40"
 >
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-brand-500/10 rounded-lg">
 <Plus className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-left">
 <h3 className="text-sm font-semibold text-white">Crear Auditoría</h3>
 <p className="text-sm text-slate-400">Nueva evaluación</p>
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
 <h3 className="text-sm font-semibold text-white">Reportes</h3>
 <p className="text-sm text-slate-400">Exportar datos</p>
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
 <h3 className="text-sm font-semibold text-white">Criterios y Scripts</h3>
 <p className="text-sm text-slate-400">Consulta de referencia</p>
 </div>
 </div>
 </button>
 </div>

 {/* Stats Cards - SIN COSTOS */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Total Auditorías</span>
 <FileText className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-white">{audits.length}</div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Completadas</span>
 <CheckCircle2 className="w-5 h-5 text-green-400" />
 </div>
 <div className="text-2xl font-bold text-white">
 {audits.filter(a => a && a.status === 'completed').length}
 </div>
 </div>

 <div className="stat-card">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Promedio Score</span>
 <TrendingUp className="w-5 h-5 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-white">
 {calculateAverageScore()}%
 </div>
 </div>
 </div>

 {/* Audits List */}
 <div className="card">
 <h2 className="section-header">
 <FileText className="w-5 h-5 text-brand-400" />
 Gestión de Auditorías
 </h2>

 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
 </div>
 ) : !audits || audits.length === 0 ? (
 <div className="text-center py-8">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
 <FileText className="w-8 h-8 text-slate-600" />
 </div>
 <p className="text-slate-400 mb-4">
 No tienes auditorías aún
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
 if (!audit) return null; // Proteccion adicional
 
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
 <span className="text-slate-500">ID Ejecutivo:</span>
 <p className="text-slate-300 font-medium break-all">{audit.executive_id}</p>
 </div>
 <div>
 <span className="text-slate-500">Cliente:</span>
 <p className="text-slate-300 font-medium break-all">{audit.client_id}</p>
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
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-700/40">
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
 <div>
 <span className="text-slate-500 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Creado por:</span>
 <p className="text-cyan-300 font-medium truncate">{audit.created_by_name || 'Desconocido'}</p>
 </div>
 </div>

 {/* RENDERIZADO SEGURO de evaluations */}
 {evaluations.length > 0 && (
 <div className="mt-4 flex items-center gap-4">
 <div className="flex items-center gap-2">
 <TrendingUp className="w-4 h-4 text-brand-400" />
 <span className="text-slate-400 text-sm">Score:</span>
 <span className="text-xl font-bold text-brand-400">
 {evaluations[0].percentage.toFixed(2)}%
 </span>
 <span className="text-sm text-slate-500">
 ({evaluations[0].total_score}/{evaluations[0].max_possible_score} pts)
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
 title="Ver detalles"
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
 title="Descargar Excel"
 >
 <Download className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </main>
 </div>
 );
}