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
        className={`${sizeClasses[size]} rounded-full border-accent-gold border-t-transparent animate-spin`}
      />
      {message && (
        <p className="mt-4 text-text-secondary">{message}</p>
      )}
    </div>
  );
};

export default Loading;
