import React from 'react';

const Badge = ({
  children,
  variant = 'primary',
  size = 'md',
  pill = true,
  className = '',
  glow = false,
  dot = false,
  bordered = false
}) => {
  // Define variant classes
  const variantClasses = {
    primary: 'bg-accent-gold/15 text-accent-gold',
    secondary: 'bg-bg-elevated text-text-secondary',
    accent: 'bg-accent-purple/15 text-accent-purple',
    success: 'bg-status-success/15 text-status-success',
    danger: 'bg-status-error/15 text-status-error',
    warning: 'bg-status-warning/15 text-status-warning',
    info: 'bg-status-info/15 text-status-info',
    purple: 'bg-accent-purple/15 text-accent-purple-light',
    dark: 'bg-bg-elevated text-text-secondary',
    light: 'bg-white/10 text-text-primary',
    outline: 'border border-border-light text-text-secondary bg-transparent',
    outlineAccent: 'border border-accent-gold/30 text-accent-gold bg-transparent',
    ghost: 'text-text-muted bg-transparent',
    gradient: 'bg-gradient-to-r from-accent-gold/20 to-accent-gold-light/20 text-accent-gold',
    gradientAccent: 'bg-gradient-to-r from-accent-purple/20 to-accent-purple-light/20 text-accent-purple-light',
    subtle: 'bg-bg-surface text-text-secondary'
  };

  // Define size classes
  const sizeClasses = {
    xs: 'text-xs py-0.5 px-1.5',
    sm: 'text-xs py-0.5 px-2',
    md: 'text-sm py-1 px-2.5',
    lg: 'text-sm py-1.5 px-3',
  };

  // Dot color mapping
  const dotColorClasses = {
    primary: 'bg-accent-gold',
    secondary: 'bg-text-secondary',
    accent: 'bg-accent-purple',
    success: 'bg-status-success',
    danger: 'bg-status-error',
    warning: 'bg-status-warning',
    info: 'bg-status-info',
    purple: 'bg-accent-purple-light',
    dark: 'bg-text-secondary',
    light: 'bg-text-primary',
    outline: 'bg-text-secondary',
    outlineAccent: 'bg-accent-gold',
    ghost: 'bg-text-muted',
    gradient: 'bg-accent-gold',
    gradientAccent: 'bg-accent-purple-light',
    subtle: 'bg-text-secondary'
  };

  // Combine classes
  const badgeClasses = `
    inline-flex items-center justify-center font-medium
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.md}
    ${pill ? 'rounded-full' : 'rounded-md'}
    ${glow ? 'shadow-glow-gold' : ''}
    ${bordered ? 'border border-white/10' : ''}
    ${className}
  `;

  return (
    <span className={badgeClasses}>
      {dot && (
        <span className={`mr-1.5 h-2 w-2 rounded-full ${dotColorClasses[variant] || 'bg-accent-gold'}`}></span>
      )}
      {children}
    </span>
  );
};

export default Badge;
