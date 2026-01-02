import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, CheckCircle2, Lock, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function QuestCard({ quest, progress, onClaim, userLevel, index }) {
  const isLocked = userLevel && quest.required_level > userLevel.level_number;
  const isCompleted = progress && progress.current_progress >= quest.target_count;
  const isClaimed = progress?.status === 'claimed';
  const currentProgress = progress?.current_progress || 0;
  const percentage = (currentProgress / quest.target_count) * 100;

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    hard: 'bg-orange-100 text-orange-800 border-orange-300',
    expert: 'bg-red-100 text-red-800 border-red-300'
  };

  const categoryColors = {
    chat: 'from-purple-400 to-pink-400',
    ai_tools: 'from-indigo-400 to-blue-500',
    social: 'from-rose-400 to-pink-500',
    learning: 'from-amber-400 to-orange-500',
    community: 'from-green-400 to-emerald-500'
  };

  const typeLabels = {
    daily: '📅 Hàng Ngày',
    weekly: '📆 Hàng Tuần',
    one_time: '⭐ Một Lần',
    achievement: '🏆 Thành Tựu'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-white/80 backdrop-blur-xl border-2 rounded-3xl p-6 shadow-xl transition-all ${
        isLocked ? 'border-gray-300 opacity-60' :
        isClaimed ? 'border-green-300' :
        isCompleted ? 'border-amber-400 shadow-2xl' :
        'border-purple-200 hover:shadow-2xl'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${categoryColors[quest.category]} flex items-center justify-center shadow-lg text-3xl flex-shrink-0 ${
            isLocked && 'opacity-50'
          }`}>
            {isLocked ? <Lock className="w-7 h-7 text-white" /> : quest.icon || '🎯'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="bg-purple-100 text-purple-800 text-xs border border-purple-300">
                {typeLabels[quest.quest_type]}
              </Badge>
              <Badge className={`${difficultyColors[quest.difficulty]} text-xs border`}>
                {quest.difficulty === 'easy' ? '⚡ Dễ' :
                 quest.difficulty === 'medium' ? '⚡⚡ Trung Bình' :
                 quest.difficulty === 'hard' ? '⚡⚡⚡ Khó' :
                 '⚡⚡⚡⚡ Chuyên Gia'}
              </Badge>
              {isLocked && (
                <Badge className="bg-gray-100 text-gray-800 text-xs border border-gray-300">
                  🔒 Cần Level {quest.required_level}
                </Badge>
              )}
            </div>
            <h3 className="text-slate-900 font-bold text-lg mb-1">{quest.title}</h3>
            <p className="text-slate-700 text-sm leading-relaxed">{quest.description}</p>
          </div>
        </div>

        <div className="text-right ml-4 flex-shrink-0">
          <div className="bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-300 rounded-xl px-3 py-2 mb-2">
            <p className="text-amber-900 font-bold text-2xl">+{quest.reward_coins.toLocaleString()}</p>
            <p className="text-amber-700 text-xs">Camlycoin</p>
          </div>
          {quest.reward_bonus && (
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              🎁 {quest.reward_bonus}
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {!isLocked && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-700 font-semibold">Tiến độ</span>
            <span className="text-purple-700 font-bold">
              {currentProgress}/{quest.target_count}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentage, 100)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full ${
                isClaimed ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                isCompleted ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                'bg-gradient-to-r from-purple-400 to-pink-500'
              }`}
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isLocked && (
        <div>
          {isClaimed ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-green-800 font-bold text-sm">✅ Đã Nhận Thưởng</p>
            </div>
          ) : isCompleted ? (
            <Button
              onClick={() => onClaim(quest, progress)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-6 font-bold shadow-lg hover:shadow-xl text-lg"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Nhận Thưởng Ngay! 🎁
            </Button>
          ) : (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-3">
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <p className="text-purple-800 font-semibold text-sm">
                  Còn {quest.target_count - currentProgress} để hoàn thành
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {isLocked && (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-3 text-center">
          <Lock className="w-6 h-6 text-gray-500 mx-auto mb-1" />
          <p className="text-gray-700 font-semibold text-sm">Mở khóa tại Level {quest.required_level}</p>
        </div>
      )}
    </motion.div>
  );
}