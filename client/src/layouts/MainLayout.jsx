import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SidebarNav from '../components/SidebarNav';
import MobileBottomNav from '../components/MobileBottomNav';
import ChatBox from '../components/chat/ChatBox';

const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Header />
      <div className="flex">
        <SidebarNav />
        <div className="flex-1 lg:ml-64 pt-16 min-h-screen flex flex-col">
          <main className="flex-1">
            <div className="container mx-auto px-4 py-8 max-w-7xl pb-24 lg:pb-8">
              {children}
            </div>
          </main>
          <Footer />
        </div>
      </div>
      <MobileBottomNav />
      <ChatBox />
    </div>
  );
};

export default MainLayout;
