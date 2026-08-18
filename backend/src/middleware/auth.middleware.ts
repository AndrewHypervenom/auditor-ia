// backend/src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export type UserRole = 'superadmin' | 'lider' | 'auditor';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        full_name?: string;
        company_id: string | null; // null solo para admin (ve todas las empresas)
      };
    }
  }
}

// ── Caché de sesión en memoria ───────────────────────────────
// Cada request pagaba 3 viajes de red a Supabase (getUser + select users +
// update last_login_at). En pantallas de administración eso multiplicaba la
// latencia percibida de cada guardado. Guardamos el usuario resuelto por token
// durante un lapso corto: los cambios de rol/empresa/estado se propagan al
// expirar la entrada, o de inmediato vía invalidateUserAuthCache().
type CachedUser = NonNullable<Express.Request['user']>;

interface AuthCacheEntry {
  user: CachedUser;
  expiresAt: number;
}

const AUTH_CACHE_TTL_MS = 60 * 1000;
const AUTH_CACHE_MAX_ENTRIES = 5000;
const authCache = new Map<string, AuthCacheEntry>();

// last_login_at es en la práctica un "visto por última vez": no necesita
// escribirse en cada request. Se escribe como mucho una vez cada 10 minutos
// por usuario y sin bloquear la respuesta.
const LAST_SEEN_THROTTLE_MS = 10 * 60 * 1000;
const lastSeenWrittenAt = new Map<string, number>();

/** Invalida la sesión cacheada de un usuario (cambio de rol, baja, etc.). */
export function invalidateUserAuthCache(userId?: string): void {
  if (!userId) {
    authCache.clear();
    return;
  }
  for (const [token, entry] of authCache) {
    if (entry.user.id === userId) authCache.delete(token);
  }
}

function getCachedUser(token: string): CachedUser | null {
  const entry = authCache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    authCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedUser(token: string, user: CachedUser): void {
  // Purga barata: al llegar al tope se limpian las entradas ya vencidas y,
  // si aún no alcanza, se descartan las más antiguas (Map preserva inserción).
  if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of authCache) if (v.expiresAt <= now) authCache.delete(k);
    while (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
      const oldest = authCache.keys().next().value;
      if (oldest === undefined) break;
      authCache.delete(oldest);
    }
  }
  authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

/** Marca actividad del usuario sin bloquear la respuesta ni escribir de más. */
function touchLastSeen(userId: string): void {
  const now = Date.now();
  const previous = lastSeenWrittenAt.get(userId) ?? 0;
  if (now - previous < LAST_SEEN_THROTTLE_MS) return;
  lastSeenWrittenAt.set(userId, now);
  void supabaseAdmin
    .from('users')
    .update({ last_login_at: new Date(now).toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) logger.warn('No se pudo actualizar last_login_at', { userId, error: error.message });
    });
}

/**
 * Middleware para verificar JWT de Supabase y extraer información del usuario
 */
export const authenticateUser = async (
 req: Request,
 res: Response,
 next: NextFunction
) => {
 try {
 // Obtener token del header Authorization
 const authHeader = req.headers.authorization;

 if (!authHeader || !authHeader.startsWith('Bearer ')) {
 return res.status(401).json({ error: 'No authorization token provided' });
 }

 const token = authHeader.substring(7); // Remover "Bearer "

 // Sesión ya resuelta hace poco → sin viajes a Supabase
 const cached = getCachedUser(token);
 if (cached) {
 req.user = cached;
 touchLastSeen(cached.id);
 return next();
 }

 // Verificar token con Supabase
 const { data: { user }, error } = await supabase.auth.getUser(token);

 if (error || !user) {
 logger.warn(' Invalid or expired token', { error: error?.message });
 return res.status(401).json({ error: 'Invalid or expired token' });
 }

 // Obtener perfil del usuario con rol
 // Intentar con company_id (post-migración); si la columna no existe, caer sin ella
 let { data: profile, error: profileError } = await supabaseAdmin
 .from('users')
 .select('role, full_name, is_active, company_id')
 .eq('id', user.id)
 .single();

 // Si falla por columna inexistente (pre-migración), reintentar sin company_id
 if (profileError && (profileError.code === 'PGRST200' || profileError.message?.includes('company_id'))) {
 const fallback = await supabaseAdmin
 .from('users')
 .select('role, full_name, is_active')
 .eq('id', user.id)
 .single();
 profile = fallback.data ? { ...fallback.data, company_id: null } : null;
 profileError = fallback.error;
 }

 // Si el usuario no existe en la tabla users, crearlo con rol analyst por defecto
 if (profileError && profileError.code === 'PGRST116') {
 logger.info(' User profile not found, creating with default analyst role...', { 
 userId: user.id, 
 email: user.email 
 });
 
 const { data: newProfile, error: createError } = await supabaseAdmin
 .from('users')
 .insert({
 id: user.id,
 email: user.email,
 full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
 role: 'auditor', // Rol por defecto (operador de auditorías)
 is_active: true
 })
 .select('role, full_name, is_active, company_id')
 .single();

 if (createError) {
 logger.error(' Error creating user profile', createError);
 return res.status(500).json({ error: 'Error creating user profile' });
 }

 profile = newProfile;
 logger.success(' User profile created successfully', { userId: user.id, role: 'auditor' });
 } else if (profileError) {
 logger.error(' Error fetching user profile', profileError);
 return res.status(500).json({ error: 'Error fetching user profile' });
 }

 // Verificar si el usuario está activo
 if (!profile?.is_active) {
 logger.warn(' Inactive user attempted to access', { userId: user.id, email: user.email });
 return res.status(403).json({ error: 'User account is inactive' });
 }

 // Actualizar last_login_at (throttled, sin bloquear la respuesta)
 touchLastSeen(user.id);

 // Agregar usuario al request
 req.user = {
 id: user.id,
 email: user.email!,
 role: (profile?.role as UserRole) || 'auditor',
 full_name: profile?.full_name || undefined,
 company_id: profile?.company_id ?? null
 };

 setCachedUser(token, req.user);

 logger.info(' User authenticated', { 
 userId: req.user.id, 
 email: req.user.email, 
 role: req.user.role 
 });
 
 next();
 } catch (error: any) {
 logger.error(' Authentication error', error);
 return res.status(500).json({ error: 'Internal authentication error' });
 }
};

/**
 * Middleware para verificar que el usuario sea Admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
 if (!req.user) {
 return res.status(401).json({ error: 'Not authenticated' });
 }

 if (req.user.role !== 'superadmin') {
 logger.warn(' Unauthorized access attempt to admin resource', {
 userId: req.user.id,
 role: req.user.role
 });
 return res.status(403).json({
 error: 'Insufficient permissions',
 message: 'This action requires superadmin privileges'
 });
 }

 next();
};

/**
 * Middleware para operaciones (crear/editar/eliminar auditorías y configuración
 * operativa). Lo pueden hacer superadmin, lider (gestor de su empresa) y auditor.
 */
export const requireAdminOrAnalyst = (req: Request, res: Response, next: NextFunction) => {
 if (!req.user) {
 return res.status(401).json({ error: 'Not authenticated' });
 }

 if (!['superadmin', 'lider', 'auditor'].includes(req.user.role)) {
 logger.warn(' Unauthorized access attempt', {
 userId: req.user.id,
 role: req.user.role,
 requiredRoles: ['superadmin', 'lider', 'auditor']
 });
 return res.status(403).json({
 error: 'Insufficient permissions',
 message: 'This action requires superadmin, lider or auditor privileges'
 });
 }

 next();
};

/**
 * Middleware para verificar roles específicos
 * @param allowedRoles - Array de roles permitidos
 */
export const requireRoles = (allowedRoles: UserRole[]) => {
 return (req: Request, res: Response, next: NextFunction) => {
 if (!req.user) {
 return res.status(401).json({ error: 'Not authenticated' });
 }

 if (!allowedRoles.includes(req.user.role)) {
 logger.warn(' Unauthorized access attempt', {
 userId: req.user.id,
 role: req.user.role,
 requiredRoles: allowedRoles
 });
 return res.status(403).json({ 
 error: 'Insufficient permissions',
 message: `This action requires one of the following roles: ${allowedRoles.join(', ')}` 
 });
 }

 next();
 };
};

/**
 * Middleware para verificar que el usuario puede acceder a una auditoría específica
 * Todos los roles (Admin, Analyst, Supervisor) pueden ver todas las auditorías
 */
export const canAccessAudit = async (req: Request, res: Response, next: NextFunction) => {
 if (!req.user) {
 return res.status(401).json({ error: 'Not authenticated' });
 }

 const auditId = req.params.id;

 if (!auditId) {
 return res.status(400).json({ error: 'Audit ID is required' });
 }

 try {
 // Todos los roles tienen acceso de lectura a las auditorías de su empresa
 if (['superadmin', 'lider', 'auditor'].includes(req.user.role)) {
 return next();
 }

 // Rol desconocido
 return res.status(403).json({ error: 'Insufficient permissions' });
 } catch (error: any) {
 logger.error(' Error in canAccessAudit middleware', error);
 return res.status(500).json({ error: 'Internal server error' });
 }
};

/**
 * Middleware para gestores de empresa/plataforma (superadmin y lider).
 * El lider gestiona su propia empresa; el superadmin todas.
 */
export const requireAdminOrSupervisor = (req: Request, res: Response, next: NextFunction) => {
 if (!req.user) {
 return res.status(401).json({ error: 'Not authenticated' });
 }

 if (!['superadmin', 'lider'].includes(req.user.role)) {
 logger.warn(' Unauthorized access attempt', {
 userId: req.user.id,
 role: req.user.role,
 requiredRoles: ['superadmin', 'lider']
 });
 return res.status(403).json({
 error: 'Insufficient permissions',
 message: 'This action requires administrator or supervisor privileges'
 });
 }

 next();
};

/**
 * Helper: Verificar si el usuario tiene un permiso específico
 * Permisos actualizados según documento AuditorIA v1.0
 * 
 * ADMIN: Control total
 * ANALYST: Crear/editar/eliminar auditorías, NO costos
 * SUPERVISOR: Solo lectura, SÍ costos
 */
export function hasPermission(role: UserRole, permission: string): boolean {
 const permissions: Record<UserRole, string[]> = {
 superadmin: ['*'], // Superadmin tiene todos los permisos (todas las empresas)
 lider: ['*'], // Lider tiene todos los permisos dentro de su empresa
 auditor: [
 'audits:create',
 'audits:read',
 'audits:update',
 'audits:delete',
 'users:read',
 'reports:generate'
 // NO incluye 'costs:read'
 ]
 };

 const userPermissions = permissions[role] || [];
 
 // Admin tiene todos los permisos
 if (userPermissions.includes('*')) {
 return true;
 }

 return userPermissions.includes(permission);
}