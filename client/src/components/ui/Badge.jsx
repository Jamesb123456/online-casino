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
    primary: 'bg-primary text-white',
    secondary: 'bg-bg-elevated text-white',
    accent: 'bg-accent text-white',
    success: 'bg-game-roulette text-white',
    danger: 'bg-game-crash text-white',
    warning: 'bg-game-wheel text-white',
    info: 'bg-game-blackjack text-white',
    purple: 'bg-game-plinko text-white',
    dark: 'bg-bg-subtle text-gray-300',
    light: 'bg-white/10 text-white',
    outline: 'bg-transparent border border-primary/70 text-primary',
    outlineAccent: 'bg-transparent border border-accent/70 text-accent',
    ghost: 'bg-white/5 text-white backdrop-blur-sm',
    gradient: 'bg-gradient-to-r from-primary to-primary-light text-white',
    gradientAccent: 'bg-gradient-to-r from-accent to-accent-light text-white',
    subtle: 'bg-primary/10 text-primary'
  };

  // Define size classes
  const sizeClasses = {
    xs: 'text-xs py-0.5 px-1.5',
    sm: 'text-xs py-0.5 px-2',
    md: 'text-sm py-1 px-2.5',
    lg: 'text-sm py-1.5 px-3',
  };

  // Combine classes
  const badgeClasses = `
    inline-flex items-center justify-center font-medium
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.md}
    ${pill ? 'rounded-full' : 'rounded-md'}
    ${glow ? 'shadow-glow' : ''}
    ${bordered ? 'border border-white/10' : ''}
    ${className}
  `;

  return (
    <span className={badgeClasses}>
      {dot && (
        <span className="mr-1.5 h-2 w-2 rounded-full bg-white"></span>
      )}
      {children}
    </span>
  );
};

export default Badge;