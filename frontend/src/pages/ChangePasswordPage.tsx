// frontend/src/pages/ChangePasswordPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import { KeyRound, Lock, ShieldCheck, LogOut, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { authService } from '../services/api';
import { staggerParent, fadeUp, EASE } from '../lib/motion';

const MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, mustChangePassword, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Reglas mostradas en vivo mientras el usuario escribe
  const rules = [
    { ok: newPassword.length >= MIN_LENGTH, label: t('changePassword.ruleLength', { min: MIN_LENGTH }) },
    { ok: /[a-zA-Z]/.test(newPassword), label: t('changePassword.ruleLetter') },
    { ok: /[0-9]/.test(newPassword), label: t('changePassword.ruleNumber') },
    { ok: newPassword.length > 0 && newPassword === confirmPassword, label: t('changePassword.ruleMatch') },
  ];
  const allValid = rules.every(r => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) {
      toast.error(t('changePassword.checkRules'));
      return;
    }

    try {
      setLoading(true);
      await authService.changePassword({
        new_password: newPassword,
        // Si la contraseña es temporal el backend no exige la anterior
        ...(mustChangePassword ? {} : { current_password: currentPassword }),
      });

      // Supabase revoca el refresh token al cambiar la contraseña, así que
      // refrescar la sesión falla con 400. En su lugar iniciamos sesión de nuevo
      // con la contraseña recién creada: eso emite un JWT limpio, ya sin el flag.
      const { error: signInError } = user?.email
        ? await supabase.auth.signInWithPassword({ email: user.email, password: newPassword })
        : { error: new Error('missing email') };

      if (signInError) {
        // Caso raro (p. ej. rate limit): la contraseña ya quedó cambiada,
        // solo hay que volver a entrar manualmente.
        toast.success(t('changePassword.successRelogin'));
        await signOut();
        navigate('/login', { replace: true });
        return;
      }

      toast.success(t('changePassword.success'));
      // Recarga completa: AuthContext se reinicializa con la sesión nueva y evita
      // que el guard lea el token viejo (todavía marcado) durante la transición.
      window.location.replace('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || t('changePassword.error');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundColor: '#0a0a12',
        backgroundImage: 'radial-gradient(ellipse 90% 60% at 50% 110%, rgba(0,214,50,0.06) 0%, transparent 60%)',
      }}
    >
      <motion.div
        className="w-full max-w-md"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp} className="flex flex-col items-center mb-7">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-brand-500/40 shadow-glow mb-4">
            <img src="/logo.jpg" alt="AuditorIA" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight text-center">
            {mustChangePassword ? t('changePassword.forcedTitle') : t('changePassword.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-2 text-center">
            {mustChangePassword ? t('changePassword.forcedSubtitle') : t('changePassword.subtitle')}
          </p>
          {user?.email && (
            <p className="text-xs text-slate-500 mt-2">{user.email}</p>
          )}
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-2xl p-8 border border-[#1e1e32]"
          style={{ background: 'linear-gradient(145deg, rgba(18,18,32,0.96), rgba(10,10,20,0.99))' }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {!mustChangePassword && (
              <div>
                <label htmlFor="current" className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  {t('changePassword.currentLabel')}
                </label>
                <input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="new" className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-brand-500" />
                {t('changePassword.newLabel')}
              </label>
              <input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
                autoFocus={mustChangePassword}
                required
              />
            </div>

            <div>
              <label htmlFor="confirm" className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-slate-400" />
                {t('changePassword.confirmLabel')}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
                required
              />
            </div>

            <ul className="space-y-1.5 pt-1">
              {rules.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-xs">
                  {r.ok
                    ? <Check className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                    : <X className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
                  <span className={r.ok ? 'text-slate-300' : 'text-slate-500'}>{r.label}</span>
                </li>
              ))}
            </ul>

            <button
              type="submit"
              disabled={loading || !allValid}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('changePassword.saving')}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {t('changePassword.submit')}
                </>
              )}
            </button>
          </form>

          <button
            onClick={handleSignOut}
            className="mt-5 w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('changePassword.signOut')}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
