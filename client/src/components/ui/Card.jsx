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
    default: 'bg-bg-card border border-border rounded-xl',
    primary: 'bg-bg-card border border-accent-gold/20 rounded-xl',
    accent: 'bg-bg-card border border-accent-purple/20 rounded-xl',
    outlined: 'bg-transparent border border-border-light rounded-xl',
    elevated: 'bg-bg-card shadow-card rounded-xl',
    dark: 'bg-bg-base border border-border rounded-xl',
    glass: 'glass rounded-xl'
  };

  // Combine classes
  const cardClasses = `
    ${variantClasses[variant] || variantClasses.default}
    overflow-hidden
    ${hoverable ? 'hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200' : ''}
    ${accent ? 'shadow-glow-gold' : ''}
    ${className}
  `;

  return (
    <div className={cardClasses}>
      {/* Card Header (if title exists) */}
      {(title || subtitle) && (
        <div className={`p-5 border-b border-border ${headerClassName}`}>
          {title && <h3 className="text-lg font-bold font-heading text-text-primary">{title}</h3>}
          {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
        </div>
      )}

      {/* Card Body */}
      <div className={`p-5 ${bodyClassName}`}>
        {children}
      </div>

      {/* Card Footer (if footerContent exists) */}
      {footerContent && (
        <div className="p-5 border-t border-border bg-bg-base/50">
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default Card;
