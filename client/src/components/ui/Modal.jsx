import React, { useEffect, useState, useCallback } from 'react';
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

  // Handle modal close with animation - defined with useCallback to maintain reference
  const handleClose = useCallback(() => {
    setIsShowing(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // Animation effect - always defined regardless of isOpen
  useEffect(() => {
    if (isOpen) {
      setIsShowing(true);
    }
  }, [isOpen]);

  // Handle ESC key press - always defined regardless of isOpen
  useEffect(() => {
    // Only add listeners if modal is open
    if (!isOpen) return;

    const handleEscKey = (e) => {
      if (closeOnEsc && e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      // Re-enable scrolling when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, closeOnEsc, handleClose]);

  // Don't render if not open - moved after all hooks
  if (!isOpen) return null;

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
    default: 'bg-bg-card border border-border',
    primary: 'bg-bg-card border border-accent-gold/30',
    accent: 'bg-bg-card border border-accent-purple/30',
    dark: 'bg-bg-base border border-border',
    glass: 'bg-bg-card/80 backdrop-blur-lg border border-white/10'
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex ${centered ? 'items-center' : 'items-start pt-20'} justify-center bg-black/60 backdrop-blur-md p-4 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleOverlayClick}
    >
      <div
        className={`${sizeClasses[size]} w-full ${variantClasses[variant]} rounded-xl shadow-card relative overflow-hidden transform transition-all duration-300 ${isShowing ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Gold accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-gold to-accent-gold-light rounded-t-xl" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 id="modal-title" className="text-xl font-bold font-heading text-text-primary">
            {title}
          </h3>
          {showCloseButton && (
            <button
              type="button"
              className="text-text-muted hover:text-text-primary transition-colors focus:outline-none cursor-pointer"
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
          <div className="flex justify-end gap-4 p-5 border-t border-border bg-bg-base/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
