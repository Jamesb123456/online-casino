import React from 'react';
import Loading from './Loading';

/**
 * A component to handle common API states: loading, error, and empty data
 */
const ApiStatus = ({
  status,
  loading,
  error,
  isEmpty,
  loadingMessage = 'Loading...',
  errorMessage = 'An error occurred. Please try again.',
  emptyMessage = 'No data available.',
  children
}) => {
  // Determine what state to show
  const isLoading = status === 'loading' || loading === true;
  const hasError = status === 'error' || error;
  const dataEmpty = status === 'empty' || isEmpty === true;

  if (isLoading) {
    return <Loading message={loadingMessage} />;
  }

  if (hasError) {
    return (
      <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-lg text-status-error">
        <p className="font-medium">{errorMessage}</p>
        {error && typeof error === 'string' && (
          <p className="text-sm mt-1 text-status-error/80">{error}</p>
        )}
      </div>
    );
  }

  if (dataEmpty) {
    return (
      <div className="p-4 bg-bg-surface border border-border rounded-lg text-text-muted">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return children;
};

export default ApiStatus;
