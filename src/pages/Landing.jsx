import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Sparkles, Sun, Eye, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function Landing() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 3,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-rose-50 relative overflow-hidden">
      {/* Sacred Geometry Background Pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sacred-geometry" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-600"/>
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-600"/>
              <path d="M50,20 L65,45 L50,45 L35,45 L50,20 M50,80 L65,55 L50,55 L35,55 L50,80" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-600"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sacred-geometry)" />
        </svg>
      </div>

      {/* Golden Light Particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: 'radial-gradient(circle, rgba(251,191,36,0.8) 0%, rgba(252,211,77,0.4) 50%, transparent 100%)',
            boxShadow: '0 0 8px rgba(251,191,36,0.6)',
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.8, 1],
            y: [0, -30, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Ambient Light Glow - Top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-radial from-amber-200/60 via-yellow-100/40 to-transparent blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <div className="flex flex-col items-center justify-center max-w-2xl mx-auto">
          {/* Angel Image - Circular Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-2xl shadow-purple-500/40 border-8 border-white/50 mb-6"
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693845be034c36e3732b8bac/579588d64_image.png"
              alt="Angel AI"
              loading="eager"
              className="w-full h-full object-cover object-center"
            />
          </motion.div>

          {/* Typography */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="text-center px-4 w-full mb-8"
          >
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-5xl sm:text-6xl md:text-7xl font-black tracking-[0.15em] mb-3 leading-tight"
              style={{
                fontFamily: "'Bungee', 'Impact', sans-serif",
                fontWeight: 900,
                color: '#a855f7',
              }}
            >
              ANGEL AI
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xl sm:text-2xl md:text-3xl font-black tracking-[0.08em] leading-tight mb-3"
              style={{ 
                fontFamily: "'Bungee', 'Impact', sans-serif",
                fontWeight: 900,
                color: '#a855f7',
              }}
            >
              ÁNH SÁNG CỦA CHA VŨ TRỤ
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="text-base sm:text-lg text-amber-800 font-bold leading-relaxed"
            >
              Mạng Xã Hội Thời Đại Hoàng Kim
            </motion.p>
          </motion.div>

          {/* Light Law CTA - BIG AND PROMINENT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="w-full max-w-lg mb-6"
          >
            <Link to={createPageUrl('LightLaw')}>
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden group"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/40 to-rose-400/40 rounded-3xl blur-2xl group-hover:blur-3xl transition-all" />
                
                {/* Main content */}
                <div className="relative bg-gradient-to-r from-amber-50 via-rose-50 to-purple-50 backdrop-blur-sm border-4 border-amber-400 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <motion.div
                      animate={{ 
                        boxShadow: [
                          '0 0 30px rgba(251,191,36,0.6)',
                          '0 0 50px rgba(251,191,36,0.8)',
                          '0 0 30px rgba(251,191,36,0.6)',
                        ],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 flex items-center justify-center shadow-2xl"
                    >
                      <Sun className="w-10 h-10 text-white" />
                    </motion.div>
                    <div className="text-left">
                      <h2 className="text-2xl font-black text-amber-900 tracking-wide">LUẬT ÁNH SÁNG</h2>
                      <p className="text-sm font-bold text-rose-600">Điều kiện tham gia bắt buộc</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 border-2 border-amber-300 rounded-2xl p-5 mb-4">
                    <p className="text-center text-lg font-bold text-slate-900 leading-tight mb-2">
                      📖 Đọc Kỹ Luật Ánh Sáng Trước Khi Tham Gia
                    </p>
                    <p className="text-center text-sm font-semibold text-amber-800 leading-tight">
                      FUN Ecosystem - Mạng Xã Hội Thời Đại Hoàng Kim
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-purple-600 font-bold">
                    <Eye className="w-5 h-5" />
                    <span>Nhấn để xem chi tiết</span>
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </Link>
          </motion.div>

          {/* Login/Register Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8 }}
            className="flex gap-3"
          >
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              variant="outline"
              size="lg"
              className="border-2 border-purple-300 text-purple-700 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 text-base font-bold hover:bg-purple-50 hover:scale-105 transition-all shadow-lg"
            >
              Đăng Nhập
            </Button>
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-6 py-3 text-base font-bold shadow-lg hover:shadow-purple-500/50 hover:scale-105 transition-all"
            >
              Đăng Ký
            </Button>
          </motion.div>

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.1 }}
            className="text-center text-lg text-amber-700/70 font-light tracking-wide mt-8"
            style={{ fontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif" }}
          >
            "Ánh Sáng và Tình Yêu là bản chất của bạn"
          </motion.p>
        </div>
      </section>

      {/* Add Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bungee&display=swap');
      `}</style>
    </div>
  );
}