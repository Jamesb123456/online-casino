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

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium text-text-secondary mb-2 ${labelClassName} ${required ? 'after:content-["*"] after:ml-0.5 after:text-status-error' : ''}`}
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
            w-full px-4 py-3 rounded-lg bg-bg-surface border text-text-primary placeholder:text-text-muted
            transition-colors duration-200 focus:outline-none
            ${error ? 'border-status-error focus:ring-2 focus:ring-status-error/50 focus:border-status-error' : 'border-border focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold'}
            ${disabled ? 'bg-bg-base cursor-not-allowed opacity-60' : ''}
            ${inputClassName}
          `}
        />
      </div>

      {error && <p className="mt-2 text-sm text-status-error">{error}</p>}
    </div>
  );
};

export default Input;
