import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Target, Calendar, Star, Gift, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QuestCard from '@/components/QuestCard';
import UserLevelBadge from '@/components/UserLevelBadge';

export default function Quests() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user level
  const { data: userLevel } = useQuery({
    queryKey: ['user-level', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const levels = await base44.entities.UserLevel.filter({ user_email: currentUser.email });
      if (levels.length > 0) return levels[0];
      
      await base44.functions.invoke('updateUserLevel', { userEmail: currentUser.email });
      const newLevels = await base44.entities.UserLevel.filter({ user_email: currentUser.email });
      return newLevels[0] || null;
    },
    enabled: !!currentUser,
  });

  // Fetch all active quests
  const { data: allQuests = [], isLoading: isLoadingQuests } = useQuery({
    queryKey: ['active-quests'],
    queryFn: () => base44.entities.Quest.filter({ is_active: true }, '-created_date'),
    enabled: !!currentUser,
  });

  // Fetch user's quest progress
  const { data: userProgress = [] } = useQuery({
    queryKey: ['user-quest-progress', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.UserQuestProgress.filter({ user_email: currentUser.email });
    },
    enabled: !!currentUser,
  });

  // Claim reward mutation
  const claimRewardMutation = useMutation({
    mutationFn: async ({ quest, progress }) => {
      // Mark as claimed
      await base44.entities.UserQuestProgress.update(progress.id, {
        status: 'claimed',
        claimed_date: new Date().toISOString()
      });

      // Add Camlycoin
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          balance: (balance.balance || 0) + quest.reward_coins,
          total_earned: (balance.total_earned || 0) + quest.reward_coins,
          available_balance: (balance.available_balance || 0) + quest.reward_coins
        });
      } else {
        await base44.entities.CamlycoinBalance.create({
          user_email: currentUser.email,
          balance: quest.reward_coins,
          total_earned: quest.reward_coins,
          available_balance: quest.reward_coins,
          total_spent: 0
        });
      }

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: currentUser.email,
        amount: quest.reward_coins,
        type: 'manual_add',
        description: `🎯 Hoàn Thành Quest: ${quest.title}\n💰 +${quest.reward_coins} Camlycoin${quest.reward_bonus ? `\n🎁 Bonus: ${quest.reward_bonus}` : ''}`,
        reference_id: quest.id
      });

      // Apply bonus if any
      if (quest.reward_bonus && userLevel) {
        const bonusUpdates = {};
        
        if (quest.reward_bonus.includes('badge')) {
          const newBadges = [...(userLevel.badges || []), quest.reward_bonus];
          bonusUpdates.badges = newBadges;
        }
        
        if (quest.reward_bonus.includes('multiplier')) {
          const match = quest.reward_bonus.match(/x([\d.]+)/);
          if (match) {
            bonusUpdates.reward_multiplier = parseFloat(match[1]);
          }
        }

        if (Object.keys(bonusUpdates).length > 0) {
          await base44.entities.UserLevel.update(userLevel.id, bonusUpdates);
        }
      }

      // Update user level points
      if (userLevel) {
        await base44.functions.invoke('updateUserLevel', { userEmail: currentUser.email });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-quest-progress'] });
      queryClient.invalidateQueries({ queryKey: ['user-level'] });
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
    }
  });

  // Filter quests
  const filteredQuests = allQuests.filter(quest => {
    if (filterType !== 'all' && quest.quest_type !== filterType) return false;
    if (filterCategory !== 'all' && quest.category !== filterCategory) return false;
    return true;
  });

  // Combine quests with progress
  const questsWithProgress = filteredQuests.map(quest => {
    const progress = userProgress.find(p => p.quest_id === quest.id);
    return { quest, progress };
  });

  // Separate into categories
  const availableQuests = questsWithProgress.filter(({ quest, progress }) => 
    !progress || progress.status === 'in_progress'
  );
  const completedQuests = questsWithProgress.filter(({ progress }) => 
    progress?.status === 'completed'
  );
  const claimedQuests = questsWithProgress.filter(({ progress }) => 
    progress?.status === 'claimed'
  );

  const stats = {
    total: questsWithProgress.length,
    available: availableQuests.length,
    completed: completedQuests.length,
    claimed: claimedQuests.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-pink-400/30 to-transparent blur-3xl" />
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
                    '0 0 40px rgba(168,85,247,0.6)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
              >
                <Target className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Nhiệm Vụ</h1>
                <p className="text-purple-600 text-xs font-medium">Quests & Challenges</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* User Level Badge */}
        {userLevel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-6"
          >
            <UserLevelBadge userLevel={userLevel} size="large" />
          </motion.div>
        )}

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4 shadow-lg text-center">
            <Target className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-slate-900 text-2xl font-bold">{stats.total}</p>
            <p className="text-slate-700 text-xs">Tất Cả</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-2xl p-4 shadow-lg text-center">
            <Calendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-slate-900 text-2xl font-bold">{stats.available}</p>
            <p className="text-slate-700 text-xs">Đang Làm</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-2xl p-4 shadow-lg text-center">
            <Star className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-slate-900 text-2xl font-bold">{stats.completed}</p>
            <p className="text-slate-700 text-xs">Hoàn Thành</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-2xl p-4 shadow-lg text-center">
            <Gift className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-slate-900 text-2xl font-bold">{stats.claimed}</p>
            <p className="text-slate-700 text-xs">Đã Nhận</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-3 block flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                Loại Nhiệm Vụ
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'daily', 'weekly', 'one_time', 'achievement'].map(type => (
                  <Button
                    key={type}
                    onClick={() => setFilterType(type)}
                    size="sm"
                    variant={filterType === type ? 'default' : 'outline'}
                    className={filterType === type 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'border-purple-300 text-slate-700'
                    }
                  >
                    {type === 'all' ? 'Tất Cả' :
                     type === 'daily' ? '📅 Hàng Ngày' :
                     type === 'weekly' ? '📆 Hàng Tuần' :
                     type === 'one_time' ? '⭐ Một Lần' :
                     '🏆 Thành Tựu'}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold mb-3 block flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                Danh Mục
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'chat', 'ai_tools', 'social', 'learning', 'community'].map(cat => (
                  <Button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    size="sm"
                    variant={filterCategory === cat ? 'default' : 'outline'}
                    className={filterCategory === cat 
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                      : 'border-purple-300 text-slate-700'
                    }
                  >
                    {cat === 'all' ? 'Tất Cả' :
                     cat === 'chat' ? '💬 Chat' :
                     cat === 'ai_tools' ? '🤖 AI Tools' :
                     cat === 'social' ? '🌐 Social' :
                     cat === 'learning' ? '📚 Học Tập' :
                     '🤝 Cộng Đồng'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Completed Quests - Ready to Claim */}
        {completedQuests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-slate-900 font-bold text-xl">Sẵn Sàng Nhận Thưởng! 🎉</h2>
              <Badge className="bg-amber-100 text-amber-800 border border-amber-400">
                {completedQuests.length} nhiệm vụ
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {completedQuests.map(({ quest, progress }, idx) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  progress={progress}
                  onClaim={claimRewardMutation.mutate}
                  userLevel={userLevel}
                  index={idx}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Available Quests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-slate-900 font-bold text-xl">Nhiệm Vụ Khả Dụng</h2>
            <Badge className="bg-blue-100 text-blue-800 border border-blue-400">
              {availableQuests.length} nhiệm vụ
            </Badge>
          </div>

          {isLoadingQuests ? (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 text-purple-300 mx-auto mb-4 animate-spin" />
              <p className="text-slate-700 font-medium">Đang tải nhiệm vụ...</p>
            </div>
          ) : availableQuests.length === 0 ? (
            <div className="text-center py-12 bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-8 shadow-xl">
              <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-bold text-lg mb-2">Không Có Nhiệm Vụ Khả Dụng</p>
              <p className="text-slate-600 text-sm">
                {filterType !== 'all' || filterCategory !== 'all' 
                  ? 'Thử điều chỉnh bộ lọc để xem thêm nhiệm vụ'
                  : 'Admin sẽ thêm nhiệm vụ mới sớm thôi!'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {availableQuests.map(({ quest, progress }, idx) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  progress={progress}
                  onClaim={claimRewardMutation.mutate}
                  userLevel={userLevel}
                  index={idx}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Claimed Quests History */}
        {claimedQuests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-slate-900 font-bold text-xl">Đã Hoàn Thành</h2>
              <Badge className="bg-green-100 text-green-800 border border-green-400">
                {claimedQuests.length} nhiệm vụ
              </Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {claimedQuests.slice(0, 10).map(({ quest, progress }, idx) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  progress={progress}
                  onClaim={claimRewardMutation.mutate}
                  userLevel={userLevel}
                  index={idx}
                />
              ))}
            </div>
            {claimedQuests.length > 10 && (
              <p className="text-center text-sm text-slate-600 mt-4">
                Hiển thị 10 / {claimedQuests.length} nhiệm vụ đã hoàn thành
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}