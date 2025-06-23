import React from 'react';

const Card = ({
  children,
  title,
  subtitle,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerContent,
  variant = 'default',
  hoverable = false,
  accent = false
}) => {
  // Define variant classes
  const variantClasses = {
    default: 'bg-bg-card border border-gray-800',
    primary: 'bg-bg-card border border-primary',
    accent: 'bg-bg-card border border-accent',
    outlined: 'bg-transparent border border-gray-700',
    elevated: 'bg-gradient-card shadow-card',
    dark: 'bg-bg-subtle'
  };
  
  // Combine classes
  const cardClasses = `
    ${variantClasses[variant] || variantClasses.default}
    rounded-xl overflow-hidden
    ${hoverable ? 'transform hover:-translate-y-1 transition-all hover:shadow-card' : ''}
    ${accent ? 'shadow-glow' : ''}
    ${className}
  `;
  
  return (
    <div className={cardClasses}>
      {/* Card Header (if title exists) */}
      {(title || subtitle) && (
        <div className={`p-5 border-b border-gray-800 ${headerClassName}`}>
          {title && <h3 className="text-lg font-bold text-white bg-clip-text bg-gradient-to-r from-white to-gray-300">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      
      {/* Card Body */}
      <div className={`p-5 ${bodyClassName}`}>
        {children}
      </div>
      
      {/* Card Footer (if footerContent exists) */}
      {footerContent && (
        <div className="p-5 border-t border-gray-800 bg-bg-subtle bg-opacity-50">
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default Card;