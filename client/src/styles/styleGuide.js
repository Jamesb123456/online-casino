/**
 * Platinum Casino Style Guide
 * 
 * This file contains the core design tokens and styling guidelines
 * for the Platinum Casino application. Use these values consistently
 * across components to maintain a unified look and feel.
 */

const styleGuide = {
  // Color Palette
  colors: {
    // Primary brand colors
    primary: {
      main: '#ffc107', // Gold - primary brand color
      light: '#ffcd38',
      dark: '#e6af06',
      gradient: 'linear-gradient(to right, #ffc107, #ff9800)',
    },
    
    // Background colors
    background: {
      darkest: '#0f1923', // Darkest blue - main background
      dark: '#192c3d',    // Dark blue - card backgrounds
      medium: '#213749',  // Medium blue - elevated elements
      light: '#2a4359',   // Light blue - hover states
    },
    
    // Border colors
    border: {
      main: '#2a3f52',    // Border color for cards and sections
      light: '#3a4f62',   // Lighter border for hover states
    },
    
    // Text colors
    text: {
      primary: '#ffffff',  // White - primary text
      secondary: '#d1d5db', // Light gray - secondary text
      muted: '#9ca3af',    // Muted gray - less important text
      gold: '#ffc107',     // Gold - accented text
    },
    
    // Status colors
    status: {
      success: '#10b981',  // Green
      error: '#ef4444',    // Red
      warning: '#f59e0b',  // Amber
      info: '#3b82f6',     // Blue
    },
    
    // Game-specific colors
    games: {
      crash: {
        primary: '#ef4444',
        gradient: 'linear-gradient(to bottom right, #ef4444, #b91c1c)',
      },
      roulette: {
        primary: '#10b981',
        gradient: 'linear-gradient(to bottom right, #10b981, #047857)',
      },
      blackjack: {
        primary: '#3b82f6',
        gradient: 'linear-gradient(to bottom right, #3b82f6, #1d4ed8)',
      },
      plinko: {
        primary: '#8b5cf6',
        gradient: 'linear-gradient(to bottom right, #8b5cf6, #6d28d9)',
      },
      wheel: {
        primary: '#f59e0b',
        gradient: 'linear-gradient(to bottom right, #f59e0b, #d97706)',
      },
      chicken: {
        primary: '#f97316',
        gradient: 'linear-gradient(to bottom right, #f97316, #c2410c)',
      },
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      primary: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
      display: '"Poppins", "Inter", sans-serif',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    fontSize: {
      xs: '0.75rem',     // 12px
      sm: '0.875rem',    // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
    },
  },
  
  // Spacing
  spacing: {
    '0': '0',
    '1': '0.25rem',      // 4px
    '2': '0.5rem',       // 8px
    '3': '0.75rem',      // 12px
    '4': '1rem',         // 16px
    '5': '1.25rem',      // 20px
    '6': '1.5rem',       // 24px
    '8': '2rem',         // 32px
    '10': '2.5rem',      // 40px
    '12': '3rem',        // 48px
    '16': '4rem',        // 64px
    '20': '5rem',        // 80px
    '24': '6rem',        // 96px
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',      // 2px
    DEFAULT: '0.25rem',  // 4px
    md: '0.375rem',      // 6px
    lg: '0.5rem',        // 8px
    xl: '0.75rem',       // 12px
    '2xl': '1rem',       // 16px
    '3xl': '1.5rem',     // 24px
    full: '9999px',      // Circle
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
  },
  
  // Z-index
  zIndex: {
    '0': 0,
    '10': 10,
    '20': 20,
    '30': 30,
    '40': 40,
    '50': 50,
    'auto': 'auto',
  },
  
  // Transitions
  transitions: {
    DEFAULT: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Component-specific styles
  components: {
    // Button variants
    button: {
      primary: {
        bg: '#ffc107',
        hoverBg: '#ffcd38',
        text: '#0f1923',
        border: 'none',
      },
      secondary: {
        bg: '#213749',
        hoverBg: '#2a4359',
        text: '#ffffff',
        border: '#2a3f52',
      },
      tertiary: {
        bg: 'transparent',
        hoverBg: 'rgba(255, 255, 255, 0.1)',
        text: '#ffffff',
        border: '#2a3f52',
      },
      danger: {
        bg: '#ef4444',
        hoverBg: '#dc2626',
        text: '#ffffff',
        border: 'none',
      },
    },
    
    // Card styles
    card: {
      bg: '#192c3d',
      border: '#2a3f52',
      radius: '0.5rem',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    
    // Form input styles
    input: {
      bg: '#0f1923',
      border: '#2a3f52',
      text: '#ffffff',
      placeholder: '#6b7280',
      focusBorder: '#ffc107',
      errorBorder: '#ef4444',
      radius: '0.375rem',
      padding: '0.75rem 1rem',
    },
    
    // Navigation styles
    nav: {
      bg: '#192c3d',
      activeBg: '#213749',
      hoverBg: 'rgba(33, 55, 73, 0.7)',
      text: '#d1d5db',
      activeText: '#ffc107',
      border: '#2a3f52',
    },
  },
};

export default styleGuide;
