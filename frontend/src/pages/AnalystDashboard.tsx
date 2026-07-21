// frontend/src/pages/AnalystDashboard.tsx

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { auditService, type Audit } from '../services/api';
import {
  FileText, Plus, Download, Clock, CheckCircle2, AlertCircle,
  AlertTriangle, Loader2, TrendingUp, Eye, BarChart3, PhoneIncoming,
  Monitor, Moon, Search, RefreshCw, LogOut, BookOpen,
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import DateRangeFilter from '../components/DateRangeFilter';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { fadeUp, staggerParent, springSoft, CountUp } from '../lib/motion';

const isBatchAudit = (audit: Audit) => audit.audio_filename === 'gpf-batch';

function scoreColor(pct: number) {
  if (pct >= 90) return { text: 'text-green-400', bar: 'bg-green-500', bg: 'bg-green-500/10 border-green-500/30' };
  if (pct >= 75) return { text: 'text-brand-400', bar: 'bg-brand-500', bg: 'bg-brand-500/10 border-brand-500/30' };
  if (pct >= 60) return { text: 'text-amber-400', bar: 'bg-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
  return { text: 'text-red-400', bar: 'bg-red-500', bg: 'bg-red-500/10 border-red-500/30' };
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
}

// yyyy-mm-dd en hora local (coincide con el valor de <input type="date">)
function localDateStr(s: string) {
  try { return new Date(s).toLocaleDateString('en-CA'); } catch { return ''; }
}

type ScoreFilter = 'all' | 'excellent' | 'good' | 'regular' | 'low';

function matchesScore(pct: number | undefined, sf: ScoreFilter) {
  if (sf === 'all') return true;
  if (pct === undefined) return false;
  if (sf === 'excellent') return pct >= 90;
  if (sf === 'good') return pct >= 75 && pct < 90;
  if (sf === 'regular') return pct >= 60 && pct < 75;
  return pct < 60;
}

function StatCard({ label, value, sub, icon: Icon, accent = false, suffix }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean; suffix?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={springSoft}
      className={`rounded-2xl border p-4 flex items-center gap-4 ${
        accent ? 'bg-brand-500/8 border-brand-500/25' : 'bg-slate-800/60 border-slate-700/50'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        accent ? 'bg-brand-500/20' : 'bg-slate-700/60'
      }`}>
        <Icon className={`w-5 h-5 ${accent ? 'text-brand-400' : 'text-slate-400'}`} />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className={`text-2xl font-bold leading-tight tabular-nums ${accent ? 'text-brand-300' : 'text-white'}`}>
          {typeof value === 'number'
            ? <CountUp value={value} suffix={suffix} />
            : value}
        </div>
        {sub && <div className="text-[11px] text-slate-600">{sub}</div>}
      </div>
    </motion.div>
  );
}

function AuditCard({ audit, onView, onDownload }: {
  audit: Audit;
  onView: () => void;
  onDownload: (filename: string) => void;
}) {
  const { t } = useTranslation();
  const evals = Array.isArray(audit.evaluations) ? audit.evaluations : [];
  const score = evals[0];
  const colors = score ? scoreColor(score.percentage) : null;
  const batch = isBatchAudit(audit);
  const hasRealCriteria = Array.isArray(score?.detailed_scores) && score.detailed_scores.length > 0;
  const emptyEval = batch && audit.status === 'completed' && (!score || !hasRealCriteria);
  const isMonitoreo = (audit.call_type || '').toUpperCase() === 'MONITOREO';

  return (
    <motion.div
      layout
      variants={fadeUp}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      whileHover={{ y: -2 }}
      transition={springSoft}
      className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-lg group ${
      audit.status === 'error'
        ? 'bg-red-500/5 border-red-500/20'
        : batch
        ? 'bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/35'
        : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/60'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {batch && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                <Moon className="w-2.5 h-2.5" />
                {t('analyst.badgeNight')}
              </span>
            )}
            {emptyEval && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <AlertTriangle className="w-2.5 h-2.5" />
                {t('analyst.badgeNoEval')}
              </span>
            )}
            {isMonitoreo ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                <Monitor className="w-2.5 h-2.5" />
                {t('analyst.badgeMonitoreo')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <PhoneIncoming className="w-2.5 h-2.5" />
                {t('analyst.badgeInbound')}
              </span>
            )}
          </div>
          <div className="flex-shrink-0">
            {audit.status === 'completed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
                <CheckCircle2 className="w-3 h-3" />{t('analyst.statusCompleted')}
              </span>
            ) : audit.status === 'processing' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />{t('analyst.statusProcessing')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400">
                <AlertCircle className="w-3 h-3" />{t('analyst.statusError')}
              </span>
            )}
          </div>
        </div>

        <div className="cursor-pointer" onClick={onView}>
          <h3 className="text-white font-semibold text-sm leading-snug group-hover:text-brand-300 transition-colors">
            {audit.executive_name}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
            <span>Caso {audit.gpf_data?.attentionFields?.['Caso'] ?? audit.executive_id}</span>
            {audit.client_id && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/25 text-brand-300 font-semibold">
                {t('analyst.partner')} {audit.client_id}
              </span>
            )}
            <span className="text-slate-700">·</span>
            <span>{fmtDate(audit.created_at)}</span>
            {audit.created_by_name && (
              <><span className="text-slate-700">·</span>
              <span className="text-slate-500">{audit.created_by_name}</span></>
            )}
          </div>
        </div>

        {score && colors && (
          <div className="mt-3 pt-3 border-t border-slate-700/40">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-3.5 h-3.5 ${colors.text}`} />
                <span className={`text-base font-bold tabular-nums ${colors.text}`}>
                  {score.percentage.toFixed(1)}%
                </span>
                <span className="text-[11px] text-slate-600">
                  {score.total_score}/{score.max_possible_score} pts
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={(e) => { e.stopPropagation(); onView(); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all"
                  title={t('analyst.viewAudit')}>
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {score.excel_filename && (
                  <button onClick={(e) => { e.stopPropagation(); onDownload(score.excel_filename); }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-all"
                    title={t('analyst.downloadExcel')}>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                style={{ width: `${Math.min(score.percentage, 100)}%` }} />
            </div>
          </div>
        )}

        {emptyEval && (
          <div className="mt-3 pt-3 border-t border-amber-500/20">
            <div className="flex items-start gap-2 text-[11px] text-amber-400/80 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{t('analyst.badgeNoEval')}</span>
            </div>
            <div className="flex justify-end">
              <button onClick={(e) => { e.stopPropagation(); onView(); }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all"
                title={t('analyst.viewAudit')}>
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {!score && !emptyEval && audit.status !== 'processing' && (
          <div className="mt-3 pt-3 border-t border-slate-700/40 flex justify-end">
            <button onClick={(e) => { e.stopPropagation(); onView(); }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all"
              title={t('analyst.viewAudit')}>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

type Filter = 'all' | 'normal' | 'batch';

export default function AnalystDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dateFrom, setDateFrom] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => { loadAudits(); }, []);

  const loadAudits = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const response = await auditService.getUserAudits();
      setAudits(Array.isArray(response?.audits) ? response.audits : []);
    } catch {
      toast.error(t('analyst.loadError'));
      setAudits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDownloadExcel = async (filename: string) => {
    try {
      toast.loading(t('analyst.downloadingExcel'), { id: 'dl' });
      const blob = await auditService.downloadExcel(filename);
      const url = window.URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success(t('analyst.excelDownloaded'), { id: 'dl' });
    } catch {
      toast.error(t('analyst.excelError'), { id: 'dl' });
    }
  };

  const completed = audits.filter(a => a?.status === 'completed');
  const batchAudits = audits.filter(a => a && isBatchAudit(a));

  const avgScore = useMemo(() => {
    const withScore = completed.filter(a => {
      const e = Array.isArray(a.evaluations) ? a.evaluations : [];
      return e.length > 0;
    });
    if (!withScore.length) return 0;
    const sum = withScore.reduce((s, a) => {
      const e = Array.isArray(a.evaluations) ? a.evaluations : [];
      return s + (e[0]?.percentage ?? 0);
    }, 0);
    return Math.round(sum / withScore.length);
  }, [completed]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    audits.forEach(a => { if (a?.call_type) set.add(a.call_type); });
    return [...set].sort();
  }, [audits]);

  const filtered = useMemo(() => {
    let list = audits.filter(Boolean);
    if (filter === 'batch') list = list.filter(isBatchAudit);
    if (filter === 'normal') list = list.filter(a => !isBatchAudit(a));
    if (dateFrom) list = list.filter(a => localDateStr(a.created_at) >= dateFrom);
    if (dateTo) list = list.filter(a => localDateStr(a.created_at) <= dateTo);
    if (categoryFilter !== 'all') list = list.filter(a => a.call_type === categoryFilter);
    if (scoreFilter !== 'all') {
      list = list.filter(a => {
        const e = Array.isArray(a.evaluations) ? a.evaluations : [];
        return matchesScore(e[0]?.percentage, scoreFilter);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.executive_name?.toLowerCase().includes(q) ||
        a.executive_id?.toLowerCase().includes(q) ||
        a.client_id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [audits, filter, search, dateFrom, dateTo, scoreFilter, categoryFilter]);

  const filterLabel = (f: Filter) => {
    if (f === 'all') return t('analyst.filterAll');
    if (f === 'normal') return t('analyst.filterNormal');
    return t('analyst.filterBatch');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader
        title={t('analyst.pageTitle')}
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/batch')}
              className="btn-ghost flex items-center gap-1.5 text-xs py-1 px-3 text-indigo-300 border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20"
            >
              <Moon className="w-3.5 h-3.5" />
              {t('analyst.batchQueue')}
            </button>
            <button onClick={() => loadAudits(true)} disabled={refreshing}
              className="btn-ghost p-2 rounded-xl" title={t('analyst.refresh')}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={async () => { await signOut(); navigate('/login'); }}
              className="btn-ghost p-2 rounded-xl text-slate-400" title={t('analyst.logout')}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <motion.div className="grid grid-cols-3 gap-3" variants={staggerParent} initial="hidden" animate="show">
          <StatCard icon={FileText} label={t('analyst.statsTotal')} value={audits.length} sub={t('analyst.statAudits')} />
          <StatCard icon={CheckCircle2} label={t('analyst.statsCompleted')} value={completed.length}
            sub={`${batchAudits.length} ${t('analyst.statBatch')}`} />
          <StatCard icon={TrendingUp} label={t('analyst.statsAvg')} value={avgScore} suffix="%"
            sub={t('analyst.statScore')} accent={avgScore >= 75} />
        </motion.div>

        <motion.div className="grid grid-cols-3 gap-3" variants={staggerParent} initial="hidden" animate="show">
          <motion.button onClick={() => navigate('/audit/new')}
            variants={fadeUp} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={springSoft}
            className="rounded-2xl border border-brand-500/30 bg-brand-500/8 hover:bg-brand-500/15 transition-colors p-4 text-left group">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center mb-3 group-hover:bg-brand-500/30 transition-colors">
              <Plus className="w-5 h-5 text-brand-400" />
            </div>
            <div className="text-white font-semibold text-sm">{t('analyst.newAudit')}</div>
            <div className="text-slate-500 text-xs mt-0.5">{t('analyst.processNow')}</div>
          </motion.button>

          <motion.button onClick={() => navigate('/reports')}
            variants={fadeUp} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={springSoft}
            className="rounded-2xl border border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/70 transition-colors p-4 text-left group">
            <div className="w-9 h-9 rounded-xl bg-slate-700/60 flex items-center justify-center mb-3 group-hover:bg-slate-700 transition-colors">
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-white font-semibold text-sm">{t('nav.reports')}</div>
            <div className="text-slate-500 text-xs mt-0.5">{t('reports.export')}</div>
          </motion.button>

          <motion.button onClick={() => navigate('/scripts-admin')}
            variants={fadeUp} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={springSoft}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 transition-colors p-4 text-left group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/30 transition-colors">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-white font-semibold text-sm">{t('scripts.title')}</div>
            <div className="text-slate-500 text-xs mt-0.5">{t('analyst.criteriaScripts') ?? 'Guiones y rúbricas'}</div>
          </motion.button>
        </motion.div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder={t('analyst.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-600"
              />
            </div>
            <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50 flex-shrink-0">
              {(['all', 'normal', 'batch'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                    filter === f ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  {f === 'batch' && <Moon className="w-3 h-3 text-indigo-400" />}
                  {filterLabel(f)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <DateRangeFilter
              from={dateFrom} to={dateTo}
              onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-brand-600 min-w-[160px]"
            />
            <div className="relative">
              <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <select
                value={scoreFilter}
                onChange={e => setScoreFilter(e.target.value as ScoreFilter)}
                className="pl-9 pr-8 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-brand-600 appearance-none"
                title={t('analyst.filterScore')}
              >
                <option value="all">{t('analyst.scoreAll')}</option>
                <option value="excellent">{t('analyst.scoreExcellent')}</option>
                <option value="good">{t('analyst.scoreGood')}</option>
                <option value="regular">{t('analyst.scoreRegular')}</option>
                <option value="low">{t('analyst.scoreLow')}</option>
              </select>
            </div>
            <div className="relative">
              <PhoneIncoming className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-brand-600 appearance-none"
                title={t('analyst.filterCategory')}
              >
                <option value="all">{t('analyst.categoryAll')}</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {(dateFrom || dateTo || scoreFilter !== 'all' || categoryFilter !== 'all') && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setScoreFilter('all'); setCategoryFilter('all'); }}
                className="text-xs text-brand-400 hover:text-brand-300">
                {t('analyst.clearFilters')}
              </button>
            )}
          </div>

          {!loading && (
            <div className="text-xs text-slate-600 px-0.5">
              {filtered.length} {filtered.length === 1 ? t('analyst.resultSingular') : t('analyst.resultPlural')}
              {filter !== 'all' || search ? ` · ${audits.length} total` : ''}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 text-brand-400 animate-spin" />
              <span className="text-slate-500 text-sm">{t('analyst.loading')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              {audits.length === 0 ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-7 h-7 text-slate-600" />
                  </div>
                  <p className="text-slate-400 font-medium">{t('analyst.noAudits')}</p>
                  <p className="text-slate-600 text-sm mt-1">{t('analyst.noAuditsHint')}</p>
                  <button onClick={() => navigate('/audit/new')}
                    className="mt-4 btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
                    <Plus className="w-4 h-4" />
                    {t('analyst.newAudit')}
                  </button>
                </>
              ) : (
                <>
                  <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">{search ? t('analyst.noResults', { search }) : t('analyst.noResultsFilters')}</p>
                  <button onClick={() => { setSearch(''); setFilter('all'); setDateFrom(''); setDateTo(''); setScoreFilter('all'); setCategoryFilter('all'); }}
                    className="mt-2 text-xs text-brand-400 hover:text-brand-300">
                    {t('analyst.clearFilters')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <motion.div className="space-y-2.5" variants={staggerParent} initial="hidden" animate="show">
              <AnimatePresence mode="popLayout">
                {filtered.map(audit => (
                  <AuditCard key={audit.id} audit={audit}
                    onView={() => navigate(`/audit/${audit.id}`)}
                    onDownload={handleDownloadExcel} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
