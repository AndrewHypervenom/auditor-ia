// frontend/src/pages/UsersPage.tsx
import { motion, AnimatePresence } from 'motion/react';
import { Stagger, MotionCard, CountUp, EASE_SPRING } from '../lib/motion';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useRole } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { userService, companyService } from '../services/api';
import AppHeader from '../components/AppHeader';
import {
 Users,
 Plus,
 Edit,
 Trash2,
 Search,
 Shield,
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
 UserCheck,
 Building2,
 KeyRound
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
 company_id: string | null;
}

interface Company {
 id: string;
 name: string;
}

interface UserFormData {
 email: string;
 password: string;
 full_name: string;
 role: UserRole;
 company_id: string;
}

export default function UsersPage() {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const { profile } = useAuth();
 const { isAdmin, isSupervisor, isSuperadmin } = useRole();
 const [users, setUsers] = useState<User[]>([]);
 const [companies, setCompanies] = useState<Company[]>([]);
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
 role: 'auditor' as UserRole,
 company_id: ''
 });

 const [editForm, setEditForm] = useState({
 full_name: '',
 role: 'auditor' as UserRole,
 company_id: '',
 password: ''
 });

 useEffect(() => {
 // Verificar que sea admin o supervisor
 if (!isAdmin && !isSupervisor) {
 toast.error(t('usersPage.noPermission'));
 navigate('/dashboard');
 return;
 }

 loadUsers();
 // El superadmin gestiona usuarios de todas las empresas: necesita la lista
 // para asignar/reasignar empresa y mostrar a qué empresa pertenece cada uno.
 if (isSuperadmin) loadCompanies();
 }, [profile, isAdmin, isSupervisor]);

 const loadCompanies = async () => {
 try {
 const data = await companyService.getAll();
 setCompanies((data || []).map((c: any) => ({ id: c.id, name: c.name })));
 } catch (error) {
 console.error('Error loading companies:', error);
 }
 };

 const companyName = (id: string | null) =>
 companies.find(c => c.id === id)?.name || '—';

 // Cerrar modales con Escape (detalle premium de teclado)
 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (e.key !== 'Escape') return;
 setShowCreateModal(false);
 setShowEditModal(false);
 setEditingUser(null);
 };
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, []);

 const loadUsers = async () => {
 try {
 setLoading(true);
 
 let query = supabase
 .from('users')
 .select('*')
 .order('created_at', { ascending: false });

 // Aislamiento por empresa: el superadmin ve todas; el resto solo su empresa
 if (profile?.role !== 'superadmin' && profile?.company_id) {
 query = query.eq('company_id', profile.company_id);
 }

 // El lider solo gestiona a los auditores de su equipo
 if (isSupervisor) {
 query = query.eq('role', 'auditor');
 }

 const { data, error } = await query;

 if (error) throw error;
 setUsers(data || []);
 } catch (error: any) {
 console.error('Error loading users:', error);
 toast.error(t('usersPage.loadError'));
 } finally {
 setLoading(false);
 }
 };

 // CORREGIDO: Ahora usa userService que va al backend en Render
 const handleCreateUser = async (e: React.FormEvent) => {
 e.preventDefault();
 
 // Validaciones
 if (!newUser.email || !newUser.password || !newUser.full_name) {
 toast.error(t('usersPage.fillFields'));
 return;
 }

 if (newUser.password.length < 6) {
 toast.error(t('usersPage.passwordMin'));
 return;
 }

 // El superadmin debe indicar a qué empresa pertenece el nuevo usuario
 if (isSuperadmin && !newUser.company_id) {
 toast.error(t('usersPage.selectCompany'));
 return;
 }

 try {
 setSubmitting(true);

 await userService.createUser({
 email: newUser.email,
 password: newUser.password,
 full_name: newUser.full_name,
 role: newUser.role,
 ...(isSuperadmin && { company_id: newUser.company_id })
 });

 toast.success(t('usersPage.created'));
 setShowCreateModal(false);
 setNewUser({
 email: '',
 password: '',
 full_name: '',
 role: 'auditor',
 company_id: ''
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

 if (editForm.password && editForm.password.length < 6) {
 toast.error(t('usersPage.passwordMin'));
 return;
 }

 try {
 setSubmitting(true);

 await userService.updateUser(editingUser.id, {
 full_name: editForm.full_name,
 role: editForm.role,
 ...(editForm.password && { password: editForm.password }),
 ...(isSuperadmin && editForm.company_id && { company_id: editForm.company_id })
 });

 toast.success(t('usersPage.updated'));
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

 toast.success(t('usersPage.deleted'));
 loadUsers();
 } catch (error: any) {
 console.error('Error deleting user:', error);
 const message = error.response?.data?.error || error.message || 'Error al eliminar usuario';
 toast.error(message);
 }
 };

 // Activa/desactiva vía backend (respeta permisos y funciona cross-empresa
 // para el superadmin, a diferencia del cliente supabase sujeto a RLS).
 const handleToggleActive = async (userId: string, currentStatus: boolean) => {
 try {
 await userService.updateUser(userId, { is_active: !currentStatus });

 toast.success(!currentStatus ? t('usersPage.activated') : t('usersPage.deactivated'));
 loadUsers();
 } catch (error: any) {
 console.error('Error toggling user status:', error);
 const message = error.response?.data?.error || error.message || t('usersPage.loadError');
 toast.error(message);
 }
 };

 const getRoleBadge = (role: UserRole) => {
 switch (role) {
 case 'superadmin':
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/20 border border-red-500/30 rounded-full text-red-300 text-xs font-medium">
 <Shield className="w-3 h-3" />
 {t('usersPage.roleAdmin')}
 </span>
 );
 case 'lider':
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-900/30 to-fuchsia-900/30 border border-purple-500/30 rounded-full text-purple-300 text-xs font-medium">
 <Eye className="w-3 h-3" />
 {t('usersPage.roleSupervisor')}
 </span>
 );
 case 'auditor':
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-brand-900/30 to-indigo-900/30 border border-brand-700/40 rounded-full text-brand-300 text-xs font-medium">
 <Award className="w-3 h-3" />
 {t('usersPage.roleAnalyst')}
 </span>
 );
 default:
 return (
 <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800/50 border border-[#1e1e32] rounded-full text-slate-400 text-xs font-medium">
 <UserIcon className="w-3 h-3" />
 {role || t('usersPage.noRole')}
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
 role: user.role,
 company_id: user.company_id || '',
 password: ''
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
 title={isSupervisor ? t('usersPage.teamTitle') : t('usersPage.manageTitle')}
 rightContent={isAdmin ? (
   <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
     <Plus className="w-3.5 h-3.5" />
     {t('usersPage.newUser')}
   </button>
 ) : undefined}
 />

 {/* Main Content */}
 <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.06 }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
 {/* Info Banner */}
 {isSupervisor && (
 <div className="mb-4 p-4 bg-brand-500/10 border border-brand-700/40 rounded-xl">
 <div className="flex items-start gap-3">
 <UserCheck className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
 <div>
 <h3 className="text-brand-400 font-semibold mb-1">{t('usersPage.supervisorBannerTitle')}</h3>
 <p className="text-slate-400 text-sm">
 {t('usersPage.supervisorBannerDesc')}
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
 placeholder={t('usersPage.searchPlaceholder')}
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="input pl-10"
 />
 </div>

 <div className="flex items-center gap-4">
 <motion.div
 className="stat-card"
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ ...EASE_SPRING, delay: 0.05 }}
 whileHover={{ y: -3 }}
 >
 <div className="flex items-center gap-3">
 <div className="p-2 bg-brand-500/10 rounded-lg">
 <Users className="w-5 h-5 text-brand-400" />
 </div>
 <div>
 <p className="text-slate-400 text-xs">{isSupervisor ? t('usersPage.totalAnalysts') : t('usersPage.totalUsers')}</p>
 <p className="text-2xl font-bold text-white tabular-nums"><CountUp value={filteredUsers.length} /></p>
 </div>
 </div>
 </motion.div>

 {!isSupervisor && (
 <motion.div
 className="stat-card bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30"
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ ...EASE_SPRING, delay: 0.12 }}
 whileHover={{ y: -3 }}
 >
 <div className="flex items-center gap-3">
 <div className="p-2 bg-green-600/20 rounded-lg">
 <CheckCircle className="w-5 h-5 text-green-400" />
 </div>
 <div>
 <p className="text-slate-400 text-xs">{t('usersPage.active')}</p>
 <p className="text-2xl font-bold text-white tabular-nums">
 <CountUp value={users.filter(u => u.is_active).length} />
 </p>
 </div>
 </div>
 </motion.div>
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
 {searchTerm ? t('usersPage.noUsers') : t('usersPage.noUsersYet')}
 </p>
 </div>
 ) : (
 <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredUsers.map((user) => (
 <MotionCard
 key={user.id}
 lift={false}
 className="group relative p-5 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-[#1e1e32] rounded-xl hover:border-brand-700/40 transition-colors duration-300 hover:shadow-lg hover:shadow-brand-500/10"
 >
 {/* Status Badge */}
 <div className="absolute top-3 right-3">
 {user.is_active ? (
 <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
 <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
 <span className="text-green-300 text-xs font-medium">{t('usersPage.statusActive')}</span>
 </div>
 ) : (
 <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
 <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
 <span className="text-red-300 text-xs font-medium">{t('usersPage.statusInactive')}</span>
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
 {user.role === 'superadmin' && <Shield className="w-3 h-3 text-red-400" />}
 {user.role === 'lider' && <Eye className="w-3 h-3 text-purple-400" />}
 {user.role === 'auditor' && <Award className="w-3 h-3 text-brand-400" />}
 </div>
 </div>

 <div className="flex-1 min-w-0">
 <h3 className="text-sm font-semibold text-white truncate mb-1">
 {user.full_name || t('usersPage.noName')}
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
 {isSuperadmin && (
 <div className="flex items-center gap-2 text-sm">
 <Building2 className="w-4 h-4 text-slate-500" />
 <span className="text-slate-400 truncate">{companyName(user.company_id)}</span>
 </div>
 )}
 </div>

 {/* Actions - Solo para Admin */}
 {isAdmin && (
 <div className="flex items-center gap-2 pt-4 border-t border-[#1e1e32]">
 <motion.button
 onClick={() => openEditModal(user)}
 whileHover={{ scale: 1.03 }}
 whileTap={{ scale: 0.96 }}
 transition={EASE_SPRING}
 className="flex-1 px-3 py-2 bg-brand-500/10 hover:bg-brand-500/30 border border-brand-700/40 text-brand-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
 title={t('usersPage.editTooltip')}
 >
 <Edit className="w-4 h-4" />
 {t('usersPage.editBtn')}
 </motion.button>
 {user.id !== profile?.id && (
 <motion.button
 onClick={() => handleToggleActive(user.id, user.is_active)}
 whileHover={{ scale: 1.06 }}
 whileTap={{ scale: 0.94 }}
 transition={EASE_SPRING}
 className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm font-medium border ${
 user.is_active
 ? 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/30 text-amber-300'
 : 'bg-green-600/20 hover:bg-green-600/30 border-green-500/30 text-green-300'
 }`}
 title={user.is_active ? t('usersPage.deactivateTooltip') : t('usersPage.activateTooltip')}
 >
 {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
 </motion.button>
 )}
 {user.id !== profile?.id && (
 <motion.button
 onClick={() => handleDeleteUser(user.id, user.email)}
 whileHover={{ scale: 1.06 }}
 whileTap={{ scale: 0.94 }}
 transition={EASE_SPRING}
 className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
 title={t('usersPage.deleteTooltip')}
 >
 <Trash2 className="w-4 h-4" />
 </motion.button>
 )}
 </div>
 )}
 </MotionCard>
 ))}
 </Stagger>
 )}
 </div>
 </motion.main>

 {/* Modal Crear Usuario - Solo Admin */}
 <AnimatePresence>
 {showCreateModal && isAdmin && (
 <motion.div
 className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 onClick={() => setShowCreateModal(false)}
 >
 <motion.div
 className="bg-[#141424] rounded-2xl p-6 max-w-md w-full border border-[#1e1e32] shadow-2xl"
 initial={{ opacity: 0, scale: 0.94, y: 16 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.96, y: 8 }}
 transition={EASE_SPRING}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold text-white">{t('usersPage.createTitle')}</h2>
 <button
 onClick={() => setShowCreateModal(false)}
 className="text-slate-400 hover:text-white transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleCreateUser} className="space-y-4">
 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.nameLabel')}</label>
 <input
 type="text"
 value={newUser.full_name}
 onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
 className="input"
 placeholder={t('usersPage.namePlaceholder')}
 required
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.emailLabel')}</label>
 <input
 type="email"
 value={newUser.email}
 onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
 className="input"
 placeholder={t('usersPage.emailPlaceholder')}
 required
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.passwordLabel')}</label>
 <input
 type="password"
 value={newUser.password}
 onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
 className="input"
 placeholder={t('usersPage.passwordPlaceholder')}
 required
 minLength={6}
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.roleLabel')}</label>
 <select
 value={newUser.role}
 onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
 className="input"
 >
 <option value="auditor">{t('usersPage.roleAnalyst')}</option>
 <option value="lider">{t('usersPage.roleSupervisor')}</option>
 {isAdmin && <option value="superadmin">{t('usersPage.roleAdmin')}</option>}
 </select>
 </div>

 {isSuperadmin && (
 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.companyLabel')}</label>
 <div className="relative">
 <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
 <select
 value={newUser.company_id}
 onChange={(e) => setNewUser(prev => ({ ...prev, company_id: e.target.value }))}
 className="input pl-9"
 required
 >
 <option value="">{t('usersPage.selectCompany')}</option>
 {companies.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 </div>
 )}

 <div className="flex gap-3 mt-6">
 <button
 type="button"
 onClick={() => setShowCreateModal(false)}
 className="flex-1 btn-secondary"
 >
 {t('usersPage.cancelBtn')}
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 {t('usersPage.creating')}
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 {t('usersPage.createBtn')}
 </>
 )}
 </button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Modal Editar Usuario - Solo Admin */}
 <AnimatePresence>
 {showEditModal && editingUser && isAdmin && (
 <motion.div
 className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 onClick={() => { setShowEditModal(false); setEditingUser(null); }}
 >
 <motion.div
 className="bg-[#141424] rounded-2xl p-6 max-w-md w-full border border-[#1e1e32] shadow-2xl"
 initial={{ opacity: 0, scale: 0.94, y: 16 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.96, y: 8 }}
 transition={EASE_SPRING}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold text-white">{t('usersPage.editTitle')}</h2>
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
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.emailLabel')}</label>
 <input
 type="email"
 value={editingUser.email}
 disabled
 className="input opacity-50 cursor-not-allowed"
 />
 <p className="text-xs text-slate-500 mt-1">{t('usersPage.emailNote')}</p>
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.nameLabel')}</label>
 <input
 type="text"
 value={editForm.full_name}
 onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
 className="input"
 placeholder={t('usersPage.namePlaceholder')}
 required
 />
 </div>

 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.roleLabel')}</label>
 <select
 value={editForm.role}
 onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
 disabled={editingUser.id === profile?.id}
 className="input disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <option value="auditor">{t('usersPage.roleAnalyst')}</option>
 <option value="lider">{t('usersPage.roleSupervisor')}</option>
 {isAdmin && <option value="superadmin">{t('usersPage.roleAdmin')}</option>}
 </select>
 {editingUser.id === profile?.id && (
 <p className="text-xs text-slate-500 mt-1">{t('usersPage.ownRoleNote')}</p>
 )}
 </div>

 {isSuperadmin && (
 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.companyLabel')}</label>
 <div className="relative">
 <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
 <select
 value={editForm.company_id}
 onChange={(e) => setEditForm(prev => ({ ...prev, company_id: e.target.value }))}
 className="input pl-9"
 >
 <option value="">{t('usersPage.selectCompany')}</option>
 {companies.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 </div>
 )}

 <div>
 <label className="block text-sm text-slate-400 mb-2">{t('usersPage.resetPasswordLabel')}</label>
 <div className="relative">
 <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
 <input
 type="password"
 value={editForm.password}
 onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
 className="input pl-9"
 placeholder={t('usersPage.resetPasswordPlaceholder')}
 minLength={6}
 autoComplete="new-password"
 />
 </div>
 <p className="text-xs text-slate-500 mt-1">{t('usersPage.resetPasswordNote')}</p>
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
 {t('usersPage.cancelBtn')}
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 {t('usersPage.saving')}
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 {t('usersPage.saveBtn')}
 </>
 )}
 </button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}