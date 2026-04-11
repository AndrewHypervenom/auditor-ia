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
// CONFIGURACIÓN DE TIMEOUTS Y CACHÉ
// ============================================
const PROFILE_LOAD_TIMEOUT = 8000; // 8 segundos (solo para carga inicial sin caché)
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
const PROFILE_STORAGE_KEY = 'auth_profile_cache';

// Caché en memoria
const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();

// Caché persistente en localStorage
function saveProfileToStorage(userId: string, profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
      userId, profile, timestamp: Date.now()
    }));
  } catch {}
}

function getProfileFromStorage(userId: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const { userId: cachedId, profile, timestamp } = JSON.parse(raw);
    if (cachedId !== userId) return null;
    if (Date.now() - timestamp > CACHE_DURATION) return null;
    return profile;
  } catch { return null; }
}

function clearProfileStorage() {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

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
 return null;
 }

 // Verificar caché
 const cached = profileCache.get(userId);
 if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
 return cached.profile;
 }

 isLoadingProfile.current = true;

 try {
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
 logAuthEvent('PROFILE_LOAD_ERROR', { userId, error: error.message });
 return null;
 }

 if (!userProfile) {
 logAuthEvent('PROFILE_NOT_FOUND', { userId });
 return null;
 }

 // ============================================
 // VERIFICAR SI LA CUENTA ESTÁ DESACTIVADA
 // ============================================
 if (userProfile.is_active === false) {
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

 // Guardar en caché (memoria y localStorage)
 profileCache.set(userId, {
 profile: userProfile,
 timestamp: Date.now()
 });
 saveProfileToStorage(userId, userProfile);

 logAuthEvent('PROFILE_LOADED', { userId, role: userProfile.role });

 return userProfile;
 } catch (error: any) {
 logAuthEvent('PROFILE_LOAD_TIMEOUT', { userId });
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
 logAuthEvent('AUTH_INIT_START');

 const { data: { session: initialSession }, error } = await supabase.auth.getSession();

 if (!isMounted) return;

 if (error) {
 logAuthEvent('SESSION_ERROR', { error: error.message });
 setLoading(false);
 return;
 }

 if (!initialSession?.user) {
 logAuthEvent('NO_SESSION');
 initializationComplete.current = true;
 setLoading(false);
 return;
 }

 setSession(initialSession);
 setUser(initialSession.user);

 logAuthEvent('SESSION_FOUND', {
 userId: initialSession.user.id,
 email: initialSession.user.email
 });

 // Fase 1: buscar perfil en localStorage (sincrónico, instantáneo)
 const cachedProfile = getProfileFromStorage(initialSession.user.id);

 if (cachedProfile) {
 // Servir desde caché → sin spinner para el usuario
 setProfile(cachedProfile);
 // También poblar el Map en memoria
 profileCache.set(initialSession.user.id, { profile: cachedProfile, timestamp: Date.now() });
 autoRefreshCleanup.current = setupAutoRefresh();
 initializationComplete.current = true;
 setLoading(false);

 // Fase 2: verificar y refrescar en background (sin bloquear UI)
 loadUserProfile(initialSession.user.id).then(freshProfile => {
 if (!isMounted) return;
 if (freshProfile) {
 setProfile(freshProfile);
 }
 // Si null por cuenta inactiva: loadUserProfile ya llamó signOut()
 // Si null por error de red: mantenemos el perfil cacheado
 });

 } else {
 // Sin caché: carga normal (solo ocurre en el primer login o caché expirada)
 const userProfile = await loadUserProfile(initialSession.user.id);

 if (isMounted && userProfile) {
 setProfile(userProfile);
 autoRefreshCleanup.current = setupAutoRefresh();
 }

 initializationComplete.current = true;
 if (isMounted) setLoading(false);
 }

 } catch (error) {
 logAuthEvent('AUTH_INIT_ERROR', { error });
 if (isMounted) setLoading(false);
 }
 };

 initAuth();

 // Escuchar cambios de autenticación
 const {
 data: { subscription },
 } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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
 if (isMounted && userProfile) {
 setProfile(userProfile);
 autoRefreshCleanup.current = setupAutoRefresh();
 }
 // Si null por cuenta inactiva: loadUserProfile ya llamó signOut() → SIGNED_OUT limpia el estado.
 // Si null por timeout/error: mantenemos la sesión activa.
 }

 } else if (event === 'SIGNED_OUT') {
 logAuthEvent('USER_SIGNED_OUT');
 setProfile(null);
 profileCache.clear();
 clearProfileStorage();

 if (autoRefreshCleanup.current) {
 autoRefreshCleanup.current();
 autoRefreshCleanup.current = null;
 }

 } else if (event === 'TOKEN_REFRESHED') {
 logAuthEvent('TOKEN_REFRESHED', { userId: newSession?.user?.id });

 // Si falla por timeout/error, mantenemos el perfil existente —
 // el usuario no debe perder la sesión por lentitud de red en el refresh del token.
 // Si la cuenta fue desactivada, loadUserProfile llama signOut() → SIGNED_OUT lo maneja.
 if (newSession?.user) {
 const userProfile = await loadUserProfile(newSession.user.id);
 if (isMounted && userProfile) {
 setProfile(userProfile);
 }
 }

 } else if (event === 'USER_UPDATED') {
 logAuthEvent('USER_UPDATED', { userId: newSession?.user?.id });

 if (newSession?.user) {
 profileCache.delete(newSession.user.id);
 const userProfile = await loadUserProfile(newSession.user.id);
 if (isMounted && userProfile) {
 setProfile(userProfile);
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
 clearProfileStorage();

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
 console.log(' Auth logs cleared');
};