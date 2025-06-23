/**
 * Global theme variables and design tokens
 * Use these colors and styles throughout the application for consistency
 */

export const colors = {
  // Primary brand colors
  primary: {
    DEFAULT: '#1E40AF', // Deep blue
    light: '#3B82F6',
    dark: '#1E3A8A',
    contrast: '#FFFFFF'
  },
  
  // Secondary/accent colors
  accent: {
    DEFAULT: '#F59E0B', // Golden/amber
    light: '#FBBF24',
    dark: '#D97706',
    contrast: '#000000'
  },
  
  // Background colors
  background: {
    DEFAULT: '#0F172A', // Deep navy blue
    card: '#1E293B',
    elevated: '#334155',
    subtle: '#0F172A'
  },
  
  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    accent: '#F59E0B',
    muted: '#64748B'
  },
  
  // Game-specific colors
  games: {
    crash: '#EF4444', // Red for crash game
    plinko: '#8B5CF6', // Purple for plinko
    wheel: '#F59E0B', // Amber for wheel
    roulette: '#10B981', // Green for roulette
    blackjack: '#3B82F6', // Blue for blackjack
    chicken: '#EC4899'  // Pink for chicken game
  },
  
  // Status colors
  status: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6'
  }
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  glow: '0 0 15px rgba(246, 158, 11, 0.5), 0 0 30px rgba(246, 158, 11, 0.2)'
};

export const gradients = {
  primary: 'linear-gradient(to right, #1E3A8A, #3B82F6)',
  accent: 'linear-gradient(to right, #D97706, #FBBF24)',
  card: 'linear-gradient(to bottom, #1E293B, #0F172A)',
  hero: 'linear-gradient(to right, #0F172A, #1E293B)'
};

export const typography = {
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    heading: '"Poppins", ui-sans-serif, system-ui'
  }
};

export const spacing = {
  container: {
    padding: '1.5rem', // 24px padding by default
    maxWidth: '1280px' // Max width for the main container
  }
};