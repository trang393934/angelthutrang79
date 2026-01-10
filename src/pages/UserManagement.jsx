import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Filter, Users, Eye, Lock, Unlock, Shield, UserCog, Calendar, Mail, Coins, Activity, X, CheckCircle2, AlertCircle, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function UserManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch all users
  const { data: allUsers = [], isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: () => base44.asServiceRole.entities.User.list('-created_date', 10000),
    enabled: isAdmin,
  });

  // Fetch all balances
  const { data: allBalances = [] } = useQuery({
    queryKey: ['admin-all-balances'],
    queryFn: () => base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000),
    enabled: isAdmin,
  });

  // Fetch transactions for selected user
  const { data: userTransactions = [] } = useQuery({
    queryKey: ['user-transactions', selectedUser?.email],
    queryFn: () => base44.asServiceRole.entities.CamlycoinTransaction.filter({ user_email: selectedUser.email }, '-created_date', 100),
    enabled: !!selectedUser,
  });

  // Fetch withdrawals for selected user
  const { data: userWithdrawals = [] } = useQuery({
    queryKey: ['user-withdrawals', selectedUser?.email],
    queryFn: () => base44.asServiceRole.entities.WithdrawalRequest.filter({ user_email: selectedUser.email }, '-created_date', 50),
    enabled: !!selectedUser,
  });

  // Change user role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await base44.asServiceRole.entities.User.update(userId, { role: newRole });
    },
    onSuccess: () => {
      refetchUsers();
      toast.success('✅ Đã cập nhật role', {
        description: 'Role của user đã được thay đổi',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast.error('❌ Cập nhật role thất bại', {
        description: error.message,
        duration: 4000,
      });
    }
  });

  // Lock/Unlock account mutation
  const toggleAccountMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }) => {
      const newStatus = currentStatus === 'active' ? 'locked' : 'active';
      await base44.asServiceRole.entities.User.update(userId, { account_status: newStatus });
      return newStatus;
    },
    onSuccess: (newStatus) => {
      refetchUsers();
      toast.success(newStatus === 'locked' ? '🔒 Đã khóa tài khoản' : '🔓 Đã mở khóa tài khoản', {
        duration: 3000,
      });
    },
    onError: (error) => {
      toast.error('❌ Thay đổi trạng thái thất bại', {
        description: error.message,
        duration: 4000,
      });
    }
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(user => {
      const matchesSearch = !searchQuery || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && (!user.account_status || user.account_status === 'active')) ||
        (filterStatus === 'locked' && user.account_status === 'locked');

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const userDate = new Date(user.created_date);
        const now = new Date();
        const days = dateFilter === '7days' ? 7 : dateFilter === '30days' ? 30 : 90;
        const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        matchesDate = userDate >= threshold;
      }

      return matchesSearch && matchesRole && matchesStatus && matchesDate;
    });
  }, [allUsers, searchQuery, filterRole, filterStatus, dateFilter]);

  // Get user balance
  const getUserBalance = (email) => {
    return allBalances.find(b => b.user_email === email);
  };

  // Stats
  const stats = useMemo(() => {
    return {
      totalUsers: allUsers.length,
      adminUsers: allUsers.filter(u => u.role === 'admin').length,
      regularUsers: allUsers.filter(u => u.role === 'user').length,
      lockedUsers: allUsers.filter(u => u.account_status === 'locked').length,
      newUsersToday: allUsers.filter(u => {
        const created = new Date(u.created_date);
        const today = new Date();
        return created.toDateString() === today.toDateString();
      }).length,
    };
  }, [allUsers]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('AdminDashboard')}>
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
                <Users className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">User Management</h1>
                <p className="text-purple-600 text-xs font-medium">Quản Lý Người Dùng</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 shadow-xl border-2 border-white">
            <Users className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Tổng Users</p>
            <p className="text-white text-3xl font-bold">{stats.totalUsers}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 shadow-xl border-2 border-white">
            <Shield className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Admin</p>
            <p className="text-white text-3xl font-bold">{stats.adminUsers}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl p-4 shadow-xl border-2 border-white">
            <Users className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Regular</p>
            <p className="text-white text-3xl font-bold">{stats.regularUsers}</p>
          </div>

          <div className="bg-gradient-to-br from-red-400 to-rose-500 rounded-2xl p-4 shadow-xl border-2 border-white">
            <Lock className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Bị Khóa</p>
            <p className="text-white text-3xl font-bold">{stats.lockedUsers}</p>
          </div>

          <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-4 shadow-xl border-2 border-white">
            <Calendar className="w-8 h-8 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium">Mới Hôm Nay</p>
            <p className="text-white text-3xl font-bold">{stats.newUsersToday}</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4 shadow-lg mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Tìm email hoặc tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-2 border-purple-200 rounded-xl"
              />
            </div>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="bg-white border-2 border-purple-200 rounded-xl">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả Role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-white border-2 border-purple-200 rounded-xl">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="locked">Bị khóa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="bg-white border-2 border-purple-200 rounded-xl">
                <SelectValue placeholder="Thời gian" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="7days">7 ngày qua</SelectItem>
                <SelectItem value="30days">30 ngày qua</SelectItem>
                <SelectItem value="90days">90 ngày qua</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Users List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {loadingUsers ? (
            <div className="text-center py-12 bg-white/80 rounded-3xl">
              <Activity className="w-12 h-12 text-purple-300 mx-auto mb-4 animate-spin" />
              <p className="text-slate-700 font-medium">Đang tải users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 bg-white/80 rounded-3xl">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Không tìm thấy user</p>
            </div>
          ) : (
            filteredUsers.map((user, idx) => {
              const balance = getUserBalance(user.email);
              const isLocked = user.account_status === 'locked';

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`bg-white/80 backdrop-blur-xl border-2 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all ${
                    isLocked ? 'border-red-300 bg-red-50/50' : 'border-purple-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* User Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">
                            {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-slate-900 font-bold text-lg truncate">
                            {user.full_name || 'Chưa có tên'}
                          </h3>
                          <p className="text-purple-600 text-sm break-all">{user.email}</p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge className={user.role === 'admin' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'}>
                          <Shield className="w-3 h-3 mr-1" />
                          {user.role}
                        </Badge>

                        {isLocked ? (
                          <Badge className="bg-red-100 text-red-800 border-red-300">
                            <Lock className="w-3 h-3 mr-1" />
                            Bị khóa
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            <Unlock className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}

                        {balance && (
                          <>
                            <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                              💰 {(balance.total_earned || 0).toLocaleString()}
                            </Badge>
                            {(balance.available_balance || 0) > 0 && (
                              <Badge className="bg-green-100 text-green-800">
                                ✅ {(balance.available_balance || 0).toLocaleString()} Sẵn Sàng
                              </Badge>
                            )}
                          </>
                        )}

                        <Badge className="bg-slate-100 text-slate-700 border-slate-300">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(new Date(user.created_date), 'dd/MM/yyyy')}
                        </Badge>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-2">
                       <Button
                         onClick={() => {
                           setSelectedUser(user);
                           setShowDetailModal(true);
                         }}
                         size="sm"
                         className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl"
                       >
                         <Eye className="w-4 h-4 mr-1" />
                         Chi Tiết
                       </Button>

                       <Button
                         onClick={async () => {
                           const result = await base44.functions.invoke('investigateDiscrepancy', { user_email: user.email });
                           console.log('Investigation:', result.data);
                           alert(`📊 PHÂN TÍCH:\n\nTổng Kiếm: ${result.data.summary.total_earned_db.toLocaleString()}\nTổng Chi Tiết: ${result.data.summary.sum_of_sub_balances.toLocaleString()}\n❌ SAI LỆCH: ${result.data.summary.discrepancy.toLocaleString()}\n\nXem Console để biết chi tiết`);
                         }}
                         size="sm"
                         variant="outline"
                         className="border-orange-300 text-orange-700 hover:bg-orange-50 rounded-xl"
                       >
                         🔍 Kiểm Tra
                       </Button>

                        <Button
                          onClick={() => changeRoleMutation.mutate({ 
                            userId: user.id, 
                            newRole: user.role === 'admin' ? 'user' : 'admin' 
                          })}
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-xl"
                        >
                          <UserCog className="w-4 h-4 mr-1" />
                          {user.role === 'admin' ? 'Hạ Admin' : 'Lên Admin'}
                        </Button>

                        <Button
                          onClick={() => toggleAccountMutation.mutate({ 
                            userId: user.id, 
                            currentStatus: user.account_status || 'active' 
                          })}
                          size="sm"
                          variant="outline"
                          className={isLocked 
                            ? 'border-green-300 text-green-700 hover:bg-green-50 rounded-xl'
                            : 'border-red-300 text-red-700 hover:bg-red-50 rounded-xl'
                          }
                        >
                          {isLocked ? (
                            <>
                              <Unlock className="w-4 h-4 mr-1" />
                              Mở Khóa
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-1" />
                              Khóa
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-2xl">
                      {selectedUser.full_name?.[0]?.toUpperCase() || selectedUser.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-2xl font-bold">{selectedUser.full_name || 'Chưa có tên'}</h3>
                    <p className="text-purple-600 font-medium">{selectedUser.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* User Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-slate-700 text-xs font-semibold mb-1">Role</p>
                  <Badge className={selectedUser.role === 'admin' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}>
                    {selectedUser.role}
                  </Badge>
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-slate-700 text-xs font-semibold mb-1">Trạng Thái</p>
                  <Badge className={selectedUser.account_status === 'locked' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}>
                    {selectedUser.account_status === 'locked' ? 'Bị khóa' : 'Active'}
                  </Badge>
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-slate-700 text-xs font-semibold mb-1">Ngày Tạo</p>
                  <p className="text-slate-900 font-bold">{format(new Date(selectedUser.created_date), 'dd/MM/yyyy HH:mm')}</p>
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-slate-700 text-xs font-semibold mb-1">Ví Web3</p>
                  <p className="text-slate-900 font-mono text-xs break-all">
                    {selectedUser.web3_wallet || 'Chưa có'}
                  </p>
                </div>
              </div>

              {/* Balance Info */}
              {getUserBalance(selectedUser.email) && (
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 mb-6 text-white">
                  <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                    <Coins className="w-6 h-6" />
                    Số Dư Camlycoin
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                      <p className="text-white/90 text-xs font-medium mb-1">Tổng Kiếm</p>
                      <p className="text-white text-2xl font-bold">
                        {(getUserBalance(selectedUser.email).total_earned || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                      <p className="text-white/90 text-xs font-medium mb-1">Sẵn Sàng TT</p>
                      <p className="text-white text-2xl font-bold">
                        {(getUserBalance(selectedUser.email).available_balance || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                      <p className="text-white/90 text-xs font-medium mb-1">Đã TT</p>
                      <p className="text-white text-2xl font-bold">
                        {(getUserBalance(selectedUser.email).paid_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                      <p className="text-white/90 text-xs font-medium mb-1">Chờ Review</p>
                      <p className="text-white text-2xl font-bold">
                        {(getUserBalance(selectedUser.email).admin_review_pending || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                      <p className="text-white/90 text-xs font-medium mb-1">Đóng Băng</p>
                      <p className="text-white text-2xl font-bold">
                        {(getUserBalance(selectedUser.email).frozen_balance || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                      <p className="text-white/90 text-xs font-medium mb-1">Spam Score</p>
                      <p className="text-white text-2xl font-bold">
                        {(getUserBalance(selectedUser.email).spam_score || 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions */}
              <div className="mb-6">
                <h4 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  Lịch Sử Giao Dịch ({userTransactions.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userTransactions.length === 0 ? (
                    <p className="text-center text-slate-600 py-8">Chưa có giao dịch</p>
                  ) : (
                    userTransactions.slice(0, 10).map((tx, idx) => (
                      <div key={tx.id} className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-900 font-medium text-sm break-words">{tx.description}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className="bg-indigo-100 text-indigo-800 text-xs">
                                {tx.type}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {format(new Date(tx.created_date), 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>
                          </div>
                          <p className={`text-lg font-bold ${tx.amount > 0 ? 'text-green-600' : tx.amount < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Withdrawals */}
              <div>
                <h4 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-green-500" />
                  Lịch Sử Rút Tiền ({userWithdrawals.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userWithdrawals.length === 0 ? (
                    <p className="text-center text-slate-600 py-8">Chưa có yêu cầu rút tiền</p>
                  ) : (
                    userWithdrawals.slice(0, 10).map((withdrawal) => (
                      <div key={withdrawal.id} className="bg-green-50 border border-green-200 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={
                                withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                                withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                withdrawal.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {withdrawal.status}
                              </Badge>
                              <span className="text-slate-900 font-bold">
                                {withdrawal.amount.toLocaleString()} Camlycoin
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 break-all mb-1">
                              {withdrawal.withdrawal_address}
                            </p>
                            {withdrawal.tx_hash && (
                              <a
                                href={`https://bscscan.com/tx/${withdrawal.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-800 text-xs hover:underline flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {withdrawal.tx_hash.slice(0, 20)}...
                              </a>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                              {format(new Date(withdrawal.created_date), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Button
                onClick={() => setShowDetailModal(false)}
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