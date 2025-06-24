import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatBox from '../components/chat/ChatBox';

const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0f1923] to-[#1a2c3d] text-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#ffc107] opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[#ffc107] opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-green-500 opacity-10 rounded-full blur-3xl"></div>
      </div>
      
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-5 bg-[url('/pattern.png')] bg-repeat z-0"></div>
      
      <Header />
      {/* Added pt-24 to create space for fixed header */}
      <main className="flex-grow container mx-auto px-4 pt-24 pb-12 relative z-10">
        {children}
      </main>
      <Footer />
      <ChatBox />
    </div>
  );
};

export default MainLayout;