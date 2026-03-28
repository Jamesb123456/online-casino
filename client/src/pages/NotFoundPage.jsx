import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

const NotFoundPage = () => {
  useEffect(() => {
    document.title = 'Page Not Found | Platinum Casino';
  }, []);
  return (
    <MainLayout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-8xl font-heading font-bold text-accent-gold/20 mb-4">404</h1>
          <h2 className="text-2xl font-heading font-semibold text-text-primary mb-4">Page Not Found</h2>
          <p className="text-text-secondary text-xl mb-8">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link
            to="/"
            className="inline-block bg-gradient-to-r from-accent-gold to-accent-gold-light text-bg-base font-bold px-8 py-3.5 rounded-lg hover:shadow-glow-gold transition-all duration-200"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </MainLayout>
  );
};

export default NotFoundPage;
