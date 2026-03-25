// frontend/src/pages/NewAuditPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProcessingStatus from '../components/ProcessingStatus';
import { auditService, gpfService } from '../services/api';
import type { GpfAttention } from '../services/api';
import { EXCEL_TYPES } from '../types';
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  Database,
  CheckCircle2
} from 'lucide-react';

type AppState = 'selecting' | 'confirming' | 'processing';

interface SSEMessage {
  type: 'info' | 'success' | 'error' | 'progress' | 'stage' | 'result';
  stage?: string;
  progress?: number;
  message: string;
  data?: any;
  timestamp: string;
}

// ── Helpers — field names match the GPF API documentation exactly ─────────────
// API returns: { id_atencion, "Agente", "Llamada en curso", "Estado llamada",
//               "Calificación", "Socio", "Caso", "Fecha de la compra", ... }

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewAuditPage() {
  const navigate = useNavigate();

  const [state, setState] = useState<AppState>('selecting');
  const [env, setEnv] = useState<'test' | 'prod'>('test');
  const [attentions, setAttentions] = useState<GpfAttention[]>([]);
  const [loadingAttentions, setLoadingAttentions] = useState(false);
  const [selectedAttention, setSelectedAttention] = useState<GpfAttention | null>(null);
  const [excelType, setExcelType] = useState<'INBOUND' | 'MONITOREO'>('INBOUND');
  const [processing, setProcessing] = useState({
    stage: 'upload' as string,
    progress: 0,
    message: 'Iniciando...'
  });

  // ── Load attentions ──────────────────────────────────────────────────────────

  const handleLoadAttentions = async () => {
    setLoadingAttentions(true);
    try {
      const result = await gpfService.getAttentions(env);
      setAttentions(result.attentions || []);
      if ((result.attentions || []).length === 0) {
        toast('No se encontraron atenciones para este ambiente.', { icon: 'ℹ️' });
      }
    } catch (error: any) {
      console.error('Error loading attentions:', error);
      toast.error(error.response?.data?.error || 'Error al cargar atenciones GPF');
    } finally {
      setLoadingAttentions(false);
    }
  };

  // ── Select attention ─────────────────────────────────────────────────────────

  const handleSelectAttention = (attention: GpfAttention) => {
    setSelectedAttention(attention);
    setState('confirming');
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

    // SSE connection
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/api/progress/${sseClientId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);

        if (message.stage && message.progress !== undefined) {
          setProcessing({
            stage: message.stage,
            progress: message.progress,
            message: message.message
          });
        }

        if (message.type === 'result') {
          if (message.data?.auditId) {
            completedAuditId = message.data.auditId;
          }

          setProcessing({ stage: 'completed', progress: 100, message: '¡Auditoría completada!' });
          eventSource.close();

          console.log(`%c🎉 GPF audit completed in ${formatTime(Date.now() - startTime)}`,
            'color: #10b981; font-weight: bold');
          console.log(message.data);

          setTimeout(() => {
            if (completedAuditId) {
              toast.success('¡Evaluación completada exitosamente!', { duration: 4000, icon: '🎉' });
              navigate(`/audit/${completedAuditId}`);
            }
          }, 1000);
        }

        if (message.type === 'error') {
          toast.error(message.message);
          eventSource.close();
          setState('confirming');
        }
      } catch {
        // ignore parse errors
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

      // Fallback navigation if SSE result event wasn't received
      if (result?.auditId && !completedAuditId) {
        completedAuditId = result.auditId;
        setTimeout(() => {
          if (completedAuditId) {
            toast.success('¡Evaluación completada exitosamente!', { duration: 4000, icon: '🎉' });
            navigate(`/audit/${completedAuditId}`);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error processing GPF audit:', error);
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
              Seleccionar Atención GPF
            </h2>

            {/* Env selector + load button */}
            <div className="flex flex-wrap items-end gap-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ambiente
                </label>
                <div className="relative">
                  <select
                    value={env}
                    onChange={(e) => {
                      setEnv(e.target.value as 'test' | 'prod');
                      setAttentions([]);
                    }}
                    className="w-40 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  >
                    <option value="test">Test</option>
                    <option value="prod">Producción</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <button
                onClick={handleLoadAttentions}
                disabled={loadingAttentions}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
              >
                {loadingAttentions ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                {loadingAttentions ? 'Cargando...' : 'Cargar Atenciones'}
              </button>
            </div>

            {/* Skeleton loader */}
            {loadingAttentions && (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-800/60 rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {/* Table */}
            {!loadingAttentions && attentions.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm text-slate-300">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Ejecutivo</th>
                      <th className="px-4 py-3 text-left">ID Atención</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentions.map((att, idx) => (
                      <tr
                        key={`${getAttentionId(att)}-${idx}`}
                        className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getAttentionDate(att) || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {getAttentionExecutive(att) || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-400">
                          {String(getAttentionId(att)) || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {getAttentionCallType(att) || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {getAttentionClient(att) || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleSelectAttention(att)}
                            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty state */}
            {!loadingAttentions && attentions.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Carga las atenciones para comenzar</p>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIRMING STATE ──────────────────────────────────────────────── */}
        {state === 'confirming' && selectedAttention && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-8 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Confirmar Auditoría
            </h2>

            {/* Attention details */}
            <div className="space-y-3 mb-8 p-5 bg-slate-800/40 rounded-xl border border-slate-700">
              {[
                ['ID Atención', String(getAttentionId(selectedAttention))],
                ['Ejecutivo', getAttentionExecutive(selectedAttention)],
                ['Tipo de Llamada', getAttentionCallType(selectedAttention)],
                ['Cliente', getAttentionClient(selectedAttention)],
                ['Fecha', getAttentionDate(selectedAttention)],
                ['Ambiente', env.toUpperCase()]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{label}</span>
                  <span className="text-slate-200 font-medium text-sm">{value || '—'}</span>
                </div>
              ))}
            </div>

            {/* Excel type selector */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo de Reporte
              </label>
              <div className="relative">
                <select
                  value={excelType}
                  onChange={(e) => setExcelType(e.target.value as 'INBOUND' | 'MONITOREO')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 appearance-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                >
                  {EXCEL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
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
