// frontend/src/pages/SettingsPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/AuthContext';
import { 
  Settings, 
  ArrowLeft,
  Key,
  Database,
  Mic,
  Brain,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SystemConfig {
  openai_api_key: string;
  assemblyai_api_key: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_role_key: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState({
    openai: false,
    assemblyai: false,
    supabase_anon: false,
    supabase_service: false
  });

  const [config, setConfig] = useState<SystemConfig>({
    openai_api_key: '',
    assemblyai_api_key: '',
    supabase_url: '',
    supabase_anon_key: '',
    supabase_service_role_key: ''
  });

  const [connectionStatus, setConnectionStatus] = useState({
    openai: false,
    assemblyai: false,
    supabase: false
  });

  useEffect(() => {
    // Verificar que sea admin
    if (profile?.role !== 'admin') {
      toast.error('No tienes permisos para acceder a esta página');
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
        throw new Error('Error al cargar configuración');
      }

      const data = await response.json();
      setConfig(data);
      await checkConnections();
    } catch (error: any) {
      console.error('Error loading config:', error);
      toast.error('Error al cargar configuración');
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
          openai: health.openai || false,
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
        throw new Error('Error al guardar configuración');
      }

      toast.success('Configuración guardada exitosamente');
      await checkConnections();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service: 'openai' | 'assemblyai' | 'supabase') => {
    try {
      setTesting(service);
      const response = await fetch(`/api/admin/test/${service}`, {
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Conexión exitosa con ${service.toUpperCase()}`);
        setConnectionStatus(prev => ({ ...prev, [service]: true }));
      } else {
        toast.error(`Error conectando con ${service.toUpperCase()}: ${result.error}`);
        setConnectionStatus(prev => ({ ...prev, [service]: false }));
      }
    } catch (error: any) {
      toast.error(`Error probando conexión: ${error.message}`);
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
          <p className="mt-4 text-white">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header glass-morphism */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(10, 10, 18, 0.88)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: '1px solid rgba(30, 30, 50, 0.8)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <BackButton onClick={() => navigate('/dashboard')} />
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl blur-md" style={{ background: 'rgba(0,214,50,0.15)' }} />
              <div className="relative w-11 h-11 rounded-xl overflow-hidden ring-1 ring-brand-500/25">
                <img src="/logo.jpg" alt="S+" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Configuración del Sistema</h1>
              <p className="text-slate-500 text-sm mt-0.5">Gestiona las APIs y configuraciones del sistema</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-brand-400" />
                <div>
                  <p className="text-sm text-slate-400">OpenAI</p>
                  <p className="text-xs text-slate-500">GPT-4o</p>
                </div>
              </div>
              {connectionStatus.openai ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-brand-400" />
                <div>
                  <p className="text-sm text-slate-400">AssemblyAI</p>
                  <p className="text-xs text-slate-500">Transcripción</p>
                </div>
              </div>
              {connectionStatus.assemblyai ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-brand-400" />
                <div>
                  <p className="text-sm text-slate-400">Supabase</p>
                  <p className="text-xs text-slate-500">Base de datos</p>
                </div>
              </div>
              {connectionStatus.supabase ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="card space-y-6">
          {/* OpenAI Config */}
          <div>
            <h3 className="section-header mb-4">OpenAI API</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-brand-400" />
                <span className="text-sm text-slate-400">GPT-4o — Análisis de auditorías</span>
              </div>
              <button
                onClick={() => testConnection('openai')}
                disabled={testing === 'openai' || !config.openai_api_key}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-700/20 rounded-lg text-sm hover:bg-brand-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'openai' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Probar Conexión
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKeys.openai ? 'text' : 'password'}
                  value={config.openai_api_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, openai_api_key: e.target.value }))}
                  placeholder="sk-..."
                  className="input pr-12"
                />
                <button
                  onClick={() => toggleShowKey('openai')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showKeys.openai ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Obtén tu API key en <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">platform.openai.com</a></p>
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
                <span className="text-sm text-slate-400">Transcripción de llamadas</span>
              </div>
              <button
                onClick={() => testConnection('assemblyai')}
                disabled={testing === 'assemblyai' || !config.assemblyai_api_key}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-700/20 rounded-lg text-sm hover:bg-brand-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'assemblyai' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Probar Conexión
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
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
                <p>Obtén tu API key en <a href="https://www.assemblyai.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">assemblyai.com/dashboard</a></p>
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
                <span className="text-sm text-slate-400">Base de datos y autenticación</span>
              </div>
              <button
                onClick={() => testConnection('supabase')}
                disabled={testing === 'supabase' || !config.supabase_url}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 text-brand-400 border border-brand-700/20 rounded-lg text-sm hover:bg-brand-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'supabase' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Probar Conexión
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
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>
      </main>
    </div>
  );
}