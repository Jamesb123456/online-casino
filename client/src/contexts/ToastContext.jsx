import React, { createContext, useState, useContext, useCallback } from 'react';
import Toast from '../components/ui/Toast';

// Create context
const ToastContext = createContext();

// Generate unique IDs for toasts
const generateId = () => `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Provider component
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Add a new toast
  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = generateId();
    setToasts(prevToasts => [...prevToasts, { id, message, type, duration }]);
    return id;
  }, []);

  // Remove a toast by ID
  const removeToast = useCallback(id => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // Helper functions for common toast types
  const success = useCallback(
    (message, duration) => addToast(message, 'success', duration),
    [addToast]
  );

  const error = useCallback(
    (message, duration) => addToast(message, 'error', duration),
    [addToast]
  );

  const warning = useCallback(
    (message, duration) => addToast(message, 'warning', duration),
    [addToast]
  );

  const info = useCallback(
    (message, duration) => addToast(message, 'info', duration),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ addToast, removeToast, success, error, warning, info }}
    >
      {children}
      <div className="fixed top-0 right-0 z-50 p-4 space-y-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Custom hook to use the toast context
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
