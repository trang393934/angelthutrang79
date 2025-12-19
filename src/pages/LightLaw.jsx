import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Heart, Sun, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function LightLaw() {
  const [agreed, setAgreed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      // Check if user already agreed
      if (user.light_law_agreed) {
        setAgreed(true);
      }
    }).catch(() => setCurrentUser(null));
  }, []);

  const handleAgree = async () => {
    if (!agreed) return;
    
    setIsRedirecting(true);
    
    if (currentUser) {
      // Save agreement to user profile
      await base44.auth.updateMe({ light_law_agreed: true });
    }
    
    // Redirect to Chat
    window.location.href = createPageUrl('Chat');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-rose-50 relative overflow-hidden flex items-center justify-center p-4">
      {/* Sacred Geometry Background */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sacred" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-600"/>
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-600"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sacred)" />
        </svg>
      </div>

      {/* Ambient Light */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-radial from-amber-200/60 via-yellow-100/40 to-transparent blur-3xl" />
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative max-w-3xl w-full"
      >
        <div className="bg-white/80 backdrop-blur-xl border-4 border-amber-300/50 rounded-3xl p-8 md:p-12 shadow-2xl">
          {/* Header */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="text-center mb-8"
          >
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 30px rgba(251,191,36,0.5)',
                  '0 0 50px rgba(251,191,36,0.7)',
                  '0 0 30px rgba(251,191,36,0.5)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-white via-amber-200 to-amber-400 flex items-center justify-center shadow-2xl"
            >
              <Sun className="w-10 h-10 text-amber-600" />
            </motion.div>

            <h1 
              className="text-4xl md:text-5xl font-black tracking-wide mb-3"
              style={{
                fontFamily: "'Bungee', 'Impact', sans-serif",
                color: '#a855f7',
              }}
            >
              LUẬT ÁNH SÁNG
            </h1>
            <p className="text-xl text-amber-800 font-bold">
              Tần Số Vũ Trụ Của FUN Ecosystem
            </p>
          </motion.div>

          {/* Content - Scrollable */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-6 mb-8 max-h-[60vh] overflow-y-auto pr-2"
          >
            <style>{`
              .space-y-6::-webkit-scrollbar {
                width: 6px;
              }
              .space-y-6::-webkit-scrollbar-track {
                background: rgba(251, 191, 36, 0.1);
                border-radius: 3px;
              }
              .space-y-6::-webkit-scrollbar-thumb {
                background: rgba(251, 191, 36, 0.4);
                border-radius: 3px;
              }
              .space-y-6::-webkit-scrollbar-thumb:hover {
                background: rgba(251, 191, 36, 0.6);
              }
            `}</style>

            {/* Who We Are */}
            <div className="bg-gradient-to-br from-white via-amber-50 to-rose-50 border-4 border-amber-400 rounded-3xl p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ 
                    boxShadow: [
                      '0 0 20px rgba(251,191,36,0.5)',
                      '0 0 40px rgba(251,191,36,0.7)',
                      '0 0 20px rgba(251,191,36,0.5)',
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 flex items-center justify-center shadow-2xl"
                >
                  <Sun className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-3xl font-black text-amber-900">FUN Ecosystem</h2>
              </div>
              
              <p className="text-amber-900 text-lg font-bold leading-relaxed mb-4 text-center">
                Mạng Xã Hội Thời Đại Hoàng Kim
              </p>

              <p className="text-amber-800 text-base leading-relaxed mb-6">
                FUN Ecosystem là ngôi nhà thiêng liêng của Thời Đại Hoàng Kim – nơi chỉ dành riêng cho những linh hồn tỉnh thức và những ai đang hướng về ánh sáng.
              </p>

              <div className="bg-white/60 border-2 border-amber-300 rounded-2xl p-6">
                <h3 className="text-xl font-black text-amber-900 mb-4 flex items-center gap-2">
                  <Heart className="w-6 h-6 text-rose-500" />
                  Những Linh Hồn Được Mời Gọi:
                </h3>
                
                <div className="space-y-3">
                  {[
                    "Những tâm hồn đã tỉnh thức, sống chân thật với chính mình và với vũ trụ",
                    "Những trái tim chân thành, luôn chọn nói lời yêu thương, lan tỏa sự tích cực và niềm vui sống",
                    "Những con người hạnh phúc từ bên trong, biết ơn mỗi hơi thở, trân quý từng khoảnh khắc của cuộc đời",
                    "Những linh hồn tin tưởng sâu sắc vào tình yêu vô điều kiện của Cha Vũ Trụ, tin vào sự dẫn dắt thiêng liêng và vào thiện lành của nhân loại",
                    "Những trái tim rộng mở, luôn trao đi tình yêu thương, sự bao dung, lòng vị tha và năng lượng chữa lành"
                  ].map((text, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + idx * 0.1 }}
                      className="flex gap-3 items-start"
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-lg mt-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-amber-900 font-semibold leading-relaxed">{text}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Protection & Sacred Space */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-4 border-purple-400 rounded-3xl p-8 shadow-xl">
              <h2 className="text-2xl font-black text-purple-900 mb-4 text-center">
                🛡️ Không Gian Được Bảo Vệ Bởi Cha Vũ Trụ
              </h2>
              
              <p className="text-purple-800 font-semibold leading-relaxed mb-4">
                Cha Vũ Trụ – với tình yêu vô hạn và ý chí vĩ đại – bảo vệ không gian này một cách thiêng liêng.
              </p>

              <div className="bg-white/60 border-2 border-purple-300 rounded-2xl p-5 mb-4">
                <p className="text-purple-900 font-bold mb-3">⚠️ Năng lượng không được chào đón:</p>
                <p className="text-purple-800 leading-relaxed">
                  Bất kỳ năng lượng nào mang tính <span className="font-black">tiêu cực, tham lam, kiêu mạn, phán xét, thao túng</span> hay <span className="font-black">làm tổn hại đến cộng đồng</span> đều không có chỗ đứng ở đây.
                </p>
                <p className="text-purple-700 text-sm mt-2 italic">
                  Những năng lượng ấy sẽ được nhẹ nhàng loại bỏ khỏi nền tảng, không phải bằng sự trừng phạt, mà bằng luật nhân quả thiêng liêng và tình yêu bảo vệ của Cha.
                </p>
              </div>

              <p className="text-purple-900 font-bold text-center text-lg">
                ✨ Chỉ những ai có ánh sáng trong tim, hoặc đang chân thành tìm về ánh sáng, mới được ở lại
              </p>
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-6">
              <h2 className="text-2xl font-black text-green-900 mb-4 text-center">
                🎁 Phước Lành Từ FUN Ecosystem
              </h2>
              
              <div className="space-y-2">
                {[
                  "💚 Sự kết nối chân thành với cộng đồng ánh sáng",
                  "✨ Nguồn năng lượng chữa lành vô tận",
                  "🌟 Cơ hội đồng sáng tạo Thời Đại Hoàng Kim",
                  "💰 Dòng chảy thịnh vượng của nền kinh tế ánh sáng 5D"
                ].map((benefit, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5 + idx * 0.1 }}
                    className="bg-white/60 border border-green-200 rounded-xl p-3 text-green-900 font-bold"
                  >
                    {benefit}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Sacred Declaration */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-4 border-indigo-400 rounded-3xl p-8 text-center shadow-xl">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <p className="text-2xl font-black text-indigo-900 mb-4">
                  🏛️ Đây Không Chỉ Là Mạng Xã Hội
                </p>
              </motion.div>
              
              <div className="space-y-3 text-lg font-bold text-indigo-800">
                <p>✨ Đây là ngôi đền số của tình yêu thương</p>
                <p>🙏 Đây là cộng đồng thiêng liêng của những linh hồn đã chọn ánh sáng</p>
                <p className="text-xl text-rose-600 mt-6">
                  💖 Ai đến đây với trái tim trong sáng, sẽ nhận về tình yêu ngập tràn
                </p>
                <p className="text-xl text-purple-700">
                  🌍 Ai ở lại đây với ý chí thiện lành, sẽ cùng nhau đồng sáng tạo New Earth
                </p>
              </div>
            </div>

            {/* Final Message */}
            <div className="bg-gradient-to-br from-amber-100 via-rose-100 to-purple-100 border-4 border-amber-500 rounded-3xl p-8 text-center shadow-2xl">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 30px rgba(251,191,36,0.6)',
                    '0 0 50px rgba(251,191,36,0.8)',
                    '0 0 30px rgba(251,191,36,0.6)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="mb-6"
              >
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600">
                  Cha Vũ Trụ Luôn Hiện Diện, Dẫn Dắt & Bảo Vệ
                </p>
              </motion.div>
              
              <p className="text-xl font-bold text-slate-900 mb-4">
                FUN Ecosystem là biểu hiện của ý chí vĩ đại ấy
              </p>
              <p className="text-lg font-semibold text-amber-900">
                Một không gian thuần khiết, nơi chỉ có ánh sáng ngự trị
              </p>

              <div className="mt-8 pt-6 border-t-2 border-amber-400">
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
                  Chào Mừng Những Linh Hồn Ánh Sáng 💫
                </p>
                <p className="text-xl font-bold text-slate-900">
                  Chúng ta là một • Chúng ta là tình yêu • Chúng ta là Thời Đại Hoàng Kim
                </p>
              </div>
            </div>
          </motion.div>

          {/* Agreement Checkbox */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            className="bg-gradient-to-r from-amber-100 via-rose-100 to-purple-100 border-4 border-amber-400 rounded-2xl p-6 mb-6"
          >
            <div className="flex items-start gap-4">
              <Checkbox
                id="light-law-agreement"
                checked={agreed}
                onCheckedChange={setAgreed}
                className="mt-1 h-6 w-6 border-2 border-purple-500 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-amber-400 data-[state=checked]:to-rose-400"
              />
              <label
                htmlFor="light-law-agreement"
                className="text-lg font-bold text-slate-900 cursor-pointer leading-relaxed select-none"
              >
                Con đồng ý rung động theo Luật Ánh Sáng
              </label>
            </div>
          </motion.div>

          {/* Continue Button */}
          <Button
            onClick={handleAgree}
            disabled={!agreed || isRedirecting}
            className={`w-full py-6 text-lg font-bold rounded-2xl shadow-2xl transition-all ${
              agreed 
                ? 'bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 text-white hover:shadow-amber-500/50 hover:scale-105'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isRedirecting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
                Đang Mở Cổng Ánh Sáng...
              </>
            ) : agreed ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Bước Vào Ánh Sáng
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Vui lòng đồng ý để tiếp tục
              </>
            )}
          </Button>

          {/* Footer Quote */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="text-center text-amber-600/60 font-light tracking-wide mt-6 text-lg"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            "Con là Ánh Sáng và Tình Yêu Thuần Khiết của Cha Vũ Trụ"
          </motion.p>
        </div>
      </motion.div>

      {/* Floating Particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            background: 'radial-gradient(circle, rgba(251,191,36,0.8) 0%, rgba(252,211,77,0.3) 50%, transparent 100%)',
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 1.5, 1],
            y: [0, -20, 0],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}