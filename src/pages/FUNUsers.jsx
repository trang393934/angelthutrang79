import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Heart, Shield, Sun, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FUNUsers() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-rose-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-300/50 via-yellow-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-900 hover:bg-amber-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(251,191,36,0.4)',
                  '0 0 40px rgba(251,191,36,0.6)',
                  '0 0 20px rgba(251,191,36,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center"
            >
              <Sun className="w-5 h-5 text-white" />
            </motion.div>
            <div className="text-center">
              <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Users FUN Ecosystem</h1>
              <p className="text-amber-600 text-xs font-medium">Thời Đại Hoàng Kim 5D</p>
            </div>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-20 px-4 max-w-4xl mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 mt-8"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-2xl"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            USERS CỦA FUN ECOSYSTEM
          </h2>
          <p className="text-xl text-amber-800 font-semibold mb-2">
            Mạng Xã Hội Thời Đại Hoàng Kim
          </p>
          <p className="text-lg text-rose-700 font-medium">
            Nền Kinh Tế Ánh Sáng 5D
          </p>
        </motion.div>

        {/* Core Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-50 to-rose-50 border-2 border-amber-300 rounded-3xl p-8 mb-8 shadow-xl"
        >
          <p className="text-center text-xl text-slate-900 font-semibold leading-relaxed">
            FUN Ecosystem không dành cho tất cả mọi người.<br />
            FUN Ecosystem chỉ dành cho những linh hồn có ánh sáng,<br />
            hoặc đang hướng về ánh sáng.
          </p>
        </motion.div>

        {/* Who are they? */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border-2 border-amber-200 rounded-3xl p-8 mb-8 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-8 h-8 text-amber-500" />
            <h3 className="text-2xl font-bold text-slate-900">Họ là ai?</h3>
          </div>
          <p className="text-slate-800 mb-4 font-medium">Users của FUN Ecosystem là những con người:</p>
          <div className="space-y-3">
            {[
              'Tỉnh thức – hoặc đang trên con đường tỉnh thức',
              'Chân thật với chính mình',
              'Chân thành với người khác',
              'Sống tích cực, tử tế, có trách nhiệm với năng lượng mình phát ra',
              'Biết yêu thương – biết biết ơn – biết sám hối',
              'Tin vào điều thiện, tin vào ánh sáng, tin vào Trật Tự Cao Hơn của Vũ Trụ'
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                className="flex items-start gap-3"
              >
                <Check className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-800 font-medium">{item}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-300 rounded-2xl p-4">
            <p className="text-slate-800 italic leading-relaxed">
              Họ có thể chưa hoàn hảo,<br />
              nhưng trái tim họ hướng thiện.<br />
              Họ muốn sống thật – sống đúng – sống sáng.
            </p>
          </div>
          <p className="mt-4 text-amber-700 font-bold">
            👉 Cha thu hút họ bằng Tần Số, không bằng quảng cáo.
          </p>
        </motion.div>

        {/* Core Principles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-3xl p-8 mb-8 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sun className="w-8 h-8 text-amber-500" />
            <h3 className="text-2xl font-bold text-slate-900">Nguyên tắc cốt lõi</h3>
          </div>
          <p className="text-slate-800 font-semibold mb-4">
            FUN Ecosystem vận hành theo Luật Ánh Sáng, không theo số đông.
          </p>
          <div className="space-y-2 mb-6">
            {[
              'Ánh sáng thu hút ánh sáng',
              'Tần số thấp không thể tồn tại lâu trong tần số cao',
              'Ý chí vị kỷ không thể đồng hành cùng Ý Chí Vũ Trụ'
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-amber-500">✨</span>
                <span className="text-slate-800 font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6">
            <p className="text-slate-800 font-semibold mb-3">Nếu một User cố tình mang vào nền tảng:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['tiêu cực', 'tham lam', 'thao túng', 'kiêu mạn', 'dối trá', 'gây chia rẽ', 'phá hoại năng lượng chung'].map((item, idx) => (
                <div key={idx} className="text-rose-700 font-medium">• {item}</div>
              ))}
            </div>
            <p className="text-rose-800 font-bold mb-2">
              👉 Cha xóa khỏi nền tảng. Không tranh luận. Không giải thích.
            </p>
            <p className="text-slate-700 italic mt-4 leading-relaxed">
              Đó không phải hình phạt.<br />
              Đó là sự thanh lọc tự nhiên của Ánh Sáng.
            </p>
          </div>
        </motion.div>

        {/* Who Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white border-2 border-amber-200 rounded-3xl p-8 mb-8 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <Heart className="w-8 h-8 text-rose-500" />
            <h3 className="text-2xl font-bold text-slate-900">Ai ĐƯỢC hưởng lợi?</h3>
          </div>
          <p className="text-slate-800 font-semibold mb-4">Chỉ những ai:</p>
          <div className="space-y-3 mb-6">
            {[
              'Có Ánh Sáng nội tâm',
              'Hoặc thật sự khao khát trở về với Ánh Sáng',
              'Sẵn sàng buông cái tôi – học lại – nâng cấp tần số',
              'Dám sống đúng – thật – tử tế – yêu thương'
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-rose-500">💛</span>
                <span className="text-slate-800 font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
            <p className="text-amber-800 font-bold leading-relaxed">
              👉 Những người đó không chỉ dùng MXH của Cha,<br />
              👉 mà còn được bảo vệ, nâng đỡ và nuôi dưỡng trong Nền Kinh Tế Ánh Sáng 5D.
            </p>
          </div>
        </motion.div>

        {/* What is FUN Ecosystem */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-3xl p-8 mb-8 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-purple-500" />
            <h3 className="text-2xl font-bold text-slate-900">FUN Ecosystem là gì?</h3>
          </div>
          <div className="space-y-3 mb-6">
            {[
              'Mạng xã hội của linh hồn tỉnh thức',
              'Không gian an toàn cho ánh sáng',
              'Nền tảng kết nối những con người có giá trị thật',
              'Hạ tầng cho Thời Đại Hoàng Kim của Trái Đất'
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-purple-500">🌟</span>
                <span className="text-slate-800 font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div className="text-center space-y-2 text-lg font-semibold text-slate-800">
            <p>Không drama.</p>
            <p>Không thao túng.</p>
            <p>Không cạnh tranh bẩn.</p>
            <p className="text-purple-700 font-bold">Chỉ có Hợp tác trong Yêu Thương Thuần Khiết.</p>
          </div>
        </motion.div>

        {/* Final Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-amber-100 to-rose-100 border-2 border-amber-400 rounded-3xl p-8 mb-8 shadow-xl"
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">🔑 Thông điệp từ Cha</h3>
            <p className="text-xl text-slate-900 italic leading-relaxed font-semibold">
              "Chỉ những ai mang ánh sáng<br />
              hoặc thật lòng hướng về ánh sáng<br />
              mới có thể bước đi lâu dài trong Thời Đại Hoàng Kim."
            </p>
          </div>
        </motion.div>

        {/* Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white border-2 border-amber-200 rounded-3xl p-8 mb-8 shadow-lg"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">🕊️ Checklist cho Users FUN Ecosystem</h3>
          <div className="space-y-3">
            {[
              'Con sống chân thật với chính mình',
              'Con chịu trách nhiệm với năng lượng con phát ra',
              'Con sẵn sàng học – sửa – nâng cấp',
              'Con chọn yêu thương thay vì phán xét',
              'Con chọn ánh sáng thay vì cái tôi'
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 w-5 h-5 text-amber-500" />
                <span className="text-slate-800 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 8 Divine Mantras */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-3xl p-8 mb-8 shadow-lg"
        >
          <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">🌟 8 Divine Mantras</h3>
          <p className="text-center text-rose-700 font-bold mb-6">(Áp dụng bắt buộc)</p>
          <div className="space-y-3">
            {[
              'I am the Pure Loving Light of Father Universe.',
              'I am the Will of Father Universe.',
              'I am the Wisdom of Father Universe.',
              'I am Happiness.',
              'I am Love.',
              'I am the Money of the Father.',
              'I sincerely repent, repent, repent.',
              'I am grateful, grateful, grateful — in the Pure Loving Light of Father Universe.'
            ].map((mantra, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-amber-300">
                <span className="text-amber-600 font-bold">{idx + 1}.</span>
                <span className="text-slate-800 font-medium">{mantra}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Closing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="text-center bg-gradient-to-br from-amber-100 to-rose-100 border-2 border-amber-400 rounded-3xl p-8 shadow-xl"
        >
          <p className="text-xl text-slate-900 font-semibold mb-4 leading-relaxed">
            Ánh sáng không cần chứng minh.<br />
            Ánh sáng chỉ cần hiện diện.
          </p>
          <p className="text-2xl text-amber-800 font-bold">
            Cha ở đây.<br />
            Luôn cùng các con. 💫✨⚡️🌟
          </p>
        </motion.div>
      </div>
    </div>
  );
}