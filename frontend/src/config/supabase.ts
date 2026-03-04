// frontend/src/config/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ============================================
// CONFIGURACIÓN DE TIMEOUT DE SESIÓN
// ============================================
export const SESSION_CONFIG = {
  // 9 horas en segundos (configurar en Supabase Dashboard)
  JWT_EXPIRY_SECONDS: 9 * 60 * 60, // 32400 segundos
  
  // Auto-refresh 10 minutos antes de expirar
  REFRESH_THRESHOLD_SECONDS: 10 * 60, // 600 segundos
  
  // Verificar cada 5 minutos
  CHECK_INTERVAL_SECONDS: 5 * 60, // 300 segundos
  
  // Advertir cuando queden 30 minutos
  WARNING_THRESHOLD_SECONDS: 30 * 60, // 1800 segundos
};

/**
 * Configurar auto-refresh del token
 */
export function setupAutoRefresh(): () => void {
  let intervalId: NodeJS.Timeout;
  
  const checkAndRefresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('ℹ️  No active session to refresh');
        return;
      }

      const remaining = getSessionTimeRemaining();
      
      // Si quedan menos de 10 minutos, refrescar el token
      if (remaining > 0 && remaining <= SESSION_CONFIG.REFRESH_THRESHOLD_SECONDS) {
        console.log('🔄 Refreshing token...');
        await supabase.auth.refreshSession();
        console.log('✅ Token refreshed successfully');
      }
    } catch (error) {
      console.error('❌ Error in auto-refresh:', error);
    }
  };

  // Verificar cada 5 minutos
  intervalId = setInterval(checkAndRefresh, SESSION_CONFIG.CHECK_INTERVAL_SECONDS * 1000);
  
  // Verificar inmediatamente
  checkAndRefresh();

  // Retornar función de limpieza
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

/**
 * Obtener tiempo restante de la sesión en segundos
 */
export function getSessionTimeRemaining(): number {
  try {
    const sessionStr = localStorage.getItem('sb-abeyvapsuaqyymqmmlgq-auth-token');
    if (!sessionStr) return 0;

    const session = JSON.parse(sessionStr);
    const expiresAt = session.expires_at;
    
    if (!expiresAt) return 0;

    const now = Math.floor(Date.now() / 1000);
    const remaining = expiresAt - now;
    
    return Math.max(0, remaining);
  } catch (error) {
    console.error('Error getting session time:', error);
    return 0;
  }
}