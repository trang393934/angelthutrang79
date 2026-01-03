import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gift, Share2, BookOpen, Heart, CalendarDays, Lightbulb, Users, Coins, Clock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function CommunityRewards() {
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user's community rewards
  const { data: myRewards = [] } = useQuery({
    queryKey: ['my-community-rewards', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      const allRewards = await base44.entities.CommunityReward.list('-created_date', 100);
      return allRewards.filter(r => r.created_by === currentUser.email);
    },
    enabled: !!currentUser,
  });

  // Check daily login reward
  const { data: hasLoginRewardToday } = useQuery({
    queryKey: ['daily-login-check', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return false;
      const today = new Date().toISOString().split('T')[0];
      const todayRewards = myRewards.filter(r => {
        const rewardDate = new Date(r.created_date).toISOString().split('T')[0];
        return rewardDate === today && r.reward_type === 'daily_login';
      });
      return todayRewards.length > 0;
    },
    enabled: !!currentUser && myRewards.length > 0,
  });

  // Claim daily login mutation
  const claimDailyLoginMutation = useMutation({
    mutationFn: async () => {
      // Create community reward
      const reward = await base44.entities.CommunityReward.create({
        user_email: currentUser.email,
        reward_type: 'daily_login',
        activity_description: `Đăng nhập ngày ${new Date().toLocaleDateString('vi-VN')}`,
        coins_awarded: 100,
        status: 'approved',
        auto_approved: true
      });

      // Update balance
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          balance: (balance.balance || 0) + 100,
          total_earned: (balance.total_earned || 0) + 100,
          available_balance: (balance.available_balance || 0) + 100
        });
      } else {
        await base44.entities.CamlycoinBalance.create({
          user_email: currentUser.email,
          balance: 100,
          total_earned: 100,
          available_balance: 100
        });
      }

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: currentUser.email,
        amount: 100,
        type: 'manual_add',
        description: `📅 Thưởng Đăng Nhập Hàng Ngày\n💰 +100 Camlycoin\n🗓️ ${new Date().toLocaleDateString('vi-VN')}`,
        reference_id: reward.id
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-community-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['daily-login-check'] });
      alert('🎉 Nhận thành công +100 Camlycoin!');
    },
    onError: (error) => {
      alert('❌ Có lỗi xảy ra. Vui lòng thử lại!');
      console.error(error);
    }
  });

  const rewardActivities = [
    {
      type: 'share_content',
      title: 'Chia Sẻ Nội Dung',
      description: 'Share tri thức Angel AI lên FUN Ecosystem',
      icon: Share2,
      color: 'from-blue-400 to-cyan-400',
      reward: 500,
      limit: '5 lần/ngày'
    },
    {
      type: 'upload_knowledge',
      title: 'Đóng Góp Tri Thức',
      description: 'Upload tài liệu/giáo lý vào Knowledge Base',
      icon: BookOpen,
      color: 'from-purple-400 to-indigo-400',
      reward: 2000,
      limit: 'Không giới hạn'
    },
    {
      type: 'helpful_feedback',
      title: 'Feedback Hữu Ích',
      description: 'Đánh giá và góp ý cải thiện AI',
      icon: Heart,
      color: 'from-rose-400 to-pink-400',
      reward: 300,
      limit: '10 lần/ngày'
    },
    {
      type: 'daily_login',
      title: 'Đăng Nhập Hàng Ngày',
      description: 'Login mỗi ngày để nhận thưởng',
      icon: CalendarDays,
      color: 'from-amber-400 to-orange-400',
      reward: 100,
      limit: '1 lần/ngày'
    },
    {
      type: 'gratitude_journal',
      title: 'Nhật Ký Biết Ơn',
      description: 'Viết journal mỗi ngày',
      icon: Heart,
      color: 'from-yellow-400 to-amber-400',
      reward: 500,
      limit: '1 lần/ngày'
    },
    {
      type: 'vision_creation',
      title: 'Tạo Personal Vision',
      description: 'Xác định tầm nhìn cá nhân',
      icon: Lightbulb,
      color: 'from-indigo-400 to-purple-400',
      reward: 1000,
      limit: 'Không giới hạn'
    },
    {
      type: 'community_help',
      title: 'Giúp Đỡ Cộng Đồng',
      description: 'Hỗ trợ thành viên khác',
      icon: Users,
      color: 'from-green-400 to-emerald-400',
      reward: 1500,
      limit: 'Theo admin duyệt'
    }
  ];

  const totalEarned = myRewards
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + (r.coins_awarded || 0), 0);

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
            <Link to={createPageUrl('Home')}>
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
                <Gift className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Thưởng Cộng Đồng</h1>
                <p className="text-purple-600 text-xs font-medium">Community Rewards</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Total Earned Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-8 shadow-2xl mb-8 border-2 border-white text-center"
        >
          <Coins className="w-12 h-12 text-white mx-auto mb-3" />
          <p className="text-white/90 text-sm font-medium mb-1">Tổng Thưởng Cộng Đồng</p>
          <p className="text-white text-5xl font-bold mb-2">
            {totalEarned.toLocaleString()}
          </p>
          <p className="text-white/80 text-sm">Camlycoin</p>
        </motion.div>

        {/* Daily Login Reward */}
        {!hasLoginRewardToday && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-3xl p-6 shadow-xl mb-8 border-2 border-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-white" />
                <div>
                  <h3 className="text-white font-bold text-lg">Thưởng Đăng Nhập Hôm Nay</h3>
                  <p className="text-white/90 text-sm">+100 Camlycoin</p>
                </div>
              </div>
              <Button
                onClick={() => claimDailyLoginMutation.mutate()}
                disabled={claimDailyLoginMutation.isPending}
                className="bg-white text-amber-600 rounded-2xl py-4 px-6 font-bold hover:bg-amber-50 shadow-lg"
              >
                {claimDailyLoginMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Gift className="w-5 h-5 mr-2" />
                    Nhận Ngay
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Reward Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {rewardActivities.map((activity, idx) => {
            const Icon = activity.icon;
            return (
              <motion.div
                key={activity.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all"
              >
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${activity.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-slate-900 font-bold text-lg mb-2">{activity.title}</h3>
                <p className="text-slate-600 text-sm mb-3">{activity.description}</p>
                
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                    +{activity.reward} Camlycoin
                  </Badge>
                  <span className="text-xs text-slate-600">{activity.limit}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* My Rewards History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            Lịch Sử Thưởng Của Tôi
          </h3>

          {myRewards.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có hoạt động cộng đồng nào</p>
              <p className="text-slate-500 text-sm mt-1">Bắt đầu tham gia để nhận thưởng!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRewards.map((reward, idx) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white border-2 border-indigo-100 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={
                          reward.status === 'approved' ? 'bg-green-100 text-green-800 border border-green-300' :
                          reward.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                          'bg-red-100 text-red-800 border border-red-300'
                        }>
                          {reward.status === 'approved' ? '✅ Đã Duyệt' :
                           reward.status === 'pending' ? '⏳ Chờ Duyệt' :
                           '❌ Từ Chối'}
                        </Badge>
                        {reward.auto_approved && (
                          <Badge variant="outline" className="text-xs">
                            🤖 Tự Động
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-900 font-semibold mb-1">{reward.activity_description}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(reward.created_date).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-amber-600">
                        +{reward.coins_awarded.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600">Camlycoin</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}