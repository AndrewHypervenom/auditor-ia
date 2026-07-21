// frontend/src/pages/LoginPage.tsx

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { toast } from 'react-hot-toast';
import { LogIn, Mail, Lock, AlertCircle, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { motion } from 'motion/react';
import { staggerParent, fadeUp, EASE } from '../lib/motion';

/* ── Fondo aurora: orbes de luz desenfocados en movimiento lento ──────────── */
function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 520, height: 520, top: '-10%', left: '-8%', background: 'radial-gradient(circle, rgba(0,214,50,0.22), transparent 65%)' }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 460, height: 460, bottom: '-12%', right: '-6%', background: 'radial-gradient(circle, rgba(46,32,120,0.55), transparent 65%)' }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 320, height: 320, top: '40%', left: '45%', background: 'radial-gradient(circle, rgba(0,180,255,0.14), transparent 65%)' }}
        animate={{ x: [0, 40, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ── Waveform: barras de audio animadas (temática auditoría de llamadas) ──── */
function Waveform() {
  const bars = useMemo(
    () =>
      Array.from({ length: 44 }, () => ({
        base: 8 + Math.random() * 10,
        peak: 26 + Math.random() * 46,
        dur: 0.9 + Math.random() * 1.1,
        delay: Math.random() * 1.2,
      })),
    []
  );
  return (
    <div className="flex items-end gap-[3px] h-16" aria-hidden="true">
      {bars.map((b, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: 'linear-gradient(to top, rgba(0,214,50,0.35), rgba(0,214,50,0.95))' }}
          animate={{ height: [b.base, b.peak, b.base] }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const location = useLocation();
 const { signIn, user, profile, loading: authLoading } = useAuth();
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [loading, setLoading] = useState(false);

 useEffect(() => {
   if (!authLoading && user && profile) {
     const from = (location.state as any)?.from?.pathname || '/dashboard';
     navigate(from, { replace: true });
   }
 }, [user, profile, authLoading, navigate, location]);

 const handleSubmit = async (e: React.FormEvent) => {
   e.preventDefault();

   if (!email || !password) {
     toast.error(t('auth.fillAllFields'));
     return;
   }

   setLoading(true);

   try {
     await signIn(email, password);

     await new Promise(resolve => setTimeout(resolve, 1000));

     const { data: { session } } = await supabase.auth.getSession();

     if (!session || !session.user) {
       toast.error(t('auth.accountDeactivated'));
       setLoading(false);
       return;
     }

     toast.success(t('auth.welcome'));

     const from = (location.state as any)?.from?.pathname || '/dashboard';
     navigate(from, { replace: true });

   } catch (error: any) {
     console.error('Login error:', error);

     let errorMessage = t('auth.invalidCredentials');

     if (error.message?.includes('Invalid login credentials')) {
       errorMessage = t('auth.invalidCredentials');
     } else if (error.message?.includes('Email not confirmed')) {
       errorMessage = t('auth.emailNotConfirmed');
     } else if (error.message?.includes('Too many requests')) {
       errorMessage = t('auth.tooManyRequests');
     } else if (error.message) {
       errorMessage = error.message;
     }

     toast.error(errorMessage);
   } finally {
     setLoading(false);
   }
 };

 if (authLoading) {
   return (
     <div
       className="min-h-screen flex items-center justify-center"
       style={{
         backgroundColor: '#0a0a12',
         backgroundImage: 'radial-gradient(ellipse 80% 50% at 10% 95%, rgba(0,214,50,0.04) 0%, transparent 60%)'
       }}
     >
       <div className="text-center">
         <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent" />
         <p className="mt-4 text-slate-400 text-sm">{t('auth.verifyingSession')}</p>
       </div>
     </div>
   );
 }

 const features = [t('auth.feature1'), t('auth.feature2'), t('auth.feature3')];

 return (
   <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]" style={{ backgroundColor: '#0a0a12' }}>

     {/* ───────────────── PANEL IZQUIERDO — Marca (solo desktop) ───────────── */}
     <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden border-r border-white/5">
       <Aurora />
       {/* Grid sutil */}
       <div
         className="absolute inset-0 opacity-[0.15] pointer-events-none"
         style={{
           backgroundImage:
             'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
           backgroundSize: '48px 48px',
           maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black, transparent 75%)',
           WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black, transparent 75%)',
         }}
       />

       {/* Logo + wordmark */}
       <motion.div
         className="relative z-10 flex items-center gap-3"
         initial={{ opacity: 0, y: -12 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.6, ease: EASE }}
       >
         <div className="relative w-11 h-11 rounded-2xl overflow-hidden ring-1 ring-brand-500/40 shadow-glow">
           <img src="/logo.jpg" alt="AuditorIA" className="w-full h-full object-cover" />
         </div>
         <div className="text-lg font-bold tracking-tight">
           <span className="text-white">Auditor</span>
           <span className="text-brand-500">IA</span>
         </div>
       </motion.div>

       {/* Centro — headline + waveform + features */}
       <motion.div
         className="relative z-10 max-w-lg"
         variants={staggerParent}
         initial="hidden"
         animate="show"
       >
         <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-semibold mb-6">
           <Sparkles className="w-3.5 h-3.5" />
           {t('auth.tagline')}
         </motion.div>

         <motion.h1 variants={fadeUp} className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1] text-white">
           {t('auth.heroTitle')}<br />
           <span
             className="bg-clip-text text-transparent"
             style={{ backgroundImage: 'linear-gradient(90deg, #00D632, #6ee7a0)' }}
           >
             {t('auth.heroTitleAccent')}
           </span>
         </motion.h1>

         <motion.div variants={fadeUp} className="mt-8 mb-8">
           <Waveform />
         </motion.div>

         <motion.ul variants={fadeUp} className="space-y-3">
           {features.map((f) => (
             <li key={f} className="flex items-center gap-3 text-slate-300 text-sm">
               <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500/15 flex items-center justify-center">
                 <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
               </span>
               {f}
             </li>
           ))}
         </motion.ul>
       </motion.div>

       {/* Footer */}
       <motion.div
         className="relative z-10 flex items-center gap-2 text-slate-600 text-xs"
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 0.6, duration: 0.6 }}
       >
         <ShieldCheck className="w-3.5 h-3.5 text-brand-500/60" />
         <span>{t('auth.secureAccess')} · © 2026 AuditorIA</span>
       </motion.div>
     </div>

     {/* ───────────────── PANEL DERECHO — Formulario ───────────────────────── */}
     <div
       className="relative flex items-center justify-center p-6 sm:p-10 min-h-screen lg:min-h-0"
       style={{
         backgroundImage:
           'radial-gradient(ellipse 90% 60% at 50% 110%, rgba(0,214,50,0.06) 0%, transparent 60%)',
       }}
     >
       {/* Selector de idioma flotante */}
       <div className="absolute top-5 right-5 z-20">
         <LanguageSelector />
       </div>

       <motion.div
         className="w-full max-w-md"
         variants={staggerParent}
         initial="hidden"
         animate="show"
       >
         {/* Logo compacto — visible solo en móvil (panel izq oculto) */}
         <motion.div variants={fadeUp} className="lg:hidden flex flex-col items-center mb-8">
           <motion.div
             className="relative mb-3"
             initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
             animate={{ scale: 1, opacity: 1, rotate: 0 }}
             transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
           >
             <motion.div
               className="absolute inset-0 rounded-2xl blur-xl scale-110"
               style={{ background: 'rgba(0,214,50,0.2)' }}
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
             />
             <div className="relative w-16 h-16 rounded-2xl overflow-hidden ring-1 ring-brand-500/30 shadow-glow">
               <img src="/logo.jpg" alt="AuditorIA" className="w-full h-full object-cover" />
             </div>
           </motion.div>
           <div className="text-xl font-bold tracking-tight">
             <span className="text-white">Auditor</span><span className="text-brand-500">IA</span>
           </div>
         </motion.div>

         {/* Encabezado */}
         <motion.div variants={fadeUp} className="mb-7 text-center lg:text-left">
           <h2 className="text-2xl font-bold text-white tracking-tight">{t('auth.welcomeBack')}</h2>
           <p className="text-sm text-slate-400 mt-1">{t('auth.signInToContinue')}</p>
         </motion.div>

         {/* Tarjeta con borde de luz giratorio */}
         <motion.div variants={fadeUp} className="relative rounded-3xl p-[1.5px] overflow-hidden">
           <motion.div
             className="absolute inset-[-60%] z-0"
             style={{
               background:
                 'conic-gradient(from 0deg, transparent 0deg, rgba(0,214,50,0.55) 55deg, transparent 130deg, transparent 240deg, rgba(0,214,50,0.3) 300deg, transparent 360deg)',
             }}
             animate={{ rotate: 360 }}
             transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
           />
           <div
             className="relative z-10 rounded-[calc(1.5rem-1.5px)] p-8"
             style={{
               background: 'linear-gradient(145deg, rgba(18,18,32,0.96), rgba(10,10,20,0.99))',
               backdropFilter: 'blur(12px)',
               WebkitBackdropFilter: 'blur(12px)',
             }}
           >
             <form onSubmit={handleSubmit} className="space-y-5">
               {/* Email */}
               <div>
                 <label htmlFor="email" className="flex items-center gap-2 mb-2">
                   <Mail className="w-4 h-4 text-brand-500" />
                   {t('auth.email')}
                 </label>
                 <input
                   id="email"
                   type="email"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   placeholder="usuario@ejemplo.com"
                   className="input"
                   disabled={loading}
                   required
                   autoComplete="email"
                   autoFocus
                 />
               </div>

               {/* Contraseña */}
               <div>
                 <label htmlFor="password" className="flex items-center gap-2 mb-2">
                   <Lock className="w-4 h-4 text-slate-400" />
                   {t('auth.password')}
                 </label>
                 <input
                   id="password"
                   type="password"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   placeholder="••••••••"
                   className="input"
                   disabled={loading}
                   required
                   autoComplete="current-password"
                 />
               </div>

               {/* Botón de ingreso con brillo */}
               <motion.button
                 type="submit"
                 disabled={loading}
                 className="btn-primary w-full flex items-center justify-center gap-2 relative overflow-hidden"
                 whileHover={loading ? undefined : { scale: 1.02 }}
                 whileTap={loading ? undefined : { scale: 0.97 }}
                 transition={{ type: 'spring', stiffness: 400, damping: 22 }}
               >
                 {!loading && (
                   <motion.span
                     className="absolute inset-0 pointer-events-none"
                     style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)' }}
                     initial={{ x: '-120%' }}
                     animate={{ x: '120%' }}
                     transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
                   />
                 )}
                 {loading ? (
                   <>
                     <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                     {t('auth.loggingIn')}
                   </>
                 ) : (
                   <>
                     <LogIn className="w-4 h-4" />
                     {t('auth.login')}
                   </>
                 )}
               </motion.button>
             </form>

             {/* Info de contacto */}
             <div
               className="mt-6 p-4 rounded-xl border border-dark-border"
               style={{ background: 'rgba(10,10,20,0.8)' }}
             >
               <div className="flex items-start gap-3">
                 <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                 <div>
                   <p className="text-sm font-medium text-slate-300 mb-0.5">
                     {t('auth.noAccount')}
                   </p>
                   <p className="text-xs text-slate-500">
                     {t('auth.contactAdmin')}
                   </p>
                 </div>
               </div>
             </div>
           </div>
         </motion.div>

         {/* Sello de seguridad */}
         <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 mt-6 text-slate-600 text-xs">
           <ShieldCheck className="w-3.5 h-3.5 text-brand-500/60" />
           {t('auth.secureAccess')}
         </motion.div>
       </motion.div>
     </div>
   </div>
 );
}
