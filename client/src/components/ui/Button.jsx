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
    primary: 'bg-primary hover:bg-primary-dark text-white',
    secondary: 'bg-bg-elevated hover:bg-bg-card text-white',
    accent: 'bg-accent hover:bg-accent-dark text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-game-roulette hover:bg-green-700 text-white',
    outline: 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-white',
    outlineAccent: 'bg-transparent border border-accent text-accent hover:bg-accent hover:text-white',
    gradient: 'bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white',
    gradientAccent: 'bg-gradient-to-r from-accent-dark to-accent hover:from-accent hover:to-accent-light text-white',
    subtle: 'bg-bg-card hover:bg-bg-elevated text-gray-300 hover:text-white border border-gray-700',
    glass: 'bg-white bg-opacity-10 backdrop-filter backdrop-blur-sm hover:bg-opacity-20 text-white border border-white border-opacity-20'
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
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${glow ? 'shadow-glow' : ''}
    font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg focus:ring-accent
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