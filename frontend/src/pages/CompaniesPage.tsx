// frontend/src/pages/CompaniesPage.tsx
// Gestión de empresas — solo accesible para admin (plataforma)

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Plus, Building2, Users, DollarSign, Settings, ChevronDown, ChevronUp, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../contexts/AuthContext';
import { companyService } from '../services/api';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  integration_type: string;
  integration_config: Record<string, unknown>;
  role_permissions: Record<string, unknown>;
  usage_limits: Record<string, unknown>;
  created_at: string;
  usage_this_month?: {
    total_audits: number;
    total_cost: number;
    total_tokens: number;
  };
}

interface CompanyFormData {
  name: string;
  slug: string;
  integration_type: string;
}

const INTEGRATION_TYPES = ['manual', 'gpf', 'api_webhook', 'csv'] as const;

export default function CompaniesPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyFormData>({ name: '', slug: '', integration_type: 'manual' });
  const [saving, setSaving] = useState(false);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await companyService.getAll();
      setCompanies(data);
    } catch {
      toast.error(t('companies.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error(t('companies.nameIdRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await companyService.update(editingId, form as unknown as Record<string, unknown>);
        toast.success(t('companies.updateSuccess'));
      } else {
        await companyService.create(form);
        toast.success(t('companies.createSuccess'));
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', slug: '', integration_type: 'manual' });
      await loadCompanies();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('companies.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (company: Company) => {
    try {
      await companyService.update(company.id, { is_active: !company.is_active });
      toast.success(company.is_active ? t('companies.deactivated') : t('companies.activated'));
      await loadCompanies();
    } catch {
      toast.error(t('companies.statusUpdateError'));
    }
  };

  const handleEditClick = (company: Company) => {
    setForm({ name: company.name, slug: company.slug, integration_type: company.integration_type });
    setEditingId(company.id);
    setShowForm(true);
  };

  const handleSaveLimits = async (companyId: string, limits: Record<string, unknown>) => {
    try {
      await companyService.setLimits(companyId, limits);
      toast.success(t('companies.limitsUpdated'));
      await loadCompanies();
    } catch {
      toast.error(t('companies.limitsUpdateError'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500/50 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <AppHeader title={t('companies.title')} />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Header actions */}
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{companies.length} empresa(s) registrada(s)</p>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', slug: '', integration_type: 'manual' }); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-black font-medium rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('companies.newCompany')}
          </button>
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="bg-slate-800/60 backdrop-blur-lg rounded-xl border border-slate-700/50 p-5">
            <h3 className="text-white font-semibold mb-4">
              {editingId ? t('companies.editCompany') : t('companies.newCompany')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('companies.name')} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  placeholder={t('companies.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('companies.slug')} *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                  placeholder="empresa-abc"
                />
                <p className="text-xs text-slate-500 mt-1">{t('companies.slugHint')}</p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('integration.type')}</label>
                <select
                  value={form.integration_type}
                  onChange={e => setForm(f => ({ ...f, integration_type: e.target.value }))}
                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  {INTEGRATION_TYPES.map(type => (
                    <option key={type} value={type}>{t(`integration.types.${type}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Companies List */}
        {companies.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t('companies.noCompanies')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(company => (
              <div
                key={company.id}
                className={`bg-slate-800/60 backdrop-blur-lg rounded-xl border transition-colors ${
                  company.is_active ? 'border-slate-700/50' : 'border-slate-700/20 opacity-60'
                }`}
              >
                {/* Company row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-brand-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{company.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{company.slug}</span>
                      {!company.is_active && (
                        <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">{t('companies.inactive')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-400">{t(`integration.types.${company.integration_type}`)}</span>
                      {company.usage_this_month && (
                        <>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${company.usage_this_month.total_cost?.toFixed(2) ?? '0.00'}
                          </span>
                          <span className="text-xs text-slate-400">{company.usage_this_month.total_audits} auditorías</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditClick(company)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(company)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title={company.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {company.is_active
                        ? <ToggleRight className="w-4 h-4 text-brand-400" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {expandedId === company.id
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* Expanded: límites de uso */}
                {expandedId === company.id && (
                  <div className="border-t border-slate-700/50 p-4">
                    <UsageLimitsEditor
                      company={company}
                      onSave={limits => handleSaveLimits(company.id, limits)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componente: editor de límites de uso ─────────────────────────────

interface UsageLimitsEditorProps {
  company: Company;
  onSave: (limits: Record<string, unknown>) => Promise<void>;
}

function UsageLimitsEditor({ company, onSave }: UsageLimitsEditorProps) {
  const { t } = useTranslation();
  const limits = company.usage_limits as any;

  const [monthlyCost, setMonthlyCost] = useState<string>(limits?.monthly_cost_usd?.toString() ?? '');
  const [monthlyAudits, setMonthlyAudits] = useState<string>(limits?.monthly_audits?.toString() ?? '');
  const [monthlyTokens, setMonthlyTokens] = useState<string>(limits?.monthly_tokens?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newLimits: Record<string, unknown> = {};
    if (monthlyCost) newLimits.monthly_cost_usd = parseFloat(monthlyCost);
    if (monthlyAudits) newLimits.monthly_audits = parseInt(monthlyAudits);
    if (monthlyTokens) newLimits.monthly_tokens = parseInt(monthlyTokens);
    await onSave(newLimits);
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-white flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-400" />
        {t('usage.setLimits')}
        <span className="text-xs text-slate-500 font-normal">{t('companies.leaveEmptyNoLimit')}</span>
      </h4>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('usage.monthlyBudget')}</label>
          <input
            type="number"
            value={monthlyCost}
            onChange={e => setMonthlyCost(e.target.value)}
            placeholder="50.00"
            className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('usage.monthlyAudits')}</label>
          <input
            type="number"
            value={monthlyAudits}
            onChange={e => setMonthlyAudits(e.target.value)}
            placeholder="500"
            className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('usage.monthlyTokens')}</label>
          <input
            type="number"
            value={monthlyTokens}
            onChange={e => setMonthlyTokens(e.target.value)}
            placeholder="1000000"
            className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-3 py-1.5 bg-brand-500 hover:bg-brand-400 text-black font-medium rounded-lg text-xs transition-colors disabled:opacity-50"
      >
        {saving ? t('common.saving') : t('common.save')}
      </button>

      {/* Uso actual del mes */}
      {company.usage_this_month && (
        <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
          <p className="text-xs text-slate-400 mb-2">{t('usage.title')}</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">{t('companies.auditsLabel')}</span>
              <p className="text-white font-medium">
                {company.usage_this_month.total_audits}
                {limits?.monthly_audits ? ` / ${limits.monthly_audits}` : ''}
              </p>
              {limits?.monthly_audits && (
                <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full"
                    style={{ width: `${Math.min(100, (company.usage_this_month.total_audits / limits.monthly_audits) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div>
              <span className="text-slate-500">{t('companies.costUsd')}</span>
              <p className="text-white font-medium">
                ${company.usage_this_month.total_cost?.toFixed(2) ?? '0.00'}
                {limits?.monthly_cost_usd ? ` / $${limits.monthly_cost_usd}` : ''}
              </p>
              {limits?.monthly_cost_usd && (
                <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, ((company.usage_this_month.total_cost ?? 0) / limits.monthly_cost_usd) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div>
              <span className="text-slate-500">{t('companies.tokens')}</span>
              <p className="text-white font-medium">
                {(company.usage_this_month.total_tokens ?? 0).toLocaleString()}
                {limits?.monthly_tokens ? ` / ${Number(limits.monthly_tokens).toLocaleString()}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
