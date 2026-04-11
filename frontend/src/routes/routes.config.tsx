// frontend/src/routes/routes.config.tsx

import type { UserRole } from '../types/auth.types';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  DollarSign,
  Settings,
  FileSearch,
  BookOpen
} from 'lucide-react';

export interface RouteConfig {
  path: string;
  name: string;
  icon?: any;
  allowedRoles: UserRole[];
  requirePermission?: string;
  showInMenu?: boolean;
  children?: RouteConfig[];
}

/**
 * Configuración completa de rutas con permisos por rol
 * Según documento AuditorIA v1.0:
 * - Admin: Acceso completo
 * - Analyst: Crear/editar/eliminar auditorías, sin costos
 * - Supervisor: Solo lectura, con costos
 */
export const ROUTES: RouteConfig[] = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['admin', 'supervisor', 'analyst'],
    showInMenu: true,
  },
  {
    path: '/audits/new',
    name: 'Nueva Auditoría',
    icon: PlusCircle,
    allowedRoles: ['admin', 'analyst'],
    requirePermission: 'audits:create',
    showInMenu: true,
  },
  {
    path: '/audits',
    name: 'Auditorías',
    icon: FileText,
    allowedRoles: ['admin', 'supervisor', 'analyst'],
    showInMenu: true,
  },
  {
    path: '/users',
    name: 'Usuarios',
    icon: Users,
    allowedRoles: ['admin', 'supervisor', 'analyst'],
    requirePermission: 'users:read',
    showInMenu: true,
  },
  {
    path: '/costs',
    name: 'Costos',
    icon: DollarSign,
    allowedRoles: ['admin', 'supervisor'],
    requirePermission: 'costs:read:all',
    showInMenu: true,
  },
  {
    path: '/logs',
    name: 'Logs de Auditoría',
    icon: FileSearch,
    allowedRoles: ['admin'],
    requirePermission: 'logs:read',
    showInMenu: true,
  },
  {
    path: '/settings',
    name: 'Configuración',
    icon: Settings,
    allowedRoles: ['admin'],
    requirePermission: 'config:manage',
    showInMenu: true,
  },
  {
    path: '/scripts-admin',
    name: 'Scripts y Criterios',
    icon: BookOpen,
    allowedRoles: ['admin'],
    requirePermission: 'config:manage',
    showInMenu: true,
  },
];

/**
 * Helper: Obtener rutas disponibles para un rol específico
 */
export function getRoutesForRole(role: UserRole): RouteConfig[] {
  return ROUTES.filter(route => route.allowedRoles.includes(role) && route.showInMenu);
}

/**
 * Helper: Verificar si un usuario con un rol específico puede acceder a una ruta
 */
export function canAccessRoute(role: UserRole, path: string): boolean {
  const route = ROUTES.find(r => r.path === path);
  if (!route) return false;
  return route.allowedRoles.includes(role);
}

/**
 * Mensajes de bienvenida personalizados por rol
 */
export const ROLE_WELCOME_MESSAGES: Record<UserRole, string> = {
  admin: '¡Bienvenido al panel de administración! Tienes control total del sistema.',
  analyst: '¡Bienvenido! Puedes crear, editar y gestionar auditorías completas.',
  supervisor: '¡Bienvenido! Puedes consultar auditorías y generar reportes con análisis de costos.',
};

/**
 * Configuración de features disponibles por rol
 */
export const ROLE_FEATURES: Record<UserRole, string[]> = {
  admin: [
    'Gestión completa de usuarios',
    'Crear, editar y eliminar auditorías',
    'Acceso a todos los costos del sistema',
    'Configuración del sistema',
    'Logs de auditoría completos',
  ],
  analyst: [
    'Crear nuevas auditorías',
    'Editar auditorías existentes',
    'Eliminar auditorías',
    'Ver todas las auditorías del sistema',
    'Generar reportes personalizados',
    'Ver transcripciones y análisis',
  ],
  supervisor: [
    'Ver todas las auditorías (solo lectura)',
    'Acceder a detalles completos de auditorías',
    'Consultar costos operativos del sistema',
    'Generar reportes de análisis',
    'Ver tendencias y métricas',
    'Exportar datos en Excel',
  ],
};