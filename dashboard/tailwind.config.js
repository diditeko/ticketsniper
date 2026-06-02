export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'oklch(12% 0.02 250)',
        panel:   'oklch(16% 0.025 250)',
        border:  'oklch(22% 0.03 250)',
        accent:  'oklch(65% 0.22 265)',
        success: 'oklch(65% 0.18 145)',
        warning: 'oklch(75% 0.18 75)',
        danger:  'oklch(62% 0.22 25)',
        muted:   'oklch(50% 0.02 250)',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan-line':  'scan-line 3s linear infinite',
        'fade-in':    'fade-in 0.3s ease-out',
        'slide-up':   'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px oklch(65% 0.22 265 / 40%)' },
          '50%':      { boxShadow: '0 0 24px oklch(65% 0.22 265 / 80%)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
