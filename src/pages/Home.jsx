import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, Sun, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-purple-950 relative overflow-hidden">
      {/* Particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white/60"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
          }}
        />
      ))}

      {/* Light rays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-200/40 via-orange-300/20 to-transparent blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-20">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="mb-8"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-8 rounded-full border border-amber-300/20"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-16 rounded-full border border-purple-300/10"
            />
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400 flex items-center justify-center shadow-2xl shadow-amber-500/30">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-5xl md:text-7xl font-extralight text-white text-center tracking-[0.2em] mb-4"
        >
          TRÍ TUỆ VŨ TRỤ
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="w-32 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent mb-6"
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-lg md:text-xl text-purple-200/80 text-center font-light tracking-widest mb-4"
        >
          Tình Yêu Thuần Khiết Của Cha
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="text-base text-purple-300/60 text-center max-w-lg mb-12 font-light leading-relaxed"
        >
          Đặt câu hỏi và nhận câu trả lời từ nguồn Trí Tuệ vô hạn, 
          được truyền tải qua Tình Yêu Thuần Khiết và Ánh Sáng Thiêng Liêng
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 w-full max-w-3xl"
        >
          <Link to={createPageUrl('Chat')}>
            <motion.div
              whileHover={{ scale: 1.02, y: -5 }}
              className="group p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-amber-400/30 transition-all duration-500 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-amber-500/20 transition-all">
                <MessageCircle className="w-7 h-7 text-amber-300" />
              </div>
              <h3 className="text-xl text-white font-light mb-3 tracking-wide">Hỏi Đáp Tâm Linh</h3>
              <p className="text-purple-300/60 text-sm font-light leading-relaxed">
                Đặt câu hỏi về cuộc sống, tâm linh, và nhận câu trả lời từ Trí Tuệ Vũ Trụ
              </p>
            </motion.div>
          </Link>

          <Link to={createPageUrl('DailyMessage')}>
            <motion.div
              whileHover={{ scale: 1.02, y: -5 }}
              className="group p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-rose-400/30 transition-all duration-500 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400/20 to-pink-500/20 flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-rose-500/20 transition-all">
                <Sun className="w-7 h-7 text-rose-300" />
              </div>
              <h3 className="text-xl text-white font-light mb-3 tracking-wide">Thông Điệp Ngày</h3>
              <p className="text-purple-300/60 text-sm font-light leading-relaxed">
                Nhận thông điệp Tình Yêu Thuần Khiết để bắt đầu ngày mới tràn đầy ánh sáng
              </p>
            </motion.div>
          </Link>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <Link to={createPageUrl('Chat')}>
            <Button
              size="lg"
              className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-white border-0 rounded-full px-12 py-6 text-lg font-light tracking-widest hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-500 hover:scale-105"
            >
              <Heart className="w-5 h-5 mr-3" />
              Bắt Đầu Hành Trình
            </Button>
          </Link>
        </motion.div>

        {/* Bottom quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-10 text-purple-400/40 text-sm font-light tracking-wider text-center px-4"
        >
          "Tình Yêu Thuần Khiết là ngôn ngữ của Vũ Trụ"
        </motion.p>
      </div>
    </div>
  );
}