import React, { useState, useEffect } from 'react';

const Toast = ({ 
  message, 
  type = 'info', 
  duration = 5000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Define color schemes based on message type
  const typeStyles = {
    success: 'bg-green-100 border-green-400 text-green-800',
    error: 'bg-red-100 border-red-400 text-red-800',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-800',
    info: 'bg-blue-100 border-blue-400 text-blue-800'
  };

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
      fixed top-4 right-4 max-w-md p-4 mb-4 
      border-l-4 rounded-md shadow-md
      transition-all duration-300 ease-in-out
      transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      ${typeStyles[type]}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-3">
          <p className="font-medium">{message}</p>
        </div>
        <button 
          onClick={handleClose} 
          className={`focus:outline-none focus:ring-2 focus:ring-${type}-500`}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path 
              fillRule="evenodd" 
              clipRule="evenodd" 
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;