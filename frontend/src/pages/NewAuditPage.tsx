// frontend/src/pages/NewAuditPage.tsx

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { toast } from 'react-hot-toast';
import ProcessingStatus from '../components/ProcessingStatus';
import { auditService, gpfService, batchService, BATCH_LIMITS_CLIENT } from '../services/api';
import type { GpfAttention, GpfAttentionDetail } from '../services/api';
import { useCallTypesConfig } from '../hooks/useCallTypesConfig';
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
 ChevronLeft,
 Mic,
 FileSpreadsheet,
 ZoomIn,
 ZoomOut,
 Maximize2,
 Clock,
 AlertTriangle,
 Moon,
 Check,
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
 // Try yyyy/mm/dd → yyyy-mm-dd
 const isoSlashMatch = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
 if (isoSlashMatch) {
  const [, y, m, d] = isoSlashMatch;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
 }
 // Try d/m/yyyy or dd/mm/yyyy → yyyy-mm-dd
 const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 if (slashMatch) {
  const [, d, m, y] = slashMatch;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
 }
 // Try d-m-yyyy or dd-mm-yyyy → yyyy-mm-dd
 const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
 if (dashMatch) {
  const [, d, m, y] = dashMatch;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
 }
 return dateStr.slice(0, 10); // ISO or similar (yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS)
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewAuditPage() {
 const navigate = useNavigate();
 const { modes: availableModes } = useCallTypesConfig();

 const [state, setState] = useState<AppState>('selecting');
 const [env] = useState<'test' | 'prod'>('prod');
 const [attentions, setAttentions] = useState<GpfAttention[]>([]);
 const [loadingAttentions, setLoadingAttentions] = useState(false);
 const [selectedAttention, setSelectedAttention] = useState<GpfAttention | null>(null);
 const [attentionDetail, setAttentionDetail] = useState<GpfAttentionDetail | null>(null);
 const [excelType, setExcelType] = useState<string>('');
 const [detailTab, setDetailTab] = useState<'info' | 'captures' | 'transactions' | 'comments' | 'otp'>('info');
 const [processing, setProcessing] = useState({
 stage: 'upload' as string,
 progress: 0,
 message: 'Iniciando...'
 });
 const [audioUrl, setAudioUrl] = useState<string | null>(null);
 const [audioLoading, setAudioLoading] = useState(false);
 const [exporting, setExporting] = useState(false);

 // ── Batch selection (cola nocturna) ───────────────────────────────────────────
 const [batchMode, setBatchMode] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [showBatchModal, setShowBatchModal] = useState(false);
 const [batchName, setBatchName] = useState('');
 const [submittingBatch, setSubmittingBatch] = useState(false);
 const [validating, setValidating] = useState(false);
 const [validationResult, setValidationResult] = useState<{
   accessible: number; noImages: number; inaccessible: number; total: number; totalImages: number;
 } | null>(null);

 // Setear el primer modo disponible en cuanto cargue desde BD
 useEffect(() => {
 if (availableModes.length > 0 && !excelType) {
 setExcelType(availableModes[0]);
 }
 }, [availableModes, excelType]);

 // ── Lightbox ──────────────────────────────────────────────────────────────────
 const [lightboxOpen, setLightboxOpen] = useState(false);
 const [lightboxIndex, setLightboxIndex] = useState(0);
 const [zoomLevel, setZoomLevel] = useState(1);
 const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
 const lightboxContainerRef = useRef<HTMLDivElement>(null);

 // ── Expiry timer (5 min desde que se cargaron los datos) ──────────────────────
 const [dataExpiresAt, setDataExpiresAt] = useState<Date | null>(null);
 const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

 // ── Filters ──────────────────────────────────────────────────────────────────

 const [filterDateFrom, setFilterDateFrom] = useState(
   () => new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
 );
 const [filterDateTo, setFilterDateTo] = useState('');
 const [filterAgent, setFilterAgent] = useState('');
 const [filterClient, setFilterClient] = useState('');
 const [filterCalificacion, setFilterCalificacion] = useState('');
 const [filterEstado, setFilterEstado] = useState('');
 const [showFilters, setShowFilters] = useState(true);

 // ── Dual scroll refs ─────────────────────────────────────────────────────────
 const topScrollRef = useRef<HTMLDivElement>(null);
 const tableScrollRef = useRef<HTMLDivElement>(null);
 const [tableScrollWidth, setTableScrollWidth] = useState(0);

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
 const uniqueCalificaciones = ['FRAUDE/ROEXT', 'TH CONFIRMA MOVIMIENTOS'];
 const uniqueEstados = useMemo(
 () => [...new Set(attentions.map(getAttentionEstado).filter(Boolean))].sort(),
 [attentions]
 );

 // Filtered list
 const filteredAttentions = useMemo(() => {
 return attentions.filter((a) => {
 const calNorm = getAttentionCalificacion(a).trim().toLowerCase();
 if (!calNorm.includes("fraude") && !calNorm.includes("th confirma")) return false;
 if (filterAgent && !getAttentionExecutive(a).toLowerCase().includes(filterAgent.toLowerCase())) return false;
 if (filterClient) {
 const term = filterClient.toLowerCase();
 const matchesAnyField = Object.values(a).some(
 (v) => v != null && String(v).toLowerCase().includes(term)
 );
 if (!matchesAnyField) return false;
 }
 if (filterCalificacion && getAttentionCalificacion(a).trim().toLowerCase() !== filterCalificacion.trim().toLowerCase()) return false;
 if (filterEstado && getAttentionEstado(a).trim().toLowerCase() !== filterEstado.trim().toLowerCase()) return false;
 return true;
 });
 }, [attentions, filterAgent, filterClient, filterCalificacion, filterEstado]);

 useEffect(() => {
 if (tableScrollRef.current) {
 setTableScrollWidth(tableScrollRef.current.scrollWidth);
 }
 }, [filteredAttentions]);

 useEffect(() => {
 const top = topScrollRef.current;
 const table = tableScrollRef.current;
 if (!top || !table) return;
 const onTopScroll = () => { table.scrollLeft = top.scrollLeft; };
 const onTableScroll = () => { top.scrollLeft = table.scrollLeft; };
 top.addEventListener('scroll', onTopScroll);
 table.addEventListener('scroll', onTableScroll);
 return () => {
 top.removeEventListener('scroll', onTopScroll);
 table.removeEventListener('scroll', onTableScroll);
 };
 }, [filteredAttentions]);

 // ── Lightbox keyboard handler ─────────────────────────────────────────────────
 useEffect(() => {
 if (!lightboxOpen) return;
 const onKey = (e: KeyboardEvent) => {
 if (e.key === 'Escape') { setLightboxOpen(false); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }
 if (e.key === 'ArrowRight') { setLightboxIndex(i => (i + 1) % (attentionDetail?.imageUrls.length ?? 1)); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }
 if (e.key === 'ArrowLeft') { setLightboxIndex(i => (i - 1 + (attentionDetail?.imageUrls.length ?? 1)) % (attentionDetail?.imageUrls.length ?? 1)); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }
 if (e.key === '+' || e.key === '=') setZoomLevel(z => Math.min(z + 0.25, 4));
 if (e.key === '-') setZoomLevel(z => Math.max(z - 0.25, 0.5));
 };
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, [lightboxOpen, attentionDetail?.imageUrls.length]);

 // ── Wheel no-passive para zoom sin error de passive listener ─────────────────
 useEffect(() => {
 const el = lightboxContainerRef.current;
 if (!el || !lightboxOpen) return;
 const onWheel = (e: WheelEvent) => {
 e.preventDefault();
 setZoomLevel(z => Math.min(Math.max(z + (e.deltaY < 0 ? 0.1 : -0.1), 0.5), 4));
 };
 el.addEventListener('wheel', onWheel, { passive: false });
 return () => el.removeEventListener('wheel', onWheel);
 }, [lightboxOpen]);

 // ── Expiry countdown timer ────────────────────────────────────────────────────
 useEffect(() => {
 if (!dataExpiresAt) return;
 const tick = () => {
 const diff = Math.max(0, Math.round((dataExpiresAt.getTime() - Date.now()) / 1000));
 setSecondsLeft(diff);
 };
 tick();
 const id = setInterval(tick, 1000);
 return () => clearInterval(id);
 }, [dataExpiresAt]);

 // ── Load attentions ──────────────────────────────────────────────────────────

 const handleLoadAttentions = async (overrideDateFrom?: string, overrideDateTo?: string) => {
 const today = new Date().toLocaleDateString('en-CA');
 const from = overrideDateFrom ?? (filterDateFrom || today);
 const to   = overrideDateTo   ?? (filterDateTo   || today);
 setLoadingAttentions(true);
 setAttentions([]);
 try {
 const result = await gpfService.getAttentions(env, from, to);
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

 // ── Batch helpers ──────────────────────────────────────────────────────────────
 const toggleBatchMode = () => {
   setBatchMode(v => !v);
   setSelectedIds(new Set());
 };

 const toggleSelectAll = () => {
   if (selectedIds.size === filteredAttentions.length) {
     setSelectedIds(new Set());
   } else {
     const newSet = new Set<string>();
     filteredAttentions.forEach(a => newSet.add(String(getAttentionId(a))));
     setSelectedIds(newSet);
   }
 };

 const toggleSelectOne = (att: GpfAttention) => {
   const id = String(getAttentionId(att));
   setSelectedIds(prev => {
     const next = new Set(prev);
     if (next.has(id)) next.delete(id); else next.add(id);
     return next;
   });
 };

 const openBatchModal = async () => {
   setBatchName(`Lote ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`);
   setValidationResult(null);
   setShowBatchModal(true);

   // Validar accesibilidad real en GPF
   const selected = filteredAttentions.filter(a => selectedIds.has(String(getAttentionId(a))));
   if (selected.length === 0) return;
   setValidating(true);
   try {
     const items = selected.map(att => ({
       gpf_attention_id: String(getAttentionId(att)),
       gpf_env: env,
     }));
     const results = await batchService.validateItems(items);
     const accessible = results.filter((r: any) => r.accessible && r.imageCount > 0).length;
     const noImages = results.filter((r: any) => r.accessible && r.imageCount === 0).length;
     const inaccessible = results.filter((r: any) => !r.accessible).length;
     const totalImages = results.reduce((s: number, r: any) => s + (r.imageCount ?? 0), 0);
     setValidationResult({ accessible, noImages, inaccessible, total: results.length, totalImages });
   } catch {
     // Si falla la validación, no bloqueamos el flujo
     setValidationResult(null);
   } finally {
     setValidating(false);
   }
 };

 const handleSubmitBatch = async () => {
   const selected = filteredAttentions.filter(a => selectedIds.has(String(getAttentionId(a))));
   if (!selected.length) return;
   setSubmittingBatch(true);
   try {
     const job = await batchService.createJob({
       name: batchName || `Lote ${new Date().toLocaleDateString('es-MX')}`,
       scheduled_for: new Date().toISOString(),
       items: selected.map(att => ({
         gpf_attention_id: String(getAttentionId(att)),
         gpf_env: env,
         gpf_attention_object: att as Record<string, any>,
         gpf_excel_type: excelType || 'INBOUND',
         executive_name: getAttentionExecutive(att) || undefined,
         call_type: getAttentionCalificacion(att) || undefined,
         call_date: getAttentionDate(att) || undefined,
       })),
     });
     // Enviar inmediatamente a OpenAI (fire-and-forget en el backend)
     batchService.submitJob(job.id).catch(() => {});
     toast.success(`${selected.length} caso${selected.length !== 1 ? 's' : ''} enviado${selected.length !== 1 ? 's' : ''} a OpenAI — resultados en ~24 h`);
     setShowBatchModal(false);
     setBatchMode(false);
     setSelectedIds(new Set());
   } catch (e: any) {
     toast.error(e.response?.data?.error || 'Error al crear el lote');
   } finally {
     setSubmittingBatch(false);
   }
 };

 const capacityPct = Math.min(100, Math.round((selectedIds.size / BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES) * 100));
 const isOverRecommended = selectedIds.size > BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES;
 const isOverHardLimit = selectedIds.size > BATCH_LIMITS_CLIENT.HARD_MAX_CASES;

 // ── Select attention → load full detail ─────────────────────────────────────

 const handleSelectAttention = async (attention: GpfAttention) => {
 setSelectedAttention(attention);
 setAttentionDetail(null);
 setDetailTab('info');
 setAudioUrl(null);
 setDataExpiresAt(null);
 setSecondsLeft(null);
 setState('loading-detail');
 try {
 const detail = await gpfService.getAttentionDetail(env, getAttentionId(attention));
 setAttentionDetail(detail);
 setDataExpiresAt(new Date(Date.now() + 5 * 60 * 1000));
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

 // Duplicar vista del caso en nueva pestaña (sin procesamiento extra)
 if (attentionDetail) {
 try {
 const key = `gpf_case_${Date.now()}`;
 localStorage.setItem(key, JSON.stringify({
 attention: selectedAttention,
 attentionDetail,
 excelType,
 callType: getAttentionCalificacion(selectedAttention) || 'FRAUDE'
 }));
 window.open(`/ai-analysis?key=${key}`, '_blank');
 } catch (e) {
 console.warn('[Caso duplicado] No se pudo abrir pestaña:', e);
 }
 }

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
 <div className="min-h-screen">
 <AppHeader showBack onBack={() => navigate('/')} title="Nueva Auditoría" />

 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">

 {/* ── SELECTING STATE ────────────────────────────────────────────────── */}
 {state === 'selecting' && (
 <div className={`bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-8 transition-all ${batchMode ? 'pb-24' : ''}`}>
 <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
 <Database className="w-5 h-5 text-brand-400" />
 Seleccionar Caso GPF
 </h2>

 {/* Load button */}
 <div className="flex flex-wrap items-end gap-4 mb-4">
 <button
 onClick={() => handleLoadAttentions()}
 disabled={loadingAttentions}
 className="px-6 py-3 bg-brand-500 text-black rounded-lg font-semibold  disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
 >
 {loadingAttentions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
 {loadingAttentions ? 'Cargando...' : 'Cargar Casos'}
 </button>

 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-3 rounded-lg font-medium flex items-center gap-2 border transition-all ${
 showFilters || activeFilterCount > 0
 ? 'bg-brand-500/10 border-brand-700/50 text-brand-300'
 : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
 }`}
 >
 <Filter className="w-4 h-4" />
 Filtros
 {activeFilterCount > 0 && (
 <span className="px-1.5 py-0.5 text-xs bg-brand-500 text-white rounded-full leading-none">
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

 {/* Toggle batch mode */}
 {attentions.length > 0 && (
   <button
     onClick={toggleBatchMode}
     className={`px-4 py-3 rounded-lg font-medium flex items-center gap-2 border transition-all ${
       batchMode
         ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30'
         : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-700/50 hover:text-indigo-400'
     }`}
   >
     <Moon className="w-4 h-4" />
     Cola nocturna
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
 <div className="mb-4 p-4 bg-slate-800/40 border border-slate-700 rounded-xl">
 <div className="flex items-center justify-between mb-3">
 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
 <Filter className="w-3 h-3" /> Filtros
 </p>
 <div className="flex items-center gap-2">
 <button
 onClick={() => {
 const yesterday = new Date();
 yesterday.setDate(yesterday.getDate() - 1);
 const yStr = yesterday.toLocaleDateString('en-CA');
 setFilterDateFrom(yStr);
 setFilterDateTo(yStr);
 handleLoadAttentions(yStr, yStr);
 }}
 className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5 transition-all border border-brand-700/50 rounded-lg px-3 py-1.5 hover:bg-brand-500/10 hover:border-brand-500/60 font-medium"
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
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-700"
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
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-700"
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
 className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-700"
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
 placeholder="Buscar en cualquier campo..."
 className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-brand-700"
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
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-brand-700 pr-8"
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
 className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-brand-700 pr-8"
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
 <div className="flex flex-col items-center justify-center py-16 gap-4">
 {/* Spinner doble-anillo */}
 <div className="relative w-16 h-16">
 <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
 <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 border-r-brand-300 animate-spin" />
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
 <div className="text-center py-8 text-slate-500">
 <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
 <p>No hay casos que coincidan con los filtros</p>
 <button onClick={clearFilters} className="mt-2 text-sm text-brand-400 hover:text-brand-300 underline">
 Limpiar filtros
 </button>
 </div>
 ) : (
 <>
   {/* ── BATCH MODE BANNER ────────────────────────────────────── */}
   {batchMode && (
     <div
       className="mb-3 rounded-xl border overflow-hidden"
       style={{
         background: 'linear-gradient(135deg, rgba(49,46,129,0.4) 0%, rgba(15,23,42,0.75) 100%)',
         borderColor: 'rgba(99,102,241,0.4)',
       }}
     >
       {/* Progress bar */}
       <div className="h-0.5 bg-slate-800/80">
         <div
           className={`h-full transition-all duration-500 ${isOverHardLimit ? 'bg-red-500' : isOverRecommended ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-violet-400'}`}
           style={{ width: `${Math.min(capacityPct, 100)}%` }}
         />
       </div>
       <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
         <div className="flex items-center gap-2.5">
           <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
             <Moon className="w-4 h-4 text-indigo-300" />
           </div>
           <div>
             <div className="text-white font-semibold text-sm leading-tight">Cola Nocturna</div>
             <div className="text-indigo-400 text-xs">Haz clic en cualquier fila para seleccionarla</div>
           </div>
         </div>
         <div className="flex items-center gap-1.5 ml-auto">
           <span className={`text-xl font-bold ${isOverHardLimit ? 'text-red-400' : isOverRecommended ? 'text-amber-300' : 'text-white'}`}>
             {selectedIds.size}
           </span>
           <span className="text-indigo-400/70 text-xs">/ {BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES} rec.</span>
         </div>
         <div className="flex items-center gap-2">
           <button
             onClick={toggleSelectAll}
             className="text-xs text-indigo-300 hover:text-indigo-200 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
           >
             {selectedIds.size === filteredAttentions.length && filteredAttentions.length > 0 ? 'Ninguno' : 'Todos'}
           </button>
           <button
             onClick={toggleBatchMode}
             className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-all flex items-center gap-1"
           >
             <X className="w-3 h-3" />
             Salir
           </button>
         </div>
       </div>
     </div>
   )}

   {/* ── TABLE ────────────────────────────────────────────────── */}
   <div
     className="rounded-xl border overflow-hidden"
     style={batchMode ? { borderColor: 'rgba(99,102,241,0.25)' } : {}}
   >
   {/* Scroll superior sincronizado */}
   <div ref={topScrollRef} className="overflow-x-auto" style={{ height: 12 }}>
   <div style={{ width: tableScrollWidth, height: 1 }} />
   </div>
               <div ref={tableScrollRef} className="overflow-x-auto">
               <table className="w-full text-sm text-slate-300">
               <thead>
               <tr className={`text-xs uppercase tracking-wider ${batchMode ? 'bg-indigo-950/70 text-indigo-300/70' : 'bg-slate-800/80 text-slate-400'}`}>
               <th className="px-4 py-3 text-center whitespace-nowrap">
                 {batchMode ? (
                   <button
                     onClick={toggleSelectAll}
                     className="flex items-center justify-center mx-auto transition-all"
                     title={selectedIds.size === filteredAttentions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                   >
                     <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                       selectedIds.size === filteredAttentions.length && filteredAttentions.length > 0
                         ? 'bg-indigo-500 border-indigo-400'
                         : 'border-indigo-400/50 hover:border-indigo-300'
                     }`}>
                       {selectedIds.size === filteredAttentions.length && filteredAttentions.length > 0 && (
                         <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                       )}
                     </div>
                   </button>
                 ) : 'Acción'}
               </th>
               {Object.keys(filteredAttentions[0]).map((key) => (
               <th key={key} className="px-4 py-3 text-left whitespace-nowrap">
               {key}
               </th>
               ))}
               </tr>
               </thead>
               <tbody>
               {filteredAttentions.map((att, idx) => {
                 const attId = String(getAttentionId(att));
                 const isChecked = selectedIds.has(attId);
                 return (
               <tr
               key={`${attId}-${idx}`}
               onClick={batchMode ? () => toggleSelectOne(att) : undefined}
               className={`border-t group transition-all ${
                 batchMode
                   ? isChecked
                     ? 'border-indigo-800/40 bg-indigo-500/10 border-l-2 border-l-indigo-400 hover:bg-indigo-500/15 cursor-pointer'
                     : 'border-slate-700/50 hover:bg-indigo-900/15 cursor-pointer'
                   : 'border-slate-700/50 hover:bg-slate-800/40'
               }`}
               >
               <td className="px-4 py-3 text-center" onClick={batchMode ? e => e.stopPropagation() : undefined}>
               {batchMode ? (
                 <button
                   onClick={() => toggleSelectOne(att)}
                   className="flex items-center justify-center mx-auto w-6 h-6"
                 >
                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                     isChecked
                       ? 'bg-indigo-500 border-indigo-400 shadow-sm shadow-indigo-500/40'
                       : 'border-slate-600 group-hover:border-indigo-400'
                   }`}>
                     {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                   </div>
                 </button>
               ) : (
               <button
               onClick={() => handleSelectAttention(att)}
               className="px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/40 border border-brand-700/50 text-brand-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 mx-auto"
               >
               Ver detalle
               <ChevronRight className="w-3 h-3" />
               </button>
               )}
               </td>
               {Object.keys(filteredAttentions[0]).map((key) => (
               <td
               key={key}
               className="px-4 py-3 text-xs whitespace-nowrap max-w-[180px] truncate"
               title={String(att[key] ?? '')}
               >
               {att[key] != null && att[key] !== '' ? String(att[key]) : '—'}
               </td>
               ))}
               </tr>
                 );
               })}
               </tbody>
               </table>
               </div>
   <div className={`px-4 py-2 border-t text-xs rounded-b-xl ${batchMode ? 'bg-indigo-950/40 border-indigo-800/30 text-indigo-400/60' : 'bg-slate-800/40 border-slate-700 text-slate-500'}`}>
   {filteredAttentions.length} caso{filteredAttentions.length !== 1 ? 's' : ''} mostrado{filteredAttentions.length !== 1 ? 's' : ''}
   </div>
   </div>
 </>
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

 {/* ── BATCH BOTTOM ACTION BAR ─────────────────────────────────────── */}
 {batchMode && (
   <div className="fixed bottom-0 left-0 right-0 z-50">
     {/* Barra de progreso superior */}
     <div className="h-0.5 bg-slate-900">
       <div
         className={`h-full transition-all duration-500 ${isOverHardLimit ? 'bg-red-500' : isOverRecommended ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-violet-400'}`}
         style={{ width: `${Math.min(capacityPct, 100)}%` }}
       />
     </div>
     <div
       className="px-4 sm:px-8 py-3.5 flex items-center gap-4 border-t"
       style={{
         background: 'rgba(13,11,35,0.97)',
         backdropFilter: 'blur(20px)',
         borderColor: selectedIds.size > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(51,65,85,0.5)',
       }}
     >
       {selectedIds.size === 0 ? (
         <div className="flex items-center gap-2.5 text-indigo-400/50">
           <Moon className="w-4 h-4" />
           <span className="text-sm">Selecciona casos para agregar a la cola nocturna</span>
         </div>
       ) : (
         <>
           <div className="flex items-center gap-3">
             <span className={`text-2xl font-bold tabular-nums ${isOverHardLimit ? 'text-red-400' : 'text-white'}`}>
               {selectedIds.size}
             </span>
             <div>
               <div className="text-sm text-indigo-200 font-medium leading-tight">
                 caso{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                 {isOverHardLimit && <span className="text-red-400 text-xs font-normal ml-2">supera el límite máximo</span>}
                 {isOverRecommended && !isOverHardLimit && <span className="text-amber-400 text-xs font-normal ml-2">sobre lo recomendado</span>}
               </div>
               <div className="text-xs text-indigo-500/70">
                 {validationResult ? `${validationResult.totalImages} imágenes` : `${selectedIds.size} casos`}
               </div>
             </div>
           </div>
           <div className="flex-1" />
           <button
             onClick={() => setSelectedIds(new Set())}
             className="text-xs text-indigo-400/70 hover:text-indigo-300 px-3 py-1.5 transition-colors"
           >
             Limpiar
           </button>
         </>
       )}
       <div className={selectedIds.size > 0 ? '' : 'ml-auto'}>
         <button
           onClick={openBatchModal}
           disabled={selectedIds.size === 0 || isOverHardLimit}
           className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
             selectedIds.size === 0 || isOverHardLimit
               ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
               : 'bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30'
           }`}
         >
           <Moon className="w-4 h-4" />
           {selectedIds.size > 0
             ? `Agregar ${selectedIds.size} a la cola`
             : 'Agregar a la cola'
           }
         </button>
       </div>
     </div>
   </div>
 )}

 {/* ── BATCH CONFIRMATION MODAL ─────────────────────────────────────── */}
 {showBatchModal && (
   <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBatchModal(false)} />
     <div
       className="relative w-full max-w-md rounded-3xl border p-6 space-y-5 shadow-2xl"
       style={{ background: 'rgba(10,10,18,0.97)', borderColor: 'rgba(0,214,50,0.25)' }}
     >
       {/* Header */}
       <div className="flex items-center gap-3">
         <div className="w-10 h-10 rounded-2xl bg-brand-500/20 flex items-center justify-center">
           <Moon className="w-5 h-5 text-brand-400" />
         </div>
         <div>
           <h3 className="text-white font-semibold">Agregar a cola nocturna</h3>
           <p className="text-slate-400 text-xs">{selectedIds.size} caso{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}</p>
         </div>
       </div>

       {/* Validation result */}
       {(validating || validationResult) && (
         <div className={`rounded-2xl border p-3 flex items-start gap-2.5 ${
           validating ? 'bg-slate-800/60 border-slate-700/50' :
           validationResult && validationResult.inaccessible > 0 ? 'bg-amber-500/10 border-amber-500/30' :
           'bg-brand-500/8 border-brand-500/20'
         }`}>
           {validating ? (
             <>
               <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0 mt-0.5" />
               <span className="text-slate-400 text-sm">Verificando acceso a casos en GPF...</span>
             </>
           ) : validationResult ? (
             <>
               {validationResult.inaccessible > 0
                 ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                 : <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
               }
               <div className="text-sm space-y-0.5">
                 <div className="text-white font-medium">
                   {validationResult.accessible} de {validationResult.total} casos listos para procesar
                 </div>
                 {validationResult.noImages > 0 && (
                   <div className="text-amber-400 text-xs">{validationResult.noImages} sin imágenes</div>
                 )}
                 {validationResult.inaccessible > 0 && (
                   <div className="text-red-400 text-xs">{validationResult.inaccessible} no accesibles en GPF (se omitirán)</div>
                 )}
               </div>
             </>
           ) : null}
         </div>
       )}

       {/* Capacity indicator */}
       <div className={`rounded-2xl border p-3 space-y-2 ${
         isOverHardLimit
           ? 'bg-red-500/10 border-red-500/30'
           : isOverRecommended
           ? 'bg-amber-500/10 border-amber-500/30'
           : 'bg-slate-800/60 border-slate-700/50'
       }`}>
         <div className="flex items-center justify-between text-xs">
           <span className="text-slate-400 font-medium">Capacidad del lote</span>
           <span className={`font-semibold ${
             isOverHardLimit ? 'text-red-400' : isOverRecommended ? 'text-amber-400' : 'text-slate-300'
           }`}>
             {selectedIds.size} / {BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES} recomendado
           </span>
         </div>
         <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
           <div
             className={`h-full rounded-full transition-all ${
               isOverHardLimit ? 'bg-red-500' : isOverRecommended ? 'bg-amber-400' : 'bg-brand-500'
             }`}
             style={{ width: `${Math.min(capacityPct, 100)}%` }}
           />
         </div>
         <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
           {isOverHardLimit ? (
             <>
               <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
               <span className="text-red-400">
                 Superas el límite máximo de {BATCH_LIMITS_CLIENT.HARD_MAX_CASES} casos (~{(BATCH_LIMITS_CLIENT.HARD_MAX_CASES * BATCH_LIMITS_CLIENT.ESTIMATED_MB_PER_CASE).toFixed(0)} MB).
                 OpenAI rechazará el archivo (límite 200 MB). Divide en lotes.
               </span>
             </>
           ) : isOverRecommended ? (
             <>
               <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
               <span className="text-amber-400">
                 Superas el máximo recomendado de {BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES}. El lote puede acercarse al límite de 200 MB si las imágenes son grandes.
               </span>
             </>
           ) : (
             <>
               <span>
                 {validationResult
                   ? `${validationResult.totalImages} imágenes reales · ${(validationResult.totalImages * 0.4).toFixed(1)} MB reales`
                   : validating
                   ? 'Calculando tamaño real...'
                   : 'Verificando casos...'}
                 {' · '}Límite máximo: {BATCH_LIMITS_CLIENT.MAX_FILE_SIZE_MB} MB por lote
               </span>
             </>
           )}
         </div>
       </div>

       {/* Form */}
       <div className="space-y-3">
         <div>
           <label className="block text-xs text-slate-400 mb-1">Nombre del lote</label>
           <input
             type="text"
             value={batchName}
             onChange={e => setBatchName(e.target.value)}
             placeholder="Ej: Lote noche 7 Mayo"
             className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-600 placeholder:text-slate-600"
           />
         </div>
         <p className="text-[11px] text-indigo-400/70">El sistema enviará el lote automáticamente esta noche.</p>
       </div>

       {/* Actions */}
       <div className="flex gap-2 pt-1">
         <button
           onClick={() => setShowBatchModal(false)}
           className="flex-1 btn-secondary py-2.5 text-sm"
         >
           Cancelar
         </button>
         <button
           onClick={handleSubmitBatch}
           disabled={submittingBatch || isOverHardLimit}
           title={isOverHardLimit ? `Máximo ${BATCH_LIMITS_CLIENT.HARD_MAX_CASES} casos por lote` : undefined}
           className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {submittingBatch
             ? <Loader2 className="w-4 h-4 animate-spin" />
             : <Moon className="w-4 h-4" />
           }
           {submittingBatch ? 'Agregando...' : 'Agregar a cola'}
         </button>
       </div>
     </div>
   </div>
 )}

 {/* ── LOADING DETAIL STATE ──────────────────────────────────────────── */}
 {state === 'loading-detail' && selectedAttention && (
 <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-12 max-w-2xl mx-auto">
 <div className="flex flex-col items-center justify-center gap-4">
 {/* Spinner doble-anillo */}
 <div className="relative w-16 h-16">
 <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
 <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 border-r-brand-300 animate-spin" />
 </div>
 {/* Texto */}
 <div className="text-center">
 <p className="text-slate-300 font-medium text-lg">Cargando detalle del caso</p>
 <p className="text-slate-500 text-sm mt-1">
 ID: <span className="font-mono text-brand-400">{String(getAttentionId(selectedAttention))}</span>
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
 <div className="flex items-center gap-3 mb-4">
 <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
 <div>
 <h2 className="text-xl font-semibold text-slate-200">Confirmar Auditoría</h2>
 <p className="text-slate-500 text-sm">
 Caso <span className="font-mono text-brand-400">{String(getAttentionId(selectedAttention))}</span>
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
 <div className="flex gap-1 mb-4 bg-slate-800/60 rounded-xl p-1 border border-slate-700 overflow-x-auto">
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
 ? 'bg-brand-600/80 text-white shadow'
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
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
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
 <div className="mb-4">
 {/* Timer de expiración */}
 <ExpiryTimer secondsLeft={secondsLeft} />
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
 Imágenes ({attentionDetail.imageUrls.length}) · <span className="normal-case text-slate-500">Clic para ampliar</span>
 </p>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
 {attentionDetail.imageUrls.map((url, idx) => (
 <button
 key={idx}
 onClick={() => { setLightboxIndex(idx); setZoomLevel(1); setLightboxOpen(true); }}
 className="block rounded-lg overflow-hidden border border-slate-700 hover:border-brand-500/60 transition-all group text-left w-full"
 >
 <div className="relative">
 <img
 src={url}
 alt={`Captura ${idx + 1}`}
 className="w-full h-28 object-cover group-hover:opacity-80 transition-opacity"
 onError={(e) => {
 (e.target as HTMLImageElement).style.display = 'none';
 (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
 }}
 />
 <div className="hidden px-2 py-3 text-xs text-brand-400 font-mono break-all bg-slate-800/80">
 {url}
 </div>
 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
 <Maximize2 className="w-6 h-6 text-white drop-shadow" />
 </div>
 </div>
 <p className="text-xs text-slate-500 px-2 py-1 bg-slate-900 truncate" title={url}>
 {idx + 1} · {url.split('/').pop()}
 </p>
 </button>
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
 <div className="mb-4">
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
 <div className="mb-4">
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
 <div className="mb-4">
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
 <div className="mb-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
 <div className="flex items-center justify-between gap-2 mb-3">
 <div className="flex items-center gap-2">
 <Mic className="w-4 h-4 text-brand-400" />
 <span className="text-sm font-medium text-slate-300">Audio de la llamada</span>
 </div>
 <ExpiryTimer secondsLeft={secondsLeft} compact />
 </div>
 {audioLoading ? (
 <div className="flex items-center gap-2 text-slate-500 text-sm">
 <Loader2 className="w-4 h-4 animate-spin" />
 Obteniendo enlace de audio...
 </div>
 ) : audioUrl ? (
 <div className="space-y-2">
 <audio controls src={audioUrl} className="w-full accent-purple-500" />
 </div>
 ) : (
 <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
   <span className="text-red-400 text-lg">⚠</span>
   <p className="text-red-400 text-sm font-medium">Sin audio disponible — no se puede auditar este caso.</p>
 </div>
 )}
 </div>

 {/* Excel type selector */}
 <div className="mb-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
 <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Reporte</label>
 <div className="relative max-w-xs">
 <select
 value={excelType}
 onChange={(e) => setExcelType(e.target.value)}
 className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 appearance-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
 >
 {availableModes.map((t) => (
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
 disabled={!audioUrl || audioLoading}
 title={!audioUrl && !audioLoading ? 'Se requiere audio para realizar la auditoría' : undefined}
 className="flex-1 px-6 py-4 bg-brand-500 hover:bg-brand-400 text-black rounded-lg font-semibold transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-400/40 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-500 disabled:shadow-none"
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
 {/* ── LIGHTBOX MODAL ───────────────────────────────────────────────── */}
 {lightboxOpen && attentionDetail && attentionDetail.imageUrls.length > 0 && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
 onClick={(e) => { if (e.target === e.currentTarget) { setLightboxOpen(false); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); } }}
 >
 {/* Toolbar superior */}
 <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent z-10">
 <span className="text-white/70 text-sm font-mono">
 {lightboxIndex + 1} / {attentionDetail.imageUrls.length}
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setZoomLevel(z => Math.max(z - 0.25, 0.5))}
 className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
 title="Alejar (−)"
 >
 <ZoomOut className="w-4 h-4" />
 </button>
 <span className="text-white/60 text-xs w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
 <button
 onClick={() => setZoomLevel(z => Math.min(z + 0.25, 4))}
 className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
 title="Acercar (+)"
 >
 <ZoomIn className="w-4 h-4" />
 </button>
 <button
 onClick={() => setZoomLevel(1)}
 className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
 title="Restablecer zoom"
 >
 100%
 </button>
 <button
 onClick={() => { setLightboxOpen(false); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
 className="p-2 rounded-lg bg-white/10 hover:bg-red-500/60 text-white transition-colors ml-2"
 title="Cerrar (Esc)"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Flecha izquierda */}
 {attentionDetail.imageUrls.length > 1 && (
 <button
 onClick={() => { setLightboxIndex(i => (i - 1 + attentionDetail.imageUrls.length) % attentionDetail.imageUrls.length); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
 className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
 title="Anterior (←)"
 >
 <ChevronLeft className="w-6 h-6" />
 </button>
 )}

 {/* Imagen con drag-to-pan */}
 <div
 ref={lightboxContainerRef}
 className="w-[90vw] h-[80vh] overflow-hidden flex items-center justify-center"
 style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
 onMouseDown={(e) => {
 setIsDragging(true);
 setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
 e.preventDefault();
 }}
 onMouseMove={(e) => {
 if (!isDragging) return;
 setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
 }}
 onMouseUp={() => setIsDragging(false)}
 onMouseLeave={() => setIsDragging(false)}
 >
 <img
 src={attentionDetail.imageUrls[lightboxIndex]}
 alt={`Captura ${lightboxIndex + 1}`}
 style={{
 transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
 transformOrigin: 'center',
 transition: isDragging ? 'none' : 'transform 0.15s ease',
 }}
 className="max-w-[85vw] max-h-[78vh] object-contain rounded-lg shadow-2xl select-none"
 draggable={false}
 />
 </div>

 {/* Flecha derecha */}
 {attentionDetail.imageUrls.length > 1 && (
 <button
 onClick={() => { setLightboxIndex(i => (i + 1) % attentionDetail.imageUrls.length); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
 className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
 title="Siguiente (→)"
 >
 <ChevronRight className="w-6 h-6" />
 </button>
 )}

 {/* Miniaturas inferiores */}
 {attentionDetail.imageUrls.length > 1 && (
 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-2 bg-black/50 rounded-xl max-w-[90vw] overflow-x-auto">
 {attentionDetail.imageUrls.map((url, idx) => (
 <button
 key={idx}
 onClick={() => { setLightboxIndex(idx); setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
 className={`flex-shrink-0 w-12 h-9 rounded overflow-hidden border-2 transition-all ${idx === lightboxIndex ? 'border-purple-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
 >
 <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 </main>
 </div>
 );
}

// ── Componente timer de expiración ────────────────────────────────────────────
function ExpiryTimer({ secondsLeft, compact = false }: { secondsLeft: number | null; compact?: boolean }) {
 if (secondsLeft === null) return null;

 const mins = Math.floor(secondsLeft / 60);
 const secs = secondsLeft % 60;
 const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
 const expired = secondsLeft === 0;

 const colorClass = expired
 ? 'bg-red-500/15 border-red-500/40 text-red-400'
 : secondsLeft < 60
 ? 'bg-red-500/10 border-red-500/30 text-red-400'
 : secondsLeft < 180
 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
 : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

 if (compact) {
 return (
 <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono ${colorClass}`}>
 {expired ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
 {expired ? 'Expirado' : formatted}
 </div>
 );
 }

 return (
 <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs mb-3 ${colorClass}`}>
 {expired ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> : <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
 {expired
 ? 'Los datos han expirado. Vuelve a seleccionar el caso para recargarlos.'
 : <><span className="font-semibold font-mono">{formatted}</span><span className="opacity-70">restantes para que los datos expiren</span></>
 }
 </div>
 );
}
