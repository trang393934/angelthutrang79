import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Coins, Crown, Star, Zap, User, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function HonorBoard() {
  const [activeTab, setActiveTab] = useState('camlycoin'); // 'camlycoin' or 'visits'
  const [showAllRankings, setShowAllRankings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

  // Get current user
  React.useEffect(() => {
    console.log('🔍 [HonorBoard] Fetching current user...');
    base44.auth.me()
      .then(user => {
        console.log('✅ [HonorBoard] Current user:', user?.email);
        setCurrentUserEmail(user?.email);
      })
      .catch(() => {
        console.log('⚠️ [HonorBoard] No user logged in');
        setCurrentUserEmail(null);
      });
  }, []);

  // Fetch total registered users from backend
  const { data: totalUsersData } = useQuery({
    queryKey: ['total-registered-users-honor'],
    queryFn: async () => {
      try {
        console.log('🔍 [HonorBoard] Fetching total users...');
        const response = await base44.functions.invoke('getTotalRegisteredUsers', {});
        console.log('✅ [HonorBoard] Total users:', response.data?.total_users);
        return response.data;
      } catch (error) {
        console.error('Failed to fetch total users:', error);
        return { total_users: 0 };
      }
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Fetch ALL users with their balances - OPTIMIZED FOR MOBILE
  const { data: allEarners = [], isLoading: loadingEarners } = useQuery({
    queryKey: ['all-users-with-balances'],
    queryFn: async () => {
      console.log('🔍 [HonorBoard] Fetching user balances...');
      
      // Fetch ALL registered users
      const allUsers = await base44.entities.User.list('-created_date', 10000);
      console.log(`✅ [HonorBoard] Found ${allUsers.length} users`);
      
      // Fetch all balances
      const balances = await base44.entities.CamlycoinBalance.list('-total_earned', 10000);
      console.log(`✅ [HonorBoard] Found ${balances.length} balances`);
      
      // Create balance lookup map
      const balanceMap = new Map();
      balances.forEach(b => {
        balanceMap.set(b.user_email, b);
      });
      
      // Merge users with their balances
      const usersWithBalances = allUsers.map(user => {
        const balance = balanceMap.get(user.email);
        return {
          user_email: user.email,
          total_earned: balance?.total_earned || 0,
          net_valid_coins: balance?.net_valid_coins || 0,
          frozen_balance: balance?.frozen_balance || 0,
          available_balance: balance?.available_balance || 0,
          paid_amount: balance?.paid_amount || 0
        };
      });
      
      // Sort by total_earned
      const sorted = usersWithBalances.sort((a, b) => b.total_earned - a.total_earned);
      console.log(`✅ [HonorBoard] Sorted ${sorted.length} users, top earner: ${sorted[0]?.total_earned || 0}`);
      
      return sorted;
    },
    refetchInterval: 30000,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3
  });

  const topEarners = allEarners.slice(0, 10);

  // Fetch all users for avatar lookup
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-avatars'],
    queryFn: async () => {
      console.log('🔍 [HonorBoard] Fetching user avatars...');
      const users = await base44.entities.User.list('-created_date', 10000);
      console.log(`✅ [HonorBoard] Found ${users.length} users for avatars`);
      return users;
    },
    refetchOnMount: true,
    staleTime: 60000
  });

  // Fetch ALL users with their visit counts
  const { data: allVisitors = [], isLoading: loadingVisitors } = useQuery({
    queryKey: ['all-users-with-visits'],
    queryFn: async () => {
      console.log('🔍 [HonorBoard] Fetching visitor stats...');
      
      // Fetch ALL registered users
      const allUsers = await base44.entities.User.list('-created_date', 10000);
      // Fetch all activities
      const activities = await base44.entities.UserActivity.list('-created_date', 10000);
      
      // Count activities per user
      const userCounts = {};
      activities.forEach(activity => {
        const email = activity.user_email;
        if (email) {
          userCounts[email] = (userCounts[email] || 0) + 1;
        }
      });

      // Merge all users with their visit counts (0 if no visits)
      const usersWithVisits = allUsers.map(user => ({
        user_email: user.email,
        visit_count: userCounts[user.email] || 0
      }));

      // Sort by visit count
      const sorted = usersWithVisits.sort((a, b) => b.visit_count - a.visit_count);
      console.log(`✅ [HonorBoard] Sorted ${sorted.length} visitors`);
      
      return sorted;
    },
    refetchInterval: 30000,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3
  });

  const topVisitors = allVisitors.slice(0, 10);

  // Helper to get user avatar
  const getUserAvatar = (email) => {
    const user = allUsers.find(u => u.email === email);
    return user?.avatar_url;
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) return <Crown className="w-3 h-3 text-yellow-400" />;
    if (rank === 2) return <Trophy className="w-3 h-3 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-3 h-3 text-amber-600" />;
    return <Star className="w-2.5 h-2.5 text-purple-400" />;
  };

  const getRankGradient = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-amber-500';
    if (rank === 2) return 'from-gray-300 to-slate-400';
    if (rank === 3) return 'from-amber-600 to-orange-500';
    return 'from-purple-400 to-pink-400';
  };

  // Filter data based on search term
  const filteredEarners = allEarners.filter(item => 
    !searchTerm || item.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredVisitors = allVisitors.filter(item => 
    !searchTerm || item.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayData = showAllRankings 
    ? (activeTab === 'camlycoin' ? filteredEarners : filteredVisitors)
    : (activeTab === 'camlycoin' ? topEarners : topVisitors);
  const isLoading = activeTab === 'camlycoin' ? loadingEarners : loadingVisitors;

  // Calculate total stats - USE TOTAL_EARNED FROM DATABASE
  const totalCamlycoin = allEarners.reduce((sum, item) => sum + (item.total_earned || 0), 0);
  const totalUsers = totalUsersData?.total_users || 0;
  
  console.log(`📊 [HonorBoard Stats] Total Camlycoin: ${totalCamlycoin}, Total Users: ${totalUsers}`);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full max-w-md"
    >
      {/* Header */}
      <div className="relative mb-6">
        <motion.div
          animate={{ 
            boxShadow: [
              '0 0 20px rgba(251,191,36,0.4)',
              '0 0 40px rgba(251,191,36,0.6)',
              '0 0 20px rgba(251,191,36,0.4)',
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-rose-400/20 rounded-3xl blur-xl"
        />
        <div className="relative bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 rounded-3xl p-1">
          <div className="bg-white rounded-3xl p-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Trophy className="w-8 h-8 text-amber-500" />
              </motion.div>
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-amber-600 tracking-wide">
                HONOR BOARD
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-purple-50 p-1 rounded-2xl">
              <button
                onClick={() => setActiveTab('camlycoin')}
                className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-all ${
                  activeTab === 'camlycoin'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-lg'
                    : 'text-purple-600 hover:bg-white'
                }`}
              >
                <Coins className="w-4 h-4 inline mr-1" />
                Top Earners
              </button>
              <button
                onClick={() => setActiveTab('visits')}
                className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-all ${
                  activeTab === 'visits'
                    ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg'
                    : 'text-purple-600 hover:bg-white'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Top Visitors
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Box - Only show when showing all rankings */}
      {showAllRankings && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-sm border-2 border-purple-200 rounded-2xl p-3 shadow-lg mb-4"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" />
            <input
              type="text"
              placeholder="Tìm email của bạn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent text-slate-900 placeholder:text-purple-400 outline-none text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-purple-400 hover:text-purple-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="bg-white/80 backdrop-blur-sm border-2 border-purple-200 rounded-3xl p-4 shadow-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
            >
              <Zap className="w-6 h-6 text-white" />
            </motion.div>
          </div>
        ) : displayData.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-purple-300 mx-auto mb-2" />
            <p className="text-purple-600 font-medium">Chưa có dữ liệu</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              {displayData.map((item, idx) => {
                const rank = idx + 1;
                const name = item.user_email?.split('@')[0] || 'Anonymous';
                const value = activeTab === 'camlycoin' ? item.total_earned : item.visit_count;
                
                return (
                  <Link
                    key={item.user_email || idx}
                    to={createPageUrl('UserProfile') + `?email=${encodeURIComponent(item.user_email)}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`relative rounded-2xl p-3 transition-all hover:scale-105 cursor-pointer ${
                        item.user_email === currentUserEmail
                          ? 'bg-gradient-to-r from-indigo-400 to-purple-500 border-2 border-white shadow-2xl'
                          : rank <= 3
                          ? 'bg-gradient-to-r ' + getRankGradient(rank)
                          : 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar with Rank Badge */}
                        <div className="relative flex-shrink-0">
                          {getUserAvatar(item.user_email) ? (
                            <img
                              src={getUserAvatar(item.user_email)}
                              alt="Avatar"
                              className={`w-10 h-10 rounded-full object-cover shadow-md ${
                                rank <= 3 ? 'border-2 border-white' : 'border-2 border-purple-300'
                              }`}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              rank <= 3 ? 'bg-white/30 backdrop-blur-sm' : 'bg-gradient-to-br from-purple-400 to-pink-400'
                            }`}>
                              <User className={`w-5 h-5 ${rank <= 3 ? 'text-white' : 'text-white'}`} />
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-md">
                            {getMedalIcon(rank)}
                          </div>
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm truncate ${
                              item.user_email === currentUserEmail ? 'text-white' :
                              rank <= 3 ? 'text-white' : 'text-slate-900'
                            }`}>
                              {rank}. {name}
                            </span>
                            {rank === 1 && (
                              <Badge className="bg-yellow-400 text-yellow-900 text-xs px-2 py-0">
                                👑 #1
                              </Badge>
                            )}
                            {item.user_email === currentUserEmail && (
                              <Badge className="bg-white text-indigo-600 text-xs px-2 py-0 font-bold">
                                👤 BẠN
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs font-medium ${
                            item.user_email === currentUserEmail ? 'text-white/90' :
                            rank <= 3 ? 'text-white/80' : 'text-purple-600'
                          }`}>
                            {activeTab === 'camlycoin' 
                              ? `${value.toLocaleString()} Camlycoin`
                              : `${value} lượt truy cập`
                            }
                          </p>
                        </div>

                        {/* Sparkle Effect for Top 3 */}
                        {rank <= 3 && (
                          <motion.div
                            animate={{ 
                              scale: [1, 1.2, 1],
                              rotate: [0, 10, -10, 0]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Star className="w-5 h-5 text-white fill-white" />
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Show All Rankings Button - Always show */}
      {!showAllRankings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4"
        >
          <button
            onClick={() => setShowAllRankings(true)}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl py-3 font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            📊 Xem Toàn Bộ Bảng Xếp Hạng ({allEarners.length} users)
          </button>
        </motion.div>
      )}

      {/* Show Top 10 Button (when showing all) */}
      {showAllRankings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <button
            onClick={() => {
              setShowAllRankings(false);
              setSearchTerm('');
            }}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-3 font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            🏆 Chỉ Xem Top 10
          </button>
        </motion.div>
      )}

      {/* Total Summary Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6"
      >
        <div className="relative">
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 20px rgba(251,191,36,0.3)',
                '0 0 40px rgba(251,191,36,0.5)',
                '0 0 20px rgba(251,191,36,0.3)',
              ]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-3xl blur-xl"
          />
          <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 rounded-3xl p-1">
            <div className="bg-white rounded-3xl p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Coins className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 tracking-wide">
                  TỔNG HỢP HỆ THỐNG
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-amber-200">
                  <p className="text-amber-700 text-xs font-bold mb-1">Tổng Camlycoin</p>
                  <p className="text-amber-900 text-2xl font-black break-words">
                    {totalCamlycoin.toLocaleString()}
                  </p>
                  <p className="text-amber-600 text-xs mt-1">💰 Đã kiếm được</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                  <p className="text-purple-700 text-xs font-bold mb-1">Tổng Người Dùng</p>
                  <p className="text-purple-900 text-2xl font-black">
                    {totalUsers}
                  </p>
                  <p className="text-purple-600 text-xs mt-1">👥 Users</p>
                </div>
              </div>

              <div className="mt-4 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-3 border-2 border-amber-300">
                <p className="text-amber-900 text-xs font-bold text-center">
                  🌟 Trung bình: {totalUsers > 0 ? Math.round(totalCamlycoin / totalUsers).toLocaleString() : 0} Camlycoin/người
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-4 text-center"
      >
        <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-2 border-purple-300 text-xs font-bold px-4 py-1">
          ✨ Cập nhật real-time
        </Badge>
      </motion.div>
    </motion.div>
  );
}