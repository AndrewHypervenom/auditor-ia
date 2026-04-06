// frontend/src/pages/BaseInboundPage.tsx
// Reporte "Base Inbound" del sitio GPF con filtros y exportación a Excel

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  Search,
  Filter,
  X,
  CalendarRange,
  User,
  Tag,
  ChevronDown,
  Database,
  Download,
  RefreshCw,
  Phone,
  FileSpreadsheet,
  Clock,
  Loader2,
} from 'lucide-react';
import { baseInboundService, type BaseInboundRecord, type BaseInboundFilters } from '../services/api';

type Env = 'test' | 'prod';

export default function BaseInboundPage() {
  const navigate = useNavigate();

  const [env, setEnv] = useState<Env>('test');
  const [records, setRecords] = useState<BaseInboundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [telefono, setTelefono] = useState('');
  const [caso, setCaso] = useState('');
  const [calificacion, setCalificacion] = useState('');
  const [agente, setAgente] = useState('');
  const [tipoFecha, setTipoFecha] = useState<'alta' | 'edicion'>('alta');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const activeFilterCount = [telefono, caso, calificacion, agente, fechaInicio, fechaFin].filter(Boolean).length;

  const clearFilters = () => {
    setTelefono('');
    setCaso('');
    setCalificacion('');
    setAgente('');
    setFechaInicio('');
    setFechaFin('');
  };

  // ── Valores únicos para selects ──────────────────────────────────────────────
  const uniqueCalificaciones = useMemo(
    () => [...new Set(records.map((r) => String(r['Calificación'] ?? '')).filter(Boolean))].sort(),
    [records]
  );
  const uniqueAgentes = useMemo(
    () => [...new Set(records.map((r) => String(r['Agente'] ?? '')).filter(Boolean))].sort(),
    [records]
  );

  // ── Filtrado local ──────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const tel = String(r['Teléfono'] ?? r['telefono'] ?? '');
      const cas = String(r['Caso'] ?? r['caso'] ?? '');
      const cal = String(r['Calificación'] ?? '');
      const agt = String(r['Agente'] ?? '');
      const fechaField = tipoFecha === 'alta'
        ? String(r['Fecha alta'] ?? r['fecha_alta'] ?? '')
        : String(r['Fecha edición'] ?? r['fecha_edicion'] ?? '');

      if (telefono && !tel.includes(telefono)) return false;
      if (caso && !cas.toLowerCase().includes(caso.toLowerCase())) return false;
      if (calificacion && cal !== calificacion) return false;
      if (agente && cal !== agente && !agt.toLowerCase().includes(agente.toLowerCase())) return false;
      if (fechaInicio && fechaField && fechaField.slice(0, 10) < fechaInicio) return false;
      if (fechaFin && fechaField && fechaField.slice(0, 10) > fechaFin) return false;
      return true;
    });
  }, [records, telefono, caso, calificacion, agente, tipoFecha, fechaInicio, fechaFin]);

  // ── Cargar datos ─────────────────────────────────────────────────────────────
  const buildFilters = (): BaseInboundFilters => ({
    env,
    telefono: telefono || undefined,
    caso: caso || undefined,
    calificacion: calificacion || undefined,
    agente: agente || undefined,
    tipoFecha,
    fechaInicio: fechaInicio || undefined,
    fechaFin: fechaFin || undefined,
  });

  const handleLoad = async () => {
    setLoading(true);
    try {
      const result = await baseInboundService.getReport(buildFilters());
      setRecords(result.records || []);
      if ((result.records || []).length === 0) {
        toast('No se encontraron registros para los filtros indicados.', { icon: 'ℹ' });
      } else {
        toast.success(`${result.count} registros cargados`);
      }
    } catch (error: any) {
      console.error('Error loading base-inbound:', error);
      toast.error(error.response?.data?.error || 'Error al cargar Base Inbound');
    } finally {
      setLoading(false);
    }
  };

  // ── Exportar Excel ───────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      await baseInboundService.exportExcel(buildFilters());
      toast.success('Excel descargado correctamente');
    } catch (error: any) {
      console.error('Error exporting base-inbound:', error);
      toast.error(error.response?.data?.error || 'Error al exportar Excel');
    } finally {
      setExporting(false);
    }
  };

  // ── Helper display ───────────────────────────────────────────────────────────
  const cell = (r: BaseInboundRecord, ...keys: string[]) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== '') return String(v);
    }
    return '—';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                Base Inbound
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Reporte web · gpf.prevencion.algartech.com.mx</p>
            </div>
          </div>

          {/* Env toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
              {(['test', 'prod'] as Env[]).map((e) => (
                <button
                  key={e}
                  onClick={() => { setEnv(e); setRecords([]); }}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    env === e
                      ? e === 'prod' ? 'bg-red-600/80 text-white' : 'bg-blue-600/80 text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {e.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main card ─────────────────────────────────────────────────────── */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-5">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                showFilters
                  ? 'bg-slate-700 border-slate-600 text-slate-200'
                  : 'border-slate-700 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={handleLoad}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {loading ? 'Cargando...' : 'Cargar reporte'}
            </button>

            {records.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {exporting ? 'Exportando...' : 'Exportar Excel'}
              </button>
            )}

            {records.length > 0 && (
              <span className="ml-auto text-xs text-slate-500">
                {filteredRecords.length} de {records.length} registros
              </span>
            )}
          </div>

          {/* ── Panel de filtros ─────────────────────────────────────────────── */}
          {showFilters && (
            <div className="mb-5 p-4 bg-slate-800/40 border border-slate-700 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Filter className="w-3 h-3" /> Filtros
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" /> Limpiar filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                {/* Teléfono */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Teléfono
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Buscar teléfono..."
                      className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Número de caso */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Search className="w-3 h-3" /> Número de caso
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={caso}
                      onChange={(e) => setCaso(e.target.value)}
                      placeholder="Buscar caso..."
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
                      value={calificacion}
                      onChange={(e) => setCalificacion(e.target.value)}
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

                {/* Agente */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Agente
                  </label>
                  <div className="relative">
                    <select
                      value={agente}
                      onChange={(e) => setAgente(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 appearance-none focus:outline-none focus:border-blue-500 pr-8"
                    >
                      <option value="">Todos</option>
                      {uniqueAgentes.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Tipo de fecha */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <CalendarRange className="w-3 h-3" /> Tipo de fecha
                  </label>
                  <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
                    <button
                      onClick={() => setTipoFecha('alta')}
                      className={`flex-1 py-2 font-medium transition-colors ${
                        tipoFecha === 'alta' ? 'bg-blue-600/80 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Fecha alta
                    </button>
                    <button
                      onClick={() => setTipoFecha('edicion')}
                      className={`flex-1 py-2 font-medium transition-colors ${
                        tipoFecha === 'edicion' ? 'bg-blue-600/80 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Fecha edición
                    </button>
                  </div>
                </div>

                {/* Rango de fecha */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Desde</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Tabla ────────────────────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-slate-400 text-sm">Cargando reporte Base Inbound...</p>
            </div>
          )}

          {!loading && records.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aplica filtros y haz clic en <strong className="text-slate-400">Cargar reporte</strong></p>
            </div>
          )}

          {!loading && records.length > 0 && filteredRecords.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay registros que coincidan con los filtros</p>
              <button onClick={clearFilters} className="mt-2 text-sm text-blue-400 hover:text-blue-300 underline">
                Limpiar filtros
              </button>
            </div>
          )}

          {!loading && filteredRecords.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm text-slate-300 min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-3 py-3 text-left whitespace-nowrap">Teléfono</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Caso</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Estado agente</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Estado PBX</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">
                      {tipoFecha === 'alta' ? 'Fecha alta' : 'Fecha edición'}
                    </th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Calificación</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Agente</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">T. Total</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">T. Espera</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">T. Conv.</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">ACW</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-xs font-mono text-blue-300 whitespace-nowrap">
                        {cell(r, 'Teléfono', 'telefono', 'phone')}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-purple-300 whitespace-nowrap">
                        {cell(r, 'Caso', 'caso', 'case_id', 'id_caso')}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-700/60 rounded-full text-slate-300">
                          {cell(r, 'Estado agente', 'estado_agente', 'agent_status')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-700/60 rounded-full text-slate-300">
                          {cell(r, 'Estado PBX', 'estado_pbx', 'pbx_status')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                        {tipoFecha === 'alta'
                          ? cell(r, 'Fecha alta', 'fecha_alta', 'created_at')
                          : cell(r, 'Fecha edición', 'fecha_edicion', 'updated_at')}
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">
                        <span className="px-2 py-0.5 bg-slate-700 rounded-full text-slate-300">
                          {cell(r, 'Calificación', 'calificacion')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[180px] truncate" title={cell(r, 'Agente', 'agente')}>
                        {cell(r, 'Agente', 'agente', 'agent_name')}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-center font-mono text-slate-400 whitespace-nowrap">
                        <span className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 opacity-50" />
                          {cell(r, 'T. Total', 't_total', 'total_time')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-center font-mono text-amber-400/80 whitespace-nowrap">
                        {cell(r, 'T. Espera', 't_espera', 'wait_time')}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-center font-mono text-emerald-400/80 whitespace-nowrap">
                        {cell(r, 'T. Conversación', 't_conversacion', 'talk_time')}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-center font-mono text-slate-400 whitespace-nowrap">
                        {cell(r, 'ACW', 'acw', 'after_call_work')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
                {filteredRecords.length} registro{filteredRecords.length !== 1 ? 's' : ''} mostrado{filteredRecords.length !== 1 ? 's' : ''}
                {filteredRecords.length !== records.length && ` (de ${records.length} totales)`}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
