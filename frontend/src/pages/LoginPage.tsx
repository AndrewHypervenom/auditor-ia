// frontend/src/pages/LoginPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { toast } from 'react-hot-toast';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';

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

 return (
   <div
     className="min-h-screen flex items-center justify-center p-4"
     style={{
       backgroundColor: '#0a0a12',
       backgroundImage:
         'radial-gradient(ellipse 100% 60% at 50% 105%, rgba(0,214,50,0.06) 0%, transparent 60%), radial-gradient(ellipse 80% 80% at 80% 0%, rgba(20,14,55,0.5) 0%, transparent 70%)'
     }}
   >
     <div className="w-full max-w-md animate-fadeIn">

       {/* Logo y branding */}
       <div className="text-center mb-7">
         <div className="relative inline-block mb-4">
           <div
             className="absolute inset-0 rounded-2xl blur-xl scale-110"
             style={{ background: 'rgba(0,214,50,0.15)' }}
           />
           <div className="relative w-16 h-16 rounded-2xl overflow-hidden ring-1 ring-brand-500/30 shadow-glow">
             <img
               src="/logo.jpg"
               alt="AuditorIA"
               className="w-full h-full object-cover"
             />
           </div>
         </div>

         <div className="mb-0.5">
           <span className="text-xl font-bold tracking-tight text-white">Auditor</span>
           <span className="text-xl font-bold tracking-tight text-brand-500">IA</span>
         </div>
         <p className="text-sm font-medium text-slate-400">Auditor IA · Sistema de evaluación</p>
       </div>

       {/* Card de login */}
       <div
         className="rounded-2xl p-8 border border-dark-border shadow-card relative overflow-hidden"
         style={{ background: 'linear-gradient(145deg, rgba(18,18,32,0.98), rgba(10,10,20,1))' }}
       >
         {/* Línea sutil verde en el top */}
         <div
           className="absolute top-0 left-0 right-0 h-px"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(0,214,50,0.35), transparent)' }}
         />

         <form onSubmit={handleSubmit} className="space-y-6">
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

           {/* Botón de ingreso */}
           <button
             type="submit"
             disabled={loading}
             className="btn-primary w-full flex items-center justify-center gap-2"
           >
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
           </button>
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

       {/* Language selector + Footer */}
       <div className="flex flex-col items-center gap-3 mt-8">
         <LanguageSelector />
         <p className="text-center text-slate-600 text-xs tracking-wide">
           © 2026 AuditorIA · Evaluación inteligente de llamadas
         </p>
       </div>
     </div>
   </div>
 );
}
