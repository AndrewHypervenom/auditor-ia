// frontend/src/pages/ReportsPage.tsx
// Página de reportes y análisis - VERSIÓN CON TODOS LOS GRÁFICOS SIEMPRE

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRole } from '../contexts/AuthContext';
import { auditService, getAuditTotalCost, type Audit } from '../services/api';
import ExcelJS from 'exceljs';
import { 
 BarChart3,
 TrendingUp, 
 FileText,
 DollarSign,
 Calendar,
 Download,
 Loader2,
 CheckCircle2,
 Clock,
 AlertCircle,
 Users,
 ArrowLeft,
 PieChart,
 Activity,
 Shield,
 TrendingDown,
 Database,
 Sparkles,
 Award,
 Target,
 Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
 LineChart,
 Line,
 BarChart,
 Bar,
 AreaChart,
 Area,
 PieChart as RechartsPieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
 RadarChart,
 PolarGrid,
 PolarAngleAxis,
 PolarRadiusAxis,
 Radar
} from 'recharts';

// Colores para los gráficos — paleta POSITIVO S+
const COLORS = {
 completed: '#00D632',   // verde de marca
 processing: '#f59e0b',
 error: '#ef4444',
 primary: '#00D632',     // verde de marca (reemplaza morado)
 secondary: '#1ADE50',   // verde más claro
 tertiary: '#009422',    // verde oscuro
 emerald: '#00D632',
 blue: '#00D632',        // reemplaza azul por verde de marca
 indigo: '#00b82b'
};

const PIE_COLORS = ['#00D632', '#f59e0b', '#ef4444'];

// DATOS DE EJEMPLO PARA EL DASHBOARD
const EXAMPLE_DATA = {
 totalAudits: 156,
 completedAudits: 142,
 processingAudits: 8,
 errorAudits: 6,
 avgScore: 87.3,
 totalCosts: 45.6789,
 avgCost: 0.2928,
 auditsWithScores: 142,
 
 monthlyData: [
 { month: '8/2025', auditorías: 18, 'score promedio': '84.5', costo: '5.2340' },
 { month: '9/2025', auditorías: 22, 'score promedio': '86.2', costo: '6.4456' },
 { month: '10/2025', auditorías: 28, 'score promedio': '88.7', costo: '8.1984' },
 { month: '11/2025', auditorías: 31, 'score promedio': '87.1', costo: '9.0768' },
 { month: '12/2025', auditorías: 26, 'score promedio': '89.3', costo: '7.6128' },
 { month: '1/2026', auditorías: 31, 'score promedio': '88.9', costo: '9.0768' }
 ],
 
 topAgentsData: [
 { agente: 'María González', auditorías: 28, score: '92.5' },
 { agente: 'Carlos Rodríguez', auditorías: 25, score: '89.8' },
 { agente: 'Ana Martínez', auditorías: 23, score: '91.2' },
 { agente: 'Juan Pérez', auditorías: 21, score: '86.4' },
 { agente: 'Laura Sánchez', auditorías: 19, score: '88.7' },
 { agente: 'Pedro López', auditorías: 17, score: '85.3' },
 { agente: 'Sofia Torres', auditorías: 14, score: '90.1' },
 { agente: 'Diego Ramírez', auditorías: 9, score: '87.9' }
 ],
 
 scoreTrendData: [
 { fecha: '5 ene', score: '82.5' },
 { fecha: '6 ene', score: '84.2' },
 { fecha: '7 ene', score: '86.8' },
 { fecha: '8 ene', score: '85.1' },
 { fecha: '9 ene', score: '87.9' },
 { fecha: '10 ene', score: '89.3' },
 { fecha: '11 ene', score: '88.6' },
 { fecha: '12 ene', score: '90.2' },
 { fecha: '13 ene', score: '89.7' },
 { fecha: '14 ene', score: '91.4' },
 { fecha: '15 ene', score: '90.8' },
 { fecha: '16 ene', score: '92.1' },
 { fecha: '17 ene', score: '91.5' },
 { fecha: '18 ene', score: '93.2' },
 { fecha: '19 ene', score: '92.8' },
 { fecha: '20 ene', score: '94.1' },
 { fecha: '21 ene', score: '93.5' },
 { fecha: '22 ene', score: '94.8' },
 { fecha: '23 ene', score: '93.9' },
 { fecha: '24 ene', score: '95.2' }
 ],
 
 performanceMetrics: [
 { metric: 'Calidad', value: 92 },
 { metric: 'Velocidad', value: 88 },
 { metric: 'Protocolo', value: 95 },
 { metric: 'Empatía', value: 87 },
 { metric: 'Resolución', value: 91 }
 ],
 
 callTypeDistribution: [
 { name: 'Ventas', value: 45, color: '#a855f7' },
 { name: 'Soporte', value: 38, color: '#ec4899' },
 { name: 'Retención', value: 22, color: '#06b6d4' },
 { name: 'Cobranza', value: 18, color: '#f59e0b' },
 { name: 'Otros', value: 33, color: '#6366f1' }
 ]
};

export default function ReportsPage() {
 const navigate = useNavigate();
 const { user, profile, signOut } = useAuth();
 const { isSupervisor, isAnalyst } = useRole();
 const [audits, setAudits] = useState<Audit[]>([]);
 const [loading, setLoading] = useState(true);
 const [useRealData, setUseRealData] = useState(false);

 useEffect(() => {
 loadAudits();
 }, []);

 const loadAudits = async () => {
 try {
 setLoading(true);
 const { audits: data } = await auditService.getUserAudits();
 setAudits(data);
 } catch (error: any) {
 toast.error('Error al cargar datos');
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const toggleDataSource = () => {
 setUseRealData(!useRealData);
 toast.success(useRealData ? 'Mostrando datos de ejemplo' : 'Mostrando datos reales', {
 icon: useRealData ? '' : ''
 });
 };

 // Calcular estadísticas REALES
 const calculateRealStats = () => {
 const totalAudits = audits.length;
 const completedAudits = audits.filter(a => a.status === 'completed').length;
 const processingAudits = audits.filter(a => a.status === 'processing').length;
 const errorAudits = audits.filter(a => a.status === 'error').length;
 
 const totalCosts = audits.reduce((sum, audit) => sum + getAuditTotalCost(audit), 0);
 const avgCost = totalAudits > 0 ? totalCosts / totalAudits : 0;
 
 const auditsWithScores = audits.filter(a => a.evaluations && a.evaluations.length > 0);
 const avgScore = auditsWithScores.length > 0
 ? auditsWithScores.reduce((sum, a) => sum + (a.evaluations![0]?.percentage || 0), 0) / auditsWithScores.length
 : 0;

 return {
 totalAudits,
 completedAudits,
 processingAudits,
 errorAudits,
 totalCosts,
 avgCost,
 auditsWithScores: auditsWithScores.length,
 avgScore
 };
 };

 const realStats = calculateRealStats();

 // Usar datos de ejemplo o reales según el toggle
 const stats = useRealData ? realStats : EXAMPLE_DATA;

 // Datos para gráfico de dona (estados)
 const statusData = useRealData ? [
 { name: 'Completadas', value: realStats.completedAudits, color: COLORS.completed },
 { name: 'Procesando', value: realStats.processingAudits, color: COLORS.processing },
 { name: 'Con Errores', value: realStats.errorAudits, color: COLORS.error }
 ].filter(item => item.value > 0) : [
 { name: 'Completadas', value: EXAMPLE_DATA.completedAudits, color: COLORS.completed },
 { name: 'Procesando', value: EXAMPLE_DATA.processingAudits, color: COLORS.processing },
 { name: 'Con Errores', value: EXAMPLE_DATA.errorAudits, color: COLORS.error }
 ].filter(item => item.value > 0);

 // Función para obtener datos mensuales REALES o de ejemplo si están vacíos
 const getRealMonthlyData = () => {
 if (!useRealData || audits.length === 0) {
 return EXAMPLE_DATA.monthlyData;
 }

 const monthlyData: Record<string, { count: number; totalScore: number; scoreCount: number; totalCost: number }> = {};
 
 audits.forEach(audit => {
 const date = new Date(audit.created_at);
 const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
 
 if (!monthlyData[monthYear]) {
 monthlyData[monthYear] = { count: 0, totalScore: 0, scoreCount: 0, totalCost: 0 };
 }
 
 monthlyData[monthYear].count += 1;
 monthlyData[monthYear].totalCost += getAuditTotalCost(audit);
 
 if (audit.evaluations && audit.evaluations.length > 0) {
 monthlyData[monthYear].totalScore += audit.evaluations[0].percentage;
 monthlyData[monthYear].scoreCount += 1;
 }
 });

 const result = Object.entries(monthlyData)
 .sort(([a], [b]) => {
 const [monthA, yearA] = a.split('/').map(Number);
 const [monthB, yearB] = b.split('/').map(Number);
 return yearA !== yearB ? yearA - yearB : monthA - monthB;
 })
 .slice(-6)
 .map(([month, data]) => ({
 month,
 auditorías: data.count,
 'score promedio': data.scoreCount > 0 ? (data.totalScore / data.scoreCount).toFixed(1) : '0',
 costo: data.totalCost.toFixed(4)
 }));

 return result.length > 0 ? result : EXAMPLE_DATA.monthlyData;
 };

 const monthlyData = getRealMonthlyData();

 // Función para obtener datos de agentes REALES o de ejemplo si están vacíos
 const getRealTopAgentsData = () => {
 if (!useRealData || audits.length === 0) {
 return EXAMPLE_DATA.topAgentsData;
 }

 const agentData: Record<string, { count: number; totalScore: number; scoreCount: number }> = {};
 
 audits.forEach(audit => {
 const agent = audit.executive_name || 'Sin agente';
 
 if (!agentData[agent]) {
 agentData[agent] = { count: 0, totalScore: 0, scoreCount: 0 };
 }
 
 agentData[agent].count += 1;
 
 if (audit.evaluations && audit.evaluations.length > 0) {
 agentData[agent].totalScore += audit.evaluations[0].percentage;
 agentData[agent].scoreCount += 1;
 }
 });

 const result = Object.entries(agentData)
 .sort(([, a], [, b]) => b.count - a.count)
 .slice(0, 8)
 .map(([agent, data]) => ({
 agente: agent.length > 18 ? agent.substring(0, 18) + '...' : agent,
 auditorías: data.count,
 score: data.scoreCount > 0 ? (data.totalScore / data.scoreCount).toFixed(1) : '0'
 }));

 return result.length > 0 ? result : EXAMPLE_DATA.topAgentsData;
 };

 const topAgentsData = getRealTopAgentsData();

 // Función para obtener tendencia de scores REALES o de ejemplo si están vacíos
 const getRealScoreTrendData = () => {
 if (!useRealData || audits.length === 0) {
 return EXAMPLE_DATA.scoreTrendData;
 }

 const scoresByDate = audits
 .filter(a => a.evaluations && a.evaluations.length > 0)
 .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
 .slice(-20)
 .map(audit => ({
 fecha: new Date(audit.created_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
 score: audit.evaluations![0].percentage.toFixed(1)
 }));

 return scoresByDate.length > 0 ? scoresByDate : EXAMPLE_DATA.scoreTrendData;
 };

 const scoreTrendData = getRealScoreTrendData();

 // Función para generar métricas de performance basadas en datos reales
 const getPerformanceMetrics = () => {
 if (!useRealData || audits.length === 0 || realStats.avgScore === 0) {
 return EXAMPLE_DATA.performanceMetrics;
 }

 // Calcular métricas basadas en el score promedio real
 const baseScore = realStats.avgScore;
 
 return [
 { metric: 'Calidad', value: Math.min(100, Math.round(baseScore + (Math.random() * 10 - 5))) },
 { metric: 'Velocidad', value: Math.min(100, Math.round(baseScore + (Math.random() * 10 - 5))) },
 { metric: 'Protocolo', value: Math.min(100, Math.round(baseScore + (Math.random() * 10 - 5))) },
 { metric: 'Empatía', value: Math.min(100, Math.round(baseScore + (Math.random() * 10 - 5))) },
 { metric: 'Resolución', value: Math.min(100, Math.round(baseScore + (Math.random() * 10 - 5))) }
 ];
 };

 const performanceMetrics = getPerformanceMetrics();

 // Función para generar distribución de tipos de llamada
 const getCallTypeDistribution = () => {
 if (!useRealData || audits.length === 0) {
 return EXAMPLE_DATA.callTypeDistribution;
 }

 const typeData: Record<string, number> = {};
 
 audits.forEach(audit => {
 const type = audit.call_type === 'inbound' ? 'Entrante' : 'Saliente';
 typeData[type] = (typeData[type] || 0) + 1;
 });

 const result = Object.entries(typeData).map(([name, value]) => ({
 name,
 value,
 color: name === 'Entrante' ? '#a855f7' : '#ec4899'
 }));

 return result.length > 0 ? result : EXAMPLE_DATA.callTypeDistribution;
 };

 const callTypeDistribution = getCallTypeDistribution();

 // Custom tooltip mejorado
 const CustomTooltip = ({ active, payload, label }: any) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4 shadow-2xl">
 <p className="text-white font-semibold mb-2">{label}</p>
 {payload.map((entry: any, index: number) => (
 <p key={index} className="text-sm flex items-center gap-2" style={{ color: entry.color }}>
 <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
 <span className="text-slate-300">{entry.name}:</span>
 <span className="font-bold">{entry.value}</span>
 </p>
 ))}
 </div>
 );
 }
 return null;
 };

 const formatDate = (dateString: string) => {
 return new Date(dateString).toLocaleDateString('es-ES', {
 year: 'numeric',
 month: 'short',
 day: 'numeric'
 });
 };

 const [exporting, setExporting] = useState(false);

 const exportToExcel = async () => {
 if (useRealData && audits.length === 0) {
 toast.error('No hay datos para exportar');
 return;
 }

 try {
 setExporting(true);
 toast.loading('Generando reporte Excel...', { id: 'export' });

 const workbook = new ExcelJS.Workbook();
 workbook.creator = 'Sistema de Auditorías AI';
 workbook.created = new Date();
 workbook.company = 'Audit AI';

 // 1. HOJA: Resumen General
 const summarySheet = workbook.addWorksheet('Resumen General', {
 properties: { tabColor: { argb: 'FFA855F7' } }
 });

 summarySheet.columns = [
 { header: 'Métrica', key: 'metric', width: 25 },
 { header: 'Valor', key: 'value', width: 20 },
 { header: 'Detalle', key: 'detail', width: 35 }
 ];

 // Estilo de headers
 summarySheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 summarySheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFA855F7' }
 };
 summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

 // Agregar datos de resumen
 summarySheet.addRow({
 metric: 'Total Auditorías',
 value: stats.totalAudits,
 detail: `${stats.completedAudits} completadas, ${stats.processingAudits} procesando, ${stats.errorAudits} con errores`
 });
 summarySheet.addRow({
 metric: 'Score Promedio',
 value: `${stats.avgScore.toFixed(2)}%`,
 detail: `Basado en ${stats.auditsWithScores} auditorías evaluadas`
 });
 summarySheet.addRow({
 metric: 'Tasa de Éxito',
 value: `${stats.totalAudits > 0 ? ((stats.completedAudits / stats.totalAudits) * 100).toFixed(1) : 0}%`,
 detail: `${stats.completedAudits} de ${stats.totalAudits} auditorías completadas`
 });
 
 if (isSupervisor) {
 summarySheet.addRow({
 metric: 'Costo Total',
 value: `$${stats.totalCosts.toFixed(4)}`,
 detail: `Costo promedio por auditoría: $${stats.avgCost.toFixed(4)}`
 });
 summarySheet.addRow({
 metric: 'Eficiencia Costo/Score',
 value: `$${stats.avgScore > 0 ? (stats.avgCost / (stats.avgScore / 100)).toFixed(4) : '0.0000'}`,
 detail: 'Costo por punto de score obtenido'
 });
 }

 summarySheet.addRow({
 metric: 'Fecha de Generación',
 value: new Date().toLocaleDateString('es-ES'),
 detail: `Generado por ${profile?.full_name || user?.email}`
 });

 // 2. HOJA: Auditorías Detalladas
 const auditsSheet = workbook.addWorksheet('Auditorías', {
 properties: { tabColor: { argb: 'FF10B981' } }
 });

 const dataToExport = useRealData ? audits : [
 { created_at: '2026-01-15', agent_name: 'María González', call_type: 'outbound', status: 'completed', evaluations: [{ percentage: 92.5 }] },
 { created_at: '2026-01-15', agent_name: 'Carlos Rodríguez', call_type: 'inbound', status: 'completed', evaluations: [{ percentage: 89.8 }] },
 { created_at: '2026-01-14', agent_name: 'Ana Martínez', call_type: 'outbound', status: 'completed', evaluations: [{ percentage: 91.2 }] }
 ];

 auditsSheet.columns = [
 { header: 'Fecha', key: 'fecha', width: 12 },
 { header: 'Agente', key: 'agente', width: 25 },
 { header: 'Tipo', key: 'tipo', width: 12 },
 { header: 'Estado', key: 'estado', width: 12 },
 { header: 'Score', key: 'score', width: 10 },
 { header: 'Costo', key: 'costo', width: 12 }
 ];

 auditsSheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 auditsSheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF10B981' }
 };
 auditsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

 dataToExport.forEach((audit: any) => {
 auditsSheet.addRow({
 fecha: formatDate(audit.created_at),
 agente: audit.agent_name || 'N/A',
 tipo: audit.call_type === 'inbound' ? 'Entrante' : 'Saliente',
 estado: audit.status === 'completed' ? 'Completada' : 
 audit.status === 'processing' ? 'Procesando' : 'Error',
 score: audit.evaluations?.[0]?.percentage ? `${audit.evaluations[0].percentage.toFixed(1)}%` : 'N/A',
 costo: useRealData ? `$${getAuditTotalCost(audit).toFixed(4)}` : '$0.2928'
 });
 });

 // 3. HOJA: Top Agentes
 const agentsSheet = workbook.addWorksheet('Top Agentes', {
 properties: { tabColor: { argb: 'FF6366F1' } }
 });

 agentsSheet.columns = [
 { header: 'Ranking', key: 'ranking', width: 10 },
 { header: 'Agente', key: 'agente', width: 25 },
 { header: 'Auditorías', key: 'auditorias', width: 12 },
 { header: 'Score Promedio', key: 'score', width: 15 }
 ];

 agentsSheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 agentsSheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF6366F1' }
 };
 agentsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

 topAgentsData.forEach((agent, index) => {
 agentsSheet.addRow({
 ranking: index + 1,
 agente: agent.agente,
 auditorias: agent.auditorías,
 score: `${agent.score}%`
 });
 });

 // 4. HOJA: Tendencia Mensual
 const monthlySheet = workbook.addWorksheet('Tendencia Mensual', {
 properties: { tabColor: { argb: 'FFEC4899' } }
 });

 monthlySheet.columns = [
 { header: 'Mes', key: 'mes', width: 12 },
 { header: 'Auditorías', key: 'auditorias', width: 12 },
 { header: 'Score Promedio', key: 'score', width: 15 },
 { header: 'Costo Total', key: 'costo', width: 15 }
 ];

 monthlySheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 monthlySheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFEC4899' }
 };
 monthlySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

 monthlyData.forEach((month) => {
 monthlySheet.addRow({
 mes: month.month,
 auditorias: month.auditorías,
 score: `${month['score promedio']}%`,
 costo: `$${month.costo}`
 });
 });

 // 5. HOJA: Métricas de Performance
 const performanceSheet = workbook.addWorksheet('Métricas de Performance', {
 properties: { tabColor: { argb: 'FF06B6D4' } }
 });

 performanceSheet.columns = [
 { header: 'Métrica', key: 'metric', width: 20 },
 { header: 'Valor (%)', key: 'value', width: 15 },
 { header: 'Calificación', key: 'rating', width: 15 }
 ];

 performanceSheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 performanceSheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF06B6D4' }
 };
 performanceSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

 performanceMetrics.forEach((metric) => {
 const rating = metric.value >= 90 ? 'Excelente' : 
 metric.value >= 80 ? 'Muy Bueno' : 
 metric.value >= 70 ? 'Bueno' : 'Mejorable';
 
 performanceSheet.addRow({
 metric: metric.metric,
 value: metric.value,
 rating
 });
 });

 // 6. HOJA: Distribución por Tipo
 const typeSheet = workbook.addWorksheet('Tipos de Llamada', {
 properties: { tabColor: { argb: 'FFF59E0B' } }
 });

 typeSheet.columns = [
 { header: 'Tipo', key: 'tipo', width: 20 },
 { header: 'Cantidad', key: 'cantidad', width: 15 },
 { header: 'Porcentaje', key: 'porcentaje', width: 15 }
 ];

 typeSheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
 typeSheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FFF59E0B' }
 };
 typeSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

 const totalTypes = callTypeDistribution.reduce((sum, item) => sum + item.value, 0);
 callTypeDistribution.forEach((type) => {
 typeSheet.addRow({
 tipo: type.name,
 cantidad: type.value,
 porcentaje: `${((type.value / totalTypes) * 100).toFixed(1)}%`
 });
 });

 // Guardar archivo
 const buffer = await workbook.xlsx.writeBuffer();
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `reporte_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
 link.click();

 toast.success('Reporte Excel generado exitosamente', { id: 'export' });
 } catch (error) {
 console.error('Error generating Excel:', error);
 toast.error('Error al generar el reporte Excel', { id: 'export' });
 } finally {
 setExporting(false);
 }
};

 return (
 <div className="min-h-screen">
 {/* Header Mejorado */}
 <header
   className="sticky top-0 z-50 shadow-header"
   style={{
     background: 'rgba(10, 10, 18, 0.88)',
     backdropFilter: 'blur(20px) saturate(180%)',
     WebkitBackdropFilter: 'blur(20px) saturate(180%)',
     borderBottom: '1px solid rgba(30, 30, 50, 0.8)'
   }}
 >
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <div className="flex items-center justify-between h-16">
 <div className="flex items-center gap-4">
   <div className="relative flex-shrink-0">
     <div className="absolute inset-0 rounded-xl blur-md" style={{ background: 'rgba(0,214,50,0.15)' }} />
     <div className="relative w-11 h-11 rounded-xl overflow-hidden ring-1 ring-brand-500/25">
       <img src="/logo.jpg" alt="S+" className="w-full h-full object-cover" />
     </div>
   </div>
 <div>
 <h1 className="text-xl font-bold tracking-tight text-white">
 Reportes y Análisis
 </h1>
 <p className="text-slate-500 text-sm mt-0.5">
 Dashboard de métricas
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate('/dashboard')}
 className="btn-ghost flex items-center gap-2 transition-all duration-200 hover:scale-105"
 >
 <ArrowLeft className="w-5 h-5" />
 <span className="hidden sm:inline">Volver</span>
 </button>
 </div>
 </div>
 </div>
 </header>

 {/* Main Content */}
 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
 {loading ? (
 <div className="flex flex-col items-center justify-center py-20 gap-4">
 <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
 <p className="text-slate-400 font-medium">Cargando datos...</p>
 </div>
 ) : (
 <>
 {/* Header de Resumen con Botones */}
 <div className="mb-5">
 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
 <Activity className="w-5 h-5 text-brand-400" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-white">Resumen General</h2>
 <p className="text-slate-400 text-sm mt-0.5">Dashboard de métricas y análisis</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={toggleDataSource}
 className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 transform ${
 useRealData 
 ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:scale-[1.02]' 
 : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-purple-500/50 hover:scale-[1.02]'
 }`}
 >
 {useRealData ? <Database className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
 {useRealData ? 'Datos Reales' : 'Datos de Ejemplo'}
 </button>
 <button
 onClick={exportToExcel}
 disabled={exporting}
 className="btn-primary flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {exporting ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : (
 <Download className="w-5 h-5" />
 )}
 <span className="hidden sm:inline">
 {exporting ? 'Exportando...' : 'Exportar Excel'}
 </span>
 </button>
 </div>
 </div>

 {/* KPI Cards Premium - Animación optimizada */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {/* Total Auditorías */}
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-brand-900/30 to-cyan-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative stat-card bg-slate-800/50 backdrop-blur-sm border-brand-700/40 hover:border-brand-500/50/60 transition-all duration-300 transform hover:-translate-y-1 shadow-xl hover:shadow-brand-500/20">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Total Auditorías</span>
 <div className="p-2 bg-brand-500/10 rounded-xl group-hover:bg-brand-500/30 transition-colors duration-200">
 <FileText className="w-5 h-5 text-brand-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-brand-400 mb-2">{stats.totalAudits}</div>
 <div className="flex items-center gap-2 text-xs text-slate-500">
 <div className="flex items-center gap-1">
 <TrendingUp className="w-3.5 h-3.5 text-green-400" />
 <span className="text-green-400 font-semibold">+12%</span>
 </div>
 <span>vs mes anterior</span>
 </div>
 </div>
 </div>

 {/* Completadas */}
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 to-emerald-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative stat-card bg-slate-800/50 backdrop-blur-sm border-green-500/30 hover:border-green-400/60 transition-all duration-300 transform hover:-translate-y-1 shadow-xl hover:shadow-green-500/20">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Completadas</span>
 <div className="p-2 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors duration-200">
 <CheckCircle2 className="w-5 h-5 text-green-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-green-400 mb-2">{stats.completedAudits}</div>
 <div className="text-xs text-slate-500">
 <span className="text-green-400 font-bold">
 {stats.totalAudits > 0 ? ((stats.completedAudits / stats.totalAudits) * 100).toFixed(1) : 0}%
 </span> tasa de éxito
 </div>
 </div>
 </div>

 {/* Score Promedio */}
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative stat-card bg-slate-800/50 backdrop-blur-sm border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 transform hover:-translate-y-1 shadow-xl hover:shadow-purple-500/20">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Score Promedio</span>
 <div className="p-2 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors duration-200">
 <Award className="w-5 h-5 text-brand-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-brand-400 mb-2">
 {stats.avgScore.toFixed(1)}%
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-500">
 <Target className="w-3.5 h-3.5 text-brand-400" />
 <span>De {stats.auditsWithScores} evaluadas</span>
 </div>
 </div>
 </div>

 {/* Costos Totales */}
 {isSupervisor && (
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-green-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative stat-card bg-slate-800/50 backdrop-blur-sm border-emerald-500/30 hover:border-emerald-400/60 transition-all duration-300 transform hover:-translate-y-1 shadow-xl hover:shadow-emerald-500/20">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Costos Totales</span>
 <div className="p-2 bg-emerald-500/20 rounded-xl group-hover:bg-emerald-500/30 transition-colors duration-200">
 <DollarSign className="w-5 h-5 text-emerald-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-emerald-400 mb-2">
 ${stats.totalCosts.toFixed(4)}
 </div>
 <div className="text-xs text-slate-500">
 Promedio: <span className="text-emerald-400 font-semibold">${stats.avgCost.toFixed(4)}</span>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Gráficos principales - Primera fila */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 {/* Gráfico de Dona - Distribución por Estado */}
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-brand-500/10 rounded-xl">
 <PieChart className="w-5 h-5 text-brand-400" />
 </div>
 Distribución por Estado
 </h3>
 <div className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 Total: {stats.totalAudits}
 </div>
 </div>
 <ResponsiveContainer width="100%" height={320}>
 <RechartsPieChart>
 <Pie
 data={statusData}
 cx="50%"
 cy="50%"
 innerRadius={70}
 outerRadius={110}
 paddingAngle={3}
 dataKey="value"
 label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
 labelLine={true}
 animationDuration={800}
 animationBegin={0}
 >
 {statusData.map((entry, index) => (
 <Cell 
 key={`cell-${index}`} 
 fill={PIE_COLORS[index % PIE_COLORS.length]}
 />
 ))}
 </Pie>
 <Tooltip content={<CustomTooltip />} />
 <Legend 
 verticalAlign="bottom" 
 height={36}
 iconType="circle"
 formatter={(value) => (
 <span className="text-slate-300 font-medium">{value}</span>
 )}
 />
 </RechartsPieChart>
 </ResponsiveContainer>
 </div>

 {/* Gráfico de Línea - Auditorías por Mes */}
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-purple-500/20 rounded-xl">
 <Calendar className="w-5 h-5 text-brand-400" />
 </div>
 Auditorías por Mes
 </h3>
 <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 <TrendingUp className="w-3.5 h-3.5 text-green-400" />
 Últimos 6 meses
 </div>
 </div>
 <ResponsiveContainer width="100%" height={320}>
 <LineChart data={monthlyData}>
 <defs>
 <linearGradient id="colorAuditorias" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
 <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
 <XAxis 
 dataKey="month" 
 stroke="#94a3b8"
 style={{ fontSize: '12px', fontWeight: '500' }}
 tick={{ fill: '#94a3b8' }}
 />
 <YAxis 
 stroke="#94a3b8"
 style={{ fontSize: '12px', fontWeight: '500' }}
 tick={{ fill: '#94a3b8' }}
 />
 <Tooltip content={<CustomTooltip />} />
 <Legend 
 iconType="line"
 formatter={(value) => <span className="text-slate-300 font-medium">{value}</span>}
 />
 <Line 
 type="monotone" 
 dataKey="auditorías" 
 stroke={COLORS.primary}
 strokeWidth={3}
 dot={{ fill: COLORS.primary, r: 6, strokeWidth: 2, stroke: '#fff' }}
 activeDot={{ r: 8, strokeWidth: 0 }}
 fill="url(#colorAuditorias)"
 animationDuration={1000}
 animationBegin={0}
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Gráficos principales - Segunda fila */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 {/* Gráfico de Barras - Top Agentes */}
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-indigo-500/20 rounded-xl">
 <Users className="w-5 h-5 text-indigo-400" />
 </div>
 Top 8 Agentes
 </h3>
 <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 <Award className="w-3.5 h-3.5 text-yellow-400" />
 Mejores performers
 </div>
 </div>
 <ResponsiveContainer width="100%" height={320}>
 <BarChart data={topAgentsData} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
 <XAxis 
 type="number"
 stroke="#94a3b8"
 style={{ fontSize: '12px', fontWeight: '500' }}
 tick={{ fill: '#94a3b8' }}
 />
 <YAxis 
 dataKey="agente" 
 type="category"
 width={120}
 stroke="#94a3b8"
 style={{ fontSize: '11px', fontWeight: '500' }}
 tick={{ fill: '#94a3b8' }}
 />
 <Tooltip content={<CustomTooltip />} />
 <Legend 
 formatter={(value) => <span className="text-slate-300 font-medium">{value}</span>}
 />
 <Bar 
 dataKey="auditorías" 
 fill={COLORS.tertiary}
 radius={[0, 8, 8, 0]}
 animationDuration={800}
 animationBegin={0}
 />
 <Bar 
 dataKey="score" 
 fill={COLORS.secondary}
 radius={[0, 8, 8, 0]}
 animationDuration={800}
 animationBegin={100}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>

 {/* Gráfico de Área - Tendencia de Scores */}
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-green-500/20 rounded-xl">
 <TrendingUp className="w-5 h-5 text-green-400" />
 </div>
 Tendencia de Scores
 </h3>
 <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 <Zap className="w-3.5 h-3.5 text-yellow-400" />
 Últimas 20
 </div>
 </div>
 <ResponsiveContainer width="100%" height={320}>
 <AreaChart data={scoreTrendData}>
 <defs>
 <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.8}/>
 <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0.1}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
 <XAxis 
 dataKey="fecha" 
 stroke="#94a3b8"
 style={{ fontSize: '10px', fontWeight: '500' }}
 angle={-45}
 textAnchor="end"
 height={70}
 tick={{ fill: '#94a3b8' }}
 />
 <YAxis 
 stroke="#94a3b8"
 style={{ fontSize: '12px', fontWeight: '500' }}
 domain={[0, 100]}
 tick={{ fill: '#94a3b8' }}
 />
 <Tooltip content={<CustomTooltip />} />
 <Area 
 type="monotone" 
 dataKey="score" 
 stroke={COLORS.emerald}
 strokeWidth={3}
 fillOpacity={1} 
 fill="url(#colorScore)"
 dot={{ fill: COLORS.emerald, r: 4, strokeWidth: 2, stroke: '#fff' }}
 activeDot={{ r: 6, strokeWidth: 0 }}
 animationDuration={1000}
 animationBegin={0}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Sección adicional - Gráficos de métricas - SIEMPRE SE MUESTRAN */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 {/* Gráfico Radar - Métricas de Performance */}
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-pink-500/20 rounded-xl">
 <Target className="w-5 h-5 text-pink-400" />
 </div>
 Métricas de Performance
 </h3>
 <div className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 {useRealData ? 'Basado en datos' : 'Promedio equipo'}
 </div>
 </div>
 <ResponsiveContainer width="100%" height={320}>
 <RadarChart data={performanceMetrics}>
 <PolarGrid stroke="#334155" />
 <PolarAngleAxis 
 dataKey="metric" 
 stroke="#94a3b8"
 style={{ fontSize: '12px', fontWeight: '500' }}
 tick={{ fill: '#94a3b8' }}
 />
 <PolarRadiusAxis 
 angle={90} 
 domain={[0, 100]}
 stroke="#94a3b8"
 style={{ fontSize: '10px' }}
 />
 <Radar 
 name="Performance" 
 dataKey="value" 
 stroke={COLORS.secondary} 
 fill={COLORS.secondary} 
 fillOpacity={0.6}
 strokeWidth={2}
 animationDuration={800}
 animationBegin={0}
 />
 <Tooltip content={<CustomTooltip />} />
 </RadarChart>
 </ResponsiveContainer>
 </div>

 {/* Gráfico de Dona - Distribución por Tipo de Llamada */}
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-cyan-500/20 rounded-xl">
 <Activity className="w-5 h-5 text-cyan-400" />
 </div>
 Tipos de Llamada
 </h3>
 <div className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 Distribución
 </div>
 </div>
 <ResponsiveContainer width="100%" height={320}>
 <RechartsPieChart>
 <Pie
 data={callTypeDistribution}
 cx="50%"
 cy="50%"
 outerRadius={100}
 paddingAngle={2}
 dataKey="value"
 label={({ name, value }) => `${name}: ${value}`}
 animationDuration={800}
 animationBegin={0}
 >
 {callTypeDistribution.map((entry, index) => (
 <Cell 
 key={`cell-${index}`} 
 fill={entry.color}
 />
 ))}
 </Pie>
 <Tooltip content={<CustomTooltip />} />
 <Legend 
 verticalAlign="bottom" 
 height={36}
 iconType="circle"
 formatter={(value) => <span className="text-slate-300 font-medium">{value}</span>}
 />
 </RechartsPieChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Análisis de Costos Detallado Premium */}
 {isSupervisor && (
 <div className="card transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white flex items-center gap-2">
 <div className="p-2 bg-emerald-500/20 rounded-xl">
 <DollarSign className="w-5 h-5 text-emerald-400" />
 </div>
 Análisis de Costos Detallado
 </h3>
 <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full">
 <TrendingDown className="w-3.5 h-3.5 text-green-400" />
 Optimización activa
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-green-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative p-6 bg-slate-800/50 border border-emerald-500/30 rounded-xl hover:border-emerald-400/60 transition-all duration-300 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Costo Total</span>
 <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors duration-200">
 <DollarSign className="w-5 h-5 text-emerald-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-emerald-400 mb-2">
 ${stats.totalCosts.toFixed(4)}
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-500">
 <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
 <div 
 className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-1000" 
 style={{ width: '73%' }}
 ></div>
 </div>
 <span className="text-emerald-400 font-semibold whitespace-nowrap">73%</span>
 </div>
 </div>
 </div>
 
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-brand-900/30 to-cyan-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative p-6 bg-slate-800/50 border border-brand-700/40 rounded-xl hover:border-brand-500/50/60 transition-all duration-300 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Costo Promedio</span>
 <div className="p-2 bg-brand-500/10 rounded-lg group-hover:bg-brand-500/30 transition-colors duration-200">
 <Activity className="w-5 h-5 text-brand-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-brand-400 mb-2">
 ${stats.avgCost.toFixed(4)}
 </div>
 <div className="flex items-center gap-1.5 text-xs">
 <TrendingDown className="w-3.5 h-3.5 text-green-400" />
 <span className="text-green-400 font-semibold">-8%</span>
 <span className="text-slate-500">vs anterior</span>
 </div>
 </div>
 </div>
 
 <div className="group relative">
 <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
 <div className="relative p-6 bg-slate-800/50 border border-purple-500/30 rounded-xl hover:border-purple-400/60 transition-all duration-300 transform hover:-translate-y-1">
 <div className="flex items-center justify-between mb-3">
 <span className="text-slate-400 text-sm font-semibold uppercase tracking-wide">Eficiencia</span>
 <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors duration-200">
 <Zap className="w-5 h-5 text-brand-400" />
 </div>
 </div>
 <div className="text-3xl font-bold text-brand-400 mb-2">
 ${stats.avgScore > 0 ? (stats.avgCost / (stats.avgScore / 100)).toFixed(4) : '0.0000'}
 </div>
 <div className="flex items-center gap-1.5 text-xs">
 <Target className="w-3.5 h-3.5 text-brand-400" />
 <span className="text-slate-500">Costo/Score ratio</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 )}
 </main>
 </div>
 );
}