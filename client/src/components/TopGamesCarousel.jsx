import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

// Game card component for the carousel
const GameCard = ({ index, title, path, icon, image, color }) => {
  return (
    <Link 
      to={path}
      className={`block relative w-36 h-48 rounded-lg overflow-hidden shadow-lg transition-transform hover:transform hover:scale-105 ${color}`}
    >
      {/* Number indicator */}
      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#213749] flex items-center justify-center text-xs font-bold text-white z-10">
        {index}
      </div>
      
      {/* Image background */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#192c3d] via-transparent">
        {image ? (
          <img src={image} alt={title} className="object-cover w-full h-full opacity-70" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {icon}
          </div>
        )}
      </div>
      
      {/* Game title */}
      <div className="absolute bottom-0 left-0 w-full p-3">
        <div className="text-white font-bold text-lg uppercase tracking-wide">
          {title}
        </div>
      </div>
    </Link>
  );
};

const TopGamesCarousel = ({ games }) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const carouselRef = useRef(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const scrollAmount = 360; // Approximate width of 3 cards
      carouselRef.current.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth'
      });
      setScrollPosition(Math.max(0, scrollPosition - scrollAmount));
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const scrollAmount = 360; // Approximate width of 3 cards
      carouselRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
      setScrollPosition(scrollPosition + scrollAmount);
    }
  };

  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = carouselRef.current 
    ? carouselRef.current.scrollWidth > carouselRef.current.clientWidth + scrollPosition 
    : true;

  console.log("TopGamesCarousel rendering", games, "Props empty?", games.length === 0);
  
  // Debug if the component is receiving valid props
  if (!games || games.length === 0) {
    // Return a very visible debug element if props are missing
    return (
      <div style={{
        padding: '20px',
        background: 'red',
        color: 'white',
        border: '5px solid yellow',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        TopGamesCarousel missing data - Props debugging: games={JSON.stringify(games)}
      </div>
    );
  }
  
  return (
    <div className="relative" data-testid="top-games-carousel" style={{
      zIndex: 20, 
      position: 'relative', 
      border: '4px solid lime', 
      minHeight: '150px', 
      background: '#192c3d',
      padding: '10px',
      display: 'block', 
      overflow: 'visible',
      width: '100%'
    }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#0c7fe9]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <h2 className="text-white text-xl font-medium">Top Games</h2>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              canScrollLeft ? 'bg-[#213749] text-white hover:bg-[#0c7fe9]' : 'bg-[#213749]/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={scrollRight}
            disabled={!canScrollRight}
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              canScrollRight ? 'bg-[#213749] text-white hover:bg-[#0c7fe9]' : 'bg-[#213749]/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div 
        ref={carouselRef}
        className="flex space-x-4 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {games.map((game, index) => (
          <GameCard 
            key={game.title}
            index={index + 1} 
            title={game.title}
            path={game.path}
            icon={game.icon}
            image={game.image}
            color={game.color}
          />
        ))}
      </div>
    </div>
  );
};

export default TopGamesCarousel;