import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Filter, TrendingUp, Users, Coins, Calendar, Download, CheckCircle2, XCircle, Clock, Eye, RefreshCw, BarChart3, PieChart, Activity, Wallet, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminAlertPanel from '@/components/AdminAlertPanel';
import { AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch all data
  const { data: allBalances = [], isLoading: loadingBalances, refetch: refetchBalances } = useQuery({
    queryKey: ['admin-all-balances'],
    queryFn: () => base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000),
    enabled: isAdmin,
  });

  const { data: allTransactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['admin-all-transactions'],
    queryFn: () => base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 5000),
    enabled: isAdmin,
  });

  const { data: allWithdrawals = [], refetch: refetchWithdrawals } = useQuery({
    queryKey: ['admin-all-withdrawals'],
    queryFn: () => base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 1000),
    enabled: isAdmin,
  });

  const { data: allAuditLogs = [] } = useQuery({
    queryKey: ['admin-all-audit-logs'],
    queryFn: () => base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000),
    enabled: isAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => base44.asServiceRole.entities.User.list('-created_date', 10000),
    enabled: isAdmin,
  });

  const { data: allLevels = [] } = useQuery({
    queryKey: ['admin-all-levels'],
    queryFn: () => base44.asServiceRole.entities.UserLevel.list('-total_points', 10000),
    enabled: isAdmin,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!allBalances.length) return null;

    const totalUsers = allBalances.length;
    const totalBalance = allBalances.reduce((sum, b) => sum + (b.balance || 0), 0);
    const totalAvailable = allBalances.reduce((sum, b) => sum + (b.available_balance || 0), 0);
    const totalFrozen = allBalances.reduce((sum, b) => sum + (b.frozen_balance || 0), 0);
    const totalPending = allBalances.reduce((sum, b) => sum + (b.pending_review_balance || 0), 0);
    const totalUnpaid = allBalances.reduce((sum, b) => sum + (b.unpaid_amount || 0), 0);
    const totalPaid = allBalances.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
    const totalEarned = allBalances.reduce((sum, b) => sum + (b.total_earned || 0), 0);

    // Withdrawal stats
    const totalWithdrawalRequests = allWithdrawals.length;
    const pendingWithdrawals = allWithdrawals.filter(w => w.status === 'pending').length;
    const completedWithdrawals = allWithdrawals.filter(w => w.status === 'completed').length;
    const rejectedWithdrawals = allWithdrawals.filter(w => w.status === 'rejected').length;
    const totalWithdrawnAmount = allWithdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);

    // Audit stats
    const totalQuestions = allAuditLogs.length;
    const validQuestions = allAuditLogs.filter(log => log.exclusion_reason === 'valid').length;
    const duplicateQuestions = allAuditLogs.filter(log => log.exclusion_reason === 'duplicate').length;
    const greetingQuestions = allAuditLogs.filter(log => log.exclusion_reason === 'greeting').length;
    const exceedsLimitQuestions = allAuditLogs.filter(log => log.exclusion_reason === 'exceeds_daily_limit').length;

    // Active users (có audit log trong 7 ngày qua)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers7Days = new Set(
      allAuditLogs
        .filter(log => new Date(log.created_date) > sevenDaysAgo)
        .map(log => log.user_email)
    ).size;

    // Top earners
    const topEarners = [...allBalances]
      .filter(b => (b.total_earned || 0) > 0)
      .sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0))
      .slice(0, 10);

    // High risk users
    const highRiskUsers = allBalances.filter(b => 
      (b.spam_score || 0) > 50 || 
      b.audit_status === 'under_review' || 
      b.audit_status === 'frozen'
    ).length;

    return {
      totalUsers,
      totalBalance,
      totalAvailable,
      totalFrozen,
      totalPending,
      totalUnpaid,
      totalPaid,
      totalEarned,
      totalWithdrawalRequests,
      pendingWithdrawals,
      completedWithdrawals,
      rejectedWithdrawals,
      totalWithdrawnAmount,
      totalQuestions,
      validQuestions,
      duplicateQuestions,
      greetingQuestions,
      exceedsLimitQuestions,
      activeUsers7Days,
      topEarners,
      highRiskUsers,
    };
  }, [allBalances, allWithdrawals, allAuditLogs]);

  // Filter and search users
  const filteredBalances = useMemo(() => {
    return allBalances.filter(balance => {
      const matchesSearch = !searchQuery || 
        balance.user_email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || 
        (filterStatus === 'unpaid' && (balance.unpaid_amount || 0) > 0) ||
        (filterStatus === 'pending' && (balance.pending_review_balance || 0) > 0) ||
        (filterStatus === 'frozen' && (balance.frozen_balance || 0) > 0) ||
        (filterStatus === 'available' && (balance.available_balance || 0) > 0);

      return matchesSearch && matchesFilter;
    });
  }, [allBalances, searchQuery, filterStatus]);

  // Prepare chart data - User growth
  const userGrowthData = useMemo(() => {
    const now = new Date();
    const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const usersOnDay = allBalances.filter(b => {
        const createdDate = new Date(b.created_date).toISOString().split('T')[0];
        return createdDate <= dateStr;
      }).length;

      data.push({
        date: dateStr,
        users: usersOnDay,
      });
    }

    return data;
  }, [allBalances, dateRange]);

  // Coins distribution data
  const coinsDistributionData = useMemo(() => {
    if (!stats) return [];
    
    return [
      { name: 'Sẵn Sàng TT', value: stats.totalAvailable, color: '#10b981' },
      { name: 'Chờ Duyệt', value: stats.totalUnpaid, color: '#f59e0b' },
      { name: 'Pending Review', value: stats.totalPending, color: '#3b82f6' },
      { name: 'Đóng Băng', value: stats.totalFrozen, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Daily transactions
  const dailyTransactionsData = useMemo(() => {
    const now = new Date();
    const days = 7;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.created_date).toISOString().split('T')[0];
        return txDate === dateStr;
      });

      const earned = dayTransactions
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const spent = Math.abs(dayTransactions
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0));

      data.push({
        date: dateStr.substring(5),
        earned,
        spent,
      });
    }

    return data;
  }, [allTransactions]);

  // Balance trends - Available and Frozen over time
  const balanceTrendsData = useMemo(() => {
    const now = new Date();
    const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Calculate total available and frozen at this date
      const totalAvailable = allBalances.reduce((sum, b) => {
        if (new Date(b.created_date) <= date) {
          return sum + (b.available_balance || 0);
        }
        return sum;
      }, 0);

      const totalFrozen = allBalances.reduce((sum, b) => {
        if (new Date(b.created_date) <= date) {
          return sum + (b.frozen_balance || 0);
        }
        return sum;
      }, 0);

      data.push({
        date: dateStr.substring(5),
        available: totalAvailable,
        frozen: totalFrozen,
      });
    }

    return data;
  }, [allBalances, dateRange]);

  // Filter withdrawals and transactions
  const filteredWithdrawals = useMemo(() => {
    return allWithdrawals.filter(w => {
      if (!withdrawalSearch) return true;
      const search = withdrawalSearch.toLowerCase();
      return w.user_email?.toLowerCase().includes(search) ||
             w.withdrawal_address?.toLowerCase().includes(search) ||
             w.tx_hash?.toLowerCase().includes(search) ||
             w.status?.toLowerCase().includes(search);
    });
  }, [allWithdrawals, withdrawalSearch]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      if (!transactionSearch) return true;
      const search = transactionSearch.toLowerCase();
      return tx.user_email?.toLowerCase().includes(search) ||
             tx.description?.toLowerCase().includes(search) ||
             tx.type?.toLowerCase().includes(search);
    });
  }, [allTransactions, transactionSearch]);

  // Pending actions
  const pendingActions = useMemo(() => {
    const unpaidCount = allBalances.filter(b => (b.unpaid_amount || 0) > 0).length;
    const pendingWithdrawals = allWithdrawals.filter(w => w.status === 'pending').length;
    const pendingReview = allBalances.filter(b => (b.pending_review_balance || 0) > 0).length;

    return {
      unpaidCount,
      pendingWithdrawals,
      pendingReview,
      total: unpaidCount + pendingWithdrawals + pendingReview,
    };
  }, [allBalances, allWithdrawals]);

  // Quick approve unpaid mutation
  const quickApproveUnpaidMutation = useMutation({
    mutationFn: async (balance) => {
      const unpaidAmount = balance.unpaid_amount || 0;
      if (unpaidAmount <= 0) return;

      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        unpaid_amount: 0,
        available_balance: (balance.available_balance || 0) + unpaidAmount
      });

      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: balance.user_email,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt ${unpaidAmount.toLocaleString()} Camlycoin từ 1/1/2026 → Sẵn Sàng Thanh Toán`,
        processed_by: currentUser.email
      });
    },
    onSuccess: () => {
      refetchBalances();
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
    }
  });

  // Quick reject unpaid mutation
  const quickRejectUnpaidMutation = useMutation({
    mutationFn: async (balance) => {
      const unpaidAmount = balance.unpaid_amount || 0;
      if (unpaidAmount <= 0) return;

      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        unpaid_amount: 0,
        frozen_balance: (balance.frozen_balance || 0) + unpaidAmount
      });

      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: balance.user_email,
        amount: 0,
        type: 'admin_adjustment',
        description: `❌ Admin từ chối ${unpaidAmount.toLocaleString()} Camlycoin từ 1/1/2026 → Đóng Băng`,
        processed_by: currentUser.email
      });
    },
    onSuccess: () => {
      refetchBalances();
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Activity className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
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
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2 flex-1 justify-center">
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
                <Activity className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Admin Dashboard</h1>
                <p className="text-purple-600 text-xs font-medium">Quản Trị Hệ Thống</p>
              </div>
            </div>

            <Button
              onClick={() => {
                refetchBalances();
                refetchWithdrawals();
              }}
              variant="outline"
              size="icon"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        {/* Admin Alerts Panel */}
        <AdminAlertPanel />

        {/* System Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
        >
          <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Tổng Hợp Hệ Thống
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <p className="text-white/90 text-xs font-medium mb-1">Sẵn Sàng TT</p>
              <p className="text-white text-xl font-bold">{(stats?.totalAvailable || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <p className="text-white/90 text-xs font-medium mb-1">Chờ Duyệt TT</p>
              <p className="text-white text-xl font-bold">{(stats?.totalUnpaid || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <p className="text-white/90 text-xs font-medium mb-1">Chờ Review</p>
              <p className="text-white text-xl font-bold">{(stats?.totalPending || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <p className="text-white/90 text-xs font-medium mb-1">Đã TT</p>
              <p className="text-white text-xl font-bold">{(stats?.totalPaid || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <p className="text-white/90 text-xs font-medium mb-1">Đóng Băng</p>
              <p className="text-white text-xl font-bold">{(stats?.totalFrozen || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Formula Validation */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30 mt-4">
            <p className="text-white/90 text-xs font-bold mb-2">✅ Kiểm Tra Công Thức:</p>
            <p className="text-white text-xs leading-relaxed">
              <strong>Tổng Kiếm:</strong> {(stats?.totalEarned || 0).toLocaleString()}<br/>
              <strong>Tổng Chi Tiết:</strong> {(
                (stats?.totalAvailable || 0) +
                (stats?.totalUnpaid || 0) +
                (stats?.totalPending || 0) +
                (stats?.totalPaid || 0) +
                (stats?.totalFrozen || 0)
              ).toLocaleString()}<br/>
              <strong className={
                (stats?.totalEarned || 0) === 
                ((stats?.totalAvailable || 0) + (stats?.totalUnpaid || 0) + (stats?.totalPending || 0) + (stats?.totalPaid || 0) + (stats?.totalFrozen || 0))
                ? 'text-green-300' : 'text-red-300'
              }>
                {(stats?.totalEarned || 0) === 
                 ((stats?.totalAvailable || 0) + (stats?.totalUnpaid || 0) + (stats?.totalPending || 0) + (stats?.totalPaid || 0) + (stats?.totalFrozen || 0))
                 ? '✅ CHÍNH XÁC' : `❌ SAI LỆCH: ${(
                  (stats?.totalEarned || 0) -
                  ((stats?.totalAvailable || 0) + (stats?.totalUnpaid || 0) + (stats?.totalPending || 0) + (stats?.totalPaid || 0) + (stats?.totalFrozen || 0))
                 ).toLocaleString()}`}
              </strong>
            </p>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 border-2 border-white rounded-2xl p-4 shadow-xl">
            <Users className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Tổng Users</p>
            <p className="text-white text-3xl font-bold">{stats?.totalUsers || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white rounded-2xl p-4 shadow-xl">
            <Coins className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Tổng Đã Kiếm</p>
            <p className="text-white text-2xl font-bold">{(stats?.totalEarned || 0).toLocaleString()}</p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-gradient-to-br from-orange-400 to-red-500 border-2 border-white rounded-2xl p-4 shadow-xl">
            <Clock className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Chờ Duyệt TT</p>
            <p className="text-white text-2xl font-bold">{(stats?.totalUnpaid || 0).toLocaleString()}</p>
            <p className="text-white/80 text-xs mt-1">⏳ {pendingActions.unpaidCount} users</p>
          </div>

          <div className="bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-white rounded-2xl p-4 shadow-xl">
            <CheckCircle2 className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Đã Thanh Toán</p>
            <p className="text-white text-2xl font-bold">{(stats?.totalPaid || 0).toLocaleString()}</p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-2 mb-6 grid grid-cols-4 gap-2">
            <TabsTrigger value="overview" className="rounded-xl">
              <BarChart3 className="w-4 h-4 mr-2" />
              Tổng Quan
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl">
              <Users className="w-4 h-4 mr-2" />
              Người Dùng
            </TabsTrigger>
            <TabsTrigger value="pending" className="rounded-xl">
              <Clock className="w-4 h-4 mr-2" />
              Chờ Duyệt
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl">
              <PieChart className="w-4 h-4 mr-2" />
              Phân Tích
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Growth Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-900 font-bold text-lg">Tăng Trưởng Users</h3>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">7 ngày</SelectItem>
                      <SelectItem value="30days">30 ngày</SelectItem>
                      <SelectItem value="90days">90 ngày</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255,255,255,0.95)', 
                        border: '2px solid #a855f7',
                        borderRadius: '12px'
                      }}
                    />
                    <Line type="monotone" dataKey="users" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Coins Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
              >
                <h3 className="text-slate-900 font-bold text-lg mb-4">Phân Bổ Coins</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={coinsDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {coinsDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255,255,255,0.95)', 
                        border: '2px solid #f59e0b',
                        borderRadius: '12px'
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Daily Transactions Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-xl"
            >
              <h3 className="text-slate-900 font-bold text-lg mb-4">Giao Dịch 7 Ngày Qua</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTransactionsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      border: '2px solid #10b981',
                      borderRadius: '12px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="earned" fill="#10b981" name="Kiếm Được" />
                  <Bar dataKey="spent" fill="#ef4444" name="Chi Tiêu" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Balance Trends Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-900 font-bold text-lg">Xu Hướng Số Dư</h3>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">7 ngày</SelectItem>
                    <SelectItem value="30days">30 ngày</SelectItem>
                    <SelectItem value="90days">90 ngày</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={balanceTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      border: '2px solid #a855f7',
                      borderRadius: '12px'
                    }}
                    formatter={(value) => value.toLocaleString()}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="available" stroke="#10b981" strokeWidth={3} name="Sẵn Sàng TT" dot={{ fill: '#10b981', r: 4 }} />
                  <Line type="monotone" dataKey="frozen" stroke="#ef4444" strokeWidth={3} name="Đóng Băng" dot={{ fill: '#ef4444', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Processed Withdrawals with Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Withdrawals Đã Xử Lý
                </h3>
                <Badge className="bg-green-100 text-green-800">
                  {allWithdrawals.filter(w => w.status === 'completed').length} hoàn thành
                </Badge>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Tìm theo email, địa chỉ ví, tx hash..."
                  value={withdrawalSearch}
                  onChange={(e) => setWithdrawalSearch(e.target.value)}
                  className="pl-10 bg-white border-2 border-green-200 rounded-xl"
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredWithdrawals
                  .filter(w => w.status === 'completed')
                  .slice(0, 20)
                  .map((withdrawal, idx) => (
                    <motion.div
                      key={withdrawal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => setSelectedWithdrawal(withdrawal)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(withdrawal.user_email)}`;
                            }}
                            className="text-purple-600 hover:text-purple-800 font-bold hover:underline text-left break-all"
                          >
                            {withdrawal.user_email}
                          </button>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className="bg-green-200 text-green-900">
                              ✅ {withdrawal.status}
                            </Badge>
                            <Badge className="bg-amber-100 text-amber-800">
                              💰 {(withdrawal.amount || 0).toLocaleString()}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 mt-2">
                            {format(new Date(withdrawal.processed_date || withdrawal.created_date), 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="border-green-300 text-green-700">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </motion.div>

            {/* Advanced Transaction Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
            >
              <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6 text-purple-500" />
                Tìm Kiếm Giao Dịch Nâng Cao
              </h3>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Tìm theo email, mô tả, loại giao dịch..."
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  className="pl-10 bg-white border-2 border-purple-200 rounded-xl"
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredTransactions.slice(0, 30).map((tx, idx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(tx.user_email)}`}
                          className="text-purple-600 hover:text-purple-800 font-semibold hover:underline text-left break-all text-sm"
                        >
                          {tx.user_email}
                        </button>
                        <p className="text-slate-900 font-medium mt-1 text-sm break-words">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className="bg-indigo-100 text-indigo-800 text-xs">
                            {tx.type}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {format(new Date(tx.created_date), 'dd/MM/yyyy HH:mm')}
                          </span>
                          {tx.processed_by && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              👤 {tx.processed_by}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xl font-bold ${tx.amount > 0 ? 'text-green-600' : tx.amount < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Search and Filter */}
            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4 shadow-lg">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Tìm kiếm email người dùng..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-2 border-purple-200 rounded-xl"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-48 bg-white border-2 border-purple-200 rounded-xl">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất Cả</SelectItem>
                    <SelectItem value="unpaid">Có Chờ Duyệt TT</SelectItem>
                    <SelectItem value="pending">Có Pending Review</SelectItem>
                    <SelectItem value="frozen">Có Đóng Băng</SelectItem>
                    <SelectItem value="available">Có Sẵn Sàng TT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Users List */}
            {loadingBalances ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-purple-300 mx-auto mb-4 animate-spin" />
                <p className="text-slate-700 font-medium">Đang tải dữ liệu...</p>
              </div>
            ) : filteredBalances.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-700 font-medium">Không tìm thấy người dùng</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBalances.map((balance, idx) => (
                  <motion.div
                    key={balance.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <button
                          onClick={() => window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(balance.user_email)}`}
                          className="text-purple-600 hover:text-purple-800 font-bold break-all hover:underline text-left"
                        >
                          {balance.user_email}
                        </button>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className="bg-amber-100 text-amber-800">
                            💰 {(balance.balance || 0).toLocaleString()}
                          </Badge>
                          {(balance.available_balance || 0) > 0 && (
                            <Badge className="bg-green-100 text-green-800">
                              ✅ {(balance.available_balance || 0).toLocaleString()} Sẵn Sàng
                            </Badge>
                          )}
                          {(balance.unpaid_amount || 0) > 0 && (
                            <Badge className="bg-orange-100 text-orange-800">
                              ⏳ {(balance.unpaid_amount || 0).toLocaleString()} Chờ Duyệt
                            </Badge>
                          )}
                          {(balance.pending_review_balance || 0) > 0 && (
                            <Badge className="bg-blue-100 text-blue-800">
                              🔍 {(balance.pending_review_balance || 0).toLocaleString()} Pending
                            </Badge>
                          )}
                          {(balance.frozen_balance || 0) > 0 && (
                            <Badge className="bg-red-100 text-red-800">
                              ❄️ {(balance.frozen_balance || 0).toLocaleString()} Frozen
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        onClick={() => window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(balance.user_email)}`}
                        variant="outline" 
                        size="sm" 
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Tab - Quick Actions */}
          <TabsContent value="pending" className="space-y-6">
            <div className="bg-white/80 backdrop-blur-xl border-2 border-orange-200 rounded-2xl p-6 shadow-xl">
              <h3 className="text-slate-900 font-bold text-lg mb-4">Chờ Duyệt Thanh Toán (Từ 1/1/2026)</h3>
              
              {allBalances.filter(b => (b.unpaid_amount || 0) > 0).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-4" />
                  <p className="text-slate-700 font-medium">Không có chờ duyệt thanh toán</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allBalances
                    .filter(b => (b.unpaid_amount || 0) > 0)
                    .map((balance, idx) => (
                      <motion.div
                        key={balance.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <button
                              onClick={() => window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(balance.user_email)}`}
                              className="text-purple-600 hover:text-purple-800 font-bold break-all hover:underline text-left"
                            >
                              {balance.user_email}
                            </button>
                            <Badge className="bg-orange-200 text-orange-900 mt-2">
                              💰 {(balance.unpaid_amount || 0).toLocaleString()} Camlycoin
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => quickApproveUnpaidMutation.mutate(balance)}
                            disabled={quickApproveUnpaidMutation.isPending}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Duyệt
                          </Button>
                          <Button
                            onClick={() => quickRejectUnpaidMutation.mutate(balance)}
                            disabled={quickRejectUnpaidMutation.isPending}
                            className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Từ Chối
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </div>

            {/* Pending Withdrawals */}
            <div className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-2xl p-6 shadow-xl">
              <h3 className="text-slate-900 font-bold text-lg mb-4">Yêu Cầu Rút Tiền Chờ Duyệt</h3>
              
              {allWithdrawals.filter(w => w.status === 'pending').length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-4" />
                  <p className="text-slate-700 font-medium">Không có yêu cầu rút tiền chờ duyệt</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allWithdrawals
                    .filter(w => w.status === 'pending')
                    .slice(0, 10)
                    .map((withdrawal, idx) => (
                      <motion.div
                        key={withdrawal.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <button
                              onClick={() => window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(withdrawal.user_email)}`}
                              className="text-purple-600 hover:text-purple-800 font-bold break-all hover:underline text-left"
                            >
                              {withdrawal.user_email}
                            </button>
                            <Badge className="bg-blue-200 text-blue-900 mt-2">
                              💰 {(withdrawal.amount || 0).toLocaleString()} Camlycoin
                            </Badge>
                            <p className="text-xs text-slate-600 mt-1 break-all">
                              {withdrawal.withdrawal_address}
                            </p>
                          </div>
                          <Link to={createPageUrl('WithdrawalManagement')}>
                            <Button size="sm" className="bg-blue-500 text-white rounded-xl">
                              Xử Lý
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Withdrawal Statistics */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 shadow-2xl border-2 border-white">
              <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                <Wallet className="w-6 h-6" />
                Thống Kê Rút Tiền
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">Tổng Yêu Cầu</p>
                  <p className="text-white text-2xl font-bold">{stats?.totalWithdrawalRequests || 0}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">⏳ Chờ Duyệt</p>
                  <p className="text-white text-2xl font-bold">{stats?.pendingWithdrawals || 0}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">✅ Hoàn Tất</p>
                  <p className="text-white text-2xl font-bold">{stats?.completedWithdrawals || 0}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">❌ Từ Chối</p>
                  <p className="text-white text-2xl font-bold">{stats?.rejectedWithdrawals || 0}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">Đã Rút</p>
                  <p className="text-white text-lg font-bold">{(stats?.totalWithdrawnAmount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Question Statistics */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-2xl border-2 border-white">
              <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Thống Kê Câu Hỏi (Audit Logs)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">Tổng Số</p>
                  <p className="text-white text-2xl font-bold">{stats?.totalQuestions || 0}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">✅ Hợp Lệ</p>
                  <p className="text-white text-2xl font-bold">{stats?.validQuestions || 0}</p>
                  <p className="text-white/80 text-xs">{stats?.totalQuestions > 0 ? ((stats.validQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">🔄 Trùng Lặp</p>
                  <p className="text-white text-2xl font-bold">{stats?.duplicateQuestions || 0}</p>
                  <p className="text-white/80 text-xs">{stats?.totalQuestions > 0 ? ((stats.duplicateQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">👋 Chào Hỏi</p>
                  <p className="text-white text-2xl font-bold">{stats?.greetingQuestions || 0}</p>
                  <p className="text-white/80 text-xs">{stats?.totalQuestions > 0 ? ((stats.greetingQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                  <p className="text-white/90 text-xs font-medium mb-1">📊 Câu 11+</p>
                  <p className="text-white text-2xl font-bold">{stats?.exceedsLimitQuestions || 0}</p>
                  <p className="text-white/80 text-xs">{stats?.totalQuestions > 0 ? ((stats.exceedsLimitQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
            </div>

            {/* User Activity Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="text-slate-600 text-xs font-medium">Active Users (7 ngày)</p>
                    <p className="text-slate-900 text-3xl font-bold">{stats?.activeUsers7Days || 0}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {stats?.totalUsers > 0 ? ((stats.activeUsers7Days / stats.totalUsers) * 100).toFixed(1) : 0}% tổng users
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="text-slate-600 text-xs font-medium">Trung Bình/User</p>
                    <p className="text-slate-900 text-3xl font-bold">
                      {stats?.totalUsers > 0 ? Math.floor(stats.totalEarned / stats.totalUsers).toLocaleString() : 0}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">Camlycoin/user</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <div>
                    <p className="text-slate-600 text-xs font-medium">High Risk Users</p>
                    <p className="text-slate-900 text-3xl font-bold">{stats?.highRiskUsers || 0}</p>
                    <p className="text-slate-500 text-xs mt-1">Cần theo dõi</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Earners */}
            <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl">
              <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-amber-500" />
                Top 10 Earners
              </h3>
              <div className="space-y-2">
                {stats?.topEarners?.map((user, idx) => (
                  <div key={user.id} className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                      idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                      idx === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {idx + 1}
                    </div>
                    <button
                      onClick={() => window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(user.user_email)}`}
                      className="text-purple-600 hover:text-purple-800 font-semibold text-sm hover:underline"
                    >
                      {user.user_email}
                    </button>
                    </div>
                    <p className="text-amber-600 font-bold text-lg">{(user.total_earned || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Balance Breakdown */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-lg mb-4">Phân Tích Balance</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                    <span className="text-slate-700 font-medium text-sm">Tổng Đã Kiếm</span>
                    <span className="text-purple-600 font-bold text-lg">{(stats?.totalEarned || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-green-100">
                    <span className="text-slate-700 font-medium text-sm">✅ Sẵn Sàng TT</span>
                    <span className="text-green-600 font-bold text-lg">{(stats?.totalAvailable || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-orange-100">
                    <span className="text-slate-700 font-medium text-sm">⏳ Chờ Duyệt TT</span>
                    <span className="text-orange-600 font-bold text-lg">{(stats?.totalUnpaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                    <span className="text-slate-700 font-medium text-sm">🔍 Chờ Review</span>
                    <span className="text-blue-600 font-bold text-lg">{(stats?.totalPending || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-green-100">
                    <span className="text-slate-700 font-medium text-sm">✅ Đã Thanh Toán</span>
                    <span className="text-green-600 font-bold text-lg">{(stats?.totalPaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-red-100">
                    <span className="text-slate-700 font-medium text-sm">❄️ Đóng Băng</span>
                    <span className="text-red-600 font-bold text-lg">{(stats?.totalFrozen || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t-2 border-purple-300">
                    <span className="text-slate-900 font-bold">Tổng Balance</span>
                    <span className="text-purple-600 font-bold text-xl">{(stats?.totalBalance || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Question Quality Analysis */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-lg mb-4">Phân Tích Chất Lượng Câu Hỏi</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                    <span className="text-slate-700 font-medium text-sm">Tổng Câu Hỏi</span>
                    <span className="text-indigo-600 font-bold text-lg">{stats?.totalQuestions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-green-100">
                    <span className="text-slate-700 font-medium text-sm">✅ Hợp Lệ</span>
                    <div className="text-right">
                      <span className="text-green-600 font-bold text-lg">{stats?.validQuestions || 0}</span>
                      <p className="text-green-500 text-xs">
                        {stats?.totalQuestions > 0 ? ((stats.validQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-orange-100">
                    <span className="text-slate-700 font-medium text-sm">🔄 Trùng Lặp</span>
                    <div className="text-right">
                      <span className="text-orange-600 font-bold text-lg">{stats?.duplicateQuestions || 0}</span>
                      <p className="text-orange-500 text-xs">
                        {stats?.totalQuestions > 0 ? ((stats.duplicateQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-yellow-100">
                    <span className="text-slate-700 font-medium text-sm">👋 Chào Hỏi</span>
                    <div className="text-right">
                      <span className="text-yellow-600 font-bold text-lg">{stats?.greetingQuestions || 0}</span>
                      <p className="text-yellow-500 text-xs">
                        {stats?.totalQuestions > 0 ? ((stats.greetingQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                    <span className="text-slate-700 font-medium text-sm">📊 Câu 11+</span>
                    <div className="text-right">
                      <span className="text-purple-600 font-bold text-lg">{stats?.exceedsLimitQuestions || 0}</span>
                      <p className="text-purple-500 text-xs">
                        {stats?.totalQuestions > 0 ? ((stats.exceedsLimitQuestions / stats.totalQuestions) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t-2 border-indigo-300">
                    <span className="text-slate-900 font-bold">Tỷ Lệ Spam</span>
                    <span className="text-red-600 font-bold text-xl">
                      {stats?.totalQuestions > 0 ? (((stats.duplicateQuestions + stats.greetingQuestions) / stats.totalQuestions) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Withdrawal Detail Modal */}
      <AnimatePresence>
        {selectedWithdrawal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedWithdrawal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-900 text-2xl font-bold">Chi Tiết Withdrawal</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedWithdrawal(null)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* User Info */}
              <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 mb-4">
                <button
                  onClick={() => {
                    setSelectedWithdrawal(null);
                    window.location.href = `${createPageUrl('UserProfile')}?email=${encodeURIComponent(selectedWithdrawal.user_email)}`;
                  }}
                  className="text-purple-600 hover:text-purple-800 font-bold hover:underline text-lg break-all"
                >
                  {selectedWithdrawal.user_email}
                </button>
              </div>

              {/* Amount */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 mb-4 text-white">
                <p className="text-white/90 text-sm mb-1">Số Tiền Rút</p>
                <p className="text-white text-4xl font-bold">{(selectedWithdrawal.amount || 0).toLocaleString()}</p>
                <p className="text-white/80 text-xs mt-1">Camlycoin</p>
              </div>

              {/* Wallet Address */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 mb-4">
                <p className="text-slate-700 font-semibold mb-2 text-sm">Địa Chỉ Ví (BEP-20)</p>
                <p className="text-slate-900 font-mono text-sm break-all bg-white border border-slate-300 rounded-lg p-3">
                  {selectedWithdrawal.withdrawal_address}
                </p>
              </div>

              {/* Status & Dates */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-300 rounded-xl p-3">
                  <p className="text-slate-700 font-semibold mb-1 text-xs">Trạng Thái</p>
                  <Badge className={
                    selectedWithdrawal.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
                    selectedWithdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    'bg-red-100 text-red-800 border-red-300'
                  }>
                    {selectedWithdrawal.status}
                  </Badge>
                </div>
                <div className="bg-slate-50 border border-slate-300 rounded-xl p-3">
                  <p className="text-slate-700 font-semibold mb-1 text-xs">Ngày Tạo</p>
                  <p className="text-slate-900 text-sm font-medium">
                    {format(new Date(selectedWithdrawal.created_date), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* TX Hash */}
              {selectedWithdrawal.tx_hash && (
                <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 mb-4">
                  <p className="text-indigo-900 font-semibold mb-2 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Transaction Hash
                  </p>
                  <div className="bg-white border border-indigo-200 rounded-lg p-3 mb-3">
                    <p className="text-slate-900 font-mono text-xs break-all">
                      {selectedWithdrawal.tx_hash}
                    </p>
                  </div>
                  <a
                    href={`https://bscscan.com/tx/${selectedWithdrawal.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm hover:underline flex items-center gap-1"
                  >
                    <Activity className="w-4 h-4" />
                    Xem trên BscScan →
                  </a>
                </div>
              )}

              {/* Gas Fee */}
              {selectedWithdrawal.gas_fee_bnb && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
                  <p className="text-amber-900 font-semibold mb-1 text-sm">⛽ Phí Gas</p>
                  <p className="text-amber-700 text-lg font-bold">
                    {selectedWithdrawal.gas_fee_bnb.toFixed(8)} BNB
                  </p>
                  <p className="text-amber-600 text-xs mt-1">
                    ~ ${(selectedWithdrawal.gas_fee_bnb * 600).toFixed(4)} USD (ước tính)
                  </p>
                </div>
              )}

              {/* Processed By */}
              {selectedWithdrawal.processed_by && (
                <div className="bg-purple-50 border border-purple-300 rounded-xl p-4 mb-4">
                  <p className="text-purple-900 font-semibold mb-1 text-sm">👤 Xử Lý Bởi</p>
                  <p className="text-purple-700 text-sm font-medium">{selectedWithdrawal.processed_by}</p>
                  {selectedWithdrawal.processed_date && (
                    <p className="text-purple-600 text-xs mt-1">
                      {format(new Date(selectedWithdrawal.processed_date), 'dd/MM/yyyy HH:mm:ss')}
                    </p>
                  )}
                </div>
              )}

              {/* Rejection Reason */}
              {selectedWithdrawal.rejection_reason && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4">
                  <p className="text-red-900 font-semibold mb-2 text-sm">❌ Lý Do Từ Chối</p>
                  <p className="text-red-800 text-sm">{selectedWithdrawal.rejection_reason}</p>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-3">
                {selectedWithdrawal.risk_level && (
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-3">
                    <p className="text-slate-700 font-semibold mb-1 text-xs">Mức Rủi Ro</p>
                    <Badge className={
                      selectedWithdrawal.risk_level === 'low' ? 'bg-green-100 text-green-800' :
                      selectedWithdrawal.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {selectedWithdrawal.risk_level}
                    </Badge>
                  </div>
                )}
                {selectedWithdrawal.verification_status && (
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-3">
                    <p className="text-slate-700 font-semibold mb-1 text-xs">Xác Thực</p>
                    <Badge className="bg-blue-100 text-blue-800">
                      {selectedWithdrawal.verification_status}
                    </Badge>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setSelectedWithdrawal(null)}
                className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl py-6 font-bold"
              >
                Đóng
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}