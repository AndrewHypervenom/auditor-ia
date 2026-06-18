// frontend/src/types/auth.types.ts

/**
 * Roles disponibles en el sistema AuditorIA
 * Basado en el documento oficial "Sistema de Roles y Permisos v1.0"
 * 
 * - superadmin: Super Administrador (control total de la plataforma, todas las empresas)
 * - lider: Líder (administra su empresa: config, APIs/endpoints internos, equipo, costos)
 * - auditor: Auditor (operador de auditorías de su empresa)
 */
export type UserRole = 'superadmin' | 'lider' | 'auditor';

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
  company_id: string | null;
  company_name?: string;
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
  | 'reports:generate'
  // Gestión de plataforma
  | 'companies:manage';

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
  // SUPERADMIN: control total de la plataforma (todas las empresas)
  superadmin: [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'audits:create',
    'audits:read:all',
    'audits:update',
    'audits:delete',
    'costs:read',
    'costs:read:all',
    'config:manage',
    'logs:read',
    'reports:generate',
    'companies:manage',
  ],
  // LIDER: administra su empresa (equipo, config, APIs/endpoints internos, costos)
  lider: [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'audits:create',
    'audits:read:all',
    'audits:update',
    'audits:delete',
    'costs:read',
    'costs:read:all',
    'config:manage',
    'logs:read',
    'reports:generate',
  ],
  // AUDITOR: operador de auditorías de su empresa
  auditor: [
    'users:read',
    'audits:create',
    'audits:read:all',
    'audits:update',
    'audits:delete',
    'reports:generate',
    // SIN ACCESO A: costos, configuración, logs
  ],
};

/**
 * Información visual de cada rol según documento oficial
 */
export const ROLE_INFO: Record<UserRole, { label: string; description: string; color: string }> = {
  superadmin: {
    label: 'Super Administrador',
    description: 'Control total de la plataforma - Todas las empresas',
    color: 'red',
  },
  lider: {
    label: 'Líder',
    description: 'Administra su empresa: config, APIs/endpoints y equipo',
    color: 'purple',
  },
  auditor: {
    label: 'Auditor',
    description: 'Operador de auditorías de su empresa',
    color: 'blue',
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