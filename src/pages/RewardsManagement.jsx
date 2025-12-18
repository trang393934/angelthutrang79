import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, DollarSign, Users, Filter, Search, Plus, Minus, Loader2, Award, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function RewardsManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch user's balance
  const { data: userBalance } = useQuery({
    queryKey: ['camlycoin-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || { balance: 0, total_earned: 0, total_spent: 0 };
    },
    enabled: !!currentUser,
  });

  // Fetch user's transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['camlycoin-transactions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: currentUser.email }, '-created_date');
    },
    enabled: !!currentUser,
  });

  // Admin: Fetch all submissions
  const { data: submissions = [] } = useQuery({
    queryKey: ['bounty-submissions'],
    queryFn: () => base44.entities.BountySubmission.list('-created_date'),
    enabled: isAdmin,
  });

  // Admin: Fetch all balances
  const { data: allBalances = [] } = useQuery({
    queryKey: ['all-balances'],
    queryFn: () => base44.entities.CamlycoinBalance.list('-balance'),
    enabled: isAdmin,
  });

  // Approve submission mutation
  const approveSubmissionMutation = useMutation({
    mutationFn: async (submission) => {
      // Update submission status
      await base44.entities.BountySubmission.update(submission.id, {
        status: 'approved',
        processed_by: currentUser.email
      });

      // Get or create user balance
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: submission.created_by });
      let userBalance = balances[0];

      if (!userBalance) {
        userBalance = await base44.entities.CamlycoinBalance.create({
          user_email: submission.created_by,
          balance: submission.reward_amount,
          total_earned: submission.reward_amount,
          total_spent: 0
        });
      } else {
        await base44.entities.CamlycoinBalance.update(userBalance.id, {
          balance: userBalance.balance + submission.reward_amount,
          total_earned: userBalance.total_earned + submission.reward_amount
        });
      }

      // Create transaction record
      await base44.entities.CamlycoinTransaction.create({
        user_email: submission.created_by,
        amount: submission.reward_amount,
        type: 'bounty_reward',
        description: `Hoàn thành: ${submission.task_title}`,
        reference_id: submission.id,
        processed_by: currentUser.email
      });

      queryClient.invalidateQueries({ queryKey: ['bounty-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['all-balances'] });
    }
  });

  // Reject submission mutation
  const rejectSubmissionMutation = useMutation({
    mutationFn: async (submission) => {
      await base44.entities.BountySubmission.update(submission.id, {
        status: 'rejected',
        processed_by: currentUser.email
      });
      queryClient.invalidateQueries({ queryKey: ['bounty-submissions'] });
    }
  });

  // Manual adjustment mutation
  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ email, amount, description, type }) => {
      // Get or create user balance
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: email });
      let userBalance = balances[0];

      if (!userBalance) {
        userBalance = await base44.entities.CamlycoinBalance.create({
          user_email: email,
          balance: amount > 0 ? amount : 0,
          total_earned: amount > 0 ? amount : 0,
          total_spent: amount < 0 ? Math.abs(amount) : 0
        });
      } else {
        const newBalance = userBalance.balance + amount;
        await base44.entities.CamlycoinBalance.update(userBalance.id, {
          balance: Math.max(0, newBalance),
          total_earned: amount > 0 ? userBalance.total_earned + amount : userBalance.total_earned,
          total_spent: amount < 0 ? userBalance.total_spent + Math.abs(amount) : userBalance.total_spent
        });
      }

      // Create transaction record
      await base44.entities.CamlycoinTransaction.create({
        user_email: email,
        amount: amount,
        type: type,
        description: description,
        processed_by: currentUser.email
      });

      setSelectedEmail('');
      setAdjustAmount('');
      setAdjustDescription('');
      queryClient.invalidateQueries({ queryKey: ['all-balances'] });
      queryClient.invalidateQueries({ queryKey: ['camlycoin-transactions'] });
    }
  });

  const filteredSubmissions = submissions.filter(sub => {
    if (filterStatus !== 'all' && sub.status !== filterStatus) return false;
    if (searchTerm && !sub.task_title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !sub.created_by.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const transactionIcons = {
    bounty_reward: Award,
    build_reward: Award,
    admin_adjustment: DollarSign,
    manual_add: Plus,
    manual_deduct: Minus,
    purchase: TrendingDown
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-300/50 via-orange-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('BuildAndBounty')}>
              <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-900 hover:bg-amber-100 flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(251,191,36,0.4)',
                    '0 0 40px rgba(251,191,36,0.6)',
                    '0 0 20px rgba(251,191,36,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center flex-shrink-0"
              >
                <Coins className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Quản Lý Camlycoin</h1>
                <p className="text-amber-600 text-xs font-medium">Rewards & Balance</p>
              </div>
            </div>

            <div className="w-10 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* User Balance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-3xl p-6 shadow-xl border-2 border-white">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-8 h-8 text-white" />
              <span className="text-white/90 text-sm font-medium">Số Dư Hiện Tại</span>
            </div>
            <p className="text-white text-4xl font-bold">
              {(userBalance?.balance || 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="text-slate-700 text-sm font-medium">Tổng Kiếm Được</span>
            </div>
            <p className="text-slate-900 text-4xl font-bold">
              {(userBalance?.total_earned || 0).toLocaleString()}
            </p>
            <p className="text-green-600 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-8 h-8 text-red-500" />
              <span className="text-slate-700 text-sm font-medium">Tổng Đã Tiêu</span>
            </div>
            <p className="text-slate-900 text-4xl font-bold">
              {(userBalance?.total_spent || 0).toLocaleString()}
            </p>
            <p className="text-red-600 text-xs mt-1">Camlycoin</p>
          </div>
        </motion.div>

        {/* Tabs */}
        {isAdmin ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { id: 'overview', label: 'Lịch Sử', icon: History },
              { id: 'submissions', label: 'Duyệt Submissions', icon: CheckCircle2 },
              { id: 'manage', label: 'Quản Lý Balance', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl py-6 font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-xl'
                      : 'bg-white border-2 border-amber-200 text-slate-900 hover:border-amber-400'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        ) : null}

        {/* Transaction History */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
                  <History className="w-6 h-6 text-amber-500" />
                  Lịch Sử Giao Dịch
                </h3>

                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-amber-300 mx-auto mb-4" />
                    <p className="text-slate-700 font-medium">Chưa có giao dịch nào</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx, index) => {
                      const Icon = transactionIcons[tx.type] || DollarSign;
                      const isPositive = tx.amount > 0;
                      
                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white border-2 border-amber-100 rounded-2xl p-4 hover:shadow-lg transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isPositive ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                <Icon className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`} />
                              </div>
                              <div>
                                <p className="text-slate-900 font-semibold">{tx.description}</p>
                                <p className="text-xs text-slate-600">
                                  {new Date(tx.created_date).toLocaleString('vi-VN')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
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
              </div>
            </motion.div>
          )}

          {/* Admin: Submissions Review */}
          {isAdmin && activeTab === 'submissions' && (
            <motion.div
              key="submissions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm theo nhiệm vụ hoặc email..."
                      className="bg-white border-2 border-purple-300 rounded-xl"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['all', 'pending', 'approved', 'rejected'].map((status) => (
                      <Button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        variant={filterStatus === status ? 'default' : 'outline'}
                        size="sm"
                        className={filterStatus === status 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full'
                          : 'border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full'
                        }
                      >
                        {status === 'all' ? 'Tất cả' : status === 'pending' ? 'Chờ' : status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {filteredSubmissions.map((sub, index) => (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h4 className="text-slate-900 font-bold text-lg mb-2">{sub.task_title}</h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge className="bg-amber-100 text-amber-800">
                            🪙 {sub.reward_amount.toLocaleString()} Camlycoin
                          </Badge>
                          <Badge variant="outline" className={
                            sub.status === 'pending' ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                            sub.status === 'approved' ? 'border-green-400 text-green-700 bg-green-50' :
                            'border-red-400 text-red-700 bg-red-50'
                          }>
                            {sub.status === 'pending' ? '⏳ Chờ duyệt' : sub.status === 'approved' ? '✅ Đã duyệt' : '❌ Từ chối'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">
                          <strong>Người gửi:</strong> {sub.created_by}
                        </p>
                        {sub.description && (
                          <p className="text-sm text-slate-600 mb-2">{sub.description}</p>
                        )}
                        <a 
                          href={sub.proof_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          🔗 Xem bằng chứng
                        </a>
                      </div>
                      
                      {sub.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => approveSubmissionMutation.mutate(sub)}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-lg hover:shadow-xl"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Duyệt
                          </Button>
                          <Button
                            onClick={() => rejectSubmissionMutation.mutate(sub)}
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 rounded-full"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Gửi lúc: {new Date(sub.created_date).toLocaleString('vi-VN')}
                    </p>
                  </motion.div>
                ))}

                {filteredSubmissions.length === 0 && (
                  <div className="text-center py-12">
                    <Filter className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                    <p className="text-slate-700 font-medium">Không có submission nào</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Admin: Balance Management */}
          {isAdmin && activeTab === 'manage' && (
            <motion.div
              key="manage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Manual Adjustment */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-indigo-500" />
                  Điều Chỉnh Thủ Công
                </h3>
                
                <div className="space-y-4">
                  <Input
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    placeholder="Email người dùng..."
                    className="bg-white border-2 border-indigo-300 rounded-xl"
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="Số lượng (+ hoặc -)"
                      className="bg-white border-2 border-indigo-300 rounded-xl"
                    />
                    <Input
                      value={adjustDescription}
                      onChange={(e) => setAdjustDescription(e.target.value)}
                      placeholder="Lý do điều chỉnh..."
                      className="bg-white border-2 border-indigo-300 rounded-xl"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => adjustBalanceMutation.mutate({
                        email: selectedEmail,
                        amount: Math.abs(parseFloat(adjustAmount)),
                        description: adjustDescription,
                        type: 'manual_add'
                      })}
                      disabled={!selectedEmail || !adjustAmount || !adjustDescription}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Cộng Camlycoin
                    </Button>
                    <Button
                      onClick={() => adjustBalanceMutation.mutate({
                        email: selectedEmail,
                        amount: -Math.abs(parseFloat(adjustAmount)),
                        description: adjustDescription,
                        type: 'manual_deduct'
                      })}
                      disabled={!selectedEmail || !adjustAmount || !adjustDescription}
                      className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      <Minus className="w-5 h-5 mr-2" />
                      Trừ Camlycoin
                    </Button>
                  </div>
                </div>
              </div>

              {/* All Balances */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
                  <Users className="w-6 h-6 text-amber-500" />
                  Danh Sách Balance
                </h3>

                <div className="space-y-3">
                  {allBalances.map((balance, index) => (
                    <motion.div
                      key={balance.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white border-2 border-amber-100 rounded-2xl p-4 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-900 font-semibold">{balance.user_email}</p>
                          <div className="flex gap-4 mt-1 text-xs text-slate-600">
                            <span>Kiếm: {balance.total_earned.toLocaleString()}</span>
                            <span>Tiêu: {balance.total_spent.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-600">
                            {balance.balance.toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-600">Camlycoin</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {allBalances.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-amber-300 mx-auto mb-4" />
                      <p className="text-slate-700 font-medium">Chưa có balance nào</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}