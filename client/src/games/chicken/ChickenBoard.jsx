import React, { useEffect, useRef, useState } from 'react';
import { formatMultiplier, getMultiplierColor, GAME_CONSTANTS } from './chickenUtils';

const ChickenBoard = ({ 
  isPlaying = false, 
  currentMultiplier = 1, 
  hasCrashed = false, 
  cashOutMultiplier = null,
  countdown = 0,
  difficulty = 'medium'
}) => {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [bombPosition, setBombPosition] = useState({ x: 0, y: 0 });
  const [chickenPosition, setChickenPosition] = useState({ x: 0, y: 0 });
  const animationRef = useRef(null);
  const containerRef = useRef(null);

  // Calculate canvas size based on container dimensions
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        const height = Math.min(width * 0.6, 400); // Keep a reasonable aspect ratio
        setCanvasSize({ width, height });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Main animation effect
  useEffect(() => {
    if (!canvasRef.current || canvasSize.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Calculate positions
    const bombY = height * 0.8; // Bomb sits near the bottom
    const chickenY = height * 0.4; // Chicken flies higher than the bomb

    // Base chicken X position
    const startX = width * 0.2; // Start at 20% from left
    const endX = width * 0.8; // End at 80% from left
    
    // Calculate current position based on multiplier
    const growthRate = GAME_CONSTANTS.MULTIPLIER_GROWTH_RATE[difficulty];
    const maxMultiplier = 10; // Visual cap for animation purposes
    const progressRatio = Math.min((currentMultiplier - 1) / (maxMultiplier - 1), 1);
    
    const currentX = startX + progressRatio * (endX - startX);
    
    setBombPosition({ x: currentX, y: bombY });
    setChickenPosition({ x: currentX, y: chickenY });

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    ctx.fillStyle = '#1F2937'; // Dark background
    ctx.fillRect(0, 0, width, height);
    
    // Draw ground
    ctx.fillStyle = '#4B5563';
    ctx.fillRect(0, height * 0.9, width, height * 0.1);
    
    // Draw progress line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, bombY);
    ctx.lineTo(endX, bombY);
    ctx.stroke();
    
    // Draw markers along progress line
    [1.5, 2, 3, 5, 10].forEach(marker => {
      const markerProgress = Math.min((marker - 1) / (maxMultiplier - 1), 1);
      const markerX = startX + markerProgress * (endX - startX);
      
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(markerX, bombY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(marker + 'x', markerX, bombY + 20);
    });
    
    // Draw bomb (unless exploded)
    if (!hasCrashed) {
      ctx.fillStyle = '#EF4444'; // Red bomb
      ctx.beginPath();
      ctx.arc(bombPosition.x, bombPosition.y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw bomb fuse
      ctx.strokeStyle = '#FCD34D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bombPosition.x, bombPosition.y - 15);
      ctx.lineTo(bombPosition.x + 5, bombPosition.y - 25);
      ctx.stroke();
    }
    
    // Draw chicken
    if (!hasCrashed) {
      // Chicken body (simplified drawing)
      ctx.fillStyle = '#FBBF24'; // Yellow/gold chicken
      ctx.beginPath();
      ctx.ellipse(chickenPosition.x, chickenPosition.y, 20, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Chicken head
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(chickenPosition.x + 15, chickenPosition.y - 5, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Chicken eye
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(chickenPosition.x + 18, chickenPosition.y - 7, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Chicken beak
      ctx.fillStyle = '#F97316'; // Orange beak
      ctx.beginPath();
      ctx.moveTo(chickenPosition.x + 25, chickenPosition.y - 7);
      ctx.lineTo(chickenPosition.x + 33, chickenPosition.y - 4);
      ctx.lineTo(chickenPosition.x + 25, chickenPosition.y - 1);
      ctx.fill();
      
      // Chicken wings
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(chickenPosition.x - 5, chickenPosition.y + 5, 12, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Add some legs
      ctx.strokeStyle = '#F97316'; // Orange legs
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chickenPosition.x - 5, chickenPosition.y + 13);
      ctx.lineTo(chickenPosition.x - 10, chickenPosition.y + 20);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(chickenPosition.x + 5, chickenPosition.y + 13);
      ctx.lineTo(chickenPosition.x, chickenPosition.y + 20);
      ctx.stroke();
    } else {
      // Explosion animation
      ctx.fillStyle = '#EF4444'; // Red explosion
      ctx.beginPath();
      ctx.arc(bombPosition.x, bombPosition.y, 40, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#F97316'; // Orange inner explosion
      ctx.beginPath();
      ctx.arc(bombPosition.x, bombPosition.y, 25, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#FBBF24'; // Yellow core
      ctx.beginPath();
      ctx.arc(bombPosition.x, bombPosition.y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Explosion rays
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 / 16) * i;
        const startRadius = 40;
        const endRadius = 60;
        
        ctx.beginPath();
        ctx.moveTo(
          bombPosition.x + Math.cos(angle) * startRadius,
          bombPosition.y + Math.sin(angle) * startRadius
        );
        ctx.lineTo(
          bombPosition.x + Math.cos(angle) * endRadius,
          bombPosition.y + Math.sin(angle) * endRadius
        );
        ctx.stroke();
      }
      
      // Chicken pieces flying
      const pieces = 8;
      for (let i = 0; i < pieces; i++) {
        const angle = (Math.PI * 2 / pieces) * i;
        const distance = 70;
        
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(
          bombPosition.x + Math.cos(angle) * distance,
          bombPosition.y + Math.sin(angle) * distance,
          5, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }
    
    // Draw multiplier text
    let displayMultiplier = currentMultiplier;
    let textColor = getMultiplierColor(displayMultiplier).replace('text-', '');
    
    // Handle color mapping from text-* classes to actual colors
    const colorMap = {
      'white': '#FFFFFF',
      'green-400': '#4ADE80',
      'blue-400': '#60A5FA',
      'purple-400': '#C084FC',
      'orange-400': '#FB923C',
      'red-500': '#EF4444'
    };
    
    ctx.fillStyle = colorMap[textColor] || '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    
    // If cashed out, show the cashout multiplier, otherwise show current
    if (cashOutMultiplier && !hasCrashed) {
      displayMultiplier = cashOutMultiplier;
      ctx.fillStyle = '#4ADE80'; // Green for cashed out
    } else if (hasCrashed) {
      ctx.fillStyle = '#EF4444'; // Red for crash
    }
    
    ctx.fillText(formatMultiplier(displayMultiplier), width / 2, height / 3);
    
    // Draw game status text
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    
    if (countdown > 0 && !isPlaying) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`Game starting in ${countdown}...`, width / 2, height / 2);
    } else if (hasCrashed) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('BOMB EXPLODED!', width / 2, height / 2);
    } else if (cashOutMultiplier) {
      ctx.fillStyle = '#4ADE80';
      ctx.fillText('CHICKEN ESCAPED!', width / 2, height / 2);
    } else if (isPlaying) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('CASH OUT BEFORE THE BOMB EXPLODES!', width / 2, height / 2);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PLACE YOUR BET', width / 2, height / 2);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    canvasSize, 
    currentMultiplier, 
    hasCrashed, 
    isPlaying, 
    cashOutMultiplier, 
    countdown,
    difficulty,
    bombPosition,
    chickenPosition
  ]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex justify-center items-center bg-gray-800 rounded-lg overflow-hidden"
    >
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
};

export default ChickenBoard;