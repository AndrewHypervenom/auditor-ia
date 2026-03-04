// frontend/src/types/auth.types.ts

/**
 * Roles disponibles en el sistema AuditorIA
 * Basado en el documento oficial "Sistema de Roles y Permisos v1.0"
 * 
 * - admin: Administrador/Desarrollador (control total)
 * - analyst: Analista/Operador Principal (gestión completa de auditorías)
 * - supervisor: Supervisor/Consulta Amplia (solo lectura con acceso a costos)
 */
export type UserRole = 'admin' | 'analyst' | 'supervisor';

/**
 * Perfil extendido del usuario
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Permisos del sistema según documento oficial
 */
export type Permission =
  // Gestión de Usuarios
  | 'users:create'
  | 'users:read'
  | 'users:update'
  | 'users:delete'
  // Auditorías
  | 'audits:create'
  | 'audits:read:all'
  | 'audits:update'
  | 'audits:delete'
  // Costos
  | 'costs:read'
  | 'costs:read:all'
  // Configuración
  | 'config:manage'
  // Logs y Seguridad
  | 'logs:read'
  // Reportes
  | 'reports:generate';

/**
 * Mapa de permisos por rol según documento oficial
 * 
 * ADMIN (Administrador/Desarrollador):
 * - Control total del sistema
 * - Gestión de usuarios, configuración, base de datos
 * - Acceso completo a costos y logs
 * 
 * ANALYST (Analista/Operador Principal):
 * - Crear, editar, eliminar auditorías
 * - Ver todas las auditorías del sistema
 * - Generar reportes
 * - SIN acceso a: configuración, usuarios, costos
 * 
 * SUPERVISOR (Supervisor/Consulta Amplia):
 * - Solo lectura de auditorías (NO puede crear/editar/eliminar)
 * - Acceso completo a costos y estadísticas
 * - Generar reportes de solo lectura
 * - Ver lista de usuarios (sin modificar)
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Usuarios
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    // Auditorías
    'audits:create',
    'audits:read:all',
    'audits:update',
    'audits:delete',
    // Costos
    'costs:read',
    'costs:read:all',
    // Configuración
    'config:manage',
    // Logs
    'logs:read',
    // Reportes
    'reports:generate',
  ],
  analyst: [
    // Usuarios (solo lectura básica)
    'users:read',
    // Auditorías (gestión completa)
    'audits:create',
    'audits:read:all',
    'audits:update',
    'audits:delete',
    // Reportes
    'reports:generate',
    // SIN ACCESO A: costos, configuración, logs
  ],
  supervisor: [
    // Usuarios (solo consulta)
    'users:read',
    // Auditorías (SOLO LECTURA)
    'audits:read:all',
    // Costos (acceso completo de lectura)
    'costs:read',
    'costs:read:all',
    // Reportes (solo lectura)
    'reports:generate',
    // SIN ACCESO A: crear/editar/eliminar auditorías, configuración, logs
  ],
};

/**
 * Información visual de cada rol según documento oficial
 */
export const ROLE_INFO: Record<UserRole, { label: string; description: string; color: string }> = {
  admin: {
    label: 'Administrador',
    description: 'Control total del sistema',
    color: 'red',
  },
  analyst: {
    label: 'Analista',
    description: 'Gestión completa de auditorías',
    color: 'blue',
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Consulta amplia con acceso a costos',
    color: 'green',
  },
};

/**
 * Verificar si un rol tiene un permiso específico
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Verificar si un rol puede crear auditorías
 */
export function canCreateAudits(role: UserRole): boolean {
  return hasPermission(role, 'audits:create');
}

/**
 * Verificar si un rol puede editar auditorías
 */
export function canEditAudits(role: UserRole): boolean {
  return hasPermission(role, 'audits:update');
}

/**
 * Verificar si un rol puede ver costos
 */
export function canViewCosts(role: UserRole): boolean {
  return hasPermission(role, 'costs:read') || hasPermission(role, 'costs:read:all');
}

/**
 * Verificar si un rol puede gestionar usuarios
 */
export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'users:create') && 
         hasPermission(role, 'users:update') && 
         hasPermission(role, 'users:delete');
}

/**
 * Verificar si un rol puede acceder a configuración
 */
export function canManageConfig(role: UserRole): boolean {
  return hasPermission(role, 'config:manage');
}