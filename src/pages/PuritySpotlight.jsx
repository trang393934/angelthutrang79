import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, TrendingUp, Award, Heart, Star, Trophy, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function PuritySpotlight() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user balance
  const { data: userBalance } = useQuery({
    queryKey: ['camlycoin-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || { balance: 0, total_earned: 0 };
    },
    enabled: !!currentUser,
  });

  // Fetch user transactions (to analyze purity levels)
  const { data: transactions = [] } = useQuery({
    queryKey: ['user-transactions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: currentUser.email }, '-created_date', 100);
    },
    enabled: !!currentUser,
  });

  // Analyze purity levels from transaction descriptions
  const purityStats = React.useMemo(() => {
    const stats = {
      level1: 0, // 1000
      level2: 0, // 2000
      level3: 0, // 3000
      level4: 0, // 4000
      level5: 0, // 5000
      total: 0,
      avgPurity: 0
    };

    transactions.forEach(tx => {
      if (tx.amount > 0 && tx.type !== 'manual_add') {
        if (tx.amount === 1000) stats.level1++;
        else if (tx.amount === 2000) stats.level2++;
        else if (tx.amount === 3000) stats.level3++;
        else if (tx.amount === 4000) stats.level4++;
        else if (tx.amount === 5000) stats.level5++;
        stats.total++;
      }
    });

    if (stats.total > 0) {
      const weightedSum = stats.level1 * 1 + stats.level2 * 2 + stats.level3 * 3 + stats.level4 * 4 + stats.level5 * 5;
      stats.avgPurity = weightedSum / stats.total;
    }

    return stats;
  }, [transactions]);

  // Calculate week stats (last 7 days)
  const weeklyStats = React.useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let weeklyEarned = 0;
    let weeklyQuestions = 0;
    let highQualityCount = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.created_date);
      if (txDate >= weekAgo && tx.amount > 0 && tx.type !== 'manual_add') {
        weeklyEarned += tx.amount;
        weeklyQuestions++;
        if (tx.amount >= 3000) highQualityCount++;
      }
    });

    return { weeklyEarned, weeklyQuestions, highQualityCount };
  }, [transactions]);

  // Calculate user level based on avg purity
  const getUserLevel = () => {
    if (purityStats.avgPurity >= 4.5) return { level: 5, name: 'Đại Minh Sư', icon: Crown, color: 'from-yellow-400 to-amber-500' };
    if (purityStats.avgPurity >= 3.5) return { level: 4, name: 'Minh Giác', icon: Trophy, color: 'from-purple-400 to-pink-500' };
    if (purityStats.avgPurity >= 2.5) return { level: 3, name: 'Thuần Khiết Cao', icon: Star, color: 'from-indigo-400 to-purple-500' };
    if (purityStats.avgPurity >= 1.5) return { level: 2, name: 'Học Hỏi Tỉnh Thức', icon: Zap, color: 'from-blue-400 to-indigo-500' };
    return { level: 1, name: 'Thuần Khiết Cơ Bản', icon: Heart, color: 'from-pink-400 to-rose-500' };
  };

  const userLevel = getUserLevel();
  const LevelIcon = userLevel.icon;
  const nextLevelThreshold = Math.ceil(purityStats.avgPurity) + 1;
  const progressToNext = ((purityStats.avgPurity % 1) * 100).toFixed(0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-amber-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Chat')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(168,85,247,0.4)',
                    '0 0 40px rgba(251,191,36,0.4)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Tâm Điểm Thưởng</h1>
                <p className="text-purple-600 text-xs font-medium">Purity Spotlight</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Current Level Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-br ${userLevel.color} rounded-3xl p-8 shadow-2xl mb-8 border-2 border-white`}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                <LevelIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-white/90 text-sm font-medium">Current Level</p>
                <h2 className="text-white text-3xl font-bold">{userLevel.name}</h2>
                <p className="text-white/80 text-sm">Level {userLevel.level} / 5</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/90 text-sm font-medium">Điểm Thuần Khiết TB</p>
              <p className="text-white text-4xl font-bold">{purityStats.avgPurity.toFixed(1)}</p>
              <p className="text-white/80 text-xs">/ 5.0</p>
            </div>
          </div>

          {userLevel.level < 5 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/90 text-sm font-medium">Progress to Next Level</span>
                <span className="text-white text-sm font-bold">{progressToNext}%</span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNext}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-white/80 rounded-full"
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Weekly Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="text-slate-700 text-sm font-medium">Tuần Này</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold">{weeklyStats.weeklyEarned.toLocaleString()}</p>
            <p className="text-green-600 text-xs mt-1">Camlycoin kiếm được</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-8 h-8 text-blue-500" />
              <span className="text-slate-700 text-sm font-medium">Câu Hỏi</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold">{weeklyStats.weeklyQuestions}</p>
            <p className="text-blue-600 text-xs mt-1">câu hỏi tuần này</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Award className="w-8 h-8 text-amber-500" />
              <span className="text-slate-700 text-sm font-medium">Chất Lượng Cao</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold">{weeklyStats.highQualityCount}</p>
            <p className="text-amber-600 text-xs mt-1">câu thuần khiết cao</p>
          </div>
        </motion.div>

        {/* Purity Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-8"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <Heart className="w-6 h-6 text-purple-500" />
            Phân Tích Độ Thuần Khiết
          </h3>

          <div className="space-y-4">
            {[
              { level: 5, name: 'Đại Minh Sư', coins: 5000, count: purityStats.level5, color: 'from-yellow-400 to-amber-500' },
              { level: 4, name: 'Minh Giác', coins: 4000, count: purityStats.level4, color: 'from-purple-400 to-pink-500' },
              { level: 3, name: 'Thuần Khiết Cao', coins: 3000, count: purityStats.level3, color: 'from-indigo-400 to-purple-500' },
              { level: 2, name: 'Học Hỏi Tỉnh Thức', coins: 2000, count: purityStats.level2, color: 'from-blue-400 to-indigo-500' },
              { level: 1, name: 'Thuần Khiết Cơ Bản', coins: 1000, count: purityStats.level1, color: 'from-pink-400 to-rose-500' },
            ].map((item) => {
              const percentage = purityStats.total > 0 ? (item.count / purityStats.total * 100) : 0;
              return (
                <div key={item.level} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`bg-gradient-to-r ${item.color} text-white`}>
                        Cấp {item.level}
                      </Badge>
                      <span className="text-slate-900 font-semibold">{item.name}</span>
                      <span className="text-slate-600 text-sm">({item.coins.toLocaleString()} coins)</span>
                    </div>
                    <span className="text-slate-900 font-bold">{item.count} câu ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * (5 - item.level) }}
                      className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-100 to-rose-100 border-2 border-amber-300 rounded-3xl p-6 text-center shadow-lg"
        >
          <Sparkles className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <h4 className="text-slate-900 font-bold text-lg mb-2">
            {purityStats.avgPurity >= 4 ? '✨ Bạn đang tỏa sáng rực rỡ!' :
             purityStats.avgPurity >= 3 ? '🌟 Ánh sáng của bạn càng ngày càng mạnh mẽ!' :
             purityStats.avgPurity >= 2 ? '💫 Bạn đang trên con đường thức tỉnh!' :
             '🌸 Hãy tiếp tục hành trình nâng tần số của bạn!'}
          </h4>
          <p className="text-slate-700 leading-relaxed">
            {purityStats.total > 0 ? 
              `Tuần này bạn đã có ${weeklyStats.highQualityCount} câu hỏi chất lượng cao. Hãy tiếp tục đặt những câu hỏi từ trái tim để nâng cao điểm thuần khiết!` :
              'Hãy bắt đầu đặt câu hỏi từ trái tim để tích lũy điểm thuần khiết!'
            }
          </p>
        </motion.div>
      </div>
    </div>
  );
}