import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ROULETTE_NUMBERS } from './rouletteUtils';

const RouletteWheel = ({ 
  isSpinning = false, 
  spinPhase = null,
  spinData = null,
  onSpinComplete = () => {},
  winningNumber = null,
  showResult = false
}) => {
  const canvasRef = useRef(null);
  const wheelRef = useRef({
    currentAngle: 0,
    targetAngle: 0,
    currentPhase: 0, // 0: not spinning, 1: fast, 2: medium, 3: slow
    phaseStartTime: 0,
    phaseEndTime: 0,
    phaseStartAngle: 0,
    phaseEndAngle: 0,
    phaseDuration: 0,
    isSpinning: false,
    animationId: null,
    radius: 0,
    centerX: 0,
    centerY: 0
  });
  
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Get container dimensions, constrained by max size
      const containerWidth = Math.min(canvas.parentNode.clientWidth, 400);
      setDimensions({
        width: containerWidth,
        height: containerWidth
      });
    }
  }, []);
  
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
  
  const drawBall = useCallback((ctx, wheel) => {
    if (!wheel.isSpinning && !showResult) return;
    
    // Calculate ball position
    const ballRadius = 8;
    
    // Ball track radius depends on the spin phase
    // Start with outer track and gradually move to inner track as the wheel slows down
    let ballTrackRadius = wheel.radius * 0.70;
    let bounceHeight = 0;
    
    // Add bouncing effect based on current phase and spin phase prop
    if (spinPhase === 'start') {
      // Start phase - ball on outer track with high bouncing
      ballTrackRadius = wheel.radius * 0.75;
      bounceHeight = Math.sin(wheel.currentAngle * 0.2) * 10;
    } else if (spinPhase === 'result' && !showResult) {
      // Result phase but result not yet shown - gradual slowing down
      ballTrackRadius = wheel.radius * 0.72;
      bounceHeight = Math.sin(wheel.currentAngle * 0.1) * 5;
    } else if (spinPhase === 'result' && showResult) {
      // Final position - ball settled in pocket
      ballTrackRadius = wheel.radius * 0.65;
      // Slight vibration effect if showing result
      bounceHeight = Math.sin(Date.now() * 0.01) * 1;
    }
    
    // Ball position changes based on wheel angle
    const ballAngle = wheel.currentAngle * Math.PI / 180;
    const ballX = wheel.centerX + Math.cos(ballAngle) * (ballTrackRadius + bounceHeight);
    const ballY = wheel.centerY + Math.sin(ballAngle) * (ballTrackRadius + bounceHeight);
    
    // Draw ball shadow for 3D effect
    ctx.beginPath();
    ctx.arc(ballX + 2, ballY + 2, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    
    // Draw ball with gradient for 3D effect
    const gradient = ctx.createRadialGradient(
      ballX - 2, ballY - 2, 0,
      ballX, ballY, ballRadius
    );
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.8, '#DDDDDD');
    gradient.addColorStop(1, '#AAAAAA');
    
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Add shine effect
    ctx.beginPath();
    ctx.arc(ballX - 3, ballY - 3, ballRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  }, [spinPhase, showResult]);
  
  useEffect(() => {
    if (isSpinning && spinData && !wheelRef.current.animationId) {
      // Start a new spin animation
      const now = performance.now();
      wheelRef.current.isSpinning = true;
      wheelRef.current.currentPhase = 1; // Start with phase 1
      
      // Set up phase 1 (fast spin)
      wheelRef.current.phaseStartTime = now;
      wheelRef.current.phaseEndTime = now + spinData.durations.phase1;
      wheelRef.current.phaseStartAngle = wheelRef.current.currentAngle;
      wheelRef.current.phaseEndAngle = wheelRef.current.currentAngle + spinData.phase1Angle;
      wheelRef.current.phaseDuration = spinData.durations.phase1;
      
      // Start animation
      wheelRef.current.animationId = requestAnimationFrame(animateWheel);
    } else if (!isSpinning) {
      // Reset if not spinning
      wheelRef.current.isSpinning = false;
    }
  }, [isSpinning, spinData]);
  
  const animateWheel = useCallback(() => {
    const wheel = wheelRef.current;
    const now = performance.now();
    
    if (!wheel.isSpinning) {
      wheel.animationId = null;
      onSpinComplete();
      return;
    }
    
    // Check if we need to advance to the next phase
    if (now >= wheel.phaseEndTime) {
      if (wheel.currentPhase === 1 && spinData) {
        // Move to phase 2 (medium spin)
        wheel.currentPhase = 2;
        wheel.phaseStartTime = now;
        wheel.phaseEndTime = now + spinData.durations.phase2;
        wheel.phaseStartAngle = wheel.currentAngle;
        wheel.phaseEndAngle = wheel.currentAngle + spinData.phase2Angle;
        wheel.phaseDuration = spinData.durations.phase2;
      } else if (wheel.currentPhase === 2 && spinData) {
        // Move to phase 3 (slow spin)
        wheel.currentPhase = 3;
        wheel.phaseStartTime = now;
        wheel.phaseEndTime = now + spinData.durations.phase3;
        wheel.phaseStartAngle = wheel.currentAngle;
        wheel.phaseEndAngle = wheel.currentAngle + spinData.phase3Angle;
        wheel.phaseDuration = spinData.durations.phase3;
      } else if (wheel.currentPhase === 3) {
        // Animation complete
        wheel.isSpinning = false;
        onSpinComplete();
        
        // Emit a custom DOM event that the wheel animation has completed
        const wheelCompleteEvent = new CustomEvent('wheelAnimationComplete', {
          detail: { finalAngle: wheel.currentAngle }
        });
        document.dispatchEvent(wheelCompleteEvent);
      }
    }
    
    // Calculate current angle based on animation phase
    if (wheel.isSpinning) {
      const phaseProgress = (now - wheel.phaseStartTime) / wheel.phaseDuration;
      const easedProgress = easeProgress(phaseProgress, wheel.currentPhase);
      wheel.currentAngle = wheel.phaseStartAngle + (wheel.phaseEndAngle - wheel.phaseStartAngle) * easedProgress;
      
      // Redraw wheel
      drawWheel();
      
      // Continue animation if still spinning
      if (wheel.isSpinning) {
        wheel.animationId = requestAnimationFrame(animateWheel);
      }
    }
  }, [spinData, onSpinComplete]);
  
  const easeProgress = useCallback((progress, phase) => {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    
    switch (phase) {
      case 1: // Fast phase - linear
        return clampedProgress;
      case 2: // Medium phase - ease-in-out
        return clampedProgress < 0.5
          ? 2 * clampedProgress * clampedProgress
          : 1 - Math.pow(-2 * clampedProgress + 2, 2) / 2;
      case 3: // Slow phase - ease-out
        return 1 - Math.pow(1 - clampedProgress, 2);
      default:
        return clampedProgress;
    }
  }, []);
  
  // Draw the wheel on canvas
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.7;  // Inner circle radius
    
    wheelRef.current.radius = outerRadius;
    wheelRef.current.centerX = centerX;
    wheelRef.current.centerY = centerY;
    
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
    ctx.fillText('PLATINUM CASINO', centerX, centerY - 10);
    ctx.font = '12px Arial';
    ctx.fillText('ROULETTE', centerX, centerY + 10);
    
    // Draw ball if spinning or showing result
    if (showResult || isSpinning) {
      drawBall(ctx, wheelRef.current);
    }
  }, [showResult, isSpinning, drawBall]);
  
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
      {winningNumber !== null && showResult && !spinning && (
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