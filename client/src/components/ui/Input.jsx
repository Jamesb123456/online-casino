import React from 'react';

const Input = ({
  type = 'text',
  name,
  value,
  onChange,
  label,
  placeholder,
  required = false,
  disabled = false,
  error = '',
  className = '',
  inputClassName = '',
  labelClassName = '',
  id,
  autoFocus = false,
  min,
  max,
  step,
  variant = 'default'
}) => {
  const inputId = id || name;
  
  // Input variants
  const variants = {
    default: 'bg-bg-elevated border-gray-700 focus:border-primary focus:ring-primary/30',
    primary: 'bg-bg-elevated border-primary/30 focus:border-primary focus:ring-primary/30',
    accent: 'bg-bg-elevated border-accent/30 focus:border-accent focus:ring-accent/30',
    dark: 'bg-bg-subtle border-gray-800 focus:border-primary focus:ring-primary/30',
    glass: 'bg-white/5 backdrop-blur-sm border-white/10 focus:border-white/30 focus:ring-white/10'
  };
  
  const variantClass = variants[variant] || variants.default;
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={inputId} 
          className={`block text-gray-300 text-sm font-medium mb-2 ${labelClassName} ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}`}
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          type={type}
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          min={min}
          max={max}
          step={step}
          className={`
            w-full px-4 py-3 border rounded-md focus:outline-none transition-colors duration-200
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : variantClass} 
            ${disabled ? 'bg-bg-subtle cursor-not-allowed opacity-60' : 'text-white'}
            focus:ring-4
            ${inputClassName}
          `}
        />
      </div>
      
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Input;