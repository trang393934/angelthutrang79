import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, DollarSign, Users, Filter, Search, Plus, Minus, Loader2, Award, History, Download, X, Wallet, AlertCircle, Activity, Sparkles } from 'lucide-react';
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
  const [minBalance, setMinBalance] = useState('');
  const [maxBalance, setMaxBalance] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [modalTab, setModalTab] = useState('transactions');
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [withdrawalSearchTerm, setWithdrawalSearchTerm] = useState('');
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState('all');
  const [withdrawalDateFrom, setWithdrawalDateFrom] = useState('');
  const [withdrawalDateTo, setWithdrawalDateTo] = useState('');
  const [selectedWithdrawals, setSelectedWithdrawals] = useState([]);
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
    queryFn: () => base44.entities.CamlycoinBalance.list('-balance', 10000),
    enabled: isAdmin,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Admin: Fetch all withdrawal requests
  const { data: allWithdrawalRequests = [] } = useQuery({
    queryKey: ['all-withdrawal-requests'],
    queryFn: () => base44.entities.WithdrawalRequest.list('-created_date', 1000),
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  // Fetch selected user transactions
  const { data: selectedUserTransactions = [] } = useQuery({
    queryKey: ['selected-user-transactions', selectedUserEmail],
    queryFn: async () => {
      if (!selectedUserEmail) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: selectedUserEmail }, '-created_date', 100);
    },
    enabled: !!selectedUserEmail && isAdmin,
  });

  // Fetch selected user withdrawal requests
  const { data: selectedUserWithdrawals = [] } = useQuery({
    queryKey: ['selected-user-withdrawals', selectedUserEmail],
    queryFn: async () => {
      if (!selectedUserEmail) return [];
      return base44.entities.WithdrawalRequest.filter({ user_email: selectedUserEmail }, '-created_date', 100);
    },
    enabled: !!selectedUserEmail && isAdmin,
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
          total_spent: 0,
          paid_amount: 0,
          unpaid_amount: submission.reward_amount
        });
      } else {
        await base44.entities.CamlycoinBalance.update(userBalance.id, {
          balance: userBalance.balance + submission.reward_amount,
          total_earned: userBalance.total_earned + submission.reward_amount,
          unpaid_amount: (userBalance.unpaid_amount || 0) + submission.reward_amount
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

  // Filter balances by balance range
  const filteredBalances = allBalances.filter(balance => {
    const bal = balance.balance || 0;
    const min = minBalance ? parseFloat(minBalance) : 0;
    const max = maxBalance ? parseFloat(maxBalance) : Infinity;
    return bal >= min && bal <= max;
  });

  // Approve withdrawal mutation with auto-transfer
  const approveWithdrawalMutation = useMutation({
    mutationFn: async (request) => {
      // Update to approved status ONLY
      await base44.entities.WithdrawalRequest.update(request.id, {
        status: 'approved',
        processed_by: currentUser.email,
        processed_date: new Date().toISOString()
      });

      // Trigger auto-transfer (balance will be deducted inside the function after successful transfer)
      const transferResult = await base44.functions.invoke('autoTransferCamlycoin', {
        withdrawalRequestId: request.id
      });

      if (transferResult.data.success) {
        queryClient.invalidateQueries({ queryKey: ['all-withdrawal-requests'] });
        queryClient.invalidateQueries({ queryKey: ['all-balances'] });
        return transferResult.data;
      } else {
        throw new Error(transferResult.data.error || 'Transfer failed');
      }
    },
    onSuccess: (data) => {
      alert(`✅ Đã duyệt và chuyển tiền thành công!\n🔗 TX Hash: ${data.tx_hash}\n💰 Số tiền: ${data.amount.toLocaleString()} Camlycoin`);
    },
    onError: (error) => {
      alert('❌ Lỗi khi chuyển tiền: ' + error.message);
      queryClient.invalidateQueries({ queryKey: ['all-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-balances'] });
    }
  });

  // Reject withdrawal mutation
  const rejectWithdrawalMutation = useMutation({
    mutationFn: async ({ request, reason }) => {
      await base44.entities.WithdrawalRequest.update(request.id, {
        status: 'rejected',
        rejection_reason: reason,
        processed_by: currentUser.email,
        processed_date: new Date().toISOString()
      });

      // Send email notification
      await base44.functions.invoke('sendNotificationEmail', {
        type: 'withdrawal_rejected',
        recipient_email: request.user_email,
        data: { amount: request.amount, reason }
      }).catch(err => console.error('Email failed:', err));

      queryClient.invalidateQueries({ queryKey: ['all-withdrawal-requests'] });
    },
    onSuccess: () => {
      alert('❌ Đã từ chối yêu cầu rút tiền!');
    }
  });

  // Bulk approve withdrawals with auto-transfer
  const bulkApproveWithdrawalsMutation = useMutation({
    mutationFn: async (requests) => {
      const results = [];
      for (const req of requests) {
        try {
          // Update to approved ONLY
          await base44.entities.WithdrawalRequest.update(req.id, {
            status: 'approved',
            processed_by: currentUser.email,
            processed_date: new Date().toISOString()
          });

          // Auto-transfer (balance will be deducted inside the function after successful transfer)
          const transferResult = await base44.functions.invoke('autoTransferCamlycoin', {
            withdrawalRequestId: req.id
          });

          results.push({ 
            email: req.user_email, 
            success: transferResult.data.success,
            tx_hash: transferResult.data.tx_hash
          });
        } catch (error) {
          results.push({ 
            email: req.user_email, 
            success: false, 
            error: error.message 
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['all-withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-balances'] });
      setSelectedWithdrawals([]);
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      alert(`✅ Hoàn tất: ${successCount} thành công, ${failCount} thất bại\n\nChi tiết:\n${results.map(r => 
        `${r.email}: ${r.success ? '✅ ' + r.tx_hash : '❌ ' + r.error}`
      ).join('\n')}`);
    }
  });

  // Bulk reject withdrawals
  const bulkRejectWithdrawalsMutation = useMutation({
    mutationFn: async ({ requests, reason }) => {
      for (const req of requests) {
        await base44.entities.WithdrawalRequest.update(req.id, {
          status: 'rejected',
          rejection_reason: reason,
          processed_by: currentUser.email,
          processed_date: new Date().toISOString()
        });

        await base44.functions.invoke('sendNotificationEmail', {
          type: 'withdrawal_rejected',
          recipient_email: req.user_email,
          data: { amount: req.amount, reason }
        }).catch(err => console.error('Email failed:', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-withdrawal-requests'] });
      setSelectedWithdrawals([]);
      alert(`❌ Đã từ chối ${selectedWithdrawals.length} yêu cầu rút tiền!`);
    }
  });

  // AI Analysis function
  const runAIAnalysis = async (targetEmail = null, autoApply = false) => {
    setIsAnalyzing(true);
    try {
      const response = await base44.functions.invoke('analyzeAndRewardUsers', {
        targetUserEmail: targetEmail,
        autoApply: autoApply
      });
      
      setAiRecommendations(response.data.recommendations);
      setShowAIAnalysis(true);
      
      if (autoApply) {
        alert(`✅ Đã phân tích và tự động thưởng ${response.data.recommendations.filter(r => r.analysis.recommendation === 'bonus').length} users!`);
        queryClient.invalidateQueries({ queryKey: ['all-balances'] });
        queryClient.invalidateQueries({ queryKey: ['camlycoin-transactions'] });
      }
    } catch (error) {
      alert('❌ Lỗi khi phân tích: ' + error.message);
    }
    setIsAnalyzing(false);
  };

  // Apply AI recommendation
  const applyAIRecommendation = async (recommendation) => {
    if (recommendation.analysis.bonus_amount <= 0) {
      alert('Không có bonus để áp dụng!');
      return;
    }

    try {
      await runAIAnalysis(recommendation.user_email, true);
      alert(`✅ Đã thưởng ${recommendation.analysis.bonus_amount.toLocaleString()} Camlycoin cho ${recommendation.user_email}!`);
    } catch (error) {
      alert('❌ Lỗi: ' + error.message);
    }
  };

  // Filter withdrawal requests
  const filteredWithdrawals = allWithdrawalRequests.filter(req => {
    // Status filter
    if (withdrawalStatusFilter !== 'all' && req.status !== withdrawalStatusFilter) return false;
    
    // Search filter
    if (withdrawalSearchTerm) {
      const searchLower = withdrawalSearchTerm.toLowerCase();
      const emailMatch = req.user_email.toLowerCase().includes(searchLower);
      const addressMatch = req.withdrawal_address.toLowerCase().includes(searchLower);
      if (!emailMatch && !addressMatch) return false;
    }
    
    // Date filter
    if (withdrawalDateFrom) {
      const reqDate = new Date(req.created_date);
      const fromDate = new Date(withdrawalDateFrom);
      if (reqDate < fromDate) return false;
    }
    if (withdrawalDateTo) {
      const reqDate = new Date(req.created_date);
      const toDate = new Date(withdrawalDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (reqDate > toDate) return false;
    }
    
    return true;
  });

  // Toggle withdrawal selection
  const toggleWithdrawalSelection = (reqId) => {
    setSelectedWithdrawals(prev => 
      prev.includes(reqId) ? prev.filter(id => id !== reqId) : [...prev, reqId]
    );
  };

  // Select all filtered withdrawals
  const selectAllWithdrawals = () => {
    const pendingIds = filteredWithdrawals
      .filter(req => req.status === 'pending')
      .map(req => req.id);
    setSelectedWithdrawals(pendingIds);
  };

  // Export to CSV function
  const exportToCSV = () => {
    // Prepare balance data
    const balanceRows = allBalances.map(b => {
      const total = b.total_earned || 0;
      const available = b.available_balance || 0;
      const frozen = b.frozen_balance || 0;
      const paid = b.paid_amount || 0;
      const pending = Math.max(0, total - available - frozen - paid);
      
      return [
        b.user_email,
        (b.balance || 0),
        (b.total_earned || 0),
        available,
        pending,
        (b.paid_amount || 0),
        (b.frozen_balance || 0)
      ].join(',');
    });

    const csvContent = [
      'Email,Số Dư,Tổng Kiếm,Sẵn Sàng,Chờ Duyệt,Đã Thanh Toán,Đóng Băng',
      ...balanceRows
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `camlycoin_balances_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
        {/* Admin: Total Summary */}
        {isAdmin && (
          <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
          >
            <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              TỔNG HỢP HỆ THỐNG
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Tổng Đã Kiếm</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {allBalances.reduce((sum, b) => sum + (b.total_earned || 0), 0).toLocaleString()}
                </p>
                <p className="text-white/80 text-xs mt-1">Camlycoin</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Tổng Đã Thanh Toán</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {allBalances.reduce((sum, b) => sum + (b.paid_amount || 0), 0).toLocaleString()}
                </p>
                <p className="text-white/80 text-xs mt-1">Camlycoin</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Tổng Chưa Thanh Toán</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {(() => {
                    const totalEarned = allBalances.reduce((sum, b) => sum + (b.total_earned || 0), 0);
                    const totalPaid = allBalances.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
                    const totalFrozen = allBalances.reduce((sum, b) => sum + (b.frozen_balance || 0), 0);
                    return (totalEarned - totalPaid - totalFrozen).toLocaleString();
                  })()}
                </p>
                <p className="text-white/80 text-xs mt-1">Camlycoin</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Tổng Người Dùng</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">{allBalances.length}</p>
                <p className="text-white/80 text-xs mt-1">Users</p>
              </div>
            </div>
          </motion.div>

          {/* Chi Tiết Số Dư Tất Cả Users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
          >
            <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
              <Coins className="w-6 h-6" />
              CHI TIẾT SỐ DƯ TẤT CẢ USERS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Sẵn Sàng Thanh Toán</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {allBalances.reduce((sum, b) => sum + (b.available_balance || 0), 0).toLocaleString()}
                </p>
                <p className="text-white/80 text-xs mt-1">✅ Admin đã duyệt</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Chờ Duyệt Thanh Toán</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {(() => {
                    const totalPending = allBalances.reduce((sum, b) => {
                      const total = b.total_earned || 0;
                      const available = b.available_balance || 0;
                      const frozen = b.frozen_balance || 0;
                      const paid = b.paid_amount || 0;
                      return sum + Math.max(0, total - available - frozen - paid);
                    }, 0);
                    return totalPending.toLocaleString();
                  })()}
                </p>
                <p className="text-white/80 text-xs mt-1">⏳ Cần duyệt</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Đã Thanh Toán</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {allBalances.reduce((sum, b) => sum + (b.paid_amount || 0), 0).toLocaleString()}
                </p>
                <p className="text-white/80 text-xs mt-1">✅ Đã chuyển</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/90 text-xs font-medium mb-1">Tổng Đóng Băng</p>
                <p className="text-white text-xl md:text-2xl font-bold break-words">
                  {allBalances.reduce((sum, b) => sum + (b.frozen_balance || 0), 0).toLocaleString()}
                </p>
                <p className="text-white/80 text-xs mt-1">❄️ Spam/Duplicate</p>
              </div>
            </div>
          </motion.div>
          </>
        )}

        {/* User Balance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-3xl p-6 shadow-xl border-2 border-white">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 md:w-8 md:h-8 text-white" />
              <span className="text-white/90 text-xs md:text-sm font-medium">Số Dư Hiện Tại</span>
            </div>
            <p className="text-white text-2xl md:text-3xl font-bold break-words">
              {(userBalance?.balance || 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
              <span className="text-slate-700 text-xs md:text-sm font-medium">Đã Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-2xl md:text-3xl font-bold break-words">
              {(userBalance?.paid_amount || 0).toLocaleString()}
            </p>
            <p className="text-green-600 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-orange-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
              <span className="text-slate-700 text-xs md:text-sm font-medium">Chưa Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-2xl md:text-3xl font-bold break-words">
              {(userBalance?.unpaid_amount || 0).toLocaleString()}
            </p>
            <p className="text-orange-600 text-xs mt-1">Camlycoin</p>
          </div>
        </motion.div>

        {/* Tabs */}
        {isAdmin ? (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { id: 'overview', label: 'Lịch Sử', icon: History },
              { id: 'submissions', label: 'Duyệt Submissions', icon: CheckCircle2 },
              { id: 'withdrawals', label: 'Yêu Cầu Rút', icon: Wallet },
              { id: 'manage', label: 'Quản Lý Balance', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl py-6 font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-amber-900 shadow-2xl border-2 border-amber-500'
                      : 'bg-white border-2 border-amber-200 text-slate-900 hover:border-amber-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-2 ${activeTab === tab.id ? 'text-amber-900' : ''}`} />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {/* AI Analysis Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white text-xl font-bold mb-2 flex items-center gap-2">
                  🤖 AI Reward Analysis
                </h3>
                <p className="text-white/90 text-sm">
                  Phân tích hoạt động users và gợi ý thưởng tự động
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => runAIAnalysis(null, false)}
                  disabled={isAnalyzing}
                  className="bg-white text-indigo-600 rounded-xl font-bold shadow-lg hover:shadow-xl"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  Phân Tích Tất Cả
                </Button>
                <Button
                  onClick={() => runAIAnalysis(null, true)}
                  disabled={isAnalyzing}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Auto Thưởng
                </Button>
              </div>
            </div>
          </motion.div>
          </>
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

          {/* Admin: Withdrawal Requests */}
          {isAdmin && activeTab === 'withdrawals' && (
            <motion.div
              key="withdrawals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Filters and Search */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-6">
                <div className="space-y-4">
                  {/* Search */}
                  <div>
                    <Input
                      value={withdrawalSearchTerm}
                      onChange={(e) => setWithdrawalSearchTerm(e.target.value)}
                      placeholder="🔍 Tìm kiếm theo email hoặc địa chỉ ví..."
                      className="bg-white border-2 border-amber-300 rounded-xl"
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="flex flex-wrap gap-2">
                    {['all', 'pending', 'approved', 'processing', 'completed', 'rejected', 'failed'].map((status) => (
                      <Button
                        key={status}
                        onClick={() => setWithdrawalStatusFilter(status)}
                        size="sm"
                        className={withdrawalStatusFilter === status 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full'
                          : 'bg-white border-2 border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full'
                        }
                      >
                        {status === 'all' ? 'Tất cả' : 
                         status === 'pending' ? '⏳ Chờ duyệt' :
                         status === 'approved' ? '✅ Đã duyệt' :
                         status === 'processing' ? '🔄 Đang xử lý' :
                         status === 'completed' ? '✅ Hoàn tất' :
                         status === 'rejected' ? '❌ Từ chối' : '❌ Thất bại'}
                      </Button>
                    ))}
                  </div>

                  {/* Date Range Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-700 text-sm font-semibold mb-2 block">Từ ngày</label>
                      <Input
                        type="date"
                        value={withdrawalDateFrom}
                        onChange={(e) => setWithdrawalDateFrom(e.target.value)}
                        className="bg-white border-2 border-amber-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 text-sm font-semibold mb-2 block">Đến ngày</label>
                      <Input
                        type="date"
                        value={withdrawalDateTo}
                        onChange={(e) => setWithdrawalDateTo(e.target.value)}
                        className="bg-white border-2 border-amber-300 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Results count */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-700">
                      Hiển thị <strong>{filteredWithdrawals.length}</strong> / {allWithdrawalRequests.length} yêu cầu
                      {selectedWithdrawals.length > 0 && (
                        <> • <strong className="text-purple-600">{selectedWithdrawals.length}</strong> đã chọn</>
                      )}
                    </p>
                    {filteredWithdrawals.filter(r => r.status === 'pending').length > 0 && (
                      <Button
                        onClick={selectAllWithdrawals}
                        size="sm"
                        variant="outline"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 rounded-lg"
                      >
                        Chọn tất cả pending
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk Actions */}
              <AnimatePresence>
                {selectedWithdrawals.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white text-lg font-bold mb-1">
                          Hành Động Hàng Loạt
                        </h3>
                        <p className="text-white/90 text-sm">
                          {selectedWithdrawals.length} yêu cầu đã chọn
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            const selectedReqs = allWithdrawalRequests.filter(r => selectedWithdrawals.includes(r.id));
                            bulkApproveWithdrawalsMutation.mutate(selectedReqs);
                          }}
                          disabled={bulkApproveWithdrawalsMutation.isPending}
                          className="bg-white text-green-600 rounded-xl font-bold shadow-lg hover:shadow-xl"
                        >
                          {bulkApproveWithdrawalsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Duyệt Tất Cả
                        </Button>
                        <Button
                          onClick={() => {
                            const reason = prompt('Lý do từ chối hàng loạt:');
                            if (reason) {
                              const selectedReqs = allWithdrawalRequests.filter(r => selectedWithdrawals.includes(r.id));
                              bulkRejectWithdrawalsMutation.mutate({ requests: selectedReqs, reason });
                            }
                          }}
                          disabled={bulkRejectWithdrawalsMutation.isPending}
                          className="bg-white text-red-600 rounded-xl font-bold shadow-lg hover:shadow-xl"
                        >
                          {bulkRejectWithdrawalsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-2" />
                          )}
                          Từ Chối Tất Cả
                        </Button>
                        <Button
                          onClick={() => setSelectedWithdrawals([])}
                          variant="outline"
                          className="bg-white/20 text-white border-white/50 rounded-xl font-bold hover:bg-white/30"
                        >
                          Bỏ Chọn
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-amber-500" />
                  Yêu Cầu Rút Tiền ({filteredWithdrawals.filter(r => r.status === 'pending').length} chờ duyệt)
                </h3>

                {filteredWithdrawals.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 text-amber-300 mx-auto mb-4" />
                    <p className="text-slate-700 font-medium">Không tìm thấy yêu cầu rút tiền nào</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredWithdrawals.map((req, index) => {
                      const statusConfigs = {
                        pending: { label: '⏳ Chờ Duyệt', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                        approved: { label: '✅ Đã Duyệt', className: 'bg-green-100 text-green-800 border-green-300' },
                        processing: { label: '🔄 Đang Xử Lý', className: 'bg-blue-100 text-blue-800 border-blue-300' },
                        completed: { label: '✅ Hoàn Tất', className: 'bg-green-100 text-green-800 border-green-300' },
                        rejected: { label: '❌ Từ Chối', className: 'bg-red-100 text-red-800 border-red-300' },
                        failed: { label: '❌ Thất Bại', className: 'bg-red-100 text-red-800 border-red-300' }
                      };
                      const statusConfig = statusConfigs[req.status] || statusConfigs.pending;

                      return (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`bg-white border-2 rounded-2xl p-5 transition-all ${
                            selectedWithdrawals.includes(req.id) 
                              ? 'border-purple-400 bg-purple-50' 
                              : 'border-amber-100'
                          }`}
                        >
                          <div className="flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                              {req.status === 'pending' && (
                                <input
                                  type="checkbox"
                                  checked={selectedWithdrawals.includes(req.id)}
                                  onChange={() => toggleWithdrawalSelection(req.id)}
                                  className="mt-1 mr-3 w-5 h-5 rounded border-2 border-purple-400 text-purple-600 focus:ring-purple-500 cursor-pointer flex-shrink-0"
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <Badge className={`border ${statusConfig.className}`}>
                                    {statusConfig.label}
                                  </Badge>
                                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold">
                                    🪙 {req.amount.toLocaleString()} Camlycoin
                                  </Badge>
                                </div>
                                <p className="text-slate-900 font-semibold mb-2">
                                  {req.user_email}
                                </p>
                                <p className="text-slate-700 text-sm mb-2 break-all">
                                  <strong>Địa chỉ ví:</strong> {req.withdrawal_address}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Tạo: {new Date(req.created_date).toLocaleString('vi-VN')}
                                </p>
                                {req.processed_date && (
                                  <p className="text-xs text-green-600 mt-1">
                                    Xử lý: {new Date(req.processed_date).toLocaleString('vi-VN')} • {req.processed_by}
                                  </p>
                                )}
                                {req.rejection_reason && (
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                                    <p className="text-red-800 text-xs">
                                      <strong>Lý do từ chối:</strong> {req.rejection_reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {req.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => approveWithdrawalMutation.mutate(req)}
                                  disabled={approveWithdrawalMutation.isPending}
                                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                                >
                                  {approveWithdrawalMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                  )}
                                  Duyệt Rút Tiền
                                </Button>
                                <Button
                                  onClick={() => {
                                    const reason = prompt('Lý do từ chối:');
                                    if (reason) {
                                      rejectWithdrawalMutation.mutate({ request: req, reason });
                                    }
                                  }}
                                  disabled={rejectWithdrawalMutation.isPending}
                                  variant="outline"
                                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50 rounded-xl font-bold"
                                >
                                  {rejectWithdrawalMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Từ Chối
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
                    <Users className="w-6 h-6 text-amber-500" />
                    Danh Sách Balance
                  </h3>
                  <Button
                    onClick={exportToCSV}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Balance Filter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Input
                    type="number"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    placeholder="Số dư tối thiểu..."
                    className="bg-white border-2 border-amber-300 rounded-xl"
                  />
                  <Input
                    type="number"
                    value={maxBalance}
                    onChange={(e) => setMaxBalance(e.target.value)}
                    placeholder="Số dư tối đa..."
                    className="bg-white border-2 border-amber-300 rounded-xl"
                  />
                </div>

                <p className="text-sm text-slate-700 mb-4">
                  Hiển thị <strong>{filteredBalances.length}</strong> / {allBalances.length} users
                </p>

                <div className="space-y-3">
                  {filteredBalances.map((balance, index) => (
                    <motion.div
                      key={balance.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white border-2 border-amber-100 rounded-2xl p-4 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-slate-900 font-semibold">{balance.user_email}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              ✅ Đã TT: {(balance.paid_amount || 0).toLocaleString()}
                            </Badge>
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              ⏳ Sẵn Sàng: {(balance.available_balance || 0).toLocaleString()}
                            </Badge>
                            <Badge className="bg-orange-100 text-orange-800 text-xs">
                              🕐 Chờ: {(() => {
                                const total = balance.total_earned || 0;
                                const available = balance.available_balance || 0;
                                const frozen = balance.frozen_balance || 0;
                                const paid = balance.paid_amount || 0;
                                return Math.max(0, total - available - frozen - paid).toLocaleString();
                              })()}
                            </Badge>
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              ❄️ Đóng: {(balance.frozen_balance || 0).toLocaleString()}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right flex gap-2">
                          <div>
                            <p className="text-2xl font-bold text-amber-600">
                              {balance.balance.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-600">Số dư</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              onClick={() => window.location.href = createPageUrl('UserProfile') + `?email=${encodeURIComponent(balance.user_email)}`}
                              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-xs h-7"
                            >
                              Hồ Sơ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUserEmail(balance.user_email);
                                setShowTransactionsModal(true);
                                setModalTab('transactions');
                              }}
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg text-xs h-7"
                            >
                              <History className="w-3 h-3 mr-1" />
                              Chi Tiết
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {filteredBalances.length === 0 && (
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

        {/* Transactions Modal */}
        <AnimatePresence>
          {showTransactionsModal && selectedUserEmail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => {
                setShowTransactionsModal(false);
                setSelectedUserEmail(null);
                setModalTab('transactions');
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl my-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-slate-900 text-2xl font-bold">Chi Tiết User</h3>
                    <p className="text-slate-600 text-sm mt-1">{selectedUserEmail}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowTransactionsModal(false);
                      setSelectedUserEmail(null);
                      setModalTab('transactions');
                    }}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <Button
                    onClick={() => setModalTab('transactions')}
                    className={`rounded-xl py-3 font-bold ${
                      modalTab === 'transactions'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                    }`}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Giao Dịch ({selectedUserTransactions.length})
                  </Button>
                  <Button
                    onClick={() => setModalTab('withdrawals')}
                    className={`rounded-xl py-3 font-bold ${
                      modalTab === 'withdrawals'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                        : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                    }`}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Yêu Cầu Rút ({selectedUserWithdrawals.length})
                  </Button>
                </div>

                {/* Transactions Tab */}
                {modalTab === 'transactions' && (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {selectedUserTransactions.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-amber-300 mx-auto mb-4" />
                        <p className="text-slate-700 font-medium">Chưa có giao dịch nào</p>
                      </div>
                    ) : (
                      selectedUserTransactions.map((tx, index) => {
                        const Icon = transactionIcons[tx.type] || DollarSign;
                        const isPositive = tx.amount > 0;
                        
                        return (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="bg-white border-2 border-amber-100 rounded-2xl p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isPositive ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                  <Icon className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-slate-900 font-semibold break-words">{tx.description}</p>
                                  <p className="text-xs text-slate-600">
                                    {new Date(tx.created_date).toLocaleString('vi-VN')}
                                  </p>
                                  {tx.processed_by && (
                                    <p className="text-xs text-purple-600">
                                      Bởi: {tx.processed_by}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-4 flex-shrink-0">
                                <p className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-600">Camlycoin</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Withdrawals Tab */}
                {modalTab === 'withdrawals' && (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {selectedUserWithdrawals.length === 0 ? (
                      <div className="text-center py-12">
                        <Wallet className="w-12 h-12 text-amber-300 mx-auto mb-4" />
                        <p className="text-slate-700 font-medium">Chưa có yêu cầu rút tiền nào</p>
                      </div>
                    ) : (
                      selectedUserWithdrawals.map((req, index) => {
                        const statusConfigs = {
                          pending: { label: '⏳ Chờ Duyệt', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                          approved: { label: '✅ Đã Duyệt', className: 'bg-green-100 text-green-800 border-green-300' },
                          processing: { label: '🔄 Đang Xử Lý', className: 'bg-blue-100 text-blue-800 border-blue-300' },
                          completed: { label: '✅ Hoàn Tất', className: 'bg-green-100 text-green-800 border-green-300' },
                          rejected: { label: '❌ Từ Chối', className: 'bg-red-100 text-red-800 border-red-300' },
                          failed: { label: '❌ Thất Bại', className: 'bg-red-100 text-red-800 border-red-300' }
                        };
                        const statusConfig = statusConfigs[req.status] || statusConfigs.pending;

                        return (
                          <motion.div
                            key={req.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="bg-white border-2 border-amber-100 rounded-2xl p-5"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <Badge className={`border ${statusConfig.className}`}>
                                    {statusConfig.label}
                                  </Badge>
                                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold">
                                    🪙 {req.amount.toLocaleString()} Camlycoin
                                  </Badge>
                                </div>
                                <p className="text-slate-700 text-sm mb-2 break-all">
                                  <strong>Địa chỉ ví:</strong> {req.withdrawal_address}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Tạo: {new Date(req.created_date).toLocaleString('vi-VN')}
                                </p>
                                {req.processed_date && (
                                  <p className="text-xs text-green-600 mt-1">
                                    Xử lý: {new Date(req.processed_date).toLocaleString('vi-VN')} • {req.processed_by}
                                  </p>
                                )}
                                {req.rejection_reason && (
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                                    <p className="text-red-800 text-xs">
                                      <strong>Lý do:</strong> {req.rejection_reason}
                                    </p>
                                  </div>
                                )}
                                {req.tx_hash && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-2">
                                    <p className="text-green-800 text-xs break-all">
                                      <strong>TX Hash:</strong> {req.tx_hash}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {req.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    approveWithdrawalMutation.mutate(req);
                                  }}
                                  disabled={approveWithdrawalMutation.isPending}
                                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                                >
                                  {approveWithdrawalMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                  )}
                                  Duyệt
                                </Button>
                                <Button
                                  onClick={() => {
                                    const reason = prompt('Lý do từ chối:');
                                    if (reason) {
                                      rejectWithdrawalMutation.mutate({ request: req, reason });
                                    }
                                  }}
                                  disabled={rejectWithdrawalMutation.isPending}
                                  variant="outline"
                                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50 rounded-xl font-bold"
                                >
                                  {rejectWithdrawalMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                  )}
                                  Từ Chối
                                </Button>
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Analysis Modal */}
        <AnimatePresence>
          {showAIAnalysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowAIAnalysis(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-8 max-w-6xl w-full shadow-2xl my-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-slate-900 text-2xl font-bold flex items-center gap-2">
                      🤖 AI Reward Analysis
                    </h3>
                    <p className="text-slate-600 text-sm mt-1">
                      {aiRecommendations.length} users được phân tích
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAIAnalysis(false)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {aiRecommendations.map((rec, index) => {
                    const recommendationColors = {
                      bonus: 'from-green-500 to-emerald-500',
                      watch: 'from-yellow-500 to-orange-500',
                      normal: 'from-blue-500 to-indigo-500',
                      freeze: 'from-red-500 to-rose-500'
                    };
                    const riskColors = {
                      low: 'bg-green-100 text-green-800 border-green-300',
                      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                      high: 'bg-red-100 text-red-800 border-red-300'
                    };

                    return (
                      <motion.div
                        key={rec.user_email}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white border-2 border-purple-200 rounded-2xl p-5"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <p className="text-slate-900 font-bold">{rec.user_email}</p>
                              <Badge className={`bg-gradient-to-r ${recommendationColors[rec.analysis.recommendation]} text-white border-0`}>
                                {rec.analysis.recommendation.toUpperCase()}
                              </Badge>
                              <Badge className={riskColors[rec.analysis.risk_level]}>
                                Risk: {rec.analysis.risk_level}
                              </Badge>
                              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">
                                Quality: {rec.analysis.quality_score}/10
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                              <div className="bg-purple-50 rounded-lg p-2">
                                <p className="text-purple-600 font-semibold">Earned</p>
                                <p className="text-purple-900 font-bold">{rec.current_metrics.total_earned.toLocaleString()}</p>
                              </div>
                              <div className="bg-amber-50 rounded-lg p-2">
                                <p className="text-amber-600 font-semibold">Streak</p>
                                <p className="text-amber-900 font-bold">{rec.current_metrics.streak_days} days</p>
                              </div>
                              <div className="bg-green-50 rounded-lg p-2">
                                <p className="text-green-600 font-semibold">Quality</p>
                                <p className="text-green-900 font-bold">{rec.current_metrics.quality_feedback}</p>
                              </div>
                              <div className="bg-red-50 rounded-lg p-2">
                                <p className="text-red-600 font-semibold">Frozen</p>
                                <p className="text-red-900 font-bold">{rec.current_metrics.frozen_balance.toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
                              <p className="text-slate-700 text-sm">
                                <strong>AI Reason:</strong> {rec.analysis.reason}
                              </p>
                            </div>

                            {rec.analysis.suggested_actions && rec.analysis.suggested_actions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {rec.analysis.suggested_actions.map((action, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    💡 {action}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {rec.analysis.bonus_amount > 0 && (
                          <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                            <div>
                              <p className="text-green-900 font-bold text-lg">
                                Bonus: {rec.analysis.bonus_amount.toLocaleString()} Camlycoin
                              </p>
                            </div>
                            <Button
                              onClick={() => applyAIRecommendation(rec)}
                              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Áp Dụng Thưởng
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}