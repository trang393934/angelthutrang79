import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Gift, CheckCircle2, XCircle, Filter, User, Calendar, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminCommunityRewards() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterUser, setFilterUser] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch all community rewards
  const { data: allRewards = [] } = useQuery({
    queryKey: ['all-community-rewards'],
    queryFn: () => base44.entities.CommunityReward.list('-created_date', 500),
    enabled: isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: (rewardId) => base44.functions.invoke('communityRewardEngine', {
      action: 'approve_reward',
      reward_id: rewardId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-community-rewards'] });
      alert('✅ Đã duyệt!');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (rewardId) => base44.functions.invoke('communityRewardEngine', {
      action: 'reject_reward',
      reward_id: rewardId,
      reason: 'Admin từ chối'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-community-rewards'] });
      alert('❌ Đã từ chối!');
    }
  });

  const filteredRewards = allRewards.filter(reward => {
    if (filterStatus !== 'all' && reward.status !== filterStatus) return false;
    if (filterUser && !reward.user_email.toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  const stats = {
    pending: allRewards.filter(r => r.status === 'pending').length,
    approved: allRewards.filter(r => r.status === 'approved').length,
    rejected: allRewards.filter(r => r.status === 'rejected').length,
    total_coins: allRewards.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.coins_awarded, 0)
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Gift className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('AdminAuditControl')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Admin: Community Rewards</h1>
                <p className="text-purple-600 text-xs font-medium">Quản Lý Thưởng Cộng Đồng</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl p-4 shadow-xl border-2 border-white">
            <Clock className="w-6 h-6 text-white mb-2" />
            <p className="text-white/90 text-xs mb-1">Chờ Duyệt</p>
            <p className="text-white text-3xl font-bold">{stats.pending}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-4 shadow-lg">
            <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
            <p className="text-slate-700 text-xs mb-1">Đã Duyệt</p>
            <p className="text-slate-900 text-3xl font-bold">{stats.approved}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-4 shadow-lg">
            <XCircle className="w-6 h-6 text-red-500 mb-2" />
            <p className="text-slate-700 text-xs mb-1">Từ Chối</p>
            <p className="text-slate-900 text-3xl font-bold">{stats.rejected}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-4 shadow-lg">
            <Gift className="w-6 h-6 text-purple-500 mb-2" />
            <p className="text-slate-700 text-xs mb-1">Tổng Thưởng</p>
            <p className="text-slate-900 text-2xl font-bold">{stats.total_coins.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-purple-500" />
            <h3 className="text-slate-900 font-bold text-lg">Bộ Lọc</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-2 block">Trạng Thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-white border-2 border-purple-300 rounded-xl px-3 py-2 text-slate-900"
              >
                <option value="all">Tất Cả</option>
                <option value="pending">Chờ Duyệt</option>
                <option value="approved">Đã Duyệt</option>
                <option value="rejected">Từ Chối</option>
              </select>
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold mb-2 block">Người Dùng</label>
              <Input
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Email..."
                className="bg-white border-2 border-purple-300"
              />
            </div>
          </div>
        </div>

        {/* Rewards List */}
        <div className="space-y-4">
          {filteredRewards.length === 0 ? (
            <div className="text-center py-12 bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl">
              <Gift className="w-12 h-12 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Không có reward nào</p>
            </div>
          ) : (
            filteredRewards.map((reward, idx) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
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
                      <Badge className="bg-amber-100 text-amber-800">
                        +{reward.coins_awarded.toLocaleString()} Camlycoin
                      </Badge>
                      {reward.auto_approved && (
                        <Badge variant="outline" className="text-xs">🤖 Auto</Badge>
                      )}
                    </div>

                    <p className="text-slate-900 font-semibold mb-2">{reward.activity_description}</p>
                    
                    <div className="flex gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {reward.user_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(reward.created_date).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {reward.processed_by && (
                      <p className="text-xs text-purple-600 mt-2">
                        Xử lý bởi: {reward.processed_by} • {new Date(reward.processed_date).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </div>

                  {reward.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(reward.id)}
                        disabled={approveMutation.isPending}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-lg hover:shadow-xl"
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={() => rejectMutation.mutate(reward.id)}
                        disabled={rejectMutation.isPending}
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 rounded-full"
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}