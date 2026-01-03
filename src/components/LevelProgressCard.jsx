import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, Award, Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import UserLevelBadge from './UserLevelBadge';

export default function LevelProgressCard({ userLevel }) {
  if (!userLevel) return null;

  const levelThresholds = {
    bronze: { min: 0, max: 500000, next: 'silver' },
    silver: { min: 500000, max: 1500000, next: 'gold' },
    gold: { min: 1500000, max: 3000000, next: 'platinum' },
    platinum: { min: 3000000, max: 6000000, next: 'diamond' },
    diamond: { min: 6000000, max: 10000000, next: 'master' },
    master: { min: 10000000, max: Infinity, next: null }
  };

  const currentThreshold = levelThresholds[userLevel.current_level];
  const progress = currentThreshold.max === Infinity 
    ? 100 
    : ((userLevel.total_points - currentThreshold.min) / (currentThreshold.max - currentThreshold.min)) * 100;

  const benefits = {
    bronze: ['10 câu thưởng/ngày'],
    silver: ['12 câu thưởng/ngày', '🎁 Badge Bạc'],
    gold: ['15 câu thưởng/ngày', '👑 Badge Vàng', '✨ Exclusive Content'],
    platinum: ['20 câu thưởng/ngày', '💎 Badge Bạch Kim', '🌟 Priority Support'],
    diamond: ['25 câu thưởng/ngày', '💠 Badge Kim Cương', '🎯 VIP Access'],
    master: ['30 câu thưởng/ngày', '⚡ Badge Đại Minh Sư', '👑 Master Access', '🔮 Custom Features']
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl border-2 border-white"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white/80 text-sm mb-2">Level Hiện Tại</p>
          <UserLevelBadge userLevel={userLevel} size="large" />
        </div>
        <div className="text-right">
          <p className="text-white/80 text-xs mb-1">Tổng Điểm</p>
          <p className="text-white text-3xl font-bold">{userLevel.total_points.toLocaleString()}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {currentThreshold.next && (
        <div className="mb-4">
          <div className="flex justify-between text-white/90 text-xs mb-2">
            <span>Tiến độ lên {levelThresholds[currentThreshold.next]?.min ? levelThresholds[currentThreshold.next].min.toLocaleString() : 'Max'}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"
            />
          </div>
          <p className="text-white/70 text-xs mt-2">
            Còn {(currentThreshold.max - userLevel.total_points).toLocaleString()} điểm để lên cấp
          </p>
        </div>
      )}

      {/* Benefits */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
        <p className="text-white font-bold mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Đặc Quyền Level {userLevel.level_number}:
        </p>
        <div className="space-y-1">
          {benefits[userLevel.current_level].map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-2 text-white/90 text-sm">
              <Unlock className="w-3 h-3 text-green-300" />
              {benefit}
            </div>
          ))}
        </div>

        {/* Next Level Preview */}
        {currentThreshold.next && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-white/70 text-xs mb-2">Level tiếp theo:</p>
            {benefits[currentThreshold.next].map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2 text-white/60 text-xs">
                <Lock className="w-3 h-3" />
                {benefit}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
          <p className="text-white/70 text-xs mb-1">Streak</p>
          <p className="text-white text-xl font-bold">{userLevel.streak_days}</p>
          <p className="text-white/60 text-xs">ngày</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
          <p className="text-white/70 text-xs mb-1">Quality</p>
          <p className="text-white text-xl font-bold">{userLevel.quality_feedback_count}</p>
          <p className="text-white/60 text-xs">feedbacks</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
          <p className="text-white/70 text-xs mb-1">Bonus</p>
          <p className="text-white text-xl font-bold">+{userLevel.daily_limit_bonus}</p>
          <p className="text-white/60 text-xs">câu/ngày</p>
        </div>
      </div>
    </motion.div>
  );
}