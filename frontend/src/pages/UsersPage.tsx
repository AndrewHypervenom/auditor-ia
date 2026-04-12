// frontend/src/pages/UsersPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRole } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { userService } from '../services/api';
import AppHeader from '../components/AppHeader';
import {
 Users,
 Plus,
 Edit,
 Trash2,
 Search,
 Shield,
 Star,
 Eye,
 User as UserIcon,
 CheckCircle,
 XCircle,
 X,
 Save,
 Loader2,
 Mail,
 Calendar,
 Award,
 UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserRole } from '../types/auth.types';

interface User {
 id: string;
 email: string;
 full_name: string | null;
 role: UserRole;
 is_active: boolean;
 created_at: string;
}

interface UserFormData {
 email: string;
 password: string;
 full_name: string;
 role: UserRole;
}

export default function UsersPage() {
 const navigate = useNavigate();
 const { profile } = useAuth();
 const { isAdmin, isSupervisor } = useRole();
 const [users, setUsers] = useState<User[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [editingUser, setEditingUser] = useState<User | null>(null);
 const [submitting, setSubmitting] = useState(false);
 
 const [newUser, setNewUser] = useState<UserFormData>({
 email: '',
 password: '',
 full_name: '',
 role: 'analyst' as UserRole
 });

 const [editForm, setEditForm] = useState({
 full_name: '',
 role: 'analyst' as UserRole
 });

 useEffect(() => {
 // Verificar que sea admin o supervisor
 if (!isAdmin && !isSupervisor) {
 toast.error('No tienes permisos para acceder a esta página');
 navigate('/dashboard');
 return;
 }

 loadUsers();
 }, [profile, isAdmin, isSupervisor]);

 const loadUsers = async () => {
 try {
 setLoading(true);
 
 let query = supabase
 .from('users')
 .select('*')
 .order('created_at', { ascending: false });

 // Si es supervisor, solo mostrar analistas
 if (isSupervisor) {
 query = query.eq('role', 'analyst');
 }

 const { data, error } = await query;

 if (error) throw error;
 setUsers(data || []);
 } catch (error: any) {
 console.error('Error loading users:', error);
 toast.error('Error al cargar usuarios');
 } finally {
 setLoading(false);
 }
 };

 // CORREGIDO: Ahora usa userService que va al backend en Render
 const handleCreateUser = async (e: React.FormEvent) => {
 e.preventDefault();
 
 // Validaciones
 if (!newUser.email || !newUser.password || !newUser.full_name) {
 toast.error('Por favor completa todos los campos');
 return;
 }

 if (newUser.password.length < 6) {
 toast.error('La contraseña debe tener al menos 6 caracteres');
 return;
 }

 try {
 setSubmitting(true);
 
 await userService.createUser(newUser);

 toast.success('Usuario creado exitosamente');
 setShowCreateModal(false);
 setNewUser({
 email: '',
 password: '',
 full_name: '',
 role: 'analyst'
 });
 loadUsers();
 } catch (error: any) {
 console.error('Error creating user:', error);
 const message = error.response?.data?.error || error.message || 'Error al crear usuario';
 toast.error(message);
 } finally {
 setSubmitting(false);
 }
 };

 // CORREGIDO: Ahora usa userService que va al backend en Render
 const handleEditUser = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!editingUser) return;

 try {
 setSubmitting(true);

 await userService.updateUser(editingUser.id, editForm);

 toast.success('Usuario actualizado exitosamente');
 setShowEditModal(false);
 setEditingUser(null);
 loadUsers();
 } catch (error: any) {
 console.error('Error updating user:', error);
 const message = error.response?.data?.error || error.message || 'Error al actualizar usuario';
 toast.error(message);
 } finally {
 setSubmitting(false);
 }
 };

 // CORREGIDO: Ahora usa userService que va al backend en Render
 const handleDeleteUser = async (userId: string, userEmail: string) => {
 if (!confirm(`¿Estás seguro de eliminar al usuario ${userEmail}?`)) {
 return;
 }

 try {
 await userService.deleteUser(userId);

 toast.success('Usuario eliminado exitosamente');
 loadUsers();
 } catch (error: any) {
 console.error('Error deleting user:', error);
 const message = error.response?.data?.error || error.message || 'Error al eliminar usuario';
 toast.error(message);
 }
 };

 const handleToggleActive = async (userId: string, currentStatus: boolean) => {
 try {
 const { error } = await supabase
 .from('users')
 .update({ is_active: !currentStatus })
 .eq('id', userId);

 if (error) throw error;

 toast.success(`Usuario ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
 loadUsers();
 } catch (error: any) {
 console.error('Error toggling user status:', error);
 toast.error('Error al cambiar estado del usuario');
 }
 };

 const getRoleBadge = (role: UserRole) => {
 switch (role) {
 case 'admin':
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/20 border border-red-500/30 rounded-full text-red-300 text-xs font-medium">
 <Shield className="w-3 h-3" />
 Administrador
 </span>
 );
 case 'supervisor':
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-full text-green-300 text-xs font-medium">
 <Eye className="w-3 h-3" />
 Supervisor
 </span>
 );
 case 'analyst':
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-brand-900/30 to-indigo-900/30 border border-brand-700/40 rounded-full text-brand-300 text-xs font-medium">
 <Award className="w-3 h-3" />
 Analista
 </span>
 );
 default:
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800/50 border border-[#1e1e32] rounded-full text-slate-400 text-xs font-medium">
 <UserIcon className="w-3 h-3" />
 {role || 'Sin rol'}
 </span>
 );
 }
 };

 const formatDate = (dateString: string) => {
 return new Date(dateString).toLocaleDateString('es-ES', {
 year: 'numeric',
 month: 'long',
 day: 'numeric'
 });
 };

 const openEditModal = (user: User) => {
 setEditingUser(user);
 setEditForm({
 full_name: user.full_name || '',
 role: user.role
 });
 setShowEditModal(true);
 };

 const filteredUsers = users.filter(user => {
 const searchLower = searchTerm.toLowerCase();
 return (
 user.email.toLowerCase().includes(searchLower) ||
 (user.full_name && user.full_name.toLowerCase().includes(searchLower))
 );
 });

 return (
 <div className="min-h-screen">
 <AppHeader
 showBack
 onBack={() => navigate('/dashboard')}
 rightContent={isAdmin ? (
   <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
     <Plus className="w-3.5 h-3.5" />
     Nuevo Usuario
   </button>
 ) : undefined}
 />

 {/* Main Content */}
 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
 {/* Info Banner */}
 {isSupervisor && (
 <div className="mb-4 p-4 bg-brand-500/10 border border-brand-700/40 rounded-xl">
 <div className="flex items-start gap-3">
 <UserCheck className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
 <div>
 <h3 className="text-brand-400 font-semibold mb-1">Vista de Supervisor</h3>
 <p className="text-slate-400 text-sm">
 Puedes consultar la información de los analistas del equipo. 
 No tienes permisos para crear, editar o eliminar usuarios.
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Search and Stats */}
 <div className="card mb-4">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
 <input
 type="text"
 placeholder="Buscar por nombre o email..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="input pl-10"
 />
 </div>

 <div className="flex items-center gap-4">
 <div className="stat-card">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-brand-500/10 rounded-lg">
 <Users className="w-5 h-5 text-brand-400" />
 </div>
 <div>
 <p className="text-slate-400 text-xs">Total {isSupervisor ? 'Analistas' : 'Usuarios'}</p>
 <p className="text-2xl font-bold text-white">{filteredUsers.length}</p>
 </div>
 </div>
 </div>

 {!isSupervisor && (
 <div className="stat-card bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-green-600/20 rounded-lg">
 <CheckCircle className="w-5 h-5 text-green-400" />
 </div>
 <div>
 <p className="text-slate-400 text-xs">Activos</p>
 <p className="text-2xl font-bold text-white">
 {users.filter(u => u.is_active).length}
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Users Grid - Vista mejorada para ambos roles */}
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
 </div>
 ) : filteredUsers.length === 0 ? (
 <div className="text-center py-8">
 <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
 <p className="text-slate-400">
 {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredUsers.map((user) => (
 <div
 key={user.id}
 className="group relative p-5 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-[#1e1e32] rounded-xl hover:border-brand-700/40 transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/10"
 >
 {/* Status Badge */}
 <div className="absolute top-3 right-3">
 {user.is_active ? (
 <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
 <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
 <span className="text-green-300 text-xs font-medium">Activo</span>
 </div>
 ) : (
 <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
 <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
 <span className="text-red-300 text-xs font-medium">Inactivo</span>
 </div>
 )}
 </div>

 {/* User Avatar */}
 <div className="flex items-start gap-4 mb-4">
 <div className="relative">
 <div className="w-14 h-14 bg-brand-500/20 border border-brand-700/40 rounded-xl flex items-center justify-center">
 <UserIcon className="w-7 h-7 text-white" />
 </div>
 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-800">
 {user.role === 'admin' && <Shield className="w-3 h-3 text-red-400" />}
 {user.role === 'supervisor' && <Eye className="w-3 h-3 text-green-400" />}
 {user.role === 'analyst' && <Award className="w-3 h-3 text-brand-400" />}
 </div>
 </div>

 <div className="flex-1 min-w-0">
 <h3 className="text-sm font-semibold text-white truncate mb-1">
 {user.full_name || 'Sin nombre'}
 </h3>
 {getRoleBadge(user.role)}
 </div>
 </div>

 {/* User Info */}
 <div className="space-y-3 mb-4">
 <div className="flex items-center gap-2 text-sm">
 <Mail className="w-4 h-4 text-slate-500" />
 <span className="text-slate-300 truncate">{user.email}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <Calendar className="w-4 h-4 text-slate-500" />
 <span className="text-slate-400">{formatDate(user.created_at)}</span>
 </div>
 </div>

 {/* Actions - Solo para Admin */}
 {isAdmin && (
 <div className="flex items-center gap-2 pt-4 border-t border-[#1e1e32]">
 <button
 onClick={() => openEditModal(user)}
 className="flex-1 px-3 py-2 bg-brand-500/10 hover:bg-brand-500/30 border border-brand-700/40 text-brand-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
 title="Editar usuario"
 >
 <Edit className="w-4 h-4" />
 Editar
 </button>
 {user.id !== profile?.id && (
 <button
 onClick={() => handleDeleteUser(user.id, user.email)}
 className="flex-1 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
 title="Eliminar usuario"
 >
 <Trash2 className="w-4 h-4" />
 Eliminar
 </button>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </main>

 {/* Modal Crear Usuario - Solo Admin */}
 {showCreateModal && isAdmin && (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
 <div className="bg-[#141424] rounded-2xl p-6 max-w-md w-full border border-[#1e1e32] shadow-2xl">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold text-white">Crear Nuevo Usuario</h2>
 <button
 onClick={() => setShowCreateModal(false)}
 className="text-slate-400 hover:text-white transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleCreateUser} className="space-y-4">
 <div>
 <label className="block text-sm text-slate-400 mb-2">Nombre Completo</label>
 <input
 type="text"
 value={newUser.full_name}
 onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
 className="input"
 placeholder="Juan Pérez"
 required
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">Email</label>
 <input
 type="email"
 value={newUser.email}
 onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
 className="input"
 placeholder="juan@ejemplo.com"
 required
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">Contraseña</label>
 <input
 type="password"
 value={newUser.password}
 onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
 className="input"
 placeholder="Mínimo 6 caracteres"
 required
 minLength={6}
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">Rol</label>
 <select
 value={newUser.role}
 onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
 className="input"
 >
 <option value="analyst">Analista</option>
 <option value="supervisor">Supervisor</option>
 <option value="admin">Administrador</option>
 </select>
 </div>

 <div className="flex gap-3 mt-6">
 <button
 type="button"
 onClick={() => setShowCreateModal(false)}
 className="flex-1 btn-secondary"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Creando...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Crear Usuario
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Modal Editar Usuario - Solo Admin */}
 {showEditModal && editingUser && isAdmin && (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
 <div className="bg-[#141424] rounded-2xl p-6 max-w-md w-full border border-[#1e1e32] shadow-2xl">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold text-white">Editar Usuario</h2>
 <button
 onClick={() => {
 setShowEditModal(false);
 setEditingUser(null);
 }}
 className="text-slate-400 hover:text-white transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleEditUser} className="space-y-4">
 <div>
 <label className="block text-sm text-slate-400 mb-2">Email</label>
 <input
 type="email"
 value={editingUser.email}
 disabled
 className="input opacity-50 cursor-not-allowed"
 />
 <p className="text-xs text-slate-500 mt-1">El email no se puede modificar</p>
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">Nombre Completo</label>
 <input
 type="text"
 value={editForm.full_name}
 onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
 className="input"
 placeholder="Juan Pérez"
 required
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">Rol</label>
 <select
 value={editForm.role}
 onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
 disabled={editingUser.id === profile?.id}
 className="input disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <option value="analyst">Analista</option>
 <option value="supervisor">Supervisor</option>
 <option value="admin">Administrador</option>
 </select>
 {editingUser.id === profile?.id && (
 <p className="text-xs text-slate-500 mt-1">No puedes cambiar tu propio rol</p>
 )}
 </div>

 <div className="flex gap-3 mt-6">
 <button
 type="button"
 onClick={() => {
 setShowEditModal(false);
 setEditingUser(null);
 }}
 className="flex-1 btn-secondary"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Guardando...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Guardar Cambios
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}