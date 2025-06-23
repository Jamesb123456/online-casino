import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnEsc = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  variant = 'default',
  centered = true
}) => {
  const [isShowing, setIsShowing] = useState(false);

  // Animation effect
  useEffect(() => {
    if (isOpen) {
      setIsShowing(true);
    }
  }, [isOpen]);

  // Handle modal close with animation
  const handleClose = () => {
    setIsShowing(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (e) => {
      if (closeOnEsc && e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      // Re-enable scrolling when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, closeOnEsc, onClose]);

  // Determine modal width based on size
  const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    'full': 'max-w-full mx-4'
  };

  // Variant styling
  const variantClasses = {
    default: 'bg-bg-card border border-gray-800',
    primary: 'bg-bg-card border border-primary/30',
    accent: 'bg-bg-card border border-accent/30',
    dark: 'bg-bg-subtle',
    glass: 'bg-bg-card bg-opacity-80 backdrop-filter backdrop-blur-lg'
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div 
      className={`fixed inset-0 z-50 flex ${centered ? 'items-center' : 'items-start pt-20'} justify-center bg-black bg-opacity-75 p-4 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleOverlayClick}
    >
      <div 
        className={`${sizeClasses[size]} w-full ${variantClasses[variant]} rounded-xl shadow-card transform transition-all duration-300 ${isShowing ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 id="modal-title" className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
            {title}
          </h3>
          {showCloseButton && (
            <button
              type="button"
              className="text-gray-400 hover:text-white transition-colors focus:outline-none"
              onClick={handleClose}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-4 p-5 border-t border-gray-800 bg-bg-subtle bg-opacity-50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;