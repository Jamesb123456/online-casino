import React, { useState, useEffect } from 'react';

const Toast = ({
  message,
  type = 'info',
  duration = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Define type styles with left border colors and icon colors
  const typeStyles = {
    success: {
      border: 'border-l-status-success',
      icon: 'text-status-success',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    error: {
      border: 'border-l-status-error',
      icon: 'text-status-error',
      iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    warning: {
      border: 'border-l-status-warning',
      icon: 'text-status-warning',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z'
    },
    info: {
      border: 'border-l-status-info',
      icon: 'text-status-info',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  };

  const currentType = typeStyles[type] || typeStyles.info;

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Animate out then call onClose
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div className={`
      fixed top-4 right-4 max-w-md z-50
      bg-bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-card
      border-l-4 ${currentType.border}
      transition-all duration-300 ease-out
      transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      animate-slide-right
    `}>
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <svg className={`w-5 h-5 mt-0.5 shrink-0 ${currentType.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={currentType.iconPath} />
        </svg>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary">{message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="text-text-muted hover:text-text-primary transition-colors shrink-0 cursor-pointer focus:outline-none"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;
