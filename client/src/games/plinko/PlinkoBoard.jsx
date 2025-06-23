import React, { useRef, useEffect } from 'react';
import { 
  getPlinkoRows,
  getNumberOfBuckets,
  formatMultiplier,
  getMultiplierColor
} from './plinkoUtils';

const PlinkoBoard = ({ 
  multipliers, 
  animationPath = null, 
  onAnimationComplete = () => {}
}) => {
  const canvasRef = useRef(null);
  const rows = getPlinkoRows();
  const buckets = getNumberOfBuckets(rows);
  
  // Animation state
  const animationRef = useRef(null);
  const ballPositionRef = useRef({ x: 0, y: 0 });
  const pathIndexRef = useRef(0);
  const animationCompleteRef = useRef(false);
  
  // Draw the Plinko board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(0, 0, width, height);
    
    // Calculate pin dimensions
    const pinRadius = 4;
    const horizontalSpacing = width / (rows + 1);
    const verticalSpacing = (height * 0.7) / (rows + 1);
    const startY = height * 0.1;
    
    // Draw pins
    ctx.fillStyle = '#4b5563';
    
    for (let r = 0; r < rows; r++) {
      const pinsInRow = r + 1;
      const rowWidth = pinsInRow * horizontalSpacing;
      const startX = (width - rowWidth) / 2 + horizontalSpacing / 2;
      
      for (let p = 0; p < pinsInRow; p++) {
        const x = startX + p * horizontalSpacing;
        const y = startY + r * verticalSpacing;
        
        ctx.beginPath();
        ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw buckets
    const bucketWidth = width / buckets;
    const bucketHeight = height * 0.25;
    const bucketY = height - bucketHeight;
    
    for (let i = 0; i < buckets; i++) {
      const bucketX = i * bucketWidth;
      
      // Bucket background
      ctx.fillStyle = '#2d3748';
      ctx.fillRect(bucketX, bucketY, bucketWidth, bucketHeight);
      
      // Bucket border
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 1;
      ctx.strokeRect(bucketX, bucketY, bucketWidth, bucketHeight);
      
      // Multiplier text (if available)
      if (multipliers && multipliers[i]) {
        ctx.fillStyle = getMultiplierColor(multipliers[i]);
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          formatMultiplier(multipliers[i]), 
          bucketX + bucketWidth / 2, 
          bucketY + bucketHeight / 2
        );
      }
    }
    
    // Set initial ball position for animation if path exists
    if (animationPath && !animationCompleteRef.current) {
      const centerX = width / 2;
      ballPositionRef.current = { x: centerX, y: 0 };
      pathIndexRef.current = 0;
      animationCompleteRef.current = false;
      
      // Start animation in next frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animateBall);
    }
    
    // Animation function
    function animateBall() {
      if (!animationPath || pathIndexRef.current >= animationPath.length) {
        // Find which bucket the ball landed in
        const bucketIndex = animationPath ? 
          animationPath.reduce((sum, dir) => sum + dir, 0) : 0;
          
        // If animation just completed
        if (!animationCompleteRef.current) {
          animationCompleteRef.current = true;
          onAnimationComplete(bucketIndex);
        }
        return;
      }
      
      // Calculate next ball position based on current path step
      const direction = animationPath[pathIndexRef.current];
      const horizontalMove = direction === 1 ? horizontalSpacing / 2 : -horizontalSpacing / 2;
      
      // Update ball position
      ballPositionRef.current.x += horizontalMove;
      ballPositionRef.current.y += verticalSpacing;
      
      // Draw board
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#1a2030';
      ctx.fillRect(0, 0, width, height);
      
      // Redraw pins
      ctx.fillStyle = '#4b5563';
      for (let r = 0; r < rows; r++) {
        const pinsInRow = r + 1;
        const rowWidth = pinsInRow * horizontalSpacing;
        const startX = (width - rowWidth) / 2 + horizontalSpacing / 2;
        
        for (let p = 0; p < pinsInRow; p++) {
          const x = startX + p * horizontalSpacing;
          const y = startY + r * verticalSpacing;
          
          ctx.beginPath();
          ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Redraw buckets
      for (let i = 0; i < buckets; i++) {
        const bucketX = i * bucketWidth;
        
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(bucketX, bucketY, bucketWidth, bucketHeight);
        
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1;
        ctx.strokeRect(bucketX, bucketY, bucketWidth, bucketHeight);
        
        if (multipliers && multipliers[i]) {
          ctx.fillStyle = getMultiplierColor(multipliers[i]);
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(
            formatMultiplier(multipliers[i]), 
            bucketX + bucketWidth / 2, 
            bucketY + bucketHeight / 2
          );
        }
      }
      
      // Draw ball
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(
        ballPositionRef.current.x, 
        ballPositionRef.current.y, 
        8, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Advance path index
      pathIndexRef.current++;
      
      // Continue animation
      animationRef.current = requestAnimationFrame(animateBall);
    }
    
    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [rows, buckets, multipliers, animationPath, onAnimationComplete]);
  
  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={500}
      className="w-full bg-gray-900 rounded-lg"
    />
  );
};

export default PlinkoBoard;