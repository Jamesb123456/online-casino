/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        'primary': {
          DEFAULT: '#0c7fe9', // Stake blue
          light: '#3e97ee',
          dark: '#0967c5'
        },
        // Secondary/accent colors
        'accent': {
          DEFAULT: '#00ffad', // Stake green
          light: '#33ffbd',
          dark: '#00cc8a'
        },
        // Background colors
        'bg': {
          DEFAULT: '#0f212e', // Stake dark background
          card: '#192c3d',    // Stake card background
          elevated: '#213749', // Stake elevated elements
          subtle: '#0b1924'   // Stake subtle background
        },
        // Game-specific colors
        'game': {
          crash: '#EF4444',
          plinko: '#8B5CF6', 
          wheel: '#F59E0B',
          roulette: '#10B981',
          blackjack: '#3B82F6',
          chicken: '#EC4899'
        },
        // Legacy colors (keeping for backward compatibility)
        'casino-gold': '#F59E0B',
        'casino-red': '#EF4444',
        'casino-green': '#10B981',
        'casino-dark': '#0F172A',
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Poppins"', 'ui-sans-serif', 'system-ui']
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'pulse-glow': 'pulse-glow 2s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(246, 158, 11, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(246, 158, 11, 0.8)' },
        }
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(to right, #1E3A8A, #3B82F6)',
        'gradient-accent': 'linear-gradient(to right, #D97706, #FBBF24)',
        'gradient-card': 'linear-gradient(to bottom, #1E293B, #0F172A)',
        'gradient-hero': 'linear-gradient(45deg, #0F172A, #1E293B)',
        'casino-pattern': "url('/src/assets/pattern.png')"
      },
      boxShadow: {
        'glow': '0 0 15px rgba(246, 158, 11, 0.5), 0 0 30px rgba(246, 158, 11, 0.2)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
      }
    },
  },
  plugins: [],
}