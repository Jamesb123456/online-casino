import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand section */}
          <div className="col-span-1">
            <div className="flex items-center gap-1 mb-4">
              <span className="text-xl font-bold font-heading text-gold-gradient">
                Platinum
              </span>
              <span className="text-xl font-bold font-heading text-text-primary">
                Casino
              </span>
            </div>
            <p className="text-text-muted text-sm mb-4">
              Experience the thrill of casino games in a safe, virtual environment.
            </p>
            <div className="flex space-x-3">
              <SocialButton icon="facebook" />
              <SocialButton icon="twitter" />
              <SocialButton icon="instagram" />
              <SocialButton icon="discord" />
            </div>
          </div>

          {/* Games */}
          <div className="col-span-1">
            <h3 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider">
              Games
            </h3>
            <ul className="space-y-2">
              <FooterLink to="/games/crash" label="Crash" />
              <FooterLink to="/games/plinko" label="Plinko" />
              <FooterLink to="/games/wheel" label="Wheel" />
              <FooterLink to="/games/roulette" label="Roulette" />
              <FooterLink to="/games/blackjack" label="Blackjack" />
              <FooterLink to="/games/landmines" label="Landmines" />
            </ul>
          </div>

          {/* Support */}
          <div className="col-span-1">
            <h3 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider">
              Support
            </h3>
            <ul className="space-y-2">
              <FooterLink to="/responsible-gaming" label="Responsible Gaming" />
            </ul>
            <p className="text-text-muted text-xs mt-3">
              This is a demo site for demonstration purposes only.
            </p>
          </div>

          {/* Legal */}
          <div className="col-span-1">
            <h3 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider">
              Legal
            </h3>
            <p className="text-text-muted text-sm">
              This platform is for entertainment purposes only. No real money gambling is offered. All balances are virtual.
            </p>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-text-muted text-sm">
            &copy; {currentYear} Platinum Casino Platform. All rights reserved.
          </p>
          <p className="text-text-muted text-sm">
            This is a demonstration site. No real money is used.
          </p>
        </div>
      </div>
    </footer>
  );
};

// Footer link component
const FooterLink = ({ to, label }) => {
  return (
    <li>
      <Link
        to={to}
        className="text-text-secondary hover:text-accent-gold text-sm transition-colors duration-200"
      >
        {label}
      </Link>
    </li>
  );
};

// Social media button component
const SocialButton = ({ icon }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'facebook':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 8H6v4h3v12h5V12h3.6l.4-4h-4V6.3c0-1 .3-1.3 1.5-1.3H18V0h-3.8C10.6 0 9 1.6 9 4.6V8z" />
          </svg>
        );
      case 'twitter':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.15.63c-.78.3-1.44.71-2.09 1.37-.67.65-1.08 1.31-1.38 2.09-.3.75-.5 1.63-.56 2.9C.01 8.33 0 8.74 0 12c0 3.26.01 3.67.07 4.95.06 1.27.26 2.15.56 2.9.3.78.71 1.44 1.37 2.09.65.67 1.31 1.08 2.09 1.38.75.3 1.63.5 2.9.56 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.9-.56.78-.3 1.44-.71 2.09-1.37.67-.65 1.08-1.31 1.38-2.09.3-.75.5-1.63.56-2.9.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.9-.3-.78-.71-1.44-1.37-2.09a4.1 4.1 0 00-2.09-1.38c-.75-.3-1.63-.5-2.9-.56C15.67.01 15.26 0 12 0zm0 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.81.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.81-.41 2.23a3.7 3.7 0 01-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.81-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.81.41-2.23.22-.56.48-.96.9-1.38a3.7 3.7 0 011.38-.9c.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07z" />
            <path d="M12 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zm0 10.15a3.99 3.99 0 110-7.98 3.99 3.99 0 010 7.98z" />
            <circle cx="18.4" cy="5.6" r="1.44" />
          </svg>
        );
      case 'discord':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.32 4.37a19.8 19.8 0 00-4.93-1.51 13.78 13.78 0 00-.64 1.28 18.27 18.27 0 00-5.5 0 14.15 14.15 0 00-.64-1.28 19.74 19.74 0 00-4.93 1.5C.72 9.97-.46 15.42.15 20.8a19.47 19.47 0 006 3.03c.47-.64.9-1.32 1.26-2.03a12.8 12.8 0 01-1.97-1.2.5.5 0 01.07-.63 14.84 14.84 0 001.24-.6.49.49 0 01.54.02 14.06 14.06 0 0011.44 0 .5.5 0 01.55-.02c.4.22.8.4 1.22.6.16.1.14.52-.05.63-.64.47-1.3.87-1.99 1.2.36.7.77 1.4 1.26 2.04a19.32 19.32 0 006-3.03c.67-6.16-1.13-11.57-4.38-15.42zm-9.5 12.4c-1.17 0-2.14-1.1-2.14-2.44 0-1.35.95-2.45 2.13-2.45 1.2 0 2.17 1.1 2.15 2.45 0 1.34-.95 2.44-2.14 2.44zm7.9 0c-1.18 0-2.14-1.1-2.14-2.44 0-1.35.96-2.45 2.13-2.45 1.2 0 2.17 1.1 2.16 2.45 0 1.34-.96 2.44-2.15 2.44z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="bg-bg-elevated hover:bg-accent-gold/20 hover:text-accent-gold text-text-muted p-2 rounded-full transition-colors duration-200"
      aria-label={`Follow us on ${icon}`}
    >
      {getIcon(icon)}
    </a>
  );
};

export default Footer;
