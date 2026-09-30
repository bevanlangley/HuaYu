/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0faf8',
          100: '#d0f0ea',
          200: '#a3e0d4',
          300: '#6dc9b8',
          400: '#3daf9c',
          500: '#2a9484',
          600: '#1f7a6d',
          700: '#165f55',
          800: '#0e4540',
        },
        secondary: {
          100: '#fef3c7',
          400: '#e9a80b',
          500: '#c78a00',
        },
        grey: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        success: {
          bg: '#d1fae5',
          text: '#065f46',
          'bg-dark': '#065f46',
          'text-dark': '#d1fae5',
        },
        warning: {
          bg: '#fef3c7',
          text: '#92400e',
          'bg-dark': '#92400e',
          'text-dark': '#fef3c7',
        },
        error: {
          bg: '#fee2e2',
          text: '#991b1b',
          'bg-dark': '#991b1b',
          'text-dark': '#fee2e2',
          'text-dark-alt': '#fca5a5',
        },
        info: {
          bg: '#dbeafe',
          text: '#1e40af',
          'bg-dark': '#1e40af',
          'text-dark': '#dbeafe',
        },
        'qa-answer': {
          bg: '#ede9fe',
          text: '#5b21b6',
        },
        // Semantic colours as CSS-variable-backed tokens for shadcn compatibility
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
        md: '0 4px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        focus: '0 0 0 3px rgba(42,148,132,0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
