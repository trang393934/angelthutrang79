import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Medal, Crown, TrendingUp, Calendar, Filter, Award, Coins, Star, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export default function Leaderboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('total_earned');

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch all users with balances
  const { data: allBalances = [], isLoading, refetch } = useQuery({
    queryKey: ['leaderboard-balances'],
    queryFn: () => base44.entities.CamlycoinBalance.list('-total_earned', 10000),
    staleTime: 0,
    cacheTime: 0,
  });

  // Fetch all transactions for time filtering
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['leaderboard-transactions'],
    queryFn: () => base44.entities.CamlycoinTransaction.list('-created_date', 10000),
    enabled: timeFilter !== 'all',
  });

  // Filter and sort users
  const rankedUsers = React.useMemo(() => {
    let users = allBalances.map(balance => {
      let earned = balance.total_earned || 0;
      let questionsCount = 0;

      // Apply time filter
      if (timeFilter !== 'all' && allTransactions.length > 0) {
        let startDate;
        const now = new Date();

        switch (timeFilter) {
          case 'daily':
            startDate = startOfDay(now);
            break;
          case 'weekly':
            startDate = startOfDay(subDays(now, 7));
            break;
          case 'monthly':
            startDate = startOfDay(subDays(now, 30));
            break;
        }

        if (startDate) {
          const userTx = allTransactions.filter(tx => 
            tx.user_email === balance.user_email &&
            tx.amount > 0 &&
            new Date(tx.created_date) >= startDate
          );
          earned = userTx.reduce((sum, tx) => sum + tx.amount, 0);
          // Count questions in time period
          questionsCount = userTx.filter(tx => tx.type === 'manual_add').length;
        }
      } else {
        // All time - count all questions
        questionsCount = allTransactions.filter(tx => 
          tx.user_email === balance.user_email && 
          tx.amount > 0 &&
          tx.type === 'manual_add'
        ).length;
      }

      return {
        ...balance,
        displayed_earned: earned,
        questions_count: questionsCount
      };
    });

    // Sort by selected metric
    users.sort((a, b) => {
      switch (sortBy) {
        case 'total_earned':
          return b.displayed_earned - a.displayed_earned;
        case 'available':
          return (b.available_balance || 0) - (a.available_balance || 0);
        case 'paid':
          return (b.paid_amount || 0) - (a.paid_amount || 0);
        case 'questions':
          return b.questions_count - a.questions_count;
        default:
          return b.displayed_earned - a.displayed_earned;
      }
    });

    // Add rank
    return users.map((user, index) => ({
      ...user,
      rank: index + 1
    })).filter(user => user.displayed_earned > 0);
  }, [allBalances, allTransactions, timeFilter, sortBy]);

  const myRank = rankedUsers.findIndex(user => user.user_email === currentUser?.email);
  const myData = myRank >= 0 ? rankedUsers[myRank] : null;

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-slate-700 font-bold text-lg">#{rank}</span>;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-amber-500';
    if (rank === 2) return 'from-gray-300 to-gray-400';
    if (rank === 3) return 'from-amber-500 to-orange-500';
    return 'from-purple-400 to-pink-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-300/50 via-amber-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Chat')}>
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
                className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center"
              >
                <Trophy className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Bảng Xếp Hạng</h1>
                <p className="text-amber-600 text-xs font-medium">Leaderboard</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* My Rank Card */}
        {myData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRankColor(myData.rank)} flex items-center justify-center shadow-lg`}>
                  {getRankIcon(myData.rank)}
                </div>
                <div>
                  <p className="text-white/80 text-sm mb-1">Xếp Hạng Của Tôi</p>
                  <p className="text-white text-3xl font-bold">#{myData.rank}</p>
                  <p className="text-white/90 text-xs mt-1">{currentUser?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm mb-1">Tổng Kiếm Được</p>
                <p className="text-white text-3xl font-bold">{myData.displayed_earned.toLocaleString()}</p>
                <p className="text-white/90 text-xs mt-1">Camlycoin</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Time Filter */}
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Khoảng Thời Gian
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Tất Cả' },
                  { value: 'daily', label: 'Hôm Nay' },
                  { value: 'weekly', label: '7 Ngày' },
                  { value: 'monthly', label: '30 Ngày' }
                ].map(option => (
                  <Button
                    key={option.value}
                    onClick={() => setTimeFilter(option.value)}
                    size="sm"
                    variant={timeFilter === option.value ? 'default' : 'outline'}
                    className={timeFilter === option.value 
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                      : 'border-amber-300 text-slate-700'
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-500" />
                Sắp Xếp Theo
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'total_earned', label: 'Tổng Kiếm' },
                  { value: 'available', label: 'Sẵn Sàng TT' },
                  { value: 'paid', label: 'Đã TT' },
                  { value: 'questions', label: 'Số Câu Hỏi' }
                ].map(option => (
                  <Button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    size="sm"
                    variant={sortBy === option.value ? 'default' : 'outline'}
                    className={sortBy === option.value 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'border-purple-300 text-slate-700'
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Top Người Dùng
            </h3>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => refetch()}
                size="sm"
                className="bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-lg font-bold hover:shadow-lg"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Làm Mới
              </Button>
              <Badge className="bg-amber-100 text-amber-800">
                {rankedUsers.length} users
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-amber-300 border-t-amber-600 rounded-full mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Đang tải bảng xếp hạng...</p>
            </div>
          ) : rankedUsers.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-amber-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium text-lg mb-2">Chưa Có Dữ Liệu</p>
              <p className="text-slate-600 text-sm">Chưa có người dùng nào kiếm Camlycoin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rankedUsers.slice(0, 50).map((user, index) => {
                const isCurrentUser = user.user_email === currentUser?.email;
                
                return (
                  <Link
                      key={user.id}
                      to={`${createPageUrl('UserProfile')}?email=${encodeURIComponent(user.user_email)}`}
                      onClick={() => {
                        console.log('🔗 [LEADERBOARD] Clicked user:', user.user_email);
                      }}
                      className="block"
                    >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className={`border-2 rounded-2xl p-4 transition-all hover:shadow-lg cursor-pointer ${
                        isCurrentUser 
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300 hover:border-purple-400' 
                          : 'bg-white border-amber-100 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Rank Badge */}
                          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getRankColor(user.rank)} flex items-center justify-center shadow-md flex-shrink-0`}>
                            {getRankIcon(user.rank)}
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-lg ${isCurrentUser ? 'text-purple-900' : 'text-slate-900'}`}>
                              {isCurrentUser ? (
                                <>
                                  {user.user_email}
                                  <Badge className="ml-2 bg-purple-100 text-purple-800">You</Badge>
                                </>
                              ) : currentUser?.role === 'admin' ? (
                                user.user_email
                              ) : (
                                `Người dùng #${user.rank}`
                              )}
                            </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              <Coins className="w-3 h-3 mr-1" />
                              {user.displayed_earned.toLocaleString()} earned
                            </Badge>
                            {sortBy === 'questions' && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                {user.questions_count} questions
                              </Badge>
                            )}
                            {sortBy === 'available' && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                {(user.available_balance || 0).toLocaleString()} available
                              </Badge>
                            )}
                            {sortBy === 'paid' && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                {(user.paid_amount || 0).toLocaleString()} paid
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right ml-4">
                        <div className="flex items-center gap-2 justify-end">
                          {user.rank <= 3 && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                          <p className={`text-2xl font-bold ${
                            user.rank === 1 ? 'text-yellow-600' :
                            user.rank === 2 ? 'text-gray-500' :
                            user.rank === 3 ? 'text-amber-600' :
                            'text-slate-900'
                          }`}>
                            {(() => {
                              switch (sortBy) {
                                case 'available':
                                  return (user.available_balance || 0).toLocaleString();
                                case 'paid':
                                  return (user.paid_amount || 0).toLocaleString();
                                case 'questions':
                                  return user.questions_count;
                                default:
                                  return user.displayed_earned.toLocaleString();
                              }
                            })()}
                          </p>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {sortBy === 'questions' ? 'câu hỏi' : 'Camlycoin'}
                        </p>
                      </div>
                    </div>
                    </motion.div>
                    </Link>
                );
              })}

              {rankedUsers.length > 50 && (
                <p className="text-center text-sm text-slate-600 mt-4">
                  Hiển thị top 50 / {rankedUsers.length} users
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}