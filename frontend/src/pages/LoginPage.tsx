// frontend/src/pages/LoginPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { toast } from 'react-hot-toast';
import { LogIn, Mail, Lock, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirigir si ya está autenticado Y tiene perfil activo
  useEffect(() => {
    if (!authLoading && user && profile) {
      console.log('✅ User already authenticated, redirecting...');
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, profile, authLoading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Attempting login...');
      await signIn(email, password);
      
      // Esperar a que el AuthContext procese el perfil
      // Si la cuenta está desactivada, AuthContext cerrará la sesión automáticamente
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Después del delay, verificar el estado de la sesión
      // Si no hay sesión, significa que fue cerrada por cuenta desactivada
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.user) {
        // La cuenta fue desactivada, AuthContext ya la cerró
        toast.error('Tu cuenta ha sido desactivada. Contacta al administrador.');
        setLoading(false);
        return;
      }
      
      // Login exitoso con cuenta activa
      toast.success('¡Bienvenido!');
      
      // Navegar al destino original o dashboard
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      // Mensajes de error más específicos
      let errorMessage = 'Credenciales inválidas';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Email o contraseña incorrectos';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Por favor confirma tu email';
      } else if (error.message?.includes('Too many requests')) {
        errorMessage = 'Demasiados intentos. Intenta más tarde';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading mientras verifica autenticación inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
          <p className="mt-4 text-white">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 mb-4 shadow-glow">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Audit AI Pro
          </h1>
          <p className="text-slate-400">
            Inicia sesión para acceder al sistema
          </p>
        </div>

        {/* Card de login */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-blue-400" />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="input"
                disabled={loading}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-purple-400" />
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Info de contacto para crear cuenta */}
          <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-400 mb-1">
                  ¿No tienes una cuenta?
                </p>
                <p className="text-xs text-slate-400">
                  Contacta al administrador del sistema para solicitar acceso.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          © 2026 Audit AI Pro. Sistema de evaluación inteligente.
        </p>
      </div>
    </div>
  );
}