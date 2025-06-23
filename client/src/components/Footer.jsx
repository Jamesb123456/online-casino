import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-800 py-8 mt-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h2 className="text-xl font-bold text-amber-500">Virtual Casino</h2>
            <p className="text-gray-400 mt-1">Experience the thrill without the risk</p>
          </div>
          
          <div className="flex flex-col md:flex-row mb-4 md:mb-0 md:space-x-8 space-y-2 md:space-y-0">
            <a href="/about" className="text-gray-300 hover:text-white">About Us</a>
            <a href="/responsible-gaming" className="text-gray-300 hover:text-white">Responsible Gaming</a>
            <a href="/terms" className="text-gray-300 hover:text-white">Terms & Conditions</a>
            <a href="/privacy" className="text-gray-300 hover:text-white">Privacy Policy</a>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} Virtual Casino Platform. All rights reserved.</p>
          <p className="mt-2 text-sm">This is a demonstration site. No real money is used.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;