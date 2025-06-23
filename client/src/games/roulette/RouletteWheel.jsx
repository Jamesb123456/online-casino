import React, { useRef, useEffect, useState } from 'react';
import { ROULETTE_NUMBERS } from './rouletteUtils';

const RouletteWheel = ({ 
  spinning = false, 
  targetAngle = 0,
  onSpinComplete = () => {},
  winningNumber = null
}) => {
  const canvasRef = useRef(null);
  const wheelRef = useRef({
    currentAngle: 0,
    targetAngle: targetAngle,
    isSpinning: false,
    animationId: null
  });
  
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  
  // Handle window resize to make wheel responsive
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Get container dimensions, constrained by max size
        const containerWidth = Math.min(canvas.parentNode.clientWidth, 400);
        setDimensions({
          width: containerWidth,
          height: containerWidth
        });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Update wheel references when props change
  useEffect(() => {
    wheelRef.current.targetAngle = targetAngle;
    wheelRef.current.isSpinning = spinning;
    
    if (spinning && !wheelRef.current.animationId) {
      wheelRef.current.animationId = requestAnimationFrame(animateWheel);
    }
  }, [spinning, targetAngle]);
  
  // Animation function to spin the wheel
  const animateWheel = () => {
    const wheel = wheelRef.current;
    
    if (!wheel.isSpinning) {
      wheel.animationId = null;
      onSpinComplete();
      return;
    }
    
    // Calculate rotation speed (easing function)
    const diff = wheel.targetAngle - wheel.currentAngle;
    
    // Start fast, slow down towards the end
    const progress = Math.min(1, wheel.currentAngle / wheel.targetAngle);
    const easingFactor = 0.02 + (0.98 * Math.pow(progress, 2));
    const spinSpeed = Math.max(0.2, diff * easingFactor);
    
    // Update current angle
    wheel.currentAngle += spinSpeed;
    
    // Check if we've reached the target angle (with small threshold)
    if (diff < 0.5) {
      wheel.currentAngle = wheel.targetAngle;
      wheel.isSpinning = false;
    }
    
    // Redraw wheel
    drawWheel();
    
    // Continue animation
    wheel.animationId = requestAnimationFrame(animateWheel);
  };
  
  // Draw the wheel on canvas
  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.7;  // Inner circle radius
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw outer border
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Draw pockets
    const pocketAngle = 2 * Math.PI / ROULETTE_NUMBERS.length;
    const rotationAngle = (wheelRef.current.currentAngle % 360) * Math.PI / 180;
    
    for (let i = 0; i < ROULETTE_NUMBERS.length; i++) {
      const startAngle = i * pocketAngle + rotationAngle;
      const endAngle = startAngle + pocketAngle;
      const { number, color } = ROULETTE_NUMBERS[i];
      
      // Draw pocket segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, outerRadius - 2, startAngle, endAngle);
      ctx.closePath();
      
      // Set pocket color
      ctx.fillStyle = color === 'red' ? '#e74c3c' : 
                      color === 'black' ? '#2c3e50' : '#27ae60';
      ctx.fill();
      
      ctx.strokeStyle = '#95a5a6';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw pocket numbers
      const midAngle = startAngle + pocketAngle / 2;
      const textRadius = outerRadius - (outerRadius - innerRadius) / 2;
      const textX = centerX + Math.cos(midAngle) * textRadius;
      const textY = centerY + Math.sin(midAngle) * textRadius;
      
      // Save context for text rotation
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(midAngle + Math.PI / 2);
      
      // Draw text
      ctx.fillStyle = color === 'black' ? '#ecf0f1' : '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number.toString(), 0, 0);
      
      // Restore context
      ctx.restore();
    }
    
    // Draw inner circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#34495e';
    ctx.fill();
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw casino logo or text in the center
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CASINO ROYALE', centerX, centerY - 10);
    ctx.font = '12px Arial';
    ctx.fillText('ROULETTE', centerX, centerY + 10);
    
    // Draw ball indicator at the top
    drawBallIndicator(ctx, centerX, centerY, outerRadius);
  };
  
  // Draw the ball/indicator at the top of the wheel
  const drawBallIndicator = (ctx, centerX, centerY, outerRadius) => {
    const ballRadius = outerRadius * 0.05;
    
    // Draw indicator triangle
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - outerRadius - 5);
    ctx.lineTo(centerX - 10, centerY - outerRadius - 20);
    ctx.lineTo(centerX + 10, centerY - outerRadius - 20);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw ball
    if (winningNumber !== null && !wheelRef.current.isSpinning) {
      ctx.beginPath();
      ctx.arc(centerX, centerY - outerRadius + ballRadius, ballRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#f1c40f';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  
  // Initial draw
  useEffect(() => {
    drawWheel();
    
    // Cleanup function
    return () => {
      if (wheelRef.current.animationId) {
        cancelAnimationFrame(wheelRef.current.animationId);
      }
    };
  }, [dimensions.width, dimensions.height, winningNumber]);
  
  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="mx-auto bg-gray-900 rounded-full shadow-lg"
      />
      {winningNumber !== null && !spinning && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-opacity-90 bg-gray-800 px-6 py-3 rounded-lg shadow-lg">
          <div className="text-center">
            <span className="text-lg text-gray-300">Number</span>
            <div className={`text-3xl font-bold ${
              ROULETTE_NUMBERS.find(n => n.number === winningNumber)?.color === 'red' ? 'text-red-500' : 
              ROULETTE_NUMBERS.find(n => n.number === winningNumber)?.color === 'black' ? 'text-gray-200' : 'text-green-500'
            }`}>
              {winningNumber}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouletteWheel;