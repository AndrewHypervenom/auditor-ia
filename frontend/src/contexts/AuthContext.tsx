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
// CONFIGURACIÓN DE CACHÉ
// ============================================
const PROFILE_LOAD_TIMEOUT = 8000; // 8 segundos (solo para primer login sin caché)
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
const PROFILE_STORAGE_KEY = 'auth_profile_cache';

// Caché en memoria (entre renders, pero no sobrevive recargas)
const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();

// ============================================
// HELPERS DE CACHÉ EN LOCALSTORAGE
// ============================================
function saveProfileToStorage(userId: string, profile: UserProfile) {
 try {
 localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
 userId, profile, timestamp: Date.now()
 }));
 } catch {}
}

function clearProfileStorage() {
 localStorage.removeItem(PROFILE_STORAGE_KEY);
}

interface StoredCache {
 userId: string;
 profile: UserProfile;
 timestamp: number;
}

// ============================================
// LECTURA SINCRÓNICA AL CARGAR EL MÓDULO
// Esto corre UNA VEZ al importar el módulo, antes de cualquier render de React.
// Permite inicializar loading=false y profile=cached en el PRIMER render.
// ============================================
const _initialCache = ((): StoredCache | null => {
 if (typeof window === 'undefined') return null;
 try {
 const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
 if (!raw) return null;
 const data: StoredCache = JSON.parse(raw);
 if (!data?.userId || !data?.profile || !data?.timestamp) return null;
 if (Date.now() - data.timestamp > CACHE_DURATION) return null;
 return data;
 } catch { return null; }
})();

// Si hay caché, poblar el Map en memoria inmediatamente (antes de cualquier render)
if (_initialCache) {
 profileCache.set(_initialCache.userId, {
 profile: _initialCache.profile,
 timestamp: _initialCache.timestamp,
 });
}

// ============================================
// LOGGING DE EVENTOS DE AUTENTICACIÓN
// ============================================
const logAuthEvent = (event: string, data?: any) => {
 try {
 const logs = JSON.parse(localStorage.getItem('auth_logs') || '[]');
 logs.unshift({ timestamp: new Date().toISOString(), event, ...data });
 if (logs.length > 50) logs.pop();
 localStorage.setItem('auth_logs', JSON.stringify(logs));
 } catch {}
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
 // ─── ESTADO INICIAL OPTIMISTA ───────────────────────────────────────────────
 // Si hay caché: loading=false y profile=cached desde el PRIMER render.
 // → No hay spinner para usuarios con sesión activa.
 // Si no hay caché: loading=true y profile=null (primer login, flujo normal).
 // ────────────────────────────────────────────────────────────────────────────
 const [user, setUser] = useState<User | null>(null);
 const [profile, setProfile] = useState<UserProfile | null>(_initialCache?.profile ?? null);
 const [session, setSession] = useState<Session | null>(null);
 const [loading, setLoading] = useState<boolean>(!_initialCache);
 const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);

 const isLoadingProfile = useRef(false);
 const initializationComplete = useRef(false);
 const autoRefreshCleanup = useRef<(() => void) | null>(null);

 // ============================================
 // CARGAR PERFIL DE USUARIO (desde DB)
 // ============================================
 const loadUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
 if (isLoadingProfile.current) return null;

 // Verificar caché en memoria primero
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
 timeoutPromise,
 ]) as any;

 if (error || !userProfile) {
 logAuthEvent('PROFILE_LOAD_ERROR', { userId, error: error?.message });
 return null;
 }

 // Verificar cuenta desactivada
 if (userProfile.is_active === false) {
 logAuthEvent('ACCOUNT_INACTIVE_AUTO_LOGOUT', { userId, email: userProfile.email });
 await supabase.auth.signOut();
 profileCache.clear();
 clearProfileStorage();
 return null;
 }

 // Guardar en caché (memoria + localStorage)
 profileCache.set(userId, { profile: userProfile, timestamp: Date.now() });
 saveProfileToStorage(userId, userProfile);

 logAuthEvent('PROFILE_LOADED', { userId, role: userProfile.role });
 return userProfile;
 } catch {
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
 clearProfileStorage();
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
 logAuthEvent('AUTH_INIT_START', { optimistic: !!_initialCache });

 const { data: { session: initialSession }, error } = await supabase.auth.getSession();

 if (!isMounted) return;

 if (error || !initialSession?.user) {
 // Sin sesión válida — limpiar estado optimista si lo había
 if (_initialCache) {
 setProfile(null);
 clearProfileStorage();
 profileCache.clear();
 }
 logAuthEvent('NO_SESSION');
 initializationComplete.current = true;
 setLoading(false);
 return;
 }

 // Sesión válida
 setSession(initialSession);
 setUser(initialSession.user);

 logAuthEvent('SESSION_FOUND', {
 userId: initialSession.user.id,
 email: initialSession.user.email,
 });

 if (_initialCache) {
 // ── MODO OPTIMISTA ─────────────────────────────────────────────
 // Ya teníamos perfil en cache → UI ya está visible (loading=false).
 // Verificar en background sin bloquear nada.
 // ──────────────────────────────────────────────────────────────
 autoRefreshCleanup.current = setupAutoRefresh();
 initializationComplete.current = true;
 // loading ya es false desde useState — no llamar setLoading

 // Si el userId del cache es diferente (otro usuario en mismo browser), limpiar
 if (_initialCache.userId !== initialSession.user.id) {
 profileCache.delete(_initialCache.userId);
 clearProfileStorage();
 const freshProfile = await loadUserProfile(initialSession.user.id);
 if (isMounted && freshProfile) setProfile(freshProfile);
 } else {
 // Background: refrescar perfil sin bloquear
 loadUserProfile(initialSession.user.id).then(freshProfile => {
 if (!isMounted) return;
 if (freshProfile) setProfile(freshProfile);
 // Si null: cuenta desactivada (signOut ya llamado) o error de red (mantener caché)
 });
 }

 } else {
 // ── PRIMER LOGIN / SIN CACHÉ ────────────────────────────────────
 // Cargar perfil desde DB (muestra spinner breve ~1-2s, solo en primer login)
 // ───────────────────────────────────────────────────────────────
 const userProfile = await loadUserProfile(initialSession.user.id);
 if (isMounted && userProfile) {
 setProfile(userProfile);
 autoRefreshCleanup.current = setupAutoRefresh();
 }
 initializationComplete.current = true;
 if (isMounted) setLoading(false);
 }

 } catch (err) {
 logAuthEvent('AUTH_INIT_ERROR', { err });
 initializationComplete.current = true;
 if (isMounted) setLoading(false);
 }
 };

 initAuth();

 // Escuchar cambios de autenticación
 const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
 logAuthEvent('AUTH_STATE_CHANGE', { event });

 if (!isMounted) return;

 setSession(newSession);
 setUser(newSession?.user ?? null);

 if (event === 'SIGNED_IN') {
 logAuthEvent('USER_SIGNED_IN', { userId: newSession?.user?.id });
 if (newSession?.user) {
 const userProfile = await loadUserProfile(newSession.user.id);
 if (isMounted && userProfile) {
 setProfile(userProfile);
 autoRefreshCleanup.current = setupAutoRefresh();
 }
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
 if (newSession?.user) {
 const userProfile = await loadUserProfile(newSession.user.id);
 if (isMounted && userProfile) setProfile(userProfile);
 }

 } else if (event === 'USER_UPDATED') {
 logAuthEvent('USER_UPDATED', { userId: newSession?.user?.id });
 if (newSession?.user) {
 profileCache.delete(newSession.user.id);
 clearProfileStorage();
 const userProfile = await loadUserProfile(newSession.user.id);
 if (isMounted && userProfile) setProfile(userProfile);
 }
 }

 if (isMounted && initializationComplete.current) {
 setLoading(false);
 }
 });

 return () => {
 isMounted = false;
 subscription.unsubscribe();
 if (autoRefreshCleanup.current) autoRefreshCleanup.current();
 };
 }, [loadUserProfile]);

 // ============================================
 // ACTUALIZAR TIEMPO RESTANTE DE SESIÓN
 // ============================================
 useEffect(() => {
 if (!session) { setSessionTimeRemaining(0); return; }

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
 const { error } = await supabase.auth.signInWithPassword({ email, password });
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
 if (userPermissions.some(p => p === 'config:manage')) return true;
 return userPermissions.some(p => p === permission);
 }, [profile]);

 // ============================================
 // VERIFICAR ROL
 // ============================================
 const isRole = useCallback((role: UserRole | UserRole[]): boolean => {
 if (!profile) return false;
 if (Array.isArray(role)) return role.includes(profile.role);
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
 try { return JSON.parse(localStorage.getItem('auth_logs') || '[]'); }
 catch { return []; }
};

export const clearAuthLogs = () => {
 localStorage.removeItem('auth_logs');
};
