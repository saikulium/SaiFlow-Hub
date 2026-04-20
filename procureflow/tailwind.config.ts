import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/customers/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pf: {
          bg: {
            primary: 'var(--pf-bg-primary)',
            secondary: 'var(--pf-bg-secondary)',
            tertiary: 'var(--pf-bg-tertiary)',
            hover: 'var(--pf-bg-hover)',
          },
          accent: {
            DEFAULT: 'var(--pf-accent)',
            hover: 'var(--pf-accent-hover)',
            subtle: 'var(--pf-accent-subtle)',
          },
          success: 'var(--pf-success)',
          warning: 'var(--pf-warning)',
          danger: 'var(--pf-danger)',
          info: 'var(--pf-info)',
          text: {
            primary: 'var(--pf-text-primary)',
            secondary: 'var(--pf-text-secondary)',
            muted: 'var(--pf-text-muted)',
          },
          border: {
            DEFAULT: 'var(--pf-border)',
            hover: 'var(--pf-border-hover)',
          },
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'SF Pro Display', 'system-ui'],
        body: ['var(--font-body)', 'SF Pro Text', 'system-ui'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        badge: '6px',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        'pulse-subtle': 'pulse-subtle 2s infinite ease-in-out',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
}
export default config
