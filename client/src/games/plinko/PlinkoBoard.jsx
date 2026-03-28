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
  const animationProgressRef = useRef(0);
  const animationCompleteRef = useRef(false);
  
  // Physics simulation
  const velocityRef = useRef({ x: 0, y: 0 });
  const gravityRef = useRef(0.0023); // 200% further reduced gravity for extremely slow falling
  const lastCollidedPinRef = useRef(null);
  const bouncingEffectRef = useRef({ active: false, strength: 0, phase: 0 });
  const timeStepRef = useRef(1/60); // 60fps simulation
  
  // Store the animateBall function in a ref so it can be accessed across effects
  const animateBallRef = useRef(null);
  
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
      ballPositionRef.current = { x: centerX, y: -10 }; // Start slightly above the canvas
      pathIndexRef.current = 0;
      animationProgressRef.current = 0;
      animationCompleteRef.current = false;
      lastCollidedPinRef.current = null;
      bouncingEffectRef.current = { active: false, strength: 0, phase: 0 };
      
      // Reset animation state to ensure it works for subsequent balls
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Add a small delay before starting the animation
      setTimeout(() => {
        // Start animation in next frame
        animationRef.current = requestAnimationFrame(animateBall);
      }, 500); // 500ms delay before the ball starts falling
    }
    
    // Animation function - define it and store in the ref so it can be used across effects
    animateBallRef.current = function animateBall() {
      
      // Function is already stored in ref, no need to reassign
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
      
      // Apply gravity to velocity
      velocityRef.current.y += gravityRef.current;
      
      // Apply velocity to position
      ballPositionRef.current.x += velocityRef.current.x;
      ballPositionRef.current.y += velocityRef.current.y;
      
      // Track which bucket the ball is heading toward
      // We'll use the path from the game logic to guide the ball slightly
      const ballProgress = Math.min(1, Math.max(0, 
        (ballPositionRef.current.y - startY) / (height * 0.7)
      ));
      
      // Find the current row based on ball position
      const currentRow = Math.floor((ballPositionRef.current.y - startY) / verticalSpacing);
      
      // Use the path data to add subtle guidance to the ball's direction
      if (currentRow >= 0 && currentRow < animationPath.length && 
          Math.abs(velocityRef.current.x) < 2) { // Only apply if not bouncing hard
        const pathDirection = animationPath[currentRow];
        const subtleBias = pathDirection === 1 ? 0.05 : -0.05;
        velocityRef.current.x += subtleBias;
      }
      
      // Exit condition - check if ball reached bottom of board
      const bucketY = height - height * 0.25;
      if (ballPositionRef.current.y >= bucketY) {
        // Calculate which bucket the ball landed in based on x position
        const bucketWidth = width / buckets;
        let bucketIndex = Math.floor(ballPositionRef.current.x / bucketWidth);
        
        // Constrain to valid bucket index
        bucketIndex = Math.max(0, Math.min(buckets - 1, bucketIndex));
        
        // Stop animation
        if (!animationCompleteRef.current) {
          animationCompleteRef.current = true;
          onAnimationComplete(bucketIndex);
        }
        return;
      }
      
      // Check for pin collisions and create realistic physics-based bounces
      let collidedWithPin = false;
      
      // Check for collisions with all pins in all rows (more accurate physics)
      for (let r = 0; r < rows; r++) {
        const pinsInRow = r + 1;
        const rowWidth = pinsInRow * horizontalSpacing;
        const rowStartX = (width - rowWidth) / 2 + horizontalSpacing / 2;
        const pinY = startY + r * verticalSpacing;
        
        // Only check rows near the ball's position for efficiency
        if (Math.abs(pinY - ballPositionRef.current.y) > verticalSpacing * 1.5) continue;
        
        for (let p = 0; p < pinsInRow; p++) {
          const pinX = rowStartX + p * horizontalSpacing;
          const pinRadius = 4;
          const ballRadius = 8;
          const combinedRadius = pinRadius + ballRadius;
          
          // Calculate distance between ball and pin
          const dx = ballPositionRef.current.x - pinX;
          const dy = ballPositionRef.current.y - pinY;
          const distance = Math.sqrt(dx*dx + dy*dy);
          
          // Collision detected
          if (distance < combinedRadius && 
              (!lastCollidedPinRef.current || 
               lastCollidedPinRef.current.x !== pinX || 
               lastCollidedPinRef.current.y !== pinY || 
               distance < lastCollidedPinRef.current.distance - 2)) {
            
            collidedWithPin = true;
            lastCollidedPinRef.current = { x: pinX, y: pinY, distance: distance, time: Date.now() };
            
            // Calculate bounce response (physics-based)
            const nx = dx / distance; // Normalized collision vector x
            const ny = dy / distance; // Normalized collision vector y
            
            // Calculate relative velocity along collision normal
            const relativeVelocity = velocityRef.current.x * nx + velocityRef.current.y * ny;
            
            // Only bounce if objects are moving toward each other
            if (relativeVelocity < 0) {
              // Elasticity coefficient (1 = perfect bounce, 0 = no bounce)
              const elasticity = 0.3 + Math.random() * 0.15; // 0.3-0.45 elasticity (much less bouncy)
              
              // Apply impulse
              const impulse = -(1 + elasticity) * relativeVelocity;
              
              // Update velocity based on collision
              velocityRef.current.x += impulse * nx;
              velocityRef.current.y += impulse * ny;
              
              // Add some randomness to make it more unpredictable
              velocityRef.current.x += (Math.random() - 0.5) * 0.5;
              
              // Ensure minimum vertical velocity after bounce
              if (velocityRef.current.y < 0.5) velocityRef.current.y = 0.5;
              
              // Dampen horizontal velocity for more balanced gameplay
              if (Math.abs(velocityRef.current.x) > 3) {
                velocityRef.current.x *= 0.85;
              }
              
              // Move ball to avoid overlapping with the pin
              const pushDistance = combinedRadius - distance + 0.5;
              ballPositionRef.current.x += nx * pushDistance;
              ballPositionRef.current.y += ny * pushDistance;
              
              // Visual bounce effect
              bouncingEffectRef.current = {
                active: true,
                strength: 2 + Math.random() * 3, // Smaller visual effect since physics handles main bounce
                phase: 0
              };
              
              break;
            }
          }
        }
        
        if (collidedWithPin) break; // Exit early if collision found
      }
      
      // Constrain ball to board boundaries
      if (ballPositionRef.current.x < 20) {
        ballPositionRef.current.x = 20;
        velocityRef.current.x = Math.abs(velocityRef.current.x) * 0.8; // Bounce off left wall
      } else if (ballPositionRef.current.x > width - 20) {
        ballPositionRef.current.x = width - 20;
        velocityRef.current.x = -Math.abs(velocityRef.current.x) * 0.8; // Bounce off right wall
      }
      
      // Update bouncing effect with enhanced visibility
      if (bouncingEffectRef.current.active) {
        bouncingEffectRef.current.phase += 0.15; // Slower phase change for longer bounce effect
        if (bouncingEffectRef.current.phase >= Math.PI) {
          bouncingEffectRef.current.active = false;
          bouncingEffectRef.current.phase = 0;
        }
        
        // Apply enhanced bounce effect
        const bounceOffset = Math.sin(bouncingEffectRef.current.phase) * bouncingEffectRef.current.strength;
        ballPositionRef.current.y -= bounceOffset;
        
        // Draw a small impact effect when bouncing
        if (bouncingEffectRef.current.phase < 0.5) {
          const impactSize = (0.5 - bouncingEffectRef.current.phase) * 16; // Shrinking effect
          ctx.beginPath();
          ctx.arc(lastCollidedPinRef.current.x, lastCollidedPinRef.current.y, 
                  pinRadius + impactSize, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.5 - bouncingEffectRef.current.phase) + ')';
          ctx.fill();
        }
      } else if (!collidedWithPin) {
        // Add subtle natural bounce when not colliding
        const naturalBounce = Math.sin(animationProgressRef.current * Math.PI) * 2;
        ballPositionRef.current.y -= naturalBounce;
      }
      
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
      
      // Draw ball with enhanced visual effect
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      
      // Draw main ball
      ctx.beginPath();
      ctx.arc(
        ballPositionRef.current.x, 
        ballPositionRef.current.y, 
        8, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      
      // Draw a small trail effect
      if (bouncingEffectRef.current.active && bouncingEffectRef.current.phase < 1.0) {
        const trailOpacity = 0.7 * (1.0 - bouncingEffectRef.current.phase / Math.PI);
        ctx.fillStyle = `rgba(255, 154, 11, ${trailOpacity})`;
        ctx.beginPath();
        ctx.arc(
          ballPositionRef.current.x, 
          ballPositionRef.current.y + 5, 
          6, 
          0, 
          Math.PI * 2
        );
        ctx.fill();
      }
      
      ctx.shadowBlur = 0;
      
      // Animation continues based on progress, no need to advance index here
      
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
  
  // Reset animation state when animationPath changes
  useEffect(() => {
    console.log('Animation path changed:', animationPath);
    
    if (animationPath) {
      console.log('Starting ball animation with path length:', animationPath.length);
      
      // Completely reset animation state when a new path is provided
      animationCompleteRef.current = false;
      pathIndexRef.current = 0;
      animationProgressRef.current = 0;
      
      // Ensure canvas is available
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('Canvas ref not available');
        return;
      }
      
      const centerX = canvas.width / 2;
      ballPositionRef.current = { x: centerX, y: 10 }; // Position slightly below top for visibility
      velocityRef.current = { x: 0, y: 1 }; // Start with small downward velocity
      lastCollidedPinRef.current = null;
      bouncingEffectRef.current = { active: false, strength: 0, phase: 0 };
      
      // Cancel any existing animation frames to avoid conflicts
      if (animationRef.current) {
        console.log('Cancelling existing animation');
        cancelAnimationFrame(animationRef.current);
      }
      
      // Force an initial render to show the ball
      if (animateBallRef.current) {
        animateBallRef.current();
      }
      
      // Start a fresh animation sequence with short delay
      console.log('Scheduling animation start');
      setTimeout(() => {
        if (!animationCompleteRef.current && animateBallRef.current) {
          console.log('Starting animation');
          // Apply initial velocity for more natural start
          velocityRef.current = { x: (Math.random() - 0.5) * 0.003, y: 0.025 }; // 200% further reduced velocity for extremely slow motion
          animationRef.current = requestAnimationFrame(animateBallRef.current);
        } else {
          console.warn('Animation not started:', 
            !animationCompleteRef.current ? 'animation already complete' : 'no animation function');
        }
      }, 200); // Shorter delay for better responsiveness
    }
  }, [animationPath]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={500}
      className="w-full bg-bg-base rounded-lg overflow-hidden"
    />
  );
};

export default PlinkoBoard;