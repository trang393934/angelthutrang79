import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, History, Filter, Calendar, Search, TrendingUp, TrendingDown, DollarSign, Award, Plus, Minus, Download, X, Zap, Star, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import LevelProgressCard from '@/components/LevelProgressCard';

export default function CamlycoinHistory() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user balance
  const { data: userBalance } = useQuery({
    queryKey: ['user-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || null;
    },
    enabled: !!currentUser,
  });

  // Fetch user level
  const { data: userLevel } = useQuery({
    queryKey: ['user-level', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const levels = await base44.entities.UserLevel.filter({ user_email: currentUser.email });
      if (levels.length > 0) return levels[0];
      
      // Auto-create if not exists
      await base44.functions.invoke('updateUserLevel', { userEmail: currentUser.email });
      const newLevels = await base44.entities.UserLevel.filter({ user_email: currentUser.email });
      return newLevels[0] || null;
    },
    enabled: !!currentUser,
  });

  // Fetch all transactions
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['all-transactions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: currentUser.email }, '-created_date', 1000);
    },
    enabled: !!currentUser,
  });

  // Filter transactions
  const filteredTransactions = allTransactions.filter(tx => {
    // Filter by search term
    if (searchTerm && !tx.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Filter by type
    if (filterType !== 'all' && tx.type !== filterType) {
      return false;
    }

    // Filter by date range
    const txDate = new Date(tx.created_date);
    let startDate, endDate;

    switch (dateRange) {
      case '7days':
        startDate = startOfDay(subDays(new Date(), 7));
        endDate = endOfDay(new Date());
        break;
      case '30days':
        startDate = startOfDay(subDays(new Date(), 30));
        endDate = endOfDay(new Date());
        break;
      case '90days':
        startDate = startOfDay(subDays(new Date(), 90));
        endDate = endOfDay(new Date());
        break;
      case 'custom':
        if (customStartDate) startDate = startOfDay(new Date(customStartDate));
        if (customEndDate) endDate = endOfDay(new Date(customEndDate));
        break;
      default:
        return true;
    }

    if (startDate && txDate < startDate) return false;
    if (endDate && txDate > endDate) return false;

    return true;
  });

  // Calculate statistics
  const stats = {
    total: filteredTransactions.length,
    earned: filteredTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
    spent: filteredTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
  };

  const transactionTypes = {
    bounty_reward: { label: 'Bounty Reward', icon: Award, color: 'bg-purple-100 text-purple-800' },
    build_reward: { label: 'Build Reward', icon: Award, color: 'bg-indigo-100 text-indigo-800' },
    admin_adjustment: { label: 'Admin Adjustment', icon: DollarSign, color: 'bg-blue-100 text-blue-800' },
    manual_add: { label: 'Thưởng', icon: Plus, color: 'bg-green-100 text-green-800' },
    manual_deduct: { label: 'Trừ', icon: Minus, color: 'bg-red-100 text-red-800' },
    purchase: { label: 'Mua', icon: TrendingDown, color: 'bg-orange-100 text-orange-800' }
  };

  // Parse energy scores from transaction descriptions
  const parseEnergyScore = (description) => {
    const match = description.match(/\((-?\d+)\/30\)/);
    return match ? parseInt(match[1]) : null;
  };

  const isQualityReward = (description) => {
    return description.includes('Thưởng Chất Lượng Cao') || description.includes('⭐');
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
                <History className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Lịch Sử Camlycoin</h1>
                <p className="text-purple-600 text-xs font-medium">Transaction History</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Level Progress */}
        {userLevel && (
          <LevelProgressCard userLevel={userLevel} />
        )}

        {/* Balance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-white/80 text-sm mb-1">Số Dư Hiện Tại</p>
              <p className="text-white text-3xl font-bold">{(userBalance?.balance || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/80 text-sm mb-1">Tổng Đã Kiếm</p>
              <p className="text-white text-3xl font-bold">{(userBalance?.total_earned || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/80 text-sm mb-1">Tổng Đã Thanh Toán</p>
              <p className="text-white text-3xl font-bold">{(userBalance?.paid_amount || 0).toLocaleString()}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4 shadow-lg">
            <p className="text-slate-700 text-sm mb-1">Tổng Giao Dịch</p>
            <p className="text-slate-900 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-2xl p-4 shadow-lg">
            <p className="text-slate-700 text-sm mb-1">Tổng Nhận (+)</p>
            <p className="text-green-600 text-2xl font-bold">+{stats.earned.toLocaleString()}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-2xl p-4 shadow-lg">
            <p className="text-slate-700 text-sm mb-1">Tổng Trừ (-)</p>
            <p className="text-red-600 text-2xl font-bold">-{stats.spent.toLocaleString()}</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-500" />
              Bộ Lọc
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-purple-600"
            >
              {showFilters ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
            </Button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4"
              >
                {/* Search */}
                <div>
                  <label className="text-slate-700 text-sm font-medium mb-2 block">Tìm Kiếm</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm trong mô tả giao dịch..."
                      className="pl-10 bg-white border-2 border-purple-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="text-slate-700 text-sm font-medium mb-2 block">Loại Giao Dịch</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setFilterType('all')}
                      size="sm"
                      variant={filterType === 'all' ? 'default' : 'outline'}
                      className={filterType === 'all' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'border-purple-300'}
                    >
                      Tất cả
                    </Button>
                    {Object.entries(transactionTypes).map(([type, { label }]) => (
                      <Button
                        key={type}
                        onClick={() => setFilterType(type)}
                        size="sm"
                        variant={filterType === type ? 'default' : 'outline'}
                        className={filterType === type ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'border-purple-300'}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="text-slate-700 text-sm font-medium mb-2 block flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Khoảng Thời Gian
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { value: 'all', label: 'Tất cả' },
                      { value: '7days', label: '7 ngày' },
                      { value: '30days', label: '30 ngày' },
                      { value: '90days', label: '90 ngày' },
                      { value: 'custom', label: 'Tùy chỉnh' }
                    ].map((range) => (
                      <Button
                        key={range.value}
                        onClick={() => setDateRange(range.value)}
                        size="sm"
                        variant={dateRange === range.value ? 'default' : 'outline'}
                        className={dateRange === range.value ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'border-purple-300'}
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>

                  {dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-600 text-xs mb-1 block">Từ ngày</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="bg-white border-2 border-purple-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-slate-600 text-xs mb-1 block">Đến ngày</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="bg-white border-2 border-purple-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Filters */}
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setDateRange('all');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  variant="outline"
                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  Xóa Bộ Lọc
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Transaction List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
              <History className="w-6 h-6 text-purple-500" />
              Danh Sách Giao Dịch
            </h3>
            <Badge className="bg-purple-100 text-purple-800">
              {filteredTransactions.length} giao dịch
            </Badge>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Đang tải giao dịch...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium text-lg mb-2">Không Có Giao Dịch</p>
              <p className="text-slate-600 text-sm">
                {searchTerm || filterType !== 'all' || dateRange !== 'all' 
                  ? 'Thử điều chỉnh bộ lọc để xem thêm giao dịch'
                  : 'Chưa có giao dịch nào trong lịch sử'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
              {filteredTransactions.map((tx, index) => {
                const isPositive = tx.amount > 0;
                const typeInfo = transactionTypes[tx.type] || { label: tx.type, icon: DollarSign, color: 'bg-gray-100 text-gray-800' };
                const Icon = typeInfo.icon;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white border-2 border-purple-100 rounded-2xl p-4 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isPositive ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                            {isQualityReward(tx.description) && (
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-400">
                                <ThumbsUp className="w-3 h-3 mr-1" />
                                Quality Bonus
                              </Badge>
                            )}
                            {parseEnergyScore(tx.description) !== null && (
                              <Badge className="bg-indigo-100 text-indigo-800 border border-indigo-400">
                                <Zap className="w-3 h-3 mr-1" />
                                {parseEnergyScore(tx.description)}/30 Energy
                              </Badge>
                            )}
                            <span className="text-xs text-slate-500">
                              {format(new Date(tx.created_date), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-slate-900 font-medium mb-1 break-words whitespace-pre-line">{tx.description}</p>
                          {tx.processed_by && (
                            <p className="text-xs text-purple-600">
                              Xử lý bởi: {tx.processed_by}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-600">Camlycoin</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}