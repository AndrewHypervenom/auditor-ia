// frontend/src/pages/NewAuditPage.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProcessingStatus from '../components/ProcessingStatus';
import { auditService, gpfService } from '../services/api';
import type { GpfAttention, GpfAttentionDetail } from '../services/api';
import { EXCEL_TYPES } from '../types';
import {
 Sparkles,
 ArrowLeft,
 RefreshCw,
 ChevronDown,
 Database,
 CheckCircle2,
 XCircle,
 Search,
 Filter,
 X,
 Image,
 MessageSquare,
 CreditCard,
 ShieldCheck,
 Loader2,
 CalendarRange,
 User,
 Tag,
 ChevronRight,
 Mic,
 FileSpreadsheet
} from 'lucide-react';
import ExcelJS from 'exceljs';

type AppState = 'selecting' | 'loading-detail' | 'confirming' | 'processing';

interface SSEMessage {
 type: 'info' | 'success' | 'error' | 'progress' | 'stage' | 'result';
 stage?: string;
 progress?: number;
 message: string;
 data?: any;
 timestamp: string;
}

// ── Helpers — field names match the GPF API documentation exactly ─────────────

const getAttentionId = (a: GpfAttention): string | number =>
 a['id_atencion'] ?? a.id ?? '';

const getAttentionDate = (a: GpfAttention): string =>
 a['Fecha de la compra'] ?? a.call_date ?? a.created_at?.split('T')[0] ?? '';

const getAttentionExecutive = (a: GpfAttention): string =>
 a['Agente'] ?? a.executive_name ?? '';

const getAttentionCallType = (a: GpfAttention): string =>
 a['Llamada en curso'] ?? a['Calificación'] ?? '';

const getAttentionClient = (a: GpfAttention): string =>
 String(a['Socio'] ?? a['Caso'] ?? a.client_id ?? '');

const getAttentionCalificacion = (a: GpfAttention): string =>
 a['Calificación'] ?? '';

const getAttentionEstado = (a: GpfAttention): string =>
 a['Estado llamada'] ?? '';

// Parse a date string to a comparable format (yyyy-mm-dd or original)
const parseDateForCompare = (dateStr: string): string => {
 if (!dateStr) return '';
 // Try dd/mm/yyyy → yyyy-mm-dd
 const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
 if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
 return dateStr.slice(0, 10); // take first 10 chars (ISO or similar)
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewAuditPage() {
 const navigate = useNavigate();

 const [state, setState] = useState<AppState>('selecting');
 const [env] = useState<'test' | 'prod'>('prod');
 const [attentions, setAttentions] = useState<GpfAttention[]>([]);
 const [loadingAttentions, setLoadingAttentions] = useState(false);
 const [selectedAttention, setSelectedAttention] = useState<GpfAttention | null>(null);
 const [attentionDetail, setAttentionDetail] = useState<GpfAttentionDetail | null>(null);
 const [excelType, setExcelType] = useState<'INBOUND' | 'MONITOREO'>('INBOUND');
 const [detailTab, setDetailTab] = useState<'info' | 'captures' | 'transactions' | 'comments' | 'otp'>('info');
 const [processing, setProcessing] = useState({
 stage: 'upload' as string,
 progress: 0,
 message: 'Iniciando...'
 });
 const [audioUrl, setAudioUrl] = useState<string | null>(null);
 const [audioLoading, setAudioLoading] = useState(false);
 const [exporting, setExporting] = useState(false);

 // ── Filters ──────────────────────────────────────────────────────────────────

 const [filterDateFrom, setFilterDateFrom] = useState('');
 const [filterDateTo, setFilterDateTo] = useState('');
 const [filterAgent, setFilterAgent] = useState('');
 const [filterClient, setFilterClient] = useState('');
 const [filterCalificacion, setFilterCalificacion] = useState('');
 const [filterEstado, setFilterEstado] = useState('');
 const [showFilters, setShowFilters] = useState(true);

 const activeFilterCount = [filterDateFrom, filterDateTo, filterAgent, filterClient, filterCalificacion, filterEstado]
 .filter(Boolean).length;

 const clearFilters = () => {
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterAgent('');
 setFilterClient('');
 setFilterCalificacion('');
 setFilterEstado('');
 };

 // Unique values for selects (derived from loaded attentions)
 const uniqueCalificaciones = useMemo(
 () => [...new Set(attentions.map(getAttentionCalificacion).filter(Boolean))].sort(),
 [attentions]
 );
 const uniqueEstados = useMemo(
 () => [...new Set(attentions.map(getAttentionEstado).filter(Boolean))].sort(),
 [attentions]
 );

 // Filtered list
 const filteredAttentions = useMemo(() => {
 return attentions.filter((a) => {
 const dateStr = parseDateForCompare(getAttentionDate(a));
 if (filterDateFrom && dateStr && dateStr < filterDateFrom) return false;
 if (filterDateTo && dateStr && dateStr > filterDateTo) return false;
 if (filterAgent && !getAttentionExecutive(a).toLowerCase().includes(filterAgent.toLowerCase())) return false;
 if (filterClient && !getAttentionClient(a).toLowerCase().includes(filterClient.toLowerCase())) return false;
 if (filterCalificacion && getAttentionCalificacion(a) !== filterCalificacion) return false;
 if (filterEstado && getAttentionEstado(a) !== filterEstado) return false;
 return true;
 });
 }, [attentions, filterDateFrom, filterDateTo, filterAgent, filterClient, filterCalificacion, filterEstado]);

 // ── Load attentions ──────────────────────────────────────────────────────────

 const handleLoadAttentions = async () => {
 setLoadingAttentions(true);
 try {
 const result = await gpfService.getAttentions(env);
 const attentions = result.attentions || [];
 if (attentions.length > 0) {
  const sample = attentions[0];
  console.group('[GPF DEBUG] Primera atención recibida');
  console.log('Todas las claves:', Object.keys(sample));
  console.log('Comercio:', sample['Comercio']);
  console.log('Fecha de la compra:', sample['Fecha de la compra']);
  console.log('Monto de la compra:', sample['Monto de la compra']);
  console.log('Objeto completo:', sample);
  console.groupEnd();
 }
 setAttentions(attentions);
 if (attentions.length === 0) {
 toast('No se encontraron casos para este ambiente.', { icon: 'ℹ' });
 }
 } catch (error: any) {
 console.error('Error loading attentions:', error);
 toast.error(error.response?.data?.error || 'Error al cargar casos GPF');
 } finally {
 setLoadingAttentions(false);
 }
 };

 // ── Export to Excel ──────────────────────────────────────────────────────────

 const handleExportExcel = async () => {
 if (filteredAttentions.length === 0) {
 toast('No hay casos para exportar.', { icon: 'ℹ' });
 return;
 }
 try {
 setExporting(true);
 toast.loading('Generando Excel...', { id: 'export-gpf' });

 const allKeys = Object.keys(filteredAttentions[0]);

 const workbook = new ExcelJS.Workbook();
 workbook.creator = 'AuditorIA';
 workbook.created = new Date();

 const sheet = workbook.addWorksheet('Casos GPF', {
 properties: { tabColor: { argb: 'FF3B82F6' } },
 views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
 });

 sheet.columns = allKeys.map((key) => ({
 header: key,
 key,
 width: Math.max(15, Math.min(key.length + 4, 35)),
 }));

 const headerRow = sheet.getRow(1);
 headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
 headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
 headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
 headerRow.height = 20;

 filteredAttentions.forEach((att, rowIdx) => {
 const rowData: Record<string, any> = {};
 allKeys.forEach((key) => { rowData[key] = att[key] ?? ''; });
 const row = sheet.addRow(rowData);
 const argb = rowIdx % 2 === 0 ? 'FF0F172A' : 'FF1E293B';
 row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
 row.font = { size: 10, color: { argb: 'FFE2E8F0' } };
 });

 sheet.autoFilter = {
 from: { row: 1, column: 1 },
 to: { row: 1, column: allKeys.length },
 };

 const buffer = await workbook.xlsx.writeBuffer();
 const blob = new Blob([buffer], {
 type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 });
 const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
 const url = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `casos_gpf_${date}.xlsx`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 window.URL.revokeObjectURL(url);

 toast.success(`${filteredAttentions.length} casos exportados`, { id: 'export-gpf' });
 } catch (err) {
 console.error('Error al exportar Excel:', err);
 toast.error('Error al generar el archivo Excel', { id: 'export-gpf' });
 } finally {
 setExporting(false);
 }
 };

 // ── Select attention → load full detail ─────────────────────────────────────

 const handleSelectAttention = async (attention: GpfAttention) => {
 setSelectedAttention(attention);
 setAttentionDetail(null);
 setDetailTab('info');
 setAudioUrl(null);
 setState('loading-detail');
 try {
 const detail = await gpfService.getAttentionDetail(env, getAttentionId(attention));
 setAttentionDetail(detail);
 setState('confirming');
 } catch (error: any) {
 console.error('Error loading attention detail:', error);
 toast.error(error.response?.data?.error || 'Error al cargar detalle del caso');
 setState('confirming');
 }
 // Obtener audio como blob (proxy del backend para evitar error SSL del browser)
 setAudioLoading(true);
 gpfService.getAudioBlob(env, getAttentionId(attention))
 .then((blobUrl) => {
 setAudioUrl(prev => {
 if (prev) URL.revokeObjectURL(prev); // liberar blob anterior
 return blobUrl;
 });
 })
 .catch(() => setAudioUrl(null))
 .finally(() => setAudioLoading(false));
 };

 // ── Submit audit ─────────────────────────────────────────────────────────────

 const handleConfirm = async () => {
 if (!selectedAttention) return;

 setState('processing');

 const sseClientId = `gpf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
 let completedAuditId: string | null = null;
 const startTime = Date.now();

 const formatTime = (ms: number) => {
 const s = Math.floor(ms / 1000);
 return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
 };

 const eventSource = new EventSource(
 `${import.meta.env.VITE_API_URL}/api/progress/${sseClientId}`
 );

 eventSource.onmessage = (event) => {
 try {
 const message: SSEMessage = JSON.parse(event.data);
 const stageTag: Record<string, string> = {
 upload: '[DESCARGA]', analysis: '[IMAGENES]', audio: '[AUDIO]',
 evaluation: '[EVALUACION]', excel: '[EXCEL]', completed: '[COMPLETADO]'
 };
 const tag = stageTag[(message as any).stage] || '[INFO]';
 if (message.type === 'error' || (message.message || '').includes('ERROR')) {
 console.error(`[Auditoria] ${tag}`, message);
 } else {
 console.log(`[Auditoria] ${tag}`, message);
 }

 if (message.stage && message.progress !== undefined) {
 setProcessing({ stage: message.stage, progress: message.progress, message: message.message });
 }

 if (message.type === 'result') {
 if (message.data?.auditId) completedAuditId = message.data.auditId;
 setProcessing({ stage: 'completed', progress: 100, message: '¡Auditoría completada!' });
 eventSource.close();
 setTimeout(() => {
 if (completedAuditId) {
 toast.success('¡Evaluación completada exitosamente!', { duration: 4000, icon: '' });
 navigate(`/audit/${completedAuditId}`);
 }
 }, 1000);
 }

 if (message.type === 'error') {
 console.error('[Auditoria] Error SSE del servidor:', message);
 toast.error(message.message);
 eventSource.close();
 setState('confirming');
 }
 } catch (parseError) {
 console.error('[Auditoria] Error parseando mensaje SSE:', parseError, '| Raw data:', event.data);
 }
 };

 eventSource.onerror = () => {
 eventSource.close();
 if (processing.progress < 100) {
 toast.error('Se perdió la conexión con el servidor. Intenta de nuevo.');
 setState('confirming');
 }
 };

 try {
 const attentionId = getAttentionId(selectedAttention);
 const result = await auditService.evaluateFromGpf({
 attentionId,
 env,
 excelType,
 sseClientId,
 attentionObject: selectedAttention
 });

 if (result?.auditId && !completedAuditId) {
 completedAuditId = result.auditId;
 setTimeout(() => {
 if (completedAuditId) {
 toast.success('¡Evaluación completada exitosamente!', { duration: 4000, icon: '' });
 navigate(`/audit/${completedAuditId}`);
 }
 }, 2000);
 }
 } catch (error: any) {
 console.error('[Auditoria] Error al procesar:', error);
 console.error('[Auditoria] Respuesta del servidor:', error?.response?.data);
 console.error('[Auditoria] Status HTTP:', error?.response?.status);
 toast.error(error.response?.data?.error || 'Error al procesar la auditoría');
 eventSource.close();
 setState('confirming');
 }
 };

 // ── Render ───────────────────────────────────────────────────────────────────

 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
 {/* Header */}
 <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 shadow-2xl sticky top-0 z-50">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
 <div className="flex items-center gap-4">
 <button
 onClick={() => navigate('/')}
 className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
 >
 <ArrowLeft className="w-5 h-5 text-slate-400" />
 </button>
 <div>
 <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
 <Sparkles className="w-8 h-8 text-purple-400" />
 Nueva Auditoría
 </h1>
 <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
 <Database className="w-3 h-3" />
 Evaluación automática desde API GPF
 </p>
 </div>
 </div>
 </div>
 </header>

 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

 {/* ── SELECTING STATE ────────────────────────────────────────────────── */}
 {state === 'selecting' && (
 <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-8">
 <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
 <Database className="w-5 h-5 text-blue-400" />
 Seleccionar Caso GPF
 </h2>

 {/* Load button */}
 <div className="flex flex-wrap items-end gap-4 mb-6">
 <button
 onClick={handleLoadAttentions}
 disabled={loadingAttentions}
 className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
 >
 {loadingAttentions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
 {loadingAttentions ? 'Cargando...' : 'Cargar Casos'}
 </button>

 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-3 rounded-lg font-medium flex items-center gap-2 border transition-all ${
 showFilters || activeFilterCount > 0
 ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
 : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
 }`}
 >
 <Filter className="w-4 h-4" />
 Filtros
 {activeFilterCount > 0 && (
 <span className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full leading-none">
 {activeFilterCount}
 </span>
 )}
 </button>

 {attentions.length > 0 && (
 <button
 onClick={handleExportExcel}
 disabled={exporting || filteredAttentions.length === 0}
 className="px-4 py-3 rounded-lg font-medium flex items-center gap-2 border transition-all bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
 >
 {exporting
 ? <RefreshCw className="w-4 h-4 animate-spin" />
 : <FileSpreadsheet className="w-4 h-4" />}
 {exporting ? 'Exportando...' : 'Exportar Excel'}
 </button>
 )}

 {attentions.length > 0 && (
 <span className="text-sm text-slate-500 ml-auto self-center">
 {filteredAttentions.length === attentions.length
 ? `${attentions.length} casos`
 : `${filteredAttentions.length} de ${attentions.length} casos`}
 </span>
 )}
 </div>

 {/* Filters panel */}
 {showFilters && (
 <div className="mb-6 p-4 bg-slate-800/40 border border-slate-700 rounded-xl">
 <div className="flex items-center justify-between mb-3">
 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
 <Filter className="w-3 h-3" /> Filtros
 </p>
 <div className="flex items-center gap-2">
 <button
 onClick={() => {
 // Calcula ayer en timezone local (funciona para Colombia UTC-5 y México UTC-6)
 const yesterday = new Date();
 yesterday.setDate(yesterday.getDate() - 1);
 const yStr = yesterday.toLocaleDateString('en-CA'); // formato YYYY-MM-DD
 setFilterDateFrom(yStr);
 setFilterDateTo(yStr);
 }}
 className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors border border-amber-600/40 rounded px-2 py-1 hover:bg-amber-600/10"
 >
 <CalendarRange className="w-3 h-3" /> Día vencido
 </button>
 {activeFilterCount > 0 && (
 <button
 onClick={clearFilters}
 className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
 >
 <X className="w-3 h-3" /> Limpiar filtros
 </button>
 )}
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {/* Date From */}
 <div>
 <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
 <CalendarRange className="w-3 h-3" /> Fecha desde
 </label>
 <input
 type="date"
 value={filterDateFrom}
 onChange={(e) => setFilterDateFrom(e.target.value)}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
 />
 </div>
 {/* Date To */}
 <div>
 <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
 <CalendarRange className="w-3 h-3" /> Fecha hasta
 </label>
 <input
 type="date"
 value={filterDateTo}
 onChange={(e) => setFilterDateTo(e.target.value)}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
 />
 </div>
 {/* Agent */}
 <div>
 <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
 <User className="w-3 h-3" /> Agente
 </label>
 <div className="relative">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
 <input
 type="text"
 value={filterAgent}
 onChange={(e) => setFilterAgent(e.target.value)}
 placeholder="Buscar agente..."
 className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
 />
 </div>
 </div>
 {/* Client */}
 <div>
 <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
 <Search className="w-3 h-3" /> Cliente / Caso
 </label>
 <div className="relative">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
 <input
 type="text"
 value={filterClient}
 onChange={(e) => setFilterClient(e.target.value)}
 placeholder="Buscar cliente o caso..."
 className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
 />
 </div>
 </div>
 {/* Calificación */}
 <div>
 <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
 <Tag className="w-3 h-3" /> Calificación
 </label>
 <div className="relative">
 <select
 value={filterCalificacion}
 onChange={(e) => setFilterCalificacion(e.target.value)}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-blue-500 pr-8"
 >
 <option value="">Todas</option>
 {uniqueCalificaciones.map((c) => (
 <option key={c} value={c}>{c}</option>
 ))}
 </select>
 <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
 </div>
 </div>
 {/* Estado */}
 <div>
 <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
 <Tag className="w-3 h-3" /> Estado llamada
 </label>
 <div className="relative">
 <select
 value={filterEstado}
 onChange={(e) => setFilterEstado(e.target.value)}
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-blue-500 pr-8"
 >
 <option value="">Todos</option>
 {uniqueEstados.map((e) => (
 <option key={e} value={e}>{e}</option>
 ))}
 </select>
 <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Dynamic loader */}
 {loadingAttentions && (
 <div className="flex flex-col items-center justify-center py-16 gap-6">
 {/* Spinner doble-anillo */}
 <div className="relative w-16 h-16">
 <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
 <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500 animate-spin" />
 </div>
 {/* Texto descriptivo */}
 <div className="text-center">
 <p className="text-slate-300 font-medium text-lg">Cargando casos</p>
 <p className="text-slate-500 text-sm mt-1 animate-pulse">Consultando la API de GPF...</p>
 </div>
 {/* Filas shimmer escalonadas */}
 <div className="w-full max-w-md space-y-3">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="h-10 bg-slate-800/60 rounded-lg overflow-hidden relative">
 <div
 className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent animate-shimmer"
 style={{ animationDelay: `${i * 200}ms` }}
 />
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Table */}
 {!loadingAttentions && attentions.length > 0 && (
 <>
 {filteredAttentions.length === 0 ? (
 <div className="text-center py-12 text-slate-500">
 <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
 <p>No hay casos que coincidan con los filtros</p>
 <button onClick={clearFilters} className="mt-2 text-sm text-blue-400 hover:text-blue-300 underline">
 Limpiar filtros
 </button>
 </div>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-slate-700">
 <table className="w-full text-sm text-slate-300">
 <thead>
 <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
 {Object.keys(filteredAttentions[0]).map((key) => (
 <th key={key} className="px-4 py-3 text-left whitespace-nowrap">
 {key}
 </th>
 ))}
 <th className="px-4 py-3 text-center whitespace-nowrap">Acción</th>
 </tr>
 </thead>
 <tbody>
 {filteredAttentions.map((att, idx) => (
 <tr
 key={`${getAttentionId(att)}-${idx}`}
 className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors"
 >
 {Object.keys(filteredAttentions[0]).map((key) => (
 <td
 key={key}
 className="px-4 py-3 text-xs whitespace-nowrap max-w-[180px] truncate"
 title={String(att[key] ?? '')}
 >
 {att[key] != null && att[key] !== '' ? String(att[key]) : '—'}
 </td>
 ))}
 <td className="px-4 py-3 text-center">
 <button
 onClick={() => handleSelectAttention(att)}
 className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 mx-auto"
 >
 Ver detalle
 <ChevronRight className="w-3 h-3" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
 {filteredAttentions.length} caso{filteredAttentions.length !== 1 ? 's' : ''} mostrado{filteredAttentions.length !== 1 ? 's' : ''}
 </div>
 </div>
 )}
 </>
 )}

 {/* Empty state */}
 {!loadingAttentions && attentions.length === 0 && (
 <div className="text-center py-16 text-slate-500">
 <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Carga los casos para comenzar</p>
 </div>
 )}
 </div>
 )}

 {/* ── LOADING DETAIL STATE ──────────────────────────────────────────── */}
 {state === 'loading-detail' && selectedAttention && (
 <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-12 max-w-2xl mx-auto">
 <div className="flex flex-col items-center justify-center gap-6">
 {/* Spinner doble-anillo */}
 <div className="relative w-16 h-16">
 <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
 <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 border-r-blue-500 animate-spin" />
 </div>
 {/* Texto */}
 <div className="text-center">
 <p className="text-slate-300 font-medium text-lg">Cargando detalle del caso</p>
 <p className="text-slate-500 text-sm mt-1">
 ID: <span className="font-mono text-blue-400">{String(getAttentionId(selectedAttention))}</span>
 </p>
 <p className="text-slate-500 text-sm animate-pulse mt-0.5">Obteniendo capturas, transacciones y comentarios...</p>
 </div>
 {/* Filas shimmer escalonadas */}
 <div className="w-full max-w-md space-y-3">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="h-10 bg-slate-800/60 rounded-lg overflow-hidden relative">
 <div
 className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent animate-shimmer"
 style={{ animationDelay: `${i * 200}ms` }}
 />
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* ── CONFIRMING STATE ──────────────────────────────────────────────── */}
 {state === 'confirming' && selectedAttention && (
 <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-8 max-w-4xl mx-auto">
 <div className="flex items-center gap-3 mb-6">
 <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
 <div>
 <h2 className="text-xl font-semibold text-slate-200">Confirmar Auditoría</h2>
 <p className="text-slate-500 text-sm">
 Caso <span className="font-mono text-blue-400">{String(getAttentionId(selectedAttention))}</span>
 {' · '}{env.toUpperCase()}
 </p>
 </div>
 <button
 onClick={() => setState('selecting')}
 className="ml-auto p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
 title="Volver a la lista"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 mb-6 bg-slate-800/60 rounded-xl p-1 border border-slate-700 overflow-x-auto">
 {[
 { key: 'info', label: 'Información', icon: <Database className="w-3.5 h-3.5" /> },
 { key: 'captures', label: `Capturas ${attentionDetail ? `(${attentionDetail.imageUrls.length})` : ''}`, icon: <Image className="w-3.5 h-3.5" /> },
 { key: 'transactions', label: `Transacciones ${attentionDetail ? `(${attentionDetail.transactions.length})` : ''}`, icon: <CreditCard className="w-3.5 h-3.5" /> },
 { key: 'comments', label: `Comentarios ${attentionDetail ? `(${attentionDetail.comments.length})` : ''}`, icon: <MessageSquare className="w-3.5 h-3.5" /> },
 { key: 'otp', label: `OTP ${attentionDetail ? `(${attentionDetail.otpValidations.length})` : ''}`, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
 ].map((tab) => (
 <button
 key={tab.key}
 onClick={() => setDetailTab(tab.key as typeof detailTab)}
 className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
 detailTab === tab.key
 ? 'bg-purple-600/80 text-white shadow'
 : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
 }`}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>

 {/* Tab: Información */}
 {detailTab === 'info' && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
 {[
 ['ID Caso', String(getAttentionId(selectedAttention))],
 ['Ejecutivo / Agente', getAttentionExecutive(selectedAttention)],
 ['Calificación', getAttentionCalificacion(selectedAttention)],
 ['Sub-calificación', selectedAttention['Sub-calificación'] ?? ''],
 ['Estado llamada', getAttentionEstado(selectedAttention)],
 ['Llamada en curso', selectedAttention['Llamada en curso'] ?? ''],
 ['Cliente / Socio', selectedAttention['Socio'] ?? ''],
 ['Correo cliente', selectedAttention['Correo cliente'] ?? ''],
 ['Teléfono cliente', selectedAttention['Teléfono cliente'] ?? ''],
 ['Caso', selectedAttention['Caso'] ?? ''],
 ['Fecha de la compra', getAttentionDate(selectedAttention)],
 ['Comercio', selectedAttention['Comercio'] ?? ''],
 ['Monto de la compra', selectedAttention['Monto de la compra'] ?? ''],
 ['4 dígitos TC', selectedAttention['4 dígitos TC'] ?? ''],
 ['Tiene afectación', selectedAttention['Tiene afectación'] ?? ''],
 ['Folio BI', selectedAttention['Folio BI'] ?? ''],
 ['Resultado dictamen', selectedAttention['Resultado dictamen'] ?? ''],
 ['Origen validación', selectedAttention['Origen validación'] ?? ''],
 ['Actualización de datos', selectedAttention['Actualización de datos'] ?? ''],
 ['Estatus correo preventivo', selectedAttention['Estatus correo preventivo'] ?? ''],
 ['Estatus SMS preventivo', selectedAttention['Estatus SMS preventivo'] ?? ''],
 ['Re-plastificación', selectedAttention['Cliente no requiere re-plastificación'] ?? ''],
 ['Ambiente', env.toUpperCase()],
 ].map(([label, value]) => (
 <div key={label} className="flex items-start justify-between gap-3 px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
 <span className="text-slate-400 text-xs flex-shrink-0">{label}</span>
 <span className="text-slate-200 font-medium text-xs text-right break-all">{value || '—'}</span>
 </div>
 ))}
 </div>
 )}

 {/* Tab: Capturas */}
 {detailTab === 'captures' && (
 <div className="mb-6">
 {!attentionDetail ? (
 <p className="text-slate-500 text-sm text-center py-8">Cargando capturas...</p>
 ) : attentionDetail.imageUrls.length === 0 && attentionDetail.rawComments.length === 0 ? (
 <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
 <Image className="w-8 h-8 opacity-30" />
 Sin capturas ni comentarios de imagen
 </p>
 ) : (
 <div className="space-y-4">
 {attentionDetail.imageUrls.length > 0 && (
 <div>
 <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">
 Imágenes ({attentionDetail.imageUrls.length})
 </p>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
 {attentionDetail.imageUrls.map((url, idx) => (
 <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
 className="block rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500/60 transition-all group"
 >
 <img
 src={url}
 alt={`Captura ${idx + 1}`}
 className="w-full h-28 object-cover group-hover:opacity-90 transition-opacity"
 onError={(e) => {
 (e.target as HTMLImageElement).style.display = 'none';
 (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
 }}
 />
 <div className="hidden px-2 py-3 text-xs text-purple-400 font-mono break-all bg-slate-800/80">
 {url}
 </div>
 <p className="text-xs text-slate-500 px-2 py-1 bg-slate-900 truncate" title={url}>
 {idx + 1} · {url.split('/').pop()}
 </p>
 </a>
 ))}
 </div>
 </div>
 )}
 {attentionDetail.rawComments.length > 0 && (
 <div>
 <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
 Comentarios de captura ({attentionDetail.rawComments.length})
 </p>
 <ul className="space-y-1">
 {attentionDetail.rawComments.map((c, idx) => (
 <li key={idx} className="px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700 text-sm text-slate-300 flex gap-2">
 <span className="text-slate-600 font-mono text-xs mt-0.5">{idx + 1}.</span>
 {c}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* Tab: Transacciones */}
 {detailTab === 'transactions' && (
 <div className="mb-6">
 {!attentionDetail ? (
 <p className="text-slate-500 text-sm text-center py-8">Cargando transacciones...</p>
 ) : attentionDetail.transactions.length === 0 ? (
 <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
 <CreditCard className="w-8 h-8 opacity-30" />
 Sin transacciones registradas
 </p>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-slate-700">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
 <th className="px-4 py-2 text-left">#</th>
 <th className="px-4 py-2 text-left">Fecha</th>
 <th className="px-4 py-2 text-left">Comercio</th>
 <th className="px-4 py-2 text-right">Monto</th>
 </tr>
 </thead>
 <tbody>
 {attentionDetail.transactions.map((t, idx) => (
 <tr key={idx} className={`border-t border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
 <td className="px-4 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
 <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">{t.date || '—'}</td>
 <td className="px-4 py-2 text-slate-300 max-w-[200px] truncate" title={t.commerce_name}>{t.commerce_name || '—'}</td>
 <td className="px-4 py-2 text-emerald-400 font-semibold text-right whitespace-nowrap">{t.amount || '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
 {attentionDetail.transactions.length} transacción{attentionDetail.transactions.length !== 1 ? 'es' : ''}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Tab: Comentarios */}
 {detailTab === 'comments' && (
 <div className="mb-6">
 {!attentionDetail ? (
 <p className="text-slate-500 text-sm text-center py-8">Cargando comentarios...</p>
 ) : attentionDetail.comments.length === 0 ? (
 <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
 <MessageSquare className="w-8 h-8 opacity-30" />
 Sin comentarios registrados
 </p>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-slate-700">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
 <th className="px-4 py-2 text-left">#</th>
 <th className="px-4 py-2 text-left">Fecha</th>
 <th className="px-4 py-2 text-left">Agente</th>
 <th className="px-4 py-2 text-left">Comentario</th>
 </tr>
 </thead>
 <tbody>
 {attentionDetail.comments.map((c, idx) => (
 <tr key={idx} className={`border-t border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
 <td className="px-4 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
 <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">{c.date || '—'}</td>
 <td className="px-4 py-2 text-teal-400 whitespace-nowrap text-xs">{c.agent || '—'}</td>
 <td className="px-4 py-2 text-slate-300">{c.comment || '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
 {attentionDetail.comments.length} comentario{attentionDetail.comments.length !== 1 ? 's' : ''}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Tab: OTP */}
 {detailTab === 'otp' && (
 <div className="mb-6">
 {!attentionDetail ? (
 <p className="text-slate-500 text-sm text-center py-8">Cargando validaciones OTP...</p>
 ) : attentionDetail.otpValidations.length === 0 ? (
 <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
 <ShieldCheck className="w-8 h-8 opacity-30" />
 Sin validaciones OTP registradas
 </p>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-slate-700">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
 <th className="px-4 py-2 text-left">#</th>
 <th className="px-4 py-2 text-left">Fecha</th>
 <th className="px-4 py-2 text-left">Agente</th>
 <th className="px-4 py-2 text-left">Resultado</th>
 </tr>
 </thead>
 <tbody>
 {attentionDetail.otpValidations.map((v, idx) => (
 <tr key={idx} className={`border-t border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
 <td className="px-4 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
 <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">{v.date || '—'}</td>
 <td className="px-4 py-2 text-teal-400 whitespace-nowrap text-xs">{v.agent || '—'}</td>
 <td className="px-4 py-2">
 {v.resultado === true || (v.resultado as any) === 'true' ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
 <CheckCircle2 className="w-3 h-3" /> Validado
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
 <XCircle className="w-3 h-3" /> Fallido
 </span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
 {attentionDetail.otpValidations.length} validación{attentionDetail.otpValidations.length !== 1 ? 'es' : ''}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Audio de la llamada */}
 <div className="mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
 <div className="flex items-center gap-2 mb-3">
 <Mic className="w-4 h-4 text-purple-400" />
 <span className="text-sm font-medium text-slate-300">Audio de la llamada</span>
 </div>
 {audioLoading ? (
 <div className="flex items-center gap-2 text-slate-500 text-sm">
 <Loader2 className="w-4 h-4 animate-spin" />
 Obteniendo enlace de audio...
 </div>
 ) : audioUrl ? (
 <div className="space-y-2">
 <audio controls src={audioUrl} className="w-full accent-purple-500" />
 <p className="text-xs text-amber-400/80">El enlace expira en 5 minutos. Si no carga, vuelve a seleccionar el caso.</p>
 </div>
 ) : (
 <p className="text-slate-500 text-sm">Sin audio disponible para este caso.</p>
 )}
 </div>

 {/* Excel type selector */}
 <div className="mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
 <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Reporte</label>
 <div className="relative max-w-xs">
 <select
 value={excelType}
 onChange={(e) => setExcelType(e.target.value as 'INBOUND' | 'MONITOREO')}
 className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 appearance-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
 >
 {EXCEL_TYPES.map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
 </div>
 </div>

 {/* Actions */}
 <div className="flex gap-4">
 <button
 onClick={handleConfirm}
 className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
 >
 <Sparkles className="w-5 h-5" />
 Confirmar y Auditar
 </button>

 <button
 onClick={() => setState('selecting')}
 className="px-6 py-4 bg-slate-800 text-slate-300 rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
 >
 <ArrowLeft className="w-5 h-5" />
 Volver
 </button>
 </div>
 </div>
 )}

 {/* ── PROCESSING STATE ──────────────────────────────────────────────── */}
 {state === 'processing' && (
 <ProcessingStatus
 stage={processing.stage}
 progress={processing.progress}
 message={processing.message}
 />
 )}
 </main>
 </div>
 );
}
