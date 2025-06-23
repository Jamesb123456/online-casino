import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-bg bg-gradient-to-b from-bg-subtle to-bg text-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-accent opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-game-roulette opacity-10 rounded-full blur-3xl"></div>
      </div>
      
      <Header />
      {/* Added pt-24 to create space for fixed header */}
      <main className="flex-grow container mx-auto px-4 pt-24 pb-12 relative z-10">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;