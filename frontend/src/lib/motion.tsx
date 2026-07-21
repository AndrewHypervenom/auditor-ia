// frontend/src/lib/motion.tsx
// Sistema de animación reutilizable basado en Motion (framer-motion).
// Micro-interacciones premium, transiciones de página y revelados escalonados,
// con respeto total por `prefers-reduced-motion`.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useInView,
  animate,
  type Variants,
  type Transition,
} from 'motion/react';

/* ── Curvas y timings compartidos ─────────────────────────────────────────── */
// easeOutExpo — la misma sensación "Apple" del CSS existente (0.16, 1, 0.3, 1)
export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 };

export const springSoft: Transition = { type: 'spring', stiffness: 220, damping: 26 };

/* ── Variants base ────────────────────────────────────────────────────────── */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: EASE } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: EASE_SPRING },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/* ── Re-exports útiles ────────────────────────────────────────────────────── */
export { motion, AnimatePresence, useReducedMotion };

/* ── Componentes de conveniencia ──────────────────────────────────────────── */

interface BaseProps {
  children: ReactNode;
  className?: string;
  /** Retraso adicional en segundos. */
  delay?: number;
}

/** Envoltura de transición para páginas completas (usada por el router). */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Aparece desde abajo al montar (o al entrar en viewport si `whenInView`). */
export function Reveal({
  children,
  className,
  delay = 0,
  whenInView = false,
  y = 16,
}: BaseProps & { whenInView?: boolean; y?: number }) {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y };
  const shown = { opacity: 1, y: 0 };
  const viewProps = whenInView
    ? { whileInView: shown, viewport: { once: true, margin: '-60px' } }
    : { animate: shown };
  return (
    <motion.div
      className={className}
      initial={initial}
      {...viewProps}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Contenedor que escalona la entrada de sus hijos `<StaggerItem>`. */
export function Stagger({ children, className, delay = 0 }: BaseProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial={reduce ? false : 'hidden'}
      animate="show"
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

/** Hijo de <Stagger>: entra desde abajo. Acepta cualquier tag vía `as`. */
export function StaggerItem({
  children,
  className,
}: BaseProps) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/**
 * Número animado que cuenta desde el valor previo hasta `value` cuando entra
 * en viewport. Respeta prefers-reduced-motion (muestra el valor final directo).
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  duration = 1.25,
  className,
  locale = 'es-MX',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Formateador personalizado (p.ej. moneda). Tiene prioridad sobre decimals. */
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  locale?: string;
}) {
  const reduce = useReducedMotion();
  const fmt = (n: number) =>
    format
      ? format(n)
      : n.toLocaleString(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });

  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const prev = useRef(reduce ? value : 0);
  const [text, setText] = useState(() => fmt(reduce ? value : 0));

  useEffect(() => {
    if (reduce) {
      setText(fmt(value));
      prev.current = value;
      return;
    }
    if (!inView) return;
    const controls = animate(prev.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setText(fmt(v)),
    });
    prev.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

/**
 * Tarjeta interactiva con elevación al hover y feedback al presionar.
 * Ideal para tarjetas de acción, KPI y elementos de lista clickeables.
 */
export function MotionCard({
  children,
  className,
  onClick,
  lift = true,
  disabled = false,
}: BaseProps & { onClick?: () => void; lift?: boolean; disabled?: boolean }) {
  const reduce = useReducedMotion();
  const interactive = !reduce && !disabled;
  return (
    <motion.div
      className={className}
      onClick={onClick}
      variants={fadeUp}
      whileHover={interactive && lift ? { y: -4, scale: 1.01 } : undefined}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      transition={springSoft}
    >
      {children}
    </motion.div>
  );
}
