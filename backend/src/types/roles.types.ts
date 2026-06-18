// backend/types/roles.types.ts
// Tipos compartidos para el sistema de roles de AuditorIA

/**
 * Roles disponibles en el sistema
 */
export type UserRole = 'superadmin' | 'lider' | 'auditor';

/**
 * Permisos granulares del sistema
 */
export type Permission =
  // Usuarios
  | 'users:create'
  | 'users:read'
  | 'users:update'
  | 'users:delete'
  // Auditorías
  | 'audits:create'
  | 'audits:read:own'
  | 'audits:read:all'
  | 'audits:update:own'
  | 'audits:update:all'
  | 'audits:delete:own'
  | 'audits:delete:all'
  // Costos
  | 'costs:read:own'
  | 'costs:read:all'
  // Configuración
  | 'config:manage'
  // Logs
  | 'logs:read'
  // Roles
  | 'roles:manage'
  // Reportes
  | 'reports:generate'
  | 'reports:generate:own'
  | 'reports:generate:readonly';

/**
 * Definición de un rol
 */
export interface Role {
  id: string;
  name: UserRole;
  display_name: string;
  description: string;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

/**
 * Información de usuario extendida con rol
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  department: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mapa de permisos por rol según documento v1.0
 * 
 * ADMINISTRADOR:
 * - Control total del sistema
 * - Gestión completa de usuarios
 * - Crear, editar y eliminar auditorías
 * - Acceso a costos completos
 * - Configuración del sistema
 * 
 * ANALISTA (Operador Principal):
 * - Crear, editar y eliminar auditorías
 * - Ver todas las auditorías
 * - NO tiene acceso a costos
 * - NO puede gestionar usuarios
 * - NO puede modificar configuración
 * 
 * SUPERVISOR (Consulta Amplia):
 * - SOLO LECTURA de auditorías
 * - NO puede crear, editar ni eliminar auditorías
 * - Puede ver costos (solo lectura)
 * - Puede generar reportes
 * - Puede ver usuarios
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // SUPERADMIN: control total de la plataforma (todas las empresas)
  superadmin: [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'audits:create',
    'audits:read:all',
    'audits:update:all',
    'audits:delete:all',
    'costs:read:all',
    'config:manage',
    'logs:read',
    'roles:manage',
    'reports:generate',
  ],
  // LIDER: administra su propia empresa (gestión, config, endpoints internos)
  lider: [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'audits:create',
    'audits:read:all',
    'audits:update:all',
    'audits:delete:all',
    'costs:read:all',
    'config:manage',
    'logs:read',
    'reports:generate',
  ],
  // AUDITOR: operador de auditorías dentro de su empresa
  auditor: [
    'audits:create',
    'audits:read:all',
    'audits:update:all',
    'audits:delete:all',
    'reports:generate',
    // Sin acceso a costos
    // Sin gestión de usuarios
    // Sin configuración del sistema
  ],
};

/**
 * Información de cada rol para mostrar en UI
 */
export const ROLE_INFO: Record<UserRole, { label: string; description: string; color: string }> = {
  superadmin: {
    label: 'Super Administrador',
    description: 'Control total de la plataforma - Todas las empresas',
    color: 'red',
  },
  lider: {
    label: 'Líder',
    description: 'Administra su empresa - Config, APIs/endpoints internos y equipo',
    color: 'purple',
  },
  auditor: {
    label: 'Auditor',
    description: 'Operador de auditorías de su empresa',
    color: 'blue',
  },
};

/**
 * Función helper para verificar si un usuario tiene un permiso
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Función helper para verificar si un usuario puede acceder a una ruta
 */
export function canAccessRoute(role: UserRole, route: string): boolean {
  const routePermissions: Record<string, Permission[]> = {
    '/dashboard': ['audits:read:own', 'audits:read:all'],
    '/audits/new': ['audits:create'],
    '/audits/:id': ['audits:read:own', 'audits:read:all'],
    '/users': ['users:read'],
    '/users/new': ['users:create'],
    '/costs': ['costs:read:all'],
    '/settings': ['config:manage'],
    '/logs': ['logs:read'],
  };

  const requiredPermissions = routePermissions[route];
  if (!requiredPermissions) return true; // Ruta pública

  return requiredPermissions.some(permission => hasPermission(role, permission));
}

/**
 * Tipo para el contexto de autenticación
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | null;
  avatar_url?: string | null;
}