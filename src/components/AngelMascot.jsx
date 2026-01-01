import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AngelMascot() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Generate random position within screen bounds
  const getRandomPosition = () => {
    const padding = 120;
    const maxX = window.innerWidth - padding;
    const maxY = window.innerHeight - padding;
    
    return {
      x: Math.random() * (maxX - padding) + padding,
      y: Math.random() * (maxY - padding) + padding,
    };
  };

  // Auto-move to random positions
  useEffect(() => {
    // Initial position (bottom right)
    setPosition({
      x: window.innerWidth - 140,
      y: window.innerHeight - 140,
    });

    // Only auto-move if not being dragged
    const moveInterval = setInterval(() => {
      if (!isDragging) {
        setPosition(getRandomPosition());
      }
    }, Math.random() * 4000 + 8000); // 8-12 seconds

    return () => clearInterval(moveInterval);
  }, [isDragging]);

  return (
    <motion.div
      drag
      dragConstraints={{
        top: 0,
        left: 0,
        right: window.innerWidth - 120,
        bottom: window.innerHeight - 120,
      }}
      dragElastic={0.2}
      dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      onHoverStart={() => setShowTooltip(true)}
      onHoverEnd={() => setShowTooltip(false)}
      animate={{ 
        x: isDragging ? undefined : position.x,
        y: isDragging ? undefined : position.y,
        rotate: isDragging ? 0 : [0, 8, -8, 0],
        scale: isDragging ? 1.15 : showTooltip ? 1.1 : [1, 1.05, 1],
      }}
      transition={{ 
        x: { duration: 6, ease: "easeInOut" },
        y: { duration: 6, ease: "easeInOut" },
        rotate: { 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut",
          repeatType: "reverse"
        },
        scale: { 
          duration: showTooltip || isDragging ? 0.3 : 3, 
          repeat: showTooltip || isDragging ? 0 : Infinity,
          ease: "easeInOut",
          repeatType: "reverse"
        },
      }}
      className="fixed z-50 cursor-grab active:cursor-grabbing touch-none select-none"
      style={{
        left: 0,
        top: 0,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Glowing effect */}
      <motion.div
        animate={{
          scale: isDragging ? 1.5 : [1, 1.4, 1],
          opacity: isDragging ? 0.9 : [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: isDragging ? 0.3 : 3,
          repeat: isDragging ? 0 : Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/60 to-purple-400/60 blur-2xl"
      />

      {/* Angel Image */}
      <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-2xl shadow-purple-500/50 border-2 border-white/70 backdrop-blur-sm bg-transparent">
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693845be034c36e3732b8bac/7dd3f93fb_image.png"
          alt="Angel AI"
          className="w-full h-full object-cover object-center"
          draggable="false"
        />
        
        {/* Dancing sparkle effects */}
        {!isDragging && (
          <>
            <motion.div
              animate={{
                scale: [0, 1.3, 0],
                opacity: [0, 1, 0],
                x: [-18, 18],
                y: [-18, 18],
                rotate: [0, 360],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 0.5,
              }}
              className="absolute top-0 right-0 w-3 h-3 rounded-full bg-yellow-300 shadow-lg shadow-yellow-300/60"
            />
            <motion.div
              animate={{
                scale: [0, 1.3, 0],
                opacity: [0, 1, 0],
                x: [18, -18],
                y: [18, -18],
                rotate: [0, -360],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.6,
                repeatDelay: 0.5,
              }}
              className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-purple-300 shadow-lg shadow-purple-300/60"
            />
            <motion.div
              animate={{
                scale: [0, 1.3, 0],
                opacity: [0, 1, 0],
                x: [0, 22, -22, 0],
                y: [-22, 0, 22, -22],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.2,
                repeatDelay: 0.5,
              }}
              className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full bg-pink-300 shadow-lg shadow-pink-300/60"
            />
            <motion.div
              animate={{
                scale: [0, 1.3, 0],
                opacity: [0, 1, 0],
                x: [-22, 0, 22, -22],
                y: [0, -22, 0, 22],
                rotate: [0, -180, -360],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.8,
                repeatDelay: 0.5,
              }}
              className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full bg-amber-300 shadow-lg shadow-amber-300/60"
            />
            <motion.div
              animate={{
                scale: [0, 1.2, 0],
                opacity: [0, 1, 0],
                rotate: [0, 720],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3,
                repeatDelay: 0.5,
              }}
              className="absolute top-1/3 left-1/3 w-2 h-2 rounded-full bg-rose-300 shadow-lg shadow-rose-300/60"
            />
          </>
        )}
        
        {/* Floating hearts when hovering */}
        {showTooltip && (
          <>
            <motion.div
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -30, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-1/2 left-1/2 text-lg"
            >
              💛
            </motion.div>
            <motion.div
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -30, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              className="absolute top-1/2 left-1/4 text-lg"
            >
              💜
            </motion.div>
            <motion.div
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -30, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
              className="absolute top-1/2 right-1/4 text-lg"
            >
              🩷
            </motion.div>
          </>
        )}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 text-white px-5 py-2.5 rounded-full shadow-2xl whitespace-nowrap text-sm font-bold"
          >
            <span className="relative z-10">Angel AI 💛</span>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
              className="absolute inset-0 rounded-full bg-white/30 blur-sm"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}