// frontend/src/pages/IntegrationsPage.tsx
//
// Página de Integraciones internas por empresa (Fase 2 multi-tenant).
// El lider edita los endpoints internos de SU empresa (companies.integration_config);
// el superadmin puede ver/editar la suya. Las APIs globales (OpenAI/AssemblyAI) NO
// se gestionan aquí — viven en /settings (solo superadmin).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../contexts/AuthContext';
import {
  Plug,
  Key,
  Link2,
  Mail,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GpfConfig {
  api_url_prod: string;
  api_url_test: string;
  app_token: string;
  email: string;
  password: string;
}

interface IntegrationResponse {
  company_id: string;
  name: string;
  integration_type: string;
  integration_config: Record<string, any>;
}

const EMPTY_GPF: GpfConfig = {
  api_url_prod: '',
  api_url_test: '',
  app_token: '',
  email: '',
  password: '',
};

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [integrationType, setIntegrationType] = useState<string>('none');
  const [gpf, setGpf] = useState<GpfConfig>(EMPTY_GPF);
  const [showSecrets, setShowSecrets] = useState({ app_token: false, password: false });

  useEffect(() => {
    if (profile && profile.role !== 'superadmin' && profile.role !== 'lider') {
      toast.error(t('integrationsPage.unauthorized'));
      navigate('/dashboard');
      return;
    }
    if (profile) loadIntegration();
  }, [profile]);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/company/integration', { credentials: 'include' });
      if (!response.ok) throw new Error('load');
      const data: IntegrationResponse = await response.json();
      setCompanyName(data.name ?? '');
      setIntegrationType(data.integration_type ?? 'none');
      const cfg = data.integration_config ?? {};
      setGpf({
        api_url_prod: cfg.api_url_prod ?? '',
        api_url_test: cfg.api_url_test ?? '',
        app_token: cfg.app_token ?? '',
        email: cfg.email ?? '',
        password: cfg.password ?? '',
      });
    } catch (error) {
      console.error('Error loading integration:', error);
      toast.error(t('integrationsPage.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const integration_config = integrationType === 'gpf' ? { ...gpf } : {};
      const response = await fetch('/api/company/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ integration_type: integrationType, integration_config }),
      });
      if (!response.ok) throw new Error('save');
      toast.success(t('integrationsPage.saveSuccess'));
    } catch (error) {
      console.error('Error saving integration:', error);
      toast.error(t('integrationsPage.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand-500/50 border-r-transparent"></div>
          <p className="mt-4 text-white">{t('integrationsPage.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader showBack onBack={() => navigate('/dashboard')} title={t('integrationsPage.title')} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>
          {/* Encabezado */}
          <div className="card mb-5">
            <div className="flex items-center gap-3">
              <Plug className="w-5 h-5 text-brand-400" />
              <div>
                <p className="text-sm text-slate-300">{companyName || t('integrationsPage.yourCompany')}</p>
                <p className="text-xs text-slate-500">{t('integrationsPage.subtitle')}</p>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="card space-y-6">
            {/* Tipo de integración */}
            <div className="space-y-2">
              <h3 className="section-header mb-2">{t('integrationsPage.typeTitle')}</h3>
              <label className="text-sm text-slate-400">{t('integrationsPage.typeLabel')}</label>
              <select
                value={integrationType}
                onChange={(e) => setIntegrationType(e.target.value)}
                className="input"
              >
                <option value="none">{t('integrationsPage.typeNone')}</option>
                <option value="gpf">GPF</option>
              </select>
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{t('integrationsPage.typeHint')}</p>
              </div>
            </div>

            {integrationType === 'gpf' && (
              <>
                <div className="border-t border-[#1e1e32]"></div>

                <div className="space-y-4">
                  <h3 className="section-header mb-2">{t('integrationsPage.gpfTitle')}</h3>

                  {/* URLs */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      {t('integrationsPage.urlProd')}
                    </label>
                    <input
                      type="text"
                      value={gpf.api_url_prod}
                      onChange={(e) => setGpf((p) => ({ ...p, api_url_prod: e.target.value }))}
                      placeholder="https://gpf.ejemplo.com"
                      className="input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      {t('integrationsPage.urlTest')}
                    </label>
                    <input
                      type="text"
                      value={gpf.api_url_test}
                      onChange={(e) => setGpf((p) => ({ ...p, api_url_test: e.target.value }))}
                      placeholder="https://gpf-test.ejemplo.com"
                      className="input"
                    />
                  </div>

                  {/* App token */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      {t('integrationsPage.appToken')}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.app_token ? 'text' : 'password'}
                        value={gpf.app_token}
                        onChange={(e) => setGpf((p) => ({ ...p, app_token: e.target.value }))}
                        placeholder="..."
                        className="input pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets((p) => ({ ...p, app_token: !p.app_token }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showSecrets.app_token ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {t('integrationsPage.email')}
                    </label>
                    <input
                      type="text"
                      value={gpf.email}
                      onChange={(e) => setGpf((p) => ({ ...p, email: e.target.value }))}
                      placeholder="usuario@empresa.com"
                      className="input"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      {t('integrationsPage.password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.password ? 'text' : 'password'}
                        value={gpf.password}
                        onChange={(e) => setGpf((p) => ({ ...p, password: e.target.value }))}
                        placeholder="••••••••"
                        className="input pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets((p) => ({ ...p, password: !p.password }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showSecrets.password ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{t('integrationsPage.gpfHint')}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Guardar */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('integrationsPage.saving')}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {t('integrationsPage.save')}
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
