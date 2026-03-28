import React, { useRef, useEffect, useState } from 'react';
import { formatMultiplier } from './wheelUtils';

const WheelBoard = ({ 
  segments = [], 
  spinning = false, 
  targetAngle = 0,
  onSpinComplete = () => {}
}) => {
  const canvasRef = useRef(null);
  const wheelRef = useRef({
    currentAngle: 0,
    targetAngle: targetAngle,
    isSpinning: false,
    animationId: null
  });
  
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
    const spinSpeed = Math.max(1, diff * 0.05); // Deceleration factor
    
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
    const radius = Math.min(width, height) / 2 - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw wheel background
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(0, 0, width, height);
    
    // No segments to draw
    if (segments.length === 0) {
      drawEmptyWheel(ctx, centerX, centerY, radius);
      return;
    }
    
    // Calculate segment angle
    const segmentAngle = 2 * Math.PI / segments.length;
    
    // Draw segments
    for (let i = 0; i < segments.length; i++) {
      const startAngle = i * segmentAngle + ((wheelRef.current.currentAngle % 360) * Math.PI / 180);
      const endAngle = startAngle + segmentAngle;
      
      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segments[i].color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw multiplier text
      const textAngle = startAngle + segmentAngle / 2;
      const textRadius = radius * 0.75;
      const textX = centerX + Math.cos(textAngle) * textRadius;
      const textY = centerY + Math.sin(textAngle) * textRadius;
      
      // Save context for text rotation
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textAngle + Math.PI / 2);
      
      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatMultiplier(segments[i].multiplier), 0, 0);
      
      // Restore context
      ctx.restore();
    }
    
    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.15, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw pointer/arrow
    drawPointer(ctx, centerX, centerY, radius);
  };
  
  // Draw wheel when no segments are available
  const drawEmptyWheel = (ctx, centerX, centerY, radius) => {
    // Draw empty wheel circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Wheel of Fortune', centerX, centerY);
    
    // Draw pointer
    drawPointer(ctx, centerX, centerY, radius);
  };
  
  // Draw the pointer/arrow that indicates selected segment
  const drawPointer = (ctx, centerX, centerY, radius) => {
    const pointerSize = radius * 0.15;
    
    // Draw triangle pointer at the top
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius - 10);
    ctx.lineTo(centerX - pointerSize, centerY - radius + pointerSize);
    ctx.lineTo(centerX + pointerSize, centerY - radius + pointerSize);
    ctx.closePath();
    
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
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
  }, [segments]);
  
  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      role="img"
      aria-label="Wheel of Fortune game wheel with multiplier segments"
      className="w-full max-w-md mx-auto bg-bg-base rounded-full"
    />
  );
};

export default WheelBoard;