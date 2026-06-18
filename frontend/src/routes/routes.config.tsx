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
  BookOpen,
  Plug
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
    allowedRoles: ['superadmin', 'lider', 'auditor'],
    showInMenu: true,
  },
  {
    path: '/audits/new',
    name: 'Nueva Auditoría',
    icon: PlusCircle,
    allowedRoles: ['superadmin', 'lider', 'auditor'],
    requirePermission: 'audits:create',
    showInMenu: true,
  },
  {
    path: '/audits',
    name: 'Auditorías',
    icon: FileText,
    allowedRoles: ['superadmin', 'lider', 'auditor'],
    showInMenu: true,
  },
  {
    path: '/users',
    name: 'Usuarios',
    icon: Users,
    allowedRoles: ['superadmin', 'lider', 'auditor'],
    requirePermission: 'users:read',
    showInMenu: true,
  },
  {
    path: '/costs',
    name: 'Costos',
    icon: DollarSign,
    allowedRoles: ['superadmin', 'lider'],
    requirePermission: 'costs:read:all',
    showInMenu: true,
  },
  {
    path: '/logs',
    name: 'Logs de Auditoría',
    icon: FileSearch,
    allowedRoles: ['superadmin'],
    requirePermission: 'logs:read',
    showInMenu: true,
  },
  {
    path: '/integrations',
    name: 'Integraciones',
    icon: Plug,
    allowedRoles: ['superadmin', 'lider'],
    showInMenu: true,
  },
  {
    path: '/settings',
    name: 'Configuración',
    icon: Settings,
    allowedRoles: ['superadmin'],
    requirePermission: 'config:manage',
    showInMenu: true,
  },
  {
    path: '/scripts-admin',
    name: 'Scripts y Criterios',
    icon: BookOpen,
    allowedRoles: ['superadmin', 'lider', 'auditor'],
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
  superadmin: '¡Bienvenido al panel de administración! Tienes control total de la plataforma.',
  lider: '¡Bienvenido! Administras tu empresa: equipo, configuración, APIs/endpoints y reportes.',
  auditor: '¡Bienvenido! Puedes crear, editar y gestionar auditorías de tu empresa.',
};

/**
 * Configuración de features disponibles por rol
 */
export const ROLE_FEATURES: Record<UserRole, string[]> = {
  superadmin: [
    'Control total de todas las empresas',
    'Gestión completa de usuarios',
    'Crear, editar y eliminar auditorías',
    'Acceso a todos los costos de la plataforma',
    'Configuración global y APIs',
    'Logs de auditoría completos',
  ],
  lider: [
    'Gestión del equipo de su empresa',
    'Crear, editar y eliminar auditorías',
    'Configurar APIs/endpoints internos de su empresa',
    'Consultar costos de su empresa',
    'Generar reportes de análisis',
    'Exportar datos en Excel',
  ],
  auditor: [
    'Crear nuevas auditorías',
    'Editar auditorías existentes',
    'Eliminar auditorías',
    'Ver todas las auditorías de su empresa',
    'Generar reportes personalizados',
    'Ver transcripciones y análisis',
  ],
};