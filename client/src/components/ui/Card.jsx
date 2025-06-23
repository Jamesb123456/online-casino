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
  hoverable = false
}) => {
  // Define variant classes
  const variantClasses = {
    default: 'bg-gray-800',
    primary: 'bg-gray-800 border border-amber-600',
    outlined: 'bg-transparent border border-gray-700',
    elevated: 'bg-gray-800 shadow-lg'
  };
  
  // Combine classes
  const cardClasses = `
    ${variantClasses[variant] || variantClasses.default}
    rounded-lg overflow-hidden
    ${hoverable ? 'transform hover:scale-102 transition-transform hover:shadow-xl' : ''}
    ${className}
  `;
  
  return (
    <div className={cardClasses}>
      {/* Card Header (if title exists) */}
      {(title || subtitle) && (
        <div className={`p-4 border-b border-gray-700 ${headerClassName}`}>
          {title && <h3 className="text-lg font-bold text-amber-400">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      
      {/* Card Body */}
      <div className={`p-4 ${bodyClassName}`}>
        {children}
      </div>
      
      {/* Card Footer (if footerContent exists) */}
      {footerContent && (
        <div className="p-4 border-t border-gray-700">
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default Card;