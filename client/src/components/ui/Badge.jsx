import React from 'react';

const Badge = ({
  children,
  variant = 'primary',
  size = 'md',
  pill = false,
  className = '',
}) => {
  // Define variant classes
  const variantClasses = {
    primary: 'bg-amber-600 text-white',
    secondary: 'bg-gray-600 text-white',
    success: 'bg-green-600 text-white',
    danger: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-gray-900',
    info: 'bg-blue-500 text-white',
    light: 'bg-gray-400 text-gray-900',
    dark: 'bg-gray-800 text-white',
    outline: 'bg-transparent border border-amber-500 text-amber-500',
  };

  // Define size classes
  const sizeClasses = {
    sm: 'text-xs py-0.5 px-1.5',
    md: 'text-sm py-1 px-2',
    lg: 'text-base py-1.5 px-3',
  };

  // Combine classes
  const badgeClasses = `
    inline-flex items-center justify-center font-medium
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.md}
    ${pill ? 'rounded-full' : 'rounded'}
    ${className}
  `;

  return <span className={badgeClasses}>{children}</span>;
};

export default Badge;