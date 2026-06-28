/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans Sinhala', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(139,92,246,0.4)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(139,92,246,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0)' },
        },
      },
      animation: {
        'fade-up':         'fade-up 0.35s ease-out',
        'fade-in':         'fade-in 0.25s ease-out',
        'slide-in-right':  'slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-left':   'slide-in-left 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':        'scale-in 0.2s ease-out',
        shimmer:           'shimmer 1.8s linear infinite',
        'pulse-ring':      'pulse-ring 1.5s ease-out infinite',
      },
    },
  },
  plugins: [],
}
