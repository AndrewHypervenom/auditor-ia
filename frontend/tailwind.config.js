/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Paleta de marca POSITIVO S+ ---
        brand: {
          50:  '#e8fff0',
          100: '#c5ffd9',
          200: '#8dfcb5',
          300: '#4ef88a',
          400: '#1ADE50',   // verde hover
          500: '#00D632',   // verde principal (logo S+)
          600: '#00b82b',   // pressed/active
          700: '#009422',   // borders sobre fondo oscuro
          800: '#006e19',   // tints muy sutiles
          900: '#004a11',   // background tints
        },
        // --- Alias primary → brand (compatibilidad con clases existentes) ---
        primary: {
          50:  '#e8fff0',
          100: '#c5ffd9',
          200: '#8dfcb5',
          300: '#4ef88a',
          400: '#1ADE50',
          500: '#00D632',
          600: '#00b82b',
          700: '#009422',
          800: '#006e19',
          900: '#004a11',
        },
        // --- Sistema de fondos oscuros (coincide con colores.jpg) ---
        dark: {
          bg:      '#0a0a12',   // fondo de página
          surface: '#0f0f1a',   // superficie base de card
          card:    '#141424',   // card principal
          raised:  '#1a1a2e',   // card elevada / sidebar
          border:  '#1e1e32',   // borde por defecto
          hover:   '#242440',   // hover background
          muted:   '#2a2a48',   // backgrounds muted
        },
        slate: {
          750: '#293548',
          850: '#172033',
          950: '#0a0a12',
        },
        // --- Colores semánticos ---
        success: {
          50:  '#e8fff0',
          100: '#c5ffd9',
          400: '#1ADE50',
          500: '#00D632',
          600: '#00b82b',
          700: '#009422',
        },
        warning: {
          50:  '#fefce8',
          100: '#fef9c3',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      boxShadow: {
        // Glow verde de marca (no azul)
        'glow':        '0 0 20px rgba(0, 214, 50, 0.25)',
        'glow-lg':     '0 0 40px rgba(0, 214, 50, 0.35)',
        'glow-xs':     '0 0 8px rgba(0, 214, 50, 0.20)',
        'inner-glow':  'inset 0 0 20px rgba(0, 214, 50, 0.08)',
        // Sombras Apple-style (capas sutiles)
        'card':        '0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.35)',
        'card-hover':  '0 4px 16px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)',
        'card-glow':   '0 4px 16px rgba(0,0,0,0.5), 0 0 24px rgba(0, 214, 50, 0.12)',
        'header':      '0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.5)',
      },
      animation: {
        'fadeIn':      'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideUp':     'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideDown':   'slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':   'spin 3s linear infinite',
        'shimmer':     'shimmer 1.8s ease-in-out infinite',
        'glow-pulse':  'glowPulse 2.5s ease-in-out infinite',
        'scale-in':    'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px',
      },
    },
  },
  plugins: [],
}
