import React from 'react';
import { motion } from 'framer-motion';

export default function AngelMascot() {
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  
  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 10 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(event, info) => {
        setIsDragging(false);
        setPosition({ x: info.point.x, y: info.point.y });
      }}
      className="fixed bottom-4 right-4 lg:bottom-8 lg:right-8 z-50 cursor-move"
      style={{ x: position.x, y: position.y }}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ 
        scale: isDragging ? 1.1 : 1, 
        rotate: 0,
        y: isDragging ? 0 : [0, -15, 0],
      }}
      transition={{
        scale: { duration: 0.5 },
        rotate: { duration: 0.5 },
        y: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }}
      whileHover={{ 
        scale: 1.1,
        rotate: [0, -10, 10, -10, 0],
        transition: { duration: 0.5 }
      }}
      whileTap={{ 
        scale: 0.95,
        rotate: [0, -15, 15, -15, 0],
        transition: { duration: 0.6 }
      }}
    >
      <motion.div
        animate={{
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative w-16 h-16 lg:w-24 lg:h-24 drop-shadow-2xl"
      >
        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 20px rgba(251,191,36,0.3)',
              '0 0 40px rgba(251,191,36,0.6)',
              '0 0 60px rgba(251,191,36,0.4)',
              '0 0 20px rgba(251,191,36,0.3)',
            ],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Angel image */}
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693845be034c36e3732b8bac/7dd3f93fb_image.png"
          alt="Angel AI"
          className="w-full h-full object-cover rounded-full border-4 border-white/50 shadow-2xl"
          style={{
            background: 'transparent',
            backdropFilter: 'blur(10px)'
          }}
        />
        
        {/* Sparkles */}
        <motion.div
          className="absolute -top-1 -right-1 text-2xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          ✨
        </motion.div>
        
        <motion.div
          className="absolute -bottom-1 -left-1 text-xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, -180, -360],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
        >
          💫
        </motion.div>
        
        <motion.div
          className="absolute top-0 left-1/2 text-lg"
          animate={{
            y: [-10, 0, -10],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          🌟
        </motion.div>
      </motion.div>
      
      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileHover={{ opacity: 1, y: 0 }}
        className="absolute -top-10 lg:-top-12 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-rose-400 text-white px-2 py-1 lg:px-3 rounded-full text-xs font-semibold whitespace-nowrap shadow-lg"
      >
        Angel AI 💛
      </motion.div>
    </motion.div>
  );
}