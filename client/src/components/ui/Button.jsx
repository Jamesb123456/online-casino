import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  rounded = 'md',
  glow = false
}) => {
  // Define variant classes
  const variantClasses = {
    primary: 'bg-accent-gold hover:bg-accent-gold-light text-bg-base font-semibold hover:shadow-glow-gold',
    secondary: 'glass text-text-primary hover:bg-white/10',
    accent: 'bg-accent-purple hover:bg-accent-purple-light text-white hover:shadow-glow-purple',
    danger: 'bg-status-error hover:bg-red-600 text-white',
    success: 'bg-status-success hover:bg-emerald-600 text-white',
    outline: 'border border-border-light text-text-secondary hover:border-accent-gold hover:text-accent-gold bg-transparent',
    outlineAccent: 'border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/10 bg-transparent',
    gradient: 'bg-gradient-to-r from-accent-gold to-accent-gold-light text-bg-base font-semibold hover:shadow-glow-gold',
    gradientAccent: 'bg-gradient-to-r from-accent-purple to-accent-purple-light text-white',
    subtle: 'bg-bg-elevated text-text-secondary hover:bg-bg-surface hover:text-text-primary',
    glass: 'glass text-text-primary hover:bg-white/10'
  };

  // Define size classes
  const sizeClasses = {
    xs: 'py-1 px-2 text-xs',
    sm: 'py-1.5 px-3 text-sm',
    md: 'py-2 px-4',
    lg: 'py-3 px-6 text-lg',
    xl: 'py-4 px-8 text-xl'
  };

  // Define rounded styles
  const roundedStyles = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full'
  };

  // Combine classes
  const buttonClasses = `
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.md}
    ${roundedStyles[rounded] || roundedStyles.md}
    ${fullWidth ? 'w-full' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
    ${glow ? 'shadow-glow-gold' : ''}
    font-medium transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base focus:outline-none
    ${className}
  `;

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
