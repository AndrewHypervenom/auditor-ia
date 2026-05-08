// frontend/src/pages/BatchPage.tsx
// Cola Nocturna — procesamiento por lotes con 50% de descuento (OpenAI Batch API)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../contexts/AuthContext';
import { batchService, type BatchJob } from '../services/api';
import toast from 'react-hot-toast';
import {
  Moon,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  Eye,
  Calendar,
  BarChart3,
  Info,
  Cpu,
  HardDrive,
  Hash,
  Timer,
} from 'lucide-react';
import { BATCH_LIMITS_CLIENT } from '../services/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<BatchJob['status'], { label: string; color: string; icon: any }> = {
  pending:    { label: 'En cola',     color: 'text-amber-400',  icon: Clock },
  assembling: { label: 'Preparando',  color: 'text-blue-400',   icon: Loader2 },
  submitted:  { label: 'Procesando',  color: 'text-blue-400',   icon: Loader2 },
  completed:  { label: 'Completado',  color: 'text-brand-400',  icon: CheckCircle2 },
  failed:     { label: 'Fallido',     color: 'text-red-400',    icon: XCircle },
  cancelled:  { label: 'Cancelado',   color: 'text-slate-400',  icon: XCircle },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function progressPct(job: BatchJob): number {
  if (!job.item_count) return 0;
  return Math.round(((job.completed_count + job.failed_count) / job.item_count) * 100);
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent = false }: {
  icon: any; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 border flex flex-col gap-1 ${
      accent
        ? 'bg-brand-500/10 border-brand-500/30'
        : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs">
        <Icon className={`w-3.5 h-3.5 ${accent ? 'text-brand-400' : 'text-slate-400'}`} />
        {label}
      </div>
      <span className={`text-2xl font-bold ${accent ? 'text-brand-300' : 'text-white'}`}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

function BatchJobCard({ job, onRefresh }: { job: BatchJob; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<'submit' | 'check' | 'delete' | null>(null);
  const meta = STATUS_META[job.status] ?? STATUS_META.pending;
  const StatusIcon = meta.icon;
  const pct = progressPct(job);
  const isActive = job.status === 'pending' || job.status === 'assembling' || job.status === 'submitted';

  const handleSubmit = async () => {
    setLoading('submit');
    try {
      await batchService.submitJob(job.id);
      toast.success('Lote enviado a OpenAI Batch API. Procesará en las próximas horas.');
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al enviar el lote');
    } finally {
      setLoading(null);
    }
  };

  const handleCheck = async () => {
    setLoading('check');
    try {
      const result = await batchService.checkJob(job.id);
      toast.success(result.message);
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al verificar el lote');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el lote "${job.name}"? Esta acción no se puede deshacer.`)) return;
    setLoading('delete');
    try {
      await batchService.deleteJob(job.id);
      toast.success('Lote eliminado');
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al eliminar el lote');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      job.status === 'completed'
        ? 'bg-brand-500/5 border-brand-500/20'
        : job.status === 'failed'
        ? 'bg-red-500/5 border-red-500/20'
        : 'bg-slate-800/50 border-slate-700/50'
    }`}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          job.status === 'completed' ? 'bg-brand-500/20' :
          job.status === 'failed' ? 'bg-red-500/20' :
          isActive ? 'bg-blue-500/20' : 'bg-slate-700'
        }`}>
          <StatusIcon className={`w-4 h-4 ${meta.color} ${
            (job.status === 'assembling' || job.status === 'submitted') ? 'animate-spin' : ''
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm truncate">{job.name}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              job.status === 'completed' ? 'text-brand-400 border-brand-500/30 bg-brand-500/10' :
              job.status === 'failed' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
              isActive ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
              'text-slate-400 border-slate-600 bg-slate-700/50'
            }`}>
              {meta.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {job.item_count} casos
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Programado: {fmtDate(job.scheduled_for)}
            </span>
            {job.submitted_at && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-400" />
                Enviado: {fmtDate(job.submitted_at)}
              </span>
            )}
            {job.completed_at && (
              <span className="flex items-center gap-1 text-brand-400">
                <CheckCircle2 className="w-3 h-3" />
                {fmtDate(job.completed_at)}
              </span>
            )}
          </div>
        </div>

        {/* Item count badge */}
        <div className="flex-shrink-0 text-right hidden sm:block">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Casos</div>
          <div className="text-white font-bold text-sm">{job.item_count}</div>
          <div className="text-[10px] text-slate-500">en lote</div>
        </div>
      </div>

      {/* Progress bar */}
      {(isActive || job.status === 'completed') && job.item_count > 0 && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>{job.completed_count}/{job.item_count} completados</span>
            {job.failed_count > 0 && (
              <span className="text-red-400">{job.failed_count} fallidos</span>
            )}
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: job.status === 'completed'
                  ? 'linear-gradient(90deg, #00d632, #00ff3c)'
                  : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
              }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {job.error_message && (
        <div className="mx-4 mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {job.error_message}
        </div>
      )}

      {/* Expanded items */}
      {expanded && job.batch_items && job.batch_items.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-slate-700/50 pt-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Casos en este lote</div>
          {job.batch_items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-700/30 border border-slate-700/40"
            >
              {item.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
              ) : item.status === 'failed' ? (
                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              ) : item.status === 'processing' ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">
                  {item.executive_name ?? `Atención ${item.gpf_attention_id}`}
                </div>
                <div className="text-[10px] text-slate-500">
                  {item.call_type ?? '—'} · {item.call_date ?? '—'}
                </div>
                {item.error_message && (
                  <div className="text-[10px] text-red-400 mt-0.5 truncate">{item.error_message}</div>
                )}
              </div>
              {item.audit_id && (
                <button
                  onClick={() => navigate(`/audit/${item.audit_id}`)}
                  className="btn-ghost p-1.5 rounded-lg"
                  title="Ver auditoría"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        {/* Expand/collapse */}
        {job.batch_items && job.batch_items.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="btn-ghost text-xs flex items-center gap-1 py-1.5 px-3"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Ocultar casos' : 'Ver casos'}
          </button>
        )}

        <div className="flex-1" />

        {/* Submit (pending only) */}
        {job.status === 'pending' && (
          <button
            onClick={handleSubmit}
            disabled={loading !== null}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            {loading === 'submit' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Enviar ahora
          </button>
        )}

        {/* Check (submitted) */}
        {job.status === 'submitted' && (
          <button
            onClick={handleCheck}
            disabled={loading !== null}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            {loading === 'check' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Verificar estado
          </button>
        )}

        {/* Delete */}
        {(job.status === 'pending' || job.status === 'failed' || job.status === 'completed' || job.status === 'cancelled') && (
          <button
            onClick={handleDelete}
            disabled={loading !== null}
            className="btn-ghost text-xs flex items-center gap-1 text-red-400 hover:text-red-300 py-1.5 px-2"
          >
            {loading === 'delete' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BatchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await batchService.getJobs();
      setJobs(data);
    } catch {
      toast.error('Error al cargar los lotes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'assembling' || j.status === 'submitted');
  const historyJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  const totalItemsQueued = activeJobs.reduce((s, j) => s + j.item_count, 0);
  const totalCompleted = historyJobs
    .filter(j => j.status === 'completed')
    .reduce((s, j) => s + j.completed_count, 0);
  const totalFailed = historyJobs
    .filter(j => j.status === 'completed')
    .reduce((s, j) => s + j.failed_count, 0);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader
        showBack
        onBack={() => navigate('/dashboard')}
        title="Cola Nocturna"
        subtitle="Procesamiento nocturno por lotes"
        rightContent={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-ghost p-2 rounded-xl"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Hero banner */}
        <div
          className="rounded-2xl p-5 border relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,214,50,0.08) 0%, rgba(0,80,160,0.10) 100%)',
            borderColor: 'rgba(0,214,50,0.20)',
          }}
        >
          <div className="absolute -right-4 -top-4 w-28 h-28 opacity-5">
            <Moon className="w-full h-full" />
          </div>
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <Moon className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Procesa casos en lote durante la noche</h2>
              <p className="text-slate-400 text-sm mt-0.5 leading-relaxed">
                Selecciona casos GPF en "Nueva Auditoría" → agrega a la cola nocturna →
                el sistema los procesa en lote y entrega los resultados listos al día siguiente.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Package}
            label="En cola"
            value={String(totalItemsQueued)}
            sub={`${activeJobs.length} lote${activeJobs.length !== 1 ? 's' : ''} activo${activeJobs.length !== 1 ? 's' : ''}`}
          />
          <StatCard
            icon={BarChart3}
            label="Procesados"
            value={String(totalCompleted)}
            sub={totalFailed > 0 ? `${totalFailed} fallidos` : 'casos totales'}
            accent={totalCompleted > 0}
          />
        </div>

        {/* CTA — add cases */}
        <button
          onClick={() => navigate('/audit/new')}
          className="w-full rounded-2xl border border-dashed border-brand-500/40 bg-brand-500/5 hover:bg-brand-500/10 transition-colors py-4 px-5 flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/30 transition-colors">
            <Moon className="w-4.5 h-4.5 text-brand-400" />
          </div>
          <div className="flex-1">
            <div className="text-white text-sm font-medium">Agregar casos a la cola</div>
            <div className="text-slate-500 text-xs">
              Ir a Nueva Auditoría → seleccionar casos GPF → "Agregar a cola nocturna"
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 -rotate-90 group-hover:text-brand-400 transition-colors" />
        </button>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-800/60 rounded-2xl border border-slate-700/50">
          {(['active', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                tab === t
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'active' ? `En proceso (${activeJobs.length})` : `Historial (${historyJobs.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
            <span className="text-slate-400 text-sm">Cargando lotes...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {tab === 'active' && (
              activeJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Moon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No hay lotes activos</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Agrega casos desde "Nueva Auditoría"
                  </p>
                </div>
              ) : (
                activeJobs.map(job => (
                  <BatchJobCard key={job.id} job={job} onRefresh={() => load(true)} />
                ))
              )
            )}

            {tab === 'history' && (
              historyJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Sin historial de lotes</p>
                </div>
              ) : (
                historyJobs.map(job => (
                  <BatchJobCard key={job.id} job={job} onRefresh={() => load(true)} />
                ))
              )
            )}
          </div>
        )}

        {/* Model & Limits Panel */}
        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Modelo y límites del lote</span>
          </div>

          {/* Model badge */}
          <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="text-white text-sm font-semibold">{BATCH_LIMITS_CLIENT.MODEL}</div>
              <div className="text-[11px] text-slate-500">
                Contexto: {(BATCH_LIMITS_CLIENT.CONTEXT_WINDOW_TOKENS / 1000).toFixed(0)}K tokens
                · Max output: {(BATCH_LIMITS_CLIENT.MAX_OUTPUT_TOKENS / 1000).toFixed(0)}K tokens
              </div>
            </div>
          </div>

          {/* Limits grid */}
          <div className="grid grid-cols-3 divide-x divide-slate-700/30">
            <div className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] mb-1">
                <HardDrive className="w-3 h-3" />
                Tamaño máx.
              </div>
              <div className="text-white font-bold text-sm">{BATCH_LIMITS_CLIENT.MAX_FILE_SIZE_MB} MB</div>
              <div className="text-[10px] text-slate-600">por lote</div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] mb-1">
                <Package className="w-3 h-3" />
                Recomendado
              </div>
              <div className="text-brand-300 font-bold text-sm">{BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES} casos</div>
              <div className="text-[10px] text-slate-600">~{(BATCH_LIMITS_CLIENT.RECOMMENDED_MAX_CASES * BATCH_LIMITS_CLIENT.ESTIMATED_MB_PER_CASE).toFixed(0)} MB</div>
            </div>
            <div className="px-3 py-3 text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] mb-1">
                <Hash className="w-3 h-3" />
                Máximo abs.
              </div>
              <div className="text-amber-300 font-bold text-sm">{BATCH_LIMITS_CLIENT.HARD_MAX_CASES} casos</div>
              <div className="text-[10px] text-slate-600">~{(BATCH_LIMITS_CLIENT.HARD_MAX_CASES * BATCH_LIMITS_CLIENT.ESTIMATED_MB_PER_CASE).toFixed(0)} MB</div>
            </div>
          </div>

          {/* Explanation */}
          <div className="px-4 py-3 border-t border-slate-700/30 space-y-1.5 text-[11px] text-slate-500">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>El límite real depende del tamaño de las imágenes. Estimado: ~{BATCH_LIMITS_CLIENT.ESTIMATED_MB_PER_CASE} MB/caso ({BATCH_LIMITS_CLIENT.AVG_IMAGES_PER_CASE} imgs × 400 KB base64).</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Timer className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>Las imágenes y audios GPF expiran en ~5 min. El sistema se re-autentica automáticamente en el momento del envío — no guardes URLs, solo los IDs.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Zap className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
              <span>OpenAI procesa en hasta 24 h. Los resultados aparecen en "Historial" una vez completados.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
