import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surface system
        surface: {
          base: '#0C0C0C',     // Near-black page background
          raised: '#111111',   // One featured/raised cell
          inset: '#080808',    // Terminal panel — deepest
          rule: '#1F1F1F',     // Horizontal rules / dividers
        },
        // Text system
        ink: {
          primary: '#E8E5DF',  // Warm off-white — main text
          secondary: '#A09D97', // Muted warm gray — secondary text
          tertiary: '#6B6863', // Even more muted — de-emphasized
        },
        // The ONE accent — forest green, used sparingly
        pulse: {
          DEFAULT: '#3D7A5A',
          dim: '#2A5540',      // Dimmer variant for backgrounds
        },
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
        headline: ['Newsreader', 'serif'],
        label: ['Space Grotesk', 'sans-serif'],
      },
      fontSize: {
        // Editorial scale — fluid where it matters
        'display': 'clamp(2.5rem, 6vw, 4.5rem)',
        'heading': 'clamp(1.5rem, 3vw, 2.25rem)',
        'subheading': 'clamp(1.1rem, 2vw, 1.375rem)',
      },
      borderColor: {
        rule: '#1F1F1F',
      },
      animation: {
        'pulse-live': 'pulse-live 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.6s ease-out forwards',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'number-tick': 'number-tick 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'number-tick': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
