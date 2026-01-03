import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Award, Flame, Activity, Target, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PointBreakdownCard({ userLevel }) {
  const [expanded, setExpanded] = useState(false);

  if (!userLevel || !userLevel.point_breakdown) return null;

  const breakdown = userLevel.point_breakdown;
  const totalPoints = userLevel.total_points;

  const pointSources = [
    {
      label: 'Camlycoin Đã Kiếm',
      value: breakdown.base_earned || 0,
      icon: TrendingUp,
      color: 'from-amber-500 to-orange-500',
      description: 'Tổng số Camlycoin bạn đã kiếm được qua các hoạt động'
    },
    {
      label: 'Bonus Chất Lượng',
      value: breakdown.quality_bonus || 0,
      icon: Award,
      color: 'from-purple-500 to-pink-500',
      description: `${breakdown.quality_feedback_count || 0} feedback "Hữu ích" × 100 điểm`
    },
    {
      label: 'Bonus Streak',
      value: breakdown.streak_bonus || 0,
      icon: Flame,
      color: 'from-red-500 to-orange-500',
      description: `${breakdown.streak_days || 0} ngày liên tục × 50 điểm`
    },
    {
      label: 'Bonus Hoạt Động',
      value: breakdown.activity_bonus || 0,
      icon: Activity,
      color: 'from-blue-500 to-indigo-500',
      description: `${breakdown.recent_activities_count || 0} hoạt động (30 ngày gần đây) × 10 điểm`
    },
    {
      label: 'Bonus Tỷ Lệ Cao',
      value: breakdown.quality_ratio_bonus || 0,
      icon: Target,
      color: 'from-green-500 to-emerald-500',
      description: breakdown.quality_ratio >= 0.7 && breakdown.total_feedbacks >= 5
        ? `Tỷ lệ hữu ích ${Math.round((breakdown.quality_ratio || 0) * 100)}% ≥ 70% (≥5 feedback)`
        : `Cần ≥70% tỷ lệ hữu ích và ≥5 feedback để nhận 500 điểm`
    }
  ];

  const activeBonus = pointSources.filter(s => s.value > 0).length - 1; // Exclude base

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-2xl border-2 border-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white/80 text-sm mb-1">Chi Tiết Điểm</p>
          <p className="text-white text-3xl font-bold">{totalPoints.toLocaleString()}</p>
          <p className="text-white/70 text-xs mt-1">
            {activeBonus} nguồn bonus đang hoạt động
          </p>
        </div>
        <Button
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 rounded-full"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </div>

      {/* Summary Bars */}
      <div className="space-y-2 mb-4">
        {pointSources.map((source, idx) => {
          const percentage = totalPoints > 0 ? (source.value / totalPoints) * 100 : 0;
          const Icon = source.icon;

          return (
            <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${source.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white text-sm font-semibold">{source.label}</span>
                </div>
                <span className="text-white font-bold">{source.value.toLocaleString()}</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`h-full bg-gradient-to-r ${source.color} rounded-full`}
                />
              </div>
              <p className="text-white/60 text-xs mt-1">{percentage.toFixed(1)}% tổng điểm</p>
            </div>
          );
        })}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-white" />
                <p className="text-white font-bold text-sm">Giải Thích Chi Tiết</p>
              </div>
              
              {pointSources.map((source, idx) => (
                <div key={idx} className="border-b border-white/10 pb-3 last:border-0 last:pb-0">
                  <p className="text-white font-semibold text-sm mb-1">{source.label}</p>
                  <p className="text-white/80 text-xs">{source.description}</p>
                </div>
              ))}

              {/* Tips */}
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-3 mt-4">
                <p className="text-yellow-100 font-bold text-xs mb-2">💡 Mẹo Tăng Điểm:</p>
                <ul className="text-yellow-100/90 text-xs space-y-1 list-disc list-inside">
                  {breakdown.streak_days === 0 && <li>Chat mỗi ngày để xây dựng streak</li>}
                  {breakdown.quality_ratio < 0.7 && <li>Cải thiện chất lượng câu hỏi để tăng tỷ lệ hữu ích</li>}
                  {breakdown.recent_activities_count < 20 && <li>Tham gia nhiều hoạt động hơn</li>}
                  {breakdown.quality_feedback_count < 10 && <li>Nhận thêm feedback "Hữu ích"</li>}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 text-center border border-white/20">
          <p className="text-white/70 text-xs">Feedback</p>
          <p className="text-white text-lg font-bold">{breakdown.total_feedbacks || 0}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 text-center border border-white/20">
          <p className="text-white/70 text-xs">Tỷ Lệ</p>
          <p className="text-white text-lg font-bold">
            {breakdown.total_feedbacks > 0 ? `${Math.round((breakdown.quality_ratio || 0) * 100)}%` : '-'}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 text-center border border-white/20">
          <p className="text-white/70 text-xs">Hoạt Động</p>
          <p className="text-white text-lg font-bold">{breakdown.recent_activities_count || 0}</p>
        </div>
      </div>
    </motion.div>
  );
}