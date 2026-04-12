// frontend/src/pages/AuditsViewPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth, useRole } from '../contexts/AuthContext';
import { auditService, getAuditTotalCost, type Audit } from '../services/api';
import { 
 FileText, 
 TrendingUp, 
 Clock,
 CheckCircle2,
 AlertCircle,
 Eye,
 Download,
 Filter,
 Search,
 Calendar,
 DollarSign,
 Loader2,
 RefreshCw,
 FileSpreadsheet,
 BarChart3,
 User,
 UserCheck,
 Phone,
 Grid3x3,
 List,
 SlidersHorizontal,
 X,
 ArrowUpDown,
 ChevronUp,
 ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';

type ViewMode = 'grid' | 'table';
type SortField = 'created_at' | 'executive_name' | 'status' | 'score';
type SortOrder = 'asc' | 'desc';

export default function AuditsViewPage() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const { isSupervisor } = useRole();
 const [audits, setAudits] = useState<Audit[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [exporting, setExporting] = useState(false);
 const [viewMode, setViewMode] = useState<ViewMode>('grid');
 
 // Filtros
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [callTypeFilter, setCallTypeFilter] = useState<string>('all');
 const [dateFilter, setDateFilter] = useState<string>('all');
 const [showFilters, setShowFilters] = useState(false);

 // Ordenamiento
 const [sortField, setSortField] = useState<SortField>('created_at');
 const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

 useEffect(() => {
 loadAudits();
 }, []);

 const loadAudits = async () => {
 try {
 setLoading(true);
 const { audits: data } = await auditService.getUserAudits();
 setAudits(data);
 } catch (error: any) {
 toast.error('Error al cargar auditorías');
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const handleRefresh = async () => {
 setRefreshing(true);
 await loadAudits();
 setRefreshing(false);
 toast.success('Datos actualizados');
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

 // Exportación mejorada a Excel con formato profesional
 const exportToExcel = async () => {
 if (filteredAndSortedAudits.length === 0) {
 toast.error('No hay datos para exportar');
 return;
 }

 try {
 setExporting(true);
 toast.loading('Generando reporte Excel...', { id: 'export-excel' });

 const workbook = new ExcelJS.Workbook();
 workbook.creator = 'Sistema de Auditorías AI';
 workbook.created = new Date();
 workbook.company = 'Call Center Analytics';

 // ========== HOJA 1: RESUMEN EJECUTIVO ==========
 const summarySheet = workbook.addWorksheet('Resumen Ejecutivo', {
 properties: { tabColor: { argb: 'FF10B981' } },
 views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
 });

 // Estadísticas calculadas
 const totalAudits = filteredAndSortedAudits.length;
 const completedAudits = filteredAndSortedAudits.filter(a => a.status === 'completed').length;
 const processingAudits = filteredAndSortedAudits.filter(a => a.status === 'processing').length;
 const errorAudits = filteredAndSortedAudits.filter(a => a.status === 'error').length;
 const auditsWithScore = filteredAndSortedAudits.filter(a => a.evaluations?.[0]?.percentage);
 const avgScore = auditsWithScore.length > 0 
 ? auditsWithScore.reduce((sum, a) => sum + (a.evaluations![0].percentage || 0), 0) / auditsWithScore.length 
 : 0;
 const totalCost = filteredAndSortedAudits.reduce((sum, a) => sum + getAuditTotalCost(a), 0);
 const avgCost = totalAudits > 0 ? totalCost / totalAudits : 0;

 // Configurar columnas del resumen
 summarySheet.columns = [
 { key: 'metric', width: 30 },
 { key: 'value', width: 25 },
 { key: 'detail', width: 50 }
 ];

 // Título principal
 summarySheet.mergeCells('A1:C1');
 const titleCell = summarySheet.getCell('A1');
         titleCell.value = '📊 REPORTE DE AUDITORÍAS - RESUMEN EJECUTIVO';
 titleCell.font = { size: 16, bold: true, color: { argb: 'FF10B981' } };
 titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
 titleCell.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF1E293B' }
 };
 summarySheet.getRow(1).height = 30;

 // Headers
 summarySheet.addRow(['Métrica', 'Valor', 'Detalle']);
 const headerRow = summarySheet.getRow(2);
 headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 headerRow.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF10B981' }
 };
 headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
 headerRow.height = 25;

 // Datos del resumen
 const summaryData = [
 {
 metric: ' Total de Auditorías',
 value: totalAudits.toString(),
 detail: `${completedAudits} completadas, ${processingAudits} en proceso, ${errorAudits} con errores`
 },
 {
 metric: 'Tasa de Éxito',
 value: totalAudits > 0 ? `${((completedAudits / totalAudits) * 100).toFixed(1)}%` : '0%',
 detail: `${completedAudits} de ${totalAudits} auditorías completadas exitosamente`
 },
 {
         metric: 'Score Promedio',
 value: avgScore > 0 ? `${avgScore.toFixed(2)}%` : 'N/A',
 detail: `Basado en ${auditsWithScore.length} auditorías evaluadas`
 },
 {
 metric: 'Mejor Score',
 value: auditsWithScore.length > 0 
 ? `${Math.max(...auditsWithScore.map(a => a.evaluations![0].percentage)).toFixed(2)}%`
 : 'N/A',
 detail: 'Score más alto obtenido en el período'
 },
 {
 metric: '° Score Más Bajo',
 value: auditsWithScore.length > 0 
 ? `${Math.min(...auditsWithScore.map(a => a.evaluations![0].percentage)).toFixed(2)}%`
 : 'N/A',
 detail: 'Score más bajo obtenido en el período'
 }
 ];

 // Agregar costos si es supervisor
 if (isSupervisor) {
 summaryData.push(
 {
 metric: '° Costo Total',
 value: `$${totalCost.toFixed(4)} USD`,
 detail: `Costo acumulado de ${totalAudits} auditorías procesadas`
 },
 {
 metric: 'µ Costo Promedio',
 value: `$${avgCost.toFixed(4)} USD`,
 detail: 'Costo promedio por auditoría'
 },
 {
 metric: 'Ë† Eficiencia',
 value: avgScore > 0 ? `$${(avgCost / (avgScore / 100)).toFixed(4)}` : 'N/A',
 detail: 'Costo por punto de score obtenido'
 }
 );
 }

 summaryData.push({
 metric: '¦ Fecha de Generación',
 value: new Date().toLocaleDateString('es-ES', { 
 year: 'numeric', 
 month: 'long', 
 day: 'numeric' 
 }),
 detail: `Generado por: ${user?.email || 'Usuario del sistema'}`
 });

 summaryData.forEach((row, index) => {
 const excelRow = summarySheet.addRow(row);
 excelRow.height = 22;
 
 // Alternar colores de fondo
 if (index % 2 === 0) {
 excelRow.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFF8FAFC' }
 };
 }

 // Estilos de celda
 excelRow.getCell('metric').font = { bold: true, size: 11 };
 excelRow.getCell('value').font = { bold: true, size: 12, color: { argb: 'FF10B981' } };
 excelRow.getCell('value').alignment = { horizontal: 'center', vertical: 'middle' };
 excelRow.getCell('detail').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
 
 // Bordes
 ['metric', 'value', 'detail'].forEach(key => {
 excelRow.getCell(key).border = {
 top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
 };
 });
 });

 // ========== HOJA 2: AUDITORÍAS DETALLADAS ==========
 const detailSheet = workbook.addWorksheet('Auditorías Detalladas', {
 properties: { tabColor: { argb: 'FF3B82F6' } },
 views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
 });

 // Configurar columnas
 const columns: any[] = [
 { header: 'Fecha', key: 'fecha', width: 20 },
 { header: 'Ejecutivo', key: 'ejecutivo', width: 25 },
         { header: 'ID Ejecutivo', key: 'id_ejecutivo', width: 18 },
 { header: 'Cliente', key: 'cliente', width: 25 },
 { header: 'Tipo Llamada', key: 'tipo_llamada', width: 16 },
 { header: 'Creado por', key: 'creado_por', width: 22 },
         { header: 'Estado', key: 'estado', width: 14 },
         { header: 'Score (%)', key: 'score', width: 14 },
         { header: 'Puntos', key: 'puntos', width: 14 }
 ];

 if (isSupervisor) {
 columns.push({ header: 'Costo (USD)', key: 'costo', width: 16 });
 }

 detailSheet.columns = columns;

 // Estilo del header
 const detailHeaderRow = detailSheet.getRow(1);
 detailHeaderRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 detailHeaderRow.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF3B82F6' }
 };
 detailHeaderRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 detailHeaderRow.height = 30;

 // Agregar datos
 filteredAndSortedAudits.forEach((audit, index) => {
 const rowData: any = {
 fecha: formatDateForExcel(audit.created_at),
 ejecutivo: audit.executive_name || 'Sin nombre',
 id_ejecutivo: audit.executive_id || 'N/A',
 cliente: truncateText(audit.client_id || 'N/A', 30),
 tipo_llamada: (audit.call_type || '').toUpperCase() === 'MONITOREO' ? '🖥️ Monitoreo' : '📞 Inbound',
 creado_por: audit.created_by_name || 'Desconocido',
         estado: audit.status === 'completed' ? '✅ Completada' :
         audit.status === 'processing' ? '⏳ Procesando' : '❌ Error',
 score: audit.evaluations?.[0]?.percentage 
 ? `${audit.evaluations[0].percentage.toFixed(1)}%` 
 : 'N/A',
 puntos: audit.evaluations?.[0] 
 ? `${audit.evaluations[0].total_score}/${audit.evaluations[0].max_possible_score}` 
 : 'N/A'
 };

 if (isSupervisor) {
 rowData.costo = `$${getAuditTotalCost(audit).toFixed(4)}`;
 }

 const excelRow = detailSheet.addRow(rowData);
 excelRow.height = 22;

 // Color de fondo alternado
 if (index % 2 === 0) {
 excelRow.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFF8FAFC' }
 };
 }

 // Colorear el score según el valor
 if (audit.evaluations?.[0]?.percentage) {
 const scoreCell = excelRow.getCell('score');
 const score = audit.evaluations[0].percentage;
 scoreCell.font = { 
 bold: true, 
 size: 11,
 color: { 
 argb: score >= 90 ? 'FF10B981' : 
 score >= 70 ? 'FF3B82F6' : 
 score >= 50 ? 'FFF59E0B' : 'FFEF4444' 
 }
 };
 }

 // Colorear el estado
 const statusCell = excelRow.getCell('estado');
 statusCell.font = {
 bold: true,
 size: 10,
 color: {
 argb: audit.status === 'completed' ? 'FF10B981' :
 audit.status === 'processing' ? 'FF3B82F6' : 'FFEF4444'
 }
 };

 // Alineación
 excelRow.eachCell((cell) => {
 cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
 cell.border = {
 top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
 };
 });

 // Centrar algunas columnas
 ['score', 'puntos', 'estado', 'tipo_llamada'].forEach(key => {
 if (isSupervisor || key !== 'costo') {
 excelRow.getCell(key).alignment = { 
 horizontal: 'center', 
 vertical: 'middle' 
 };
 }
 });

 if (isSupervisor) {
 excelRow.getCell('costo').alignment = { 
 horizontal: 'right', 
 vertical: 'middle' 
 };
 excelRow.getCell('costo').font = { bold: true, color: { argb: 'FF10B981' } };
 }
 });

 // Agregar filtros automáticos
 detailSheet.autoFilter = {
 from: 'A1',
 to: isSupervisor ? 'J1' : 'I1'
 };

 // ========== HOJA 3: ANÁLISIS POR EJECUTIVO ==========
 const executivesSheet = workbook.addWorksheet('Análisis por Ejecutivo', {
 properties: { tabColor: { argb: 'FFA855F7' } },
 views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
 });

 // Agrupar auditorías por ejecutivo
 const executiveStats = new Map<string, {
 name: string;
 total: number;
 completed: number;
 avgScore: number;
 scores: number[];
 totalCost: number;
 }>();

 filteredAndSortedAudits.forEach(audit => {
 const execId = audit.executive_id;
 if (!executiveStats.has(execId)) {
 executiveStats.set(execId, {
 name: audit.executive_name,
 total: 0,
 completed: 0,
 avgScore: 0,
 scores: [],
 totalCost: 0
 });
 }

 const stats = executiveStats.get(execId)!;
 stats.total++;
 if (audit.status === 'completed') stats.completed++;
 if (audit.evaluations?.[0]?.percentage) {
 stats.scores.push(audit.evaluations[0].percentage);
 }
 stats.totalCost += getAuditTotalCost(audit);
 });

 // Calcular promedios
 executiveStats.forEach(stats => {
 if (stats.scores.length > 0) {
 stats.avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
 }
 });

 // Configurar columnas
 const execColumns: any[] = [
 { header: 'Ejecutivo', key: 'ejecutivo', width: 25 },
         { header: 'ID', key: 'id', width: 18 },
         { header: 'Total', key: 'total', width: 12 },
         { header: 'Completadas', key: 'completadas', width: 14 },
         { header: 'Tasa Éxito', key: 'tasa', width: 14 },
         { header: 'Score Prom.', key: 'score_prom', width: 14 },
 { header: 'Mejor Score', key: 'mejor', width: 14 },
 { header: 'Peor Score', key: 'peor', width: 14 }
 ];

 if (isSupervisor) {
 execColumns.push(
 { header: 'Costo Total', key: 'costo_total', width: 16 },
 { header: 'Costo Prom.', key: 'costo_prom', width: 16 }
 );
 }

 executivesSheet.columns = execColumns;

 // Header
 const execHeaderRow = executivesSheet.getRow(1);
 execHeaderRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 execHeaderRow.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFA855F7' }
 };
 execHeaderRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 execHeaderRow.height = 30;

 // Agregar datos de ejecutivos (ordenados por score promedio)
 const sortedExecs = Array.from(executiveStats.entries())
 .sort((a, b) => b[1].avgScore - a[1].avgScore);

 sortedExecs.forEach(([execId, stats], index) => {
 const rowData: any = {
 ejecutivo: stats.name || 'Sin nombre',
 id: execId,
 total: stats.total,
 completadas: stats.completed,
 tasa: stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(1)}%` : '0%',
 score_prom: stats.avgScore > 0 ? `${stats.avgScore.toFixed(2)}%` : 'N/A',
 mejor: stats.scores.length > 0 ? `$(echo "PLACEHOLDER_MAX")` : 'N/A',
 peor: stats.scores.length > 0 ? `${Math.min(...stats.scores).toFixed(1)}%` : 'N/A'
 };

 if (isSupervisor) {
 rowData.costo_total = `$${stats.totalCost.toFixed(4)}`;
 rowData.costo_prom = stats.total > 0 ? `$${(stats.totalCost / stats.total).toFixed(4)}` : '$0.0000';
 }

 const excelRow = executivesSheet.addRow(rowData);
 excelRow.height = 22;

 if (index % 2 === 0) {
 excelRow.fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFF8FAFC' }
 };
 }

 // Estilos
 excelRow.eachCell((cell, colNumber) => {
 cell.alignment = { 
 horizontal: colNumber <= 2 ? 'left' : 'center', 
 vertical: 'middle' 
 };
 cell.border = {
 top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
 right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
 };
 });

 // Colorear el score promedio
 const scoreCell = excelRow.getCell('score_prom');
 if (stats.avgScore > 0) {
 scoreCell.font = {
 bold: true,
 size: 11,
 color: {
 argb: stats.avgScore >= 90 ? 'FF10B981' :
 stats.avgScore >= 70 ? 'FF3B82F6' :
 stats.avgScore >= 50 ? 'FFF59E0B' : 'FFEF4444'
 }
 };
 }

 // Destacar ejecutivos top
 if (index < 3 && stats.scores.length > 0) {
 excelRow.getCell('ejecutivo').font = { 
 bold: true, 
 color: { argb: 'FFA855F7' },
 size: 11
 };
         excelRow.getCell('ejecutivo').value = `👤 ${rowData.ejecutivo}`;
 }
 });

 // Agregar filtros
 executivesSheet.autoFilter = {
 from: 'A1',
 to: isSupervisor ? 'J1' : 'H1'
 };

 // ========== GUARDAR ARCHIVO ==========
 const buffer = await workbook.xlsx.writeBuffer();
 const blob = new Blob([buffer], { 
 type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
 });
 
 const url = window.URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `Auditorias_Detallado_${new Date().toISOString().split('T')[0]}.xlsx`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 window.URL.revokeObjectURL(url);

 toast.success('Excel generado exitosamente', { id: 'export-excel' });
 } catch (error) {
 console.error('Error al exportar:', error);
 toast.error('Error al generar el Excel', { id: 'export-excel' });
 } finally {
 setExporting(false);
 }
 };

 const getStatusBadge = (status: string) => {
 switch (status) {
 case 'completed':
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 text-xs font-medium whitespace-nowrap">
 <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
 Completada
 </span>
 );
 case 'processing':
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 border border-brand-700/40 rounded-lg text-brand-300 text-xs font-medium whitespace-nowrap">
 <Clock className="w-3.5 h-3.5 flex-shrink-0" />
 Procesando
 </span>
 );
 case 'error':
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs font-medium whitespace-nowrap">
 <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
 Error
 </span>
 );
 default:
 return null;
 }
 };

 const formatDate = (dateString: string) => {
 return new Date(dateString).toLocaleDateString('es-ES', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 });
 };

 const formatDateForExcel = (dateString: string) => {
 return new Date(dateString).toLocaleString('es-ES', {
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit'
 });
 };

 const truncateText = (text: string, maxLength: number) => {
 if (text.length <= maxLength) return text;
 return text.substring(0, maxLength - 3) + '...';
 };

 const getScoreColor = (percentage: number) => {
 if (percentage >= 90) return 'text-green-400';
 if (percentage >= 70) return 'text-brand-400';
 if (percentage >= 50) return 'text-yellow-400';
 return 'text-red-400';
 };

 // Aplicar filtros
 const filteredAudits = audits.filter(audit => {
 // Búsqueda
 const searchLower = searchTerm.toLowerCase();
 const matchesSearch = 
 audit.executive_name.toLowerCase().includes(searchLower) ||
 audit.executive_id.toLowerCase().includes(searchLower) ||
 audit.client_id.toLowerCase().includes(searchLower) ||
 (audit.created_by_name || '').toLowerCase().includes(searchLower);

 if (!matchesSearch) return false;

 // Filtro de estado
 if (statusFilter !== 'all' && audit.status !== statusFilter) return false;

 // Filtro de tipo de llamada
 if (callTypeFilter !== 'all' && audit.call_type !== callTypeFilter) return false;

 // Filtro de fecha
 if (dateFilter !== 'all') {
 const auditDate = new Date(audit.created_at);
 const now = new Date();
 
 switch (dateFilter) {
 case 'today':
 if (auditDate.toDateString() !== now.toDateString()) return false;
 break;
 case 'yesterday': {
 // Usa timezone local del navegador (funciona para Colombia UTC-5 y México UTC-6)
 const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
 const startOfYesterday = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
 const endOfYesterday   = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
 if (auditDate < startOfYesterday || auditDate > endOfYesterday) return false;
 break;
 }
 case 'week':
 const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
 if (auditDate < weekAgo) return false;
 break;
 case 'month':
 const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
 if (auditDate < monthAgo) return false;
 break;
 }
 }

 return true;
 });

 // Aplicar ordenamiento
 const filteredAndSortedAudits = [...filteredAudits].sort((a, b) => {
 let comparison = 0;

 switch (sortField) {
 case 'created_at':
 comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
 break;
 case 'executive_name':
 comparison = a.executive_name.localeCompare(b.executive_name);
 break;
 case 'status':
 comparison = a.status.localeCompare(b.status);
 break;
 case 'score':
 const scoreA = a.evaluations?.[0]?.percentage || 0;
 const scoreB = b.evaluations?.[0]?.percentage || 0;
 comparison = scoreA - scoreB;
 break;
 }

 return sortOrder === 'asc' ? comparison : -comparison;
 });

 const handleSort = (field: SortField) => {
 if (sortField === field) {
 setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
 } else {
 setSortField(field);
 setSortOrder('desc');
 }
 };

 // Calcular estadísticas
 const stats = {
 total: filteredAndSortedAudits.length,
 completed: filteredAndSortedAudits.filter(a => a.status === 'completed').length,
 processing: filteredAndSortedAudits.filter(a => a.status === 'processing').length,
 errors: filteredAndSortedAudits.filter(a => a.status === 'error').length,
 avgScore: filteredAndSortedAudits
 .filter(a => a.evaluations?.[0]?.percentage)
 .reduce((sum, a) => sum + (a.evaluations![0].percentage || 0), 0) / 
 filteredAndSortedAudits.filter(a => a.evaluations?.[0]?.percentage).length || 0,
 totalCost: filteredAndSortedAudits.reduce((sum, a) => sum + getAuditTotalCost(a), 0)
 };

 return (
 <div className="min-h-screen">
 <AppHeader
 showBack
 onBack={() => navigate(-1)}
 title="Explorador de Auditorías"
 rightContent={
   <button onClick={handleRefresh} disabled={refreshing} className="btn-ghost flex items-center gap-1.5 text-xs">
     <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
     Actualizar
   </button>
 }
 />

 <main className="max-w-[1600px] mx-auto px-6 pt-5 pb-8">
 {/* KPI Cards mejorados */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
 <div className="stat-card bg-slate-800/50 border-brand-700/40 hover:border-brand-500/50/60 transition-all">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total</span>
 <FileText className="w-4 h-4 text-brand-400" />
 </div>
 <div className="text-2xl font-bold text-brand-400">{stats.total}</div>
 <div className="text-xs text-slate-500 mt-1">Auditorías</div>
 </div>

 <div className="stat-card bg-slate-800/50 border-green-500/30 hover:border-green-400/60 transition-all">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Completadas</span>
 <CheckCircle2 className="w-4 h-4 text-green-400" />
 </div>
 <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
 <div className="text-xs text-slate-500 mt-1">
 {stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(1)}%` : '0%'} del total
 </div>
 </div>

 <div className="stat-card bg-slate-800/50 border-yellow-500/30 hover:border-yellow-400/60 transition-all">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Procesando</span>
 <Clock className="w-4 h-4 text-yellow-400" />
 </div>
 <div className="text-2xl font-bold text-yellow-400">{stats.processing}</div>
 <div className="text-xs text-slate-500 mt-1">En proceso</div>
 </div>

 <div className="stat-card bg-slate-800/50 border-red-500/30 hover:border-red-400/60 transition-all">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Errores</span>
 <AlertCircle className="w-4 h-4 text-red-400" />
 </div>
 <div className="text-2xl font-bold text-red-400">{stats.errors}</div>
 <div className="text-xs text-slate-500 mt-1">Con problemas</div>
 </div>

 <div className="stat-card bg-slate-800/50 border-brand-700/40 hover:border-brand-500/50 transition-all">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Score Prom.</span>
 <TrendingUp className="w-4 h-4 text-brand-400" />
 </div>
 <div className={`text-2xl font-bold ${getScoreColor(stats.avgScore)}`}>
 {stats.avgScore > 0 ? `${stats.avgScore.toFixed(1)}%` : 'N/A'}
 </div>
 <div className="text-xs text-slate-500 mt-1">Calificación media</div>
 </div>

 {isSupervisor && (
 <div className="stat-card bg-slate-800/50 border-emerald-500/30 hover:border-emerald-400/60 transition-all">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Costos</span>
 <DollarSign className="w-4 h-4 text-emerald-400" />
 </div>
 <div className="text-2xl font-bold text-emerald-400">
 ${stats.totalCost.toFixed(2)}
 </div>
 <div className="text-xs text-slate-500 mt-1">USD Total</div>
 </div>
 )}
 </div>

 {/* Barra de controles mejorada */}
 <div className="card mb-4">
 <div className="flex flex-col lg:flex-row gap-4">
 {/* Búsqueda */}
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Buscar por ejecutivo, ID, cliente o creador..."
 className="input pl-10"
 />
 </div>

 {/* Botones de control */}
 <div className="flex flex-wrap gap-2">
 {/* Toggle Filtros */}
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 font-medium ${
 showFilters
 ? 'bg-brand-500 text-black'
 : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-[#1e1e32]'
 }`}
 >
 <SlidersHorizontal className="w-5 h-5" />
 <span className="hidden sm:inline">Filtros</span>
 </button>

 {/* Vista Grid/Table */}
 <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
 <button
 onClick={() => setViewMode('grid')}
 className={`p-2 rounded transition-colors ${
 viewMode === 'grid'
 ? 'bg-brand-500 text-black'
 : 'text-slate-400 hover:text-white'
 }`}
 title="Vista en tarjetas"
 >
 <Grid3x3 className="w-5 h-5" />
 </button>
 <button
 onClick={() => setViewMode('table')}
 className={`p-2 rounded transition-colors ${
 viewMode === 'table'
 ? 'bg-brand-500 text-black'
 : 'text-slate-400 hover:text-white'
 }`}
 title="Vista en tabla"
 >
 <List className="w-5 h-5" />
 </button>
 </div>

 {/* Exportar Excel */}
 <button
 onClick={exportToExcel}
 disabled={exporting || filteredAndSortedAudits.length === 0}
 className="btn-primary flex items-center gap-2 font-medium"
 >
 {exporting ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : (
 <FileSpreadsheet className="w-5 h-5" />
 )}
 <span className="hidden sm:inline">
 {exporting ? 'Exportando...' : 'Exportar Excel'}
 </span>
 </button>
 </div>
 </div>

 {/* Panel de Filtros */}
 {showFilters && (
 <div className="mt-4 pt-4 border-t border-[#1e1e32]">
 {/* Accesos rápidos */}
 <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
 <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Accesos rápidos</span>
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setDateFilter('yesterday')}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
 dateFilter === 'yesterday'
 ? 'bg-amber-600 text-white'
 : 'bg-slate-800 text-amber-400 hover:bg-amber-600/20 border border-amber-600/40'
 }`}
 >
 <Calendar className="w-3.5 h-3.5" />
 Día vencido
 </button>
 <button
 onClick={() => {
 setSearchTerm('');
 setStatusFilter('all');
 setCallTypeFilter('all');
 setDateFilter('all');
 }}
 className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700"
 >
 <X className="w-3.5 h-3.5" />
 Limpiar filtros
 </button>
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm text-slate-400 mb-2 font-medium">Estado</label>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="input"
 >
 <option value="all">Todos los estados</option>
         <option value="completed">Completadas</option>
         <option value="processing">Procesando</option>
         <option value="error">Con Error</option>
 </select>
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2 font-medium">Tipo de Llamada</label>
 <select
 value={callTypeFilter}
 onChange={(e) => setCallTypeFilter(e.target.value)}
 className="input"
 >
 <option value="all">Todas las llamadas</option>
         <option value="INBOUND">📞 Inbound</option>
         <option value="MONITOREO">🖥️ Monitoreo</option>
 </select>
 </div>

 <div>
         <label className="block text-sm text-slate-400 mb-2 font-medium">Período</label>
 <select
 value={dateFilter}
 onChange={(e) => setDateFilter(e.target.value)}
 className="input"
 >
         <option value="all">Todo el tiempo</option>
 <option value="today">Hoy</option>
 <option value="yesterday">Ayer (día vencido)</option>
         <option value="week">Última semana</option>
         <option value="month">Último mes</option>
 </select>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Contenido */}
 {loading ? (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
 </div>
 ) : filteredAndSortedAudits.length === 0 ? (
 <div className="card text-center py-16">
 <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
 <h3 className="text-xl font-semibold text-white mb-2">No se encontraron auditorías</h3>
 <p className="text-slate-400 mb-4">
 {searchTerm || statusFilter !== 'all' || callTypeFilter !== 'all' || dateFilter !== 'all'
         ? 'Intenta ajustar los filtros de búsqueda'
 : 'Aún no hay auditorías registradas'}
 </p>
 {(searchTerm || statusFilter !== 'all' || callTypeFilter !== 'all' || dateFilter !== 'all') && (
 <button
 onClick={() => {
 setSearchTerm('');
 setStatusFilter('all');
 setCallTypeFilter('all');
 setDateFilter('all');
 }}
 className="btn-secondary"
 >
 Limpiar filtros
 </button>
 )}
 </div>
 ) : viewMode === 'grid' ? (
 /* Vista de Tarjetas mejorada */
 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
 {filteredAndSortedAudits.map((audit) => (
 <div
 key={audit.id}
 onClick={() => navigate(`/audit/${audit.id}`)}
 className="card hover:border-green-500/40 transition-all duration-300 cursor-pointer group"
 >
 {/* Header de la tarjeta */}
 <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-700/50">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-2">
 <User className="w-4 h-4 text-green-400 flex-shrink-0" />
 <h3 className="text-white font-semibold truncate group-hover:text-green-400 transition-colors">
 {audit.executive_name}
 </h3>
 </div>
 <p className="text-slate-500 text-sm truncate">ID: {audit.executive_id}</p>
 </div>
 {getStatusBadge(audit.status)}
 </div>

 {/* Info de la auditoría */}
 <div className="space-y-3 mb-4">
 <div className="flex items-center gap-2 text-sm">
 <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
 <span className="text-slate-400">Cliente:</span>
 <span className="text-white font-medium truncate">{audit.client_id}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
 <span className={`px-2 py-1 rounded text-xs font-medium ${
 (audit.call_type || '').toUpperCase() === 'MONITOREO'
 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
 : 'bg-brand-500/10 text-brand-300 border border-brand-700/40'
 }`}>
 {(audit.call_type || '').toUpperCase() === 'MONITOREO' ? '🖥️ Monitoreo' : '📞 Inbound'}
 </span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
 <span className="text-slate-400">{formatDate(audit.created_at)}</span>
 </div>
 {audit.created_by_name && (
 <div className="flex items-center gap-2 text-sm">
 <UserCheck className="w-4 h-4 text-cyan-500 flex-shrink-0" />
 <span className="text-slate-400">Creado por:</span>
 <span className="text-cyan-300 font-medium truncate">{audit.created_by_name}</span>
 </div>
 )}
 </div>

 {/* Score */}
 {audit.evaluations && audit.evaluations.length > 0 && (
 <div className="pt-4 border-t border-slate-700/50">
 <div className="flex items-center justify-between mb-2">
 <span className="text-slate-400 text-sm font-medium">Score de Calidad</span>
 <TrendingUp className="w-4 h-4 text-green-400" />
 </div>
 <div className="flex items-baseline gap-2">
 <span className={`text-2xl font-bold ${getScoreColor(audit.evaluations[0].percentage)}`}>
 {audit.evaluations[0].percentage.toFixed(1)}%
 </span>
 <span className="text-slate-500 text-sm">
 ({audit.evaluations[0].total_score}/{audit.evaluations[0].max_possible_score} pts)
 </span>
 </div>
 </div>
 )}

 {/* Cost (Supervisor only) */}
 {isSupervisor && getAuditTotalCost(audit) > 0 && (
 <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
 <span className="text-slate-400 text-sm font-medium">Costo</span>
 <span className="text-emerald-400 font-bold text-lg">
 ${getAuditTotalCost(audit).toFixed(4)}
 </span>
 </div>
 )}

 {/* Actions */}
 <div className="mt-4 flex gap-2">
 <button
 onClick={(e) => {
 e.stopPropagation();
 navigate(`/audit/${audit.id}`);
 }}
 className="flex-1 px-3 py-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-700/40 text-brand-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
 >
 <Eye className="w-4 h-4" />
 Ver Detalles
 </button>
 {audit.evaluations?.[0]?.excel_filename && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDownloadExcel(audit.evaluations![0].excel_filename);
 }}
 className="px-3 py-2 bg-brand-500/10 hover:bg-brand-500/30 border border-brand-700/40 text-brand-300 rounded-lg transition-colors flex items-center justify-center"
 title="Descargar Excel individual"
 >
 <FileSpreadsheet className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 ) : (
 /* Vista de Tabla mejorada */
 <div className="card overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-[#1e1e32] bg-[#141424]/80">
 <th className="px-4 py-3 text-left">
 <button
 onClick={() => handleSort('created_at')}
 className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium whitespace-nowrap"
 >
 Fecha
 {sortField === 'created_at' && (
 sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
 )}
 </button>
 </th>
 <th className="px-4 py-3 text-left">
 <button
 onClick={() => handleSort('executive_name')}
 className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium whitespace-nowrap"
 >
 Ejecutivo
 {sortField === 'executive_name' && (
 sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
 )}
 </button>
 </th>
 <th className="px-4 py-3 text-left text-slate-400 text-sm font-medium whitespace-nowrap">Cliente</th>
 <th className="px-4 py-3 text-left text-slate-400 text-sm font-medium whitespace-nowrap">Tipo</th>
 <th className="px-4 py-3 text-left text-slate-400 text-sm font-medium whitespace-nowrap">Creado por</th>
 <th className="px-4 py-3 text-left">
 <button
 onClick={() => handleSort('status')}
 className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium whitespace-nowrap"
 >
 Estado
 {sortField === 'status' && (
 sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
 )}
 </button>
 </th>
 <th className="px-4 py-3 text-left">
 <button
 onClick={() => handleSort('score')}
 className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium whitespace-nowrap"
 >
 Score
 {sortField === 'score' && (
 sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
 )}
 </button>
 </th>
 {isSupervisor && (
 <th className="px-4 py-3 text-left text-slate-400 text-sm font-medium whitespace-nowrap">Costo</th>
 )}
 <th className="px-4 py-3 text-right text-slate-400 text-sm font-medium whitespace-nowrap">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {filteredAndSortedAudits.map((audit, index) => (
 <tr
 key={audit.id}
 className={`border-b border-[#1e1e32] hover:bg-[#1a1a2e]/60 transition-colors cursor-pointer ${
 index % 2 === 0 ? 'bg-[#0a0a12]/30' : ''
 }`}
 onClick={() => navigate(`/audit/${audit.id}`)}
 >
 <td className="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">
 {formatDate(audit.created_at)}
 </td>
 <td className="px-4 py-4">
 <div className="min-w-0">
 <p className="text-white font-medium truncate">{audit.executive_name}</p>
 <p className="text-slate-500 text-xs truncate">ID: {audit.executive_id}</p>
 </div>
 </td>
 <td className="px-4 py-4 text-sm text-slate-300">
 <span className="truncate block max-w-[200px]" title={audit.client_id}>
 {audit.client_id}
 </span>
 </td>
 <td className="px-4 py-4 text-sm text-slate-300 whitespace-nowrap">
 {(audit.call_type || '').toUpperCase() === 'MONITOREO' ? '🖥️ Monitoreo' : '📞 Inbound'}
 </td>
 <td className="px-4 py-4 text-sm whitespace-nowrap">
 <span className="text-cyan-300 font-medium" title={audit.created_by_email || ''}>
 {audit.created_by_name || 'Desconocido'}
 </span>
 </td>
 <td className="px-4 py-4">
 {getStatusBadge(audit.status)}
 </td>
 <td className="px-4 py-4 whitespace-nowrap">
 {audit.evaluations?.[0] ? (
 <div>
 <span className={`text-lg font-bold ${getScoreColor(audit.evaluations[0].percentage)}`}>
 {audit.evaluations[0].percentage.toFixed(1)}%
 </span>
 <span className="text-slate-500 text-xs ml-1">
 ({audit.evaluations[0].total_score}/{audit.evaluations[0].max_possible_score})
 </span>
 </div>
 ) : (
 <span className="text-slate-500 text-sm">N/A</span>
 )}
 </td>
 {isSupervisor && (
 <td className="px-4 py-4 text-sm text-emerald-400 font-semibold whitespace-nowrap">
 ${getAuditTotalCost(audit).toFixed(4)}
 </td>
 )}
 <td className="px-4 py-4">
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={(e) => {
 e.stopPropagation();
 navigate(`/audit/${audit.id}`);
 }}
 className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors text-brand-400"
 title="Ver detalles"
 >
 <Eye className="w-4 h-4" />
 </button>
 {audit.evaluations?.[0]?.excel_filename && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDownloadExcel(audit.evaluations![0].excel_filename);
 }}
 className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-brand-400"
 title="Descargar Excel individual"
 >
 <Download className="w-4 h-4" />
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </main>
 </div>
 );
}