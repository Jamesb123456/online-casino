import React from 'react';

const Loading = ({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-3',
    lg: 'h-16 w-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div 
        className={`${sizeClasses[size]} rounded-full border-t-gray-200 border-r-gray-200 border-b-gray-200 border-l-primary animate-spin`} 
        style={{ borderLeftColor: '#4F46E5' }}
      />
      {message && (
        <p className="mt-4 text-gray-600">{message}</p>
      )}
    </div>
  );
};

export default Loading;