// frontend/src/contexts/AuthContext.tsx

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, setupAutoRefresh, getSessionTimeRemaining } from '../config/supabase';
import type { UserRole, UserProfile } from '../types/auth.types';
import { ROLE_PERMISSIONS } from '../types/auth.types';

type Session = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>;

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  sessionTimeRemaining: number;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isRole: (role: UserRole | UserRole[]) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// CONFIGURACIÓN DE TIMEOUTS
// ============================================
const PROFILE_LOAD_TIMEOUT = 5000; // 5 segundos
const INIT_TIMEOUT = 8000; // 8 segundos
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

// Caché del perfil
const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();

// ============================================
// LOGGING DE EVENTOS DE AUTENTICACIÓN
// ============================================
const logAuthEvent = (event: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...data
  };
  
  console.log(`🔐 [AUTH] ${event}`, data || '');
  
  try {
    const logs = JSON.parse(localStorage.getItem('auth_logs') || '[]');
    logs.unshift(logEntry);
    if (logs.length > 50) logs.pop();
    localStorage.setItem('auth_logs', JSON.stringify(logs));
  } catch (error) {
    console.error('Error saving auth log:', error);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  
  const isLoadingProfile = useRef(false);
  const initializationComplete = useRef(false);
  const autoRefreshCleanup = useRef<(() => void) | null>(null);

  // ============================================
  // CARGAR PERFIL DE USUARIO
  // ============================================
  const loadUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (isLoadingProfile.current) {
      console.log('⏭️  Profile load already in progress, skipping');
      return null;
    }

    // Verificar caché
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('✅ Using cached profile');
      return cached.profile;
    }

    isLoadingProfile.current = true;

    try {
      console.log('📥 Loading user profile...', userId);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile load timeout')), PROFILE_LOAD_TIMEOUT);
      });

      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const { data: userProfile, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('❌ Error loading profile:', error);
        logAuthEvent('PROFILE_LOAD_ERROR', { userId, error: error.message });
        return null;
      }

      if (!userProfile) {
        console.warn('⚠️  No profile found for user');
        logAuthEvent('PROFILE_NOT_FOUND', { userId });
        return null;
      }

      // ============================================
      // VERIFICAR SI LA CUENTA ESTÁ DESACTIVADA
      // ============================================
      if (userProfile.is_active === false) {
        console.warn('🚫 User account is inactive, logging out...');
        logAuthEvent('ACCOUNT_INACTIVE_AUTO_LOGOUT', { 
          userId, 
          email: userProfile.email 
        });
        
        // Cerrar sesión automáticamente
        await supabase.auth.signOut();
        
        // Limpiar todo
        profileCache.clear();
        
        return null;
      }

      // Guardar en caché
      profileCache.set(userId, {
        profile: userProfile,
        timestamp: Date.now()
      });

      console.log('✅ Profile loaded successfully');
      logAuthEvent('PROFILE_LOADED', { userId, role: userProfile.role });
      
      return userProfile;
    } catch (error: any) {
      console.error('❌ Profile load error:', error);
      logAuthEvent('PROFILE_LOAD_TIMEOUT', { userId });
      
      if (error.message === 'Profile load timeout') {
        console.warn('⚠️  Profile load timeout, user can still access basic features');
      }
      return null;
    } finally {
      isLoadingProfile.current = false;
    }
  }, []);

  // ============================================
  // REFRESCAR PERFIL
  // ============================================
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    
    console.log('🔄 Refreshing profile...');
    profileCache.delete(user.id);
    
    const userProfile = await loadUserProfile(user.id);
    if (userProfile) {
      setProfile(userProfile);
      logAuthEvent('PROFILE_REFRESHED', { userId: user.id });
    }
  }, [user?.id, loadUserProfile]);

  // ============================================
  // INICIALIZACIÓN DE AUTENTICACIÓN
  // ============================================
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        console.log('🔐 Initializing authentication...');
        logAuthEvent('AUTH_INIT_START');
        
        const initTimeout = setTimeout(() => {
          if (!initializationComplete.current && isMounted) {
            console.warn('⚠️  Auth initialization timeout');
            logAuthEvent('AUTH_INIT_TIMEOUT');
            setLoading(false);
          }
        }, INIT_TIMEOUT);

        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (error) {
          console.error('❌ Error getting session:', error);
          logAuthEvent('SESSION_ERROR', { error: error.message });
          setLoading(false);
          clearTimeout(initTimeout);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          console.log('✅ Session found');
          logAuthEvent('SESSION_FOUND', { 
            userId: initialSession.user.id,
            email: initialSession.user.email 
          });
          
          const userProfile = await loadUserProfile(initialSession.user.id);
          
          // Si el perfil es null, significa que la cuenta está desactivada
          // y ya se cerró la sesión automáticamente
          if (isMounted) {
            if (userProfile) {
              setProfile(userProfile);
              autoRefreshCleanup.current = setupAutoRefresh();
            } else {
              // Limpiar estado si no hay perfil (cuenta desactivada)
              setUser(null);
              setSession(null);
              setProfile(null);
            }
          }
        } else {
          console.log('ℹ️  No active session');
          logAuthEvent('NO_SESSION');
        }
        
        initializationComplete.current = true;
        clearTimeout(initTimeout);
        
        if (isMounted) {
          setLoading(false);
        }

      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        logAuthEvent('AUTH_INIT_ERROR', { error });
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 Auth state changed:', event);
      logAuthEvent('AUTH_STATE_CHANGE', { event });
      
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (event === 'SIGNED_IN') {
        logAuthEvent('USER_SIGNED_IN', { 
          userId: newSession?.user?.id,
          email: newSession?.user?.email 
        });
        
        if (newSession?.user) {
          const userProfile = await loadUserProfile(newSession.user.id);
          if (isMounted) {
            if (userProfile) {
              setProfile(userProfile);
              autoRefreshCleanup.current = setupAutoRefresh();
            } else {
              // Cuenta desactivada, limpiar todo
              setUser(null);
              setSession(null);
              setProfile(null);
            }
          }
        }
        
      } else if (event === 'SIGNED_OUT') {
        logAuthEvent('USER_SIGNED_OUT');
        setProfile(null);
        profileCache.clear();
        
        if (autoRefreshCleanup.current) {
          autoRefreshCleanup.current();
          autoRefreshCleanup.current = null;
        }
        
      } else if (event === 'TOKEN_REFRESHED') {
        logAuthEvent('TOKEN_REFRESHED', { userId: newSession?.user?.id });
        
        // Verificar que la cuenta siga activa en cada refresh
        if (newSession?.user) {
          const userProfile = await loadUserProfile(newSession.user.id);
          if (isMounted) {
            if (userProfile) {
              setProfile(userProfile);
            } else {
              // Cuenta desactivada durante la sesión
              setUser(null);
              setSession(null);
              setProfile(null);
            }
          }
        }
        
      } else if (event === 'USER_UPDATED') {
        logAuthEvent('USER_UPDATED', { userId: newSession?.user?.id });
        
        if (newSession?.user) {
          profileCache.delete(newSession.user.id);
          const userProfile = await loadUserProfile(newSession.user.id);
          if (isMounted) {
            if (userProfile) {
              setProfile(userProfile);
            } else {
              setUser(null);
              setSession(null);
              setProfile(null);
            }
          }
        }
      }
      
      if (isMounted && initializationComplete.current) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      
      if (autoRefreshCleanup.current) {
        autoRefreshCleanup.current();
      }
    };
  }, [loadUserProfile]);

  // ============================================
  // ACTUALIZAR TIEMPO RESTANTE DE SESIÓN
  // ============================================
  useEffect(() => {
    if (!session) {
      setSessionTimeRemaining(0);
      return;
    }

    const updateTimeRemaining = () => {
      const remaining = getSessionTimeRemaining();
      setSessionTimeRemaining(remaining);
      
      if (remaining > 0 && remaining <= 30 * 60 && remaining > 29 * 60) {
        console.warn('⚠️  Session expires in 30 minutes');
        logAuthEvent('SESSION_EXPIRING_SOON', { remainingMinutes: 30 });
      }
    };

    updateTimeRemaining();
    const intervalId = setInterval(updateTimeRemaining, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [session]);

  // ============================================
  // SIGN IN
  // ============================================
  const signIn = async (email: string, password: string) => {
    console.log('🔐 Signing in...');
    logAuthEvent('SIGN_IN_ATTEMPT', { email });
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logAuthEvent('SIGN_IN_ERROR', { email, error: error.message });
      throw error;
    }
    
    logAuthEvent('SIGN_IN_SUCCESS', { email });
  };

  // ============================================
  // SIGN OUT
  // ============================================
  const signOut = async () => {
    console.log('🔐 Signing out...');
    logAuthEvent('SIGN_OUT_ATTEMPT', { userId: user?.id });
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      logAuthEvent('SIGN_OUT_ERROR', { error: error.message });
      throw error;
    }
    
    setUser(null);
    setProfile(null);
    setSession(null);
    
    profileCache.clear();
    
    if (autoRefreshCleanup.current) {
      autoRefreshCleanup.current();
      autoRefreshCleanup.current = null;
    }
    
    logAuthEvent('SIGN_OUT_SUCCESS');
  };

  // ============================================
  // VERIFICAR PERMISOS
  // ============================================
  const hasPermission = useCallback((permission: string): boolean => {
    if (!profile) return false;

    const userPermissions = ROLE_PERMISSIONS[profile.role] || [];
    
    if (userPermissions.some(p => p === 'config:manage')) {
      return true;
    }

    return userPermissions.some(p => p === permission);
  }, [profile]);

  // ============================================
  // VERIFICAR ROL
  // ============================================
  const isRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (!profile) return false;

    if (Array.isArray(role)) {
      return role.includes(profile.role);
    }

    return profile.role === role;
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        sessionTimeRemaining,
        signIn,
        signOut,
        hasPermission,
        isRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRole() {
  const { profile, isRole, hasPermission } = useAuth();
  
  return {
    role: profile?.role,
    isAdmin: isRole('admin'),
    isSupervisor: isRole('supervisor'),
    isAnalyst: isRole('analyst'),
    canCreateAudits: hasPermission('audits:create'),
    canViewAllAudits: hasPermission('audits:read:all') || isRole(['admin', 'supervisor', 'analyst']),
    canViewCosts: hasPermission('costs:read:all'),
    canManageUsers: hasPermission('users:create'),
  };
}

export const getAuthLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('auth_logs') || '[]');
  } catch {
    return [];
  }
};

export const clearAuthLogs = () => {
  localStorage.removeItem('auth_logs');
  console.log('🗑️  Auth logs cleared');
};