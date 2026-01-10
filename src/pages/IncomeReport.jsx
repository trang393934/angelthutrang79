import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Calendar, DollarSign, PieChart, BarChart3, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export default function IncomeReport() {
  const [currentUser, setCurrentUser] = useState(null);
  const [timeFilter, setTimeFilter] = useState('month'); // day, week, month, all
  const [sourceFilter, setSourceFilter] = useState('all');

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const [isFixing, setIsFixing] = useState(false);

  // Fetch user balance
  const { data: userBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['user-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || { total_earned: 0 };
    },
    enabled: !!currentUser,
  });

  // Fetch all transactions
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['income-transactions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      const txs = await base44.entities.CamlycoinTransaction.filter(
        { user_email: currentUser.email },
        '-created_date',
        10000
      );
      return txs.filter(tx => tx.amount > 0); // Only income
    },
    enabled: !!currentUser,
  });

  // Filter transactions by time
  const filteredTransactions = useMemo(() => {
    if (!allTransactions.length) return [];

    const now = new Date();
    let startDate;

    switch (timeFilter) {
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'all':
      default:
        startDate = null;
    }

    let filtered = startDate 
      ? allTransactions.filter(tx => new Date(tx.created_date) >= startDate)
      : allTransactions;

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === sourceFilter);
    }

    return filtered;
  }, [allTransactions, timeFilter, sourceFilter]);

  // Calculate income by source
  const incomeBySource = useMemo(() => {
    const sourceMap = {};
    filteredTransactions.forEach(tx => {
      const type = tx.type || 'other';
      sourceMap[type] = (sourceMap[type] || 0) + tx.amount;
    });

    return Object.entries(sourceMap)
      .filter(([type]) => currentUser?.role === 'admin' || type !== 'admin_adjustment')
      .map(([type, amount]) => ({
        name: type === 'manual_add' ? 'Câu Hỏi' :
              type === 'bounty_reward' ? 'Bounty' :
              type === 'build_reward' ? 'Build Reward' :
              type === 'admin_adjustment' ? 'Admin Bonus' : type,
        value: amount,
        type
      }));
  }, [filteredTransactions]);

  // Calculate daily income for chart
  const dailyIncome = useMemo(() => {
    const dailyMap = {};
    
    filteredTransactions.forEach(tx => {
      const date = format(new Date(tx.created_date), 'yyyy-MM-dd');
      dailyMap[date] = (dailyMap[date] || 0) + tx.amount;
    });

    return Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, amount]) => ({
        date: format(new Date(date), 'dd/MM'),
        amount,
        fullDate: date
      }));
  }, [filteredTransactions]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const count = filteredTransactions.length;
    const average = count > 0 ? total / count : 0;

    // Find highest earning day
    const dailyMap = {};
    filteredTransactions.forEach(tx => {
      const date = format(new Date(tx.created_date), 'yyyy-MM-dd');
      dailyMap[date] = (dailyMap[date] || 0) + tx.amount;
    });

    const highestDay = Object.entries(dailyMap)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      count,
      average,
      highestDay: highestDay ? {
        date: format(new Date(highestDay[0]), 'dd/MM/yyyy'),
        amount: highestDay[1]
      } : null
    };
  }, [filteredTransactions]);

  const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

  // Calculate balance integrity
  const balanceCheck = useMemo(() => {
    if (!userBalance) return null;

    const totalEarned = userBalance.total_earned || 0;
    const available = userBalance.available_balance || 0;
    const pending = userBalance.admin_review_pending || 0;
    const frozen = userBalance.frozen_balance || 0;
    const paid = userBalance.paid_amount || 0;

    const sumOfSubBalances = available + pending + frozen + paid;
    const discrepancy = totalEarned - sumOfSubBalances;

    return {
      totalEarned,
      available,
      pending,
      frozen,
      paid,
      sumOfSubBalances,
      discrepancy,
      hasDiscrepancy: Math.abs(discrepancy) >= 1
    };
  }, [userBalance]);

  const handleFixDiscrepancy = async () => {
    setIsFixing(true);
    try {
      const result = await base44.functions.invoke('fixBalanceDiscrepancy', {});
      console.log('Fix result:', result.data);
      await refetchBalance();
      alert(`✅ Đã sửa xong!\n\nDiscrepancy cũ: ${balanceCheck.discrepancy.toLocaleString()}\nDiscrepancy mới: 0`);
    } catch (error) {
      console.error('Fix failed:', error);
      alert('❌ Sửa thất bại: ' + error.message);
    }
    setIsFixing(false);
  };

  const exportReport = () => {
    const reportData = {
      period: timeFilter,
      total: stats.total,
      transactions: filteredTransactions.length,
      average: stats.average,
      bySource: incomeBySource,
      dailyData: dailyIncome
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="w-16 h-16 text-purple-300 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-900 font-bold text-xl">Đang tải...</p>
        </div>
      </div>
    );
  }

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
                    '0 0 20px rgba(139,92,246,0.4)',
                    '0 0 40px rgba(139,92,246,0.6)',
                    '0 0 20px rgba(139,92,246,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
              >
                <TrendingUp className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Báo Cáo Thu Nhập</h1>
                <p className="text-purple-600 text-xs font-medium">Income Report</p>
              </div>
            </div>

            <Button
              onClick={exportReport}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Xuất
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Time Filter */}
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                Khoảng Thời Gian
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'day', label: 'Hôm Nay' },
                  { value: 'week', label: 'Tuần Này' },
                  { value: 'month', label: 'Tháng Này' },
                  { value: 'all', label: 'Tất Cả' }
                ].map(option => (
                  <Button
                    key={option.value}
                    onClick={() => setTimeFilter(option.value)}
                    size="sm"
                    variant={timeFilter === option.value ? 'default' : 'outline'}
                    className={timeFilter === option.value 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'border-purple-300 text-slate-700'
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Source Filter */}
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-500" />
                Nguồn Thu Nhập
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Tất Cả' },
                  { value: 'manual_add', label: 'Câu Hỏi' },
                  { value: 'bounty_reward', label: 'Bounty' },
                  ...(currentUser?.role === 'admin' ? [{ value: 'admin_adjustment', label: 'Admin' }] : [])
                ].map(option => (
                  <Button
                    key={option.value}
                    onClick={() => setSourceFilter(option.value)}
                    size="sm"
                    variant={sourceFilter === option.value ? 'default' : 'outline'}
                    className={sourceFilter === option.value 
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

        {/* Balance Check Card */}
        {balanceCheck?.hasDiscrepancy && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-3xl p-6 shadow-xl mb-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-red-900 font-bold text-lg mb-2 flex items-center gap-2">
                  ❌ Kiểm Tra Công Thức
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-700">
                    <span className="font-semibold">Tổng Kiếm:</span> {balanceCheck.totalEarned.toLocaleString()}
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold">Tổng Chi Tiết:</span> {balanceCheck.sumOfSubBalances.toLocaleString()}
                  </p>
                  <p className="text-red-700 font-bold">
                    ❌ SAI LỆCH: {balanceCheck.discrepancy.toLocaleString()}
                  </p>
                  <div className="text-xs text-slate-600 bg-white/70 rounded-lg p-2 mt-2">
                    <p>Sẵn Sàng TT: {balanceCheck.available.toLocaleString()}</p>
                    <p>Chờ Duyệt TT: {balanceCheck.pending.toLocaleString()}</p>
                    <p>Đóng Băng: {balanceCheck.frozen.toLocaleString()}</p>
                    <p>Đã TT: {balanceCheck.paid.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleFixDiscrepancy}
                disabled={isFixing}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 whitespace-nowrap"
              >
                {isFixing ? '⏳ Đang sửa...' : '🔧 Fix & Refresh'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-white" />
              <span className="text-white/90 text-sm font-medium">Tổng Thu Nhập</span>
            </div>
            <p className="text-white text-3xl font-bold">{stats.total.toLocaleString()}</p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-pink-200 rounded-3xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-pink-500" />
              <span className="text-slate-700 text-sm font-medium">Số Giao Dịch</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold">{stats.count}</p>
            <p className="text-pink-600 text-xs mt-1">giao dịch thu nhập</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-amber-500" />
              <span className="text-slate-700 text-sm font-medium">Trung Bình</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold">{stats.average.toFixed(0)}</p>
            <p className="text-amber-600 text-xs mt-1">Camlycoin / giao dịch</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-green-500" />
              <span className="text-slate-700 text-sm font-medium">Ngày Cao Nhất</span>
            </div>
            {stats.highestDay ? (
              <>
                <p className="text-slate-900 text-2xl font-bold">{stats.highestDay.amount.toLocaleString()}</p>
                <p className="text-green-600 text-xs mt-1">{stats.highestDay.date}</p>
              </>
            ) : (
              <p className="text-slate-600 text-sm">Chưa có dữ liệu</p>
            )}
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Line Chart - Daily Income */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
          >
            <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              Thu Nhập Theo Ngày
            </h3>
            {dailyIncome.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyIncome}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '2px solid #a855f7',
                      borderRadius: '12px',
                      padding: '12px'
                    }}
                    formatter={(value) => [`${value.toLocaleString()} Camlycoin`, 'Thu nhập']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                <p className="text-slate-600">Chưa có dữ liệu</p>
              </div>
            )}
          </motion.div>

          {/* Pie Chart - Income by Source */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-pink-200 rounded-3xl p-6 shadow-xl"
          >
            <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-pink-500" />
              Thu Nhập Theo Nguồn
            </h3>
            {incomeBySource.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={incomeBySource}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {incomeBySource.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString()} Camlycoin`} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {incomeBySource.map((source, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        {source.name}: {source.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <PieChart className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                <p className="text-slate-600">Chưa có dữ liệu</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Bar Chart - Income Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Biểu Đồ Cột Thu Nhập Theo Nguồn
          </h3>
          {incomeBySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeBySource}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '2px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '12px'
                  }}
                  formatter={(value) => [`${value.toLocaleString()} Camlycoin`, 'Thu nhập']}
                />
                <Legend />
                <Bar dataKey="value" fill="#f59e0b" name="Số Camlycoin" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-slate-600">Chưa có dữ liệu</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}