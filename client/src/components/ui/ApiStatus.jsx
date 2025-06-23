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
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        <p className="font-medium">{errorMessage}</p>
        {error && typeof error === 'string' && (
          <p className="text-sm mt-1">{error}</p>
        )}
      </div>
    );
  }
  
  if (dataEmpty) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
        <p>{emptyMessage}</p>
      </div>
    );
  }
  
  return children;
};

export default ApiStatus;