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
  step
}) => {
  const inputId = id || name;
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label 
          htmlFor={inputId} 
          className={`block text-gray-300 mb-2 ${labelClassName} ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}`}
        >
          {label}
        </label>
      )}
      
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
          w-full px-3 py-2 bg-gray-700 border rounded focus:outline-none 
          ${error ? 'border-red-500' : 'border-gray-600 focus:ring-2 focus:ring-amber-500'} 
          ${disabled ? 'bg-gray-800 cursor-not-allowed opacity-75' : 'text-white'}
          ${inputClassName}
        `}
      />
      
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Input;