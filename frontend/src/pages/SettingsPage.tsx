// frontend/src/pages/SettingsPage.tsx
import { motion } from 'motion/react';
import { Stagger, StaggerItem, Reveal, EASE_SPRING } from '../lib/motion';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../contexts/AuthContext';
import { 
  Settings,
  Key,
  Database,
  Mic,
  Brain,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SystemConfig {
  anthropic_api_key: string;
  assemblyai_api_key: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState({
    anthropic: false,
    assemblyai: false,
    supabase_anon: false,
    supabase_service: false
  });

  const [config, setConfig] = useState<SystemConfig>({
    anthropic_api_key: '',
    assemblyai_api_key: '',
    supabase_url: '',
    supabase_anon_key: '',
    supabase_service_role_key: ''
  });

  const [connectionStatus, setConnectionStatus] = useState({
    anthropic: false,
    assemblyai: false,
    supabase: false
  });

  useEffect(() => {
    // Verificar que sea superadmin
    if (profile?.role !== 'superadmin') {
      toast.error(t('settingsPage.unauthorized'));
      navigate('/dashboard');
      return;
    }

    loadConfig();
  }, [profile]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/config', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(t('settingsPage.loadError'));
      }

      const data = await response.json();
      setConfig(data);
      await checkConnections();
    } catch (error: any) {
      console.error('Error loading config:', error);
      toast.error(t('settingsPage.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const checkConnections = async () => {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        const health = await response.json();
        setConnectionStatus({
          anthropic: health.anthropic || false,
          assemblyai: health.assemblyai || false,
          supabase: health.supabase || false
        });
      }
    } catch (error) {
      console.error('Error checking connections:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(t('settingsPage.saveError'));
      }

      toast.success(t('settingsPage.saveSuccess'));
      await checkConnections();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(t('settingsPage.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service: 'anthropic' | 'assemblyai' | 'supabase') => {
    try {
      setTesting(service);
      const response = await fetch(`/api/admin/test/${service}`, {
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${t('settingsPage.testSuccess')} ${service.toUpperCase()}`);
        setConnectionStatus(prev => ({ ...prev, [service]: true }));
      } else {
        toast.error(`${t('settingsPage.testError')} ${service.toUpperCase()}: ${result.error}`);
        setConnectionStatus(prev => ({ ...prev, [service]: false }));
      }
    } catch (error: any) {
      toast.error(`${t('settingsPage.testError')}: ${error.message}`);
      setConnectionStatus(prev => ({ ...prev, [service]: false }));
    } finally {
      setTesting(null);
    }
  };

  const toggleShowKey = (key: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskKey = (key: string, visible: boolean) => {
    if (visible || !key) return key;
    const visibleChars = 8;
    if (key.length <= visibleChars) return '•'.repeat(key.length);
    return key.substring(0, 4) + '•'.repeat(key.length - visibleChars) + key.substring(key.length - 4);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand-500/50 border-r-transparent"></div>
          <p className="mt-4 text-white">{t('settingsPage.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader showBack onBack={() => navigate('/dashboard')} title={t('settingsPage.title')} />

      <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.06 }} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>

        {/* Status Cards */}
        <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <StatusCard icon={<Brain className="w-5 h-5 text-brand-400" />} title={t('settingsPage.openaiTitle')} subtitle="Claude Sonnet 5" connected={connectionStatus.anthropic} t={t} />
          <StatusCard icon={<Mic className="w-5 h-5 text-brand-400" />} title={t('settingsPage.assemblyaiTitle')} subtitle={t('settingsPage.transcription')} connected={connectionStatus.assemblyai} t={t} />
          <StatusCard icon={<Database className="w-6 h-6 text-brand-400" />} title={t('settingsPage.supabaseTitle')} subtitle={t('settingsPage.database')} connected={connectionStatus.supabase} t={t} />
        </Stagger>

        {/* Configuration Form */}
        <Reveal whenInView className="card space-y-6">
          {/* Anthropic (Claude) Config */}
          <div>
            <h3 className="section-header mb-4">Anthropic API (Claude)</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-brand-400" />
                <span className="text-sm text-slate-400">{t('settingsPage.gptDesc')}</span>
              </div>
              <button
                onClick={() => testConnection('anthropic')}
                disabled={testing === 'anthropic' || !config.anthropic_api_key}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-700/20 rounded-lg text-sm hover:bg-brand-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {testing === 'anthropic' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {t('settingsPage.testConnection')}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-2">
                <Key className="w-4 h-4" />
                {t('settingsPage.apiKey')}
              </label>
              <div className="relative">
                <input
                  type={showKeys.anthropic ? 'text' : 'password'}
                  value={config.anthropic_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
                  placeholder="sk-ant-..."
                  className="input pr-12"
                />
                <button
                  onClick={() => toggleShowKey('anthropic')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showKeys.anthropic ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{t('settingsPage.getKeyAt')} <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">console.anthropic.com</a></p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#1e1e32]"></div>

          {/* AssemblyAI Config */}
          <div>
            <h3 className="section-header mb-4">AssemblyAI API</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-brand-400" />
                <span className="text-sm text-slate-400">{t('settingsPage.assemblyDesc')}</span>
              </div>
              <button
                onClick={() => testConnection('assemblyai')}
                disabled={testing === 'assemblyai' || !config.assemblyai_api_key}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-700/20 rounded-lg text-sm hover:bg-brand-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {testing === 'assemblyai' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {t('settingsPage.testConnection')}
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-2">
                <Key className="w-4 h-4" />
                {t('settingsPage.apiKey')}
              </label>
              <div className="relative">
                <input
                  type={showKeys.assemblyai ? 'text' : 'password'}
                  value={config.assemblyai_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, assemblyai_api_key: e.target.value }))}
                  placeholder="..."
                  className="input pr-12"
                />
                <button
                  onClick={() => toggleShowKey('assemblyai')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showKeys.assemblyai ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{t('settingsPage.getKeyAt')} <a href="https://www.assemblyai.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">assemblyai.com/dashboard</a></p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#1e1e32]"></div>

          {/* Supabase Config */}
          <div>
            <h3 className="section-header mb-4">Supabase Database</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-brand-400" />
                <span className="text-sm text-slate-400">{t('settingsPage.supabaseDesc')}</span>
              </div>
              <button
                onClick={() => testConnection('supabase')}
                disabled={testing === 'supabase' || !config.supabase_url}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-700/20 rounded-lg text-sm hover:bg-brand-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {testing === 'supabase' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {t('settingsPage.testConnection')}
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Project URL</label>
                <input
                  type="text"
                  value={config.supabase_url}
                  onChange={(e) => setConfig(prev => ({ ...prev, supabase_url: e.target.value }))}
                  placeholder="https://xxxxx.supabase.co"
                  className="input"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-400 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Anon Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys.supabase_anon ? 'text' : 'password'}
                    value={config.supabase_anon_key}
                    onChange={(e) => setConfig(prev => ({ ...prev, supabase_anon_key: e.target.value }))}
                    placeholder="eyJ..."
                    className="input pr-12"
                  />
                  <button
                    onClick={() => toggleShowKey('supabase_anon')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKeys.supabase_anon ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-400 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Service Role Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys.supabase_service ? 'text' : 'password'}
                    value={config.supabase_service_role_key}
                    onChange={(e) => setConfig(prev => ({ ...prev, supabase_service_role_key: e.target.value }))}
                    placeholder="eyJ..."
                    className="input pr-12"
                  />
                  <button
                    onClick={() => toggleShowKey('supabase_service')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKeys.supabase_service ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Encuentra tus credenciales en <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">app.supabase.com</a> → Settings → API</p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileHover={saving ? undefined : { scale: 1.02 }}
            whileTap={saving ? undefined : { scale: 0.97 }}
            transition={EASE_SPRING}
            className="btn-primary flex items-center gap-2 px-6 py-3 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!saving && (
              <motion.span
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)' }}
                initial={{ x: '-120%' }}
                animate={{ x: '120%' }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
              />
            )}
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('settingsPage.saving')}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('settingsPage.saveConfig')}
              </>
            )}
          </motion.button>
        </div>
      </div>
      </motion.main>
    </div>
  );
}

// Tarjeta de estado de conexión con pill animado + elevación al hover
function StatusCard({
  icon,
  title,
  subtitle,
  connected,
  t,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  connected: boolean;
  t: (k: string) => string;
}) {
  return (
    <StaggerItem>
      <motion.div className="card h-full" whileHover={{ y: -4 }} transition={EASE_SPRING}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <p className="text-sm text-slate-400">{title}</p>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              connected
                ? 'bg-green-500/15 border-green-500/30 text-green-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {connected ? t('settingsPage.connected') : t('settingsPage.disconnected')}
          </span>
        </div>
      </motion.div>
    </StaggerItem>
  );
}