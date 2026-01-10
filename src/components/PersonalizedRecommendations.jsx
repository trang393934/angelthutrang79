import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Target, Gift, MessageSquare, Zap, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PersonalizedRecommendations() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => null);
  }, []);

  // Fetch user data for personalization
  const { data: userActivities = [] } = useQuery({
    queryKey: ['user-activities', currentUser?.email],
    queryFn: () => base44.entities.UserActivity.filter({ user_email: currentUser.email }, '-created_date', 50),
    enabled: !!currentUser,
  });

  const { data: userBalance } = useQuery({
    queryKey: ['user-balance-recs', currentUser?.email],
    queryFn: async () => {
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || null;
    },
    enabled: !!currentUser,
  });

  const { data: userLevel } = useQuery({
    queryKey: ['user-level-recs', currentUser?.email],
    queryFn: async () => {
      const levels = await base44.entities.UserLevel.filter({ user_email: currentUser.email });
      return levels[0] || null;
    },
    enabled: !!currentUser,
  });

  const { data: completedQuests = [] } = useQuery({
    queryKey: ['completed-quests', currentUser?.email],
    queryFn: () => base44.entities.UserQuestProgress.filter({ 
      user_email: currentUser.email,
      status: 'completed'
    }),
    enabled: !!currentUser,
  });

  // Fetch AI-powered recommendations
  const { data: aiRecommendations } = useQuery({
    queryKey: ['ai-recommendations', currentUser?.email],
    queryFn: async () => {
      const result = await base44.functions.invoke('getUserRecommendations', {});
      return result.data.recommendations || [];
    },
    enabled: !!currentUser && !!userBalance && !!userActivities,
    staleTime: 300000, // 5 minutes
  });

  // Generate personalized recommendations (fallback)
  const fallbackRecommendations = React.useMemo(() => {
    if (!currentUser || !userBalance || !userActivities) return [];

    const recs = [];
    const activityTypes = new Set(userActivities.map(a => a.activity_type));
    const recentPages = userActivities
      .filter(a => a.activity_type === 'page_view')
      .map(a => a.activity_details?.page)
      .filter(Boolean);

    // Chat recommendation
    const chatActivities = userActivities.filter(a => a.activity_type === 'chat_message');
    const todayChat = chatActivities.filter(a => {
      const actDate = new Date(a.timestamp);
      const today = new Date();
      return actDate.toDateString() === today.toDateString();
    });

    if (todayChat.length === 0) {
      recs.push({
        id: 'daily-chat',
        icon: MessageSquare,
        title: '💬 Trò Chuyện Hàng Ngày',
        description: 'Bạn chưa chat với Angel AI hôm nay. Trò chuyện để nhận thưởng!',
        action: 'Bắt Đầu Chat',
        link: 'Chat',
        gradient: 'from-amber-400 to-rose-400',
        priority: 10
      });
    }

    // Withdraw recommendation
    if ((userBalance.available_balance || 0) >= 100000) {
      recs.push({
        id: 'withdraw-ready',
        icon: Zap,
        title: '💰 Sẵn Sàng Rút Tiền',
        description: `Bạn có ${userBalance.available_balance.toLocaleString()} Camlycoin sẵn sàng rút!`,
        action: 'Rút Ngay',
        link: 'WithdrawCamlycoin',
        gradient: 'from-green-400 to-emerald-500',
        priority: 9
      });
    }

    // Quests recommendation
    if (completedQuests.length < 5 && !recentPages.includes('Quests')) {
      recs.push({
        id: 'complete-quests',
        icon: Target,
        title: '🎯 Nhiệm Vụ Chưa Hoàn Thành',
        description: 'Hoàn thành nhiệm vụ để nhận thưởng Camlycoin!',
        action: 'Xem Nhiệm Vụ',
        link: 'Quests',
        gradient: 'from-indigo-400 to-purple-500',
        priority: 8
      });
    }

    return recs.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [currentUser, userBalance, userActivities, completedQuests]);

  // Use AI recommendations if available, otherwise fallback
  const recommendations = aiRecommendations && aiRecommendations.length > 0 
    ? aiRecommendations.map(rec => ({
        id: rec.title.replace(/\s+/g, '-').toLowerCase(),
        icon: Sparkles,
        title: rec.title,
        description: rec.description,
        action: rec.action_text,
        link: rec.target_page,
        gradient: 'from-purple-400 to-pink-500',
        priority: rec.priority
      }))
    : fallbackRecommendations;

  if (!currentUser || recommendations.length === 0 || dismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-6"
    >
      <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h3 className="text-slate-900 font-bold text-lg">Dành Riêng Cho Bạn</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {recommendations.map((rec, idx) => {
              const Icon = rec.icon;
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group"
                >
                  <Link to={createPageUrl(rec.link)}>
                    <motion.div
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${rec.gradient} p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-bold mb-1">{rec.title}</h4>
                            <p className="text-white/90 text-sm">{rec.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-white text-sm font-semibold flex-shrink-0">
                          <span>{rec.action}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}