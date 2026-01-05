import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Coins, Wallet, TrendingUp, TrendingDown, Clock, History, Copy, Check, Camera, Loader2, CheckCircle2, DollarSign, X, Activity, Lock, Eye, RefreshCw, XCircle, AlertCircle, Gift, Trophy, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { AnimatePresence } from 'framer-motion';
import LevelProgressCard from '@/components/LevelProgressCard';

// My Rank Component
function MyRankCard({ targetEmail }) {
  const { data: allBalances = [] } = useQuery({
    queryKey: ['rank-balances'],
    queryFn: () => base44.entities.CamlycoinBalance.list('-total_earned', 10000),
  });

  const rankedUsers = allBalances
    .filter(b => (b.total_earned || 0) > 0)
    .sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0))
    .map((user, index) => ({ ...user, rank: index + 1 }));

  const myData = rankedUsers.find(u => u.user_email === targetEmail);

  if (!myData) return null;

  const getRankColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-amber-500';
    if (rank === 2) return 'from-gray-300 to-gray-400';
    if (rank === 3) return 'from-amber-500 to-orange-500';
    return 'from-purple-400 to-pink-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRankColor(myData.rank)} flex items-center justify-center shadow-lg`}>
            {myData.rank <= 3 ? (
              <Trophy className="w-8 h-8 text-white" />
            ) : (
              <Award className="w-8 h-8 text-white" />
            )}
          </div>
          <div>
            <p className="text-white/90 text-sm mb-1">Xếp Hạng Toàn Hệ Thống</p>
            <p className="text-white text-4xl font-bold">#{myData.rank}</p>
            <p className="text-white/90 text-xs mt-1">trong {rankedUsers.length} users</p>
          </div>
        </div>
        <Link to={createPageUrl('Leaderboard')}>
          <Button className="bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 shadow-lg">
            <Trophy className="w-4 h-4 mr-2" />
            Xem Bảng XH
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function UserProfile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEliminatedModal, setShowEliminatedModal] = useState(false);
  const [showPendingReviewModal, setShowPendingReviewModal] = useState(false);
  const [aiAnalysisResults, setAiAnalysisResults] = useState({});
  const [analyzingQuestions, setAnalyzingQuestions] = useState(new Set());
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
    
    // Get email from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    if (email) {
      setTargetEmail(email);
      // Fetch target user info
      base44.entities.User.filter({ email: email }).then(users => {
        if (users.length > 0) {
          setTargetUser(users[0]);
        }
      });
    }
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch target user's balance
  const { data: userBalance } = useQuery({
    queryKey: ['user-balance', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: targetEmail });
      return balances[0] || { balance: 0, total_earned: 0, total_spent: 0 };
    },
    enabled: !!targetEmail,
  });

  // Fetch target user's transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['user-transactions', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: targetEmail }, '-created_date', 20);
    },
    enabled: !!targetEmail,
  });

  // Fetch ALL audit logs của user (bao gồm cả valid để hiển thị toàn bộ lịch sử)
  const { data: allUserLogs = [], isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['all-user-audit-logs', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      
      // Admin: fetch tất cả audit logs
      if (isAdmin) {
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-question_date', 10000);
        const userLogs = allLogs.filter(log => log.user_email === targetEmail);
        
        console.log('Total audit logs for', targetEmail, ':', userLogs.length);
        console.log('Breakdown:', {
          valid: userLogs.filter(l => l.exclusion_reason === 'valid').length,
          duplicate: userLogs.filter(l => l.exclusion_reason === 'duplicate').length,
          greeting: userLogs.filter(l => l.exclusion_reason === 'greeting').length,
          exceeds_limit: userLogs.filter(l => l.exclusion_reason === 'exceeds_daily_limit').length
        });
        
        return userLogs;
      }
      
      // Regular user: không hiển thị audit logs
      return [];
    },
    enabled: !!targetEmail,
    staleTime: 0,
    cacheTime: 0
  });

  // Phân loại logs
  const eliminatedLogs = allUserLogs.filter(log => 
    log.exclusion_reason !== 'valid' && log.coin_category === 'frozen'
  );
  const validLogs = allUserLogs.filter(log => log.exclusion_reason === 'valid');
  const pendingReviewLogs = allUserLogs.filter(log => 
    log.coin_category === 'pending_review' || log.exclusion_reason === 'exceeds_daily_limit'
  );

  // Fetch user level
  const { data: userLevel } = useQuery({
    queryKey: ['user-level', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return null;
      const levels = await base44.entities.UserLevel.filter({ user_email: targetEmail });
      if (levels.length > 0) return levels[0];
      
      // Auto-create if not exists (admin only)
      if (isAdmin) {
        await base44.functions.invoke('updateUserLevel', { userEmail: targetEmail });
        const newLevels = await base44.entities.UserLevel.filter({ user_email: targetEmail });
        return newLevels[0] || null;
      }
      
      return null;
    },
    enabled: !!targetEmail,
  });

  // Fetch wallet address from multiple sources
  const { data: submissions = [] } = useQuery({
    queryKey: ['user-submissions', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      const allSubmissions = await base44.entities.BountySubmission.list();
      return allSubmissions.filter(sub => sub.created_by === targetEmail);
    },
    enabled: !!targetEmail && !!isAdmin,
  });

  const { data: withdrawalRequests = [] } = useQuery({
    queryKey: ['user-withdrawals', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      const allWithdrawals = await base44.entities.WithdrawalRequest.list();
      return allWithdrawals.filter(req => req.user_email === targetEmail);
    },
    enabled: !!targetEmail && !!isAdmin,
  });

  // Try to get wallet from submissions first, then from withdrawal requests
  const walletAddress = submissions.length > 0 
    ? submissions[0].wallet_address 
    : withdrawalRequests.length > 0 
    ? withdrawalRequests[0].withdrawal_address 
    : null;

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  // Approve percentage mutation - SỬA LẠI DÙNG UNPAID_AMOUNT
  const approvePercentageMutation = useMutation({
    mutationFn: async (percentage) => {
      if (!userBalance) return;
      
      const unpaidAmount = userBalance.unpaid_amount || 0;
      
      if (unpaidAmount <= 0) return;

      const approveAmount = Math.floor(unpaidAmount * percentage / 100);
      
      await base44.entities.CamlycoinBalance.update(userBalance.id, {
        unpaid_amount: unpaidAmount - approveAmount,
        available_balance: (userBalance.available_balance || 0) + approveAmount
      });

      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt ${percentage}% (${approveAmount.toLocaleString()}/${unpaidAmount.toLocaleString()}) Camlycoin → Sẵn Sàng Thanh Toán`,
        processed_by: currentUser.email
      });

      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
    },
    onSuccess: () => {
      alert('✅ Đã duyệt thanh toán!');
    }
  });



  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (amount) => {
      if (!userBalance) return;
      
      const paidAmount = parseFloat(amount);
      const currentAvailable = userBalance.available_balance || 0;
      const currentPaid = userBalance.paid_amount || 0;
      const currentBalance = userBalance.balance || 0;
      
      if (paidAmount > currentAvailable) {
        alert('Số tiền thanh toán không được lớn hơn số Sẵn Sàng Thanh Toán!');
        return;
      }
      
      // Reset available về 0 sau khi thanh toán, trừ balance
      await base44.entities.CamlycoinBalance.update(userBalance.id, {
        paid_amount: currentPaid + paidAmount,
        available_balance: 0,
        balance: currentBalance - paidAmount
      });
      
      // Create transaction record
      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin đã chuyển khoản ${paidAmount.toLocaleString()} Camlycoin (Ngày ${new Date().getDate()}/${new Date().getMonth() + 1})`,
        processed_by: currentUser.email
      });

      // Send email notification to user
      await base44.functions.invoke('sendNotificationEmail', {
        type: 'payment_processed',
        recipient_email: targetEmail,
        data: {
          amount: paidAmount
        }
      }).catch(err => console.error('Email notification failed:', err));

      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      setShowPaymentModal(false);
      setPaymentAmount('');
      }
  });

  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('comprehensiveAudit', {
        targetUserEmail: targetEmail,
        batchSize: 1
      });
      return result.data;
    },
    onSuccess: () => {
      alert('✅ Audit hoàn tất! Đang tải lại dữ liệu...');
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['eliminated-logs'] });
    },
    onError: (error) => {
      alert('❌ Lỗi khi chạy audit: ' + error.message);
    }
  });

  // Approve pending review question mutation
  const approvePendingReviewMutation = useMutation({
    mutationFn: async (logId) => {
      const log = pendingReviewLogs.find(l => l.id === logId);
      if (!log) return;

      // Move coins to available_balance
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: targetEmail });
      if (balances.length > 0) {
        const balance = balances[0];
        const currentAvailable = balance.available_balance || 0;
        const currentPending = balance.pending_review_balance || 0;

        await base44.entities.CamlycoinBalance.update(balance.id, {
          pending_review_balance: Math.max(0, currentPending - log.coins_earned),
          available_balance: currentAvailable + log.coins_earned
        });
      }

      // Update log
      await base44.entities.QuestionAuditLog.update(logId, {
        coin_category: 'pending_withdrawal',
        exclusion_reason: 'valid'
      });

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt câu chờ review: "${log.question_text.substring(0, 50)}..."\n💰 +${log.coins_earned} → Available`,
        processed_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
    }
  });

  // Reject pending review question mutation
  const rejectPendingReviewMutation = useMutation({
    mutationFn: async (logId) => {
      const log = pendingReviewLogs.find(l => l.id === logId);
      if (!log) return;

      // Move to frozen
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: targetEmail });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          pending_review_balance: Math.max(0, (balance.pending_review_balance || 0) - log.coins_earned),
          frozen_balance: (balance.frozen_balance || 0) + log.coins_earned
        });
      }

      await base44.entities.QuestionAuditLog.update(logId, {
        coin_category: 'frozen'
      });

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `❌ Admin từ chối câu chờ review: "${log.question_text.substring(0, 50)}..."\n💰 ${log.coins_earned} → Frozen`,
        processed_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
    }
  });

  // Approve eliminated question mutation
  const approveEliminatedMutation = useMutation({
    mutationFn: async (logId) => {
      const log = eliminatedLogs.find(l => l.id === logId);
      if (!log) return;

      // Move coins to available_balance
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: targetEmail });
      if (balances.length > 0) {
        const balance = balances[0];
        const currentAvailable = balance.available_balance || 0;
        const currentFrozen = balance.frozen_balance || 0;
        const currentPending = balance.pending_review_balance || 0;

        if (log.coin_category === 'frozen') {
          await base44.entities.CamlycoinBalance.update(balance.id, {
            frozen_balance: Math.max(0, currentFrozen - log.coins_earned),
            available_balance: currentAvailable + log.coins_earned
          });
        } else if (log.coin_category === 'pending_review') {
          await base44.entities.CamlycoinBalance.update(balance.id, {
            pending_review_balance: Math.max(0, currentPending - log.coins_earned),
            available_balance: currentAvailable + log.coins_earned
          });
        }
      }

      // Update log
      await base44.entities.QuestionAuditLog.update(logId, {
        coin_category: 'pending_withdrawal',
        exclusion_reason: 'valid'
      });

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt câu đã loại bỏ: "${log.question_text.substring(0, 50)}..."\n💰 +${log.coins_earned} → Available`,
        processed_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      alert('✅ Đã duyệt thưởng câu hỏi!');
    }
  });

  // Reject eliminated question mutation
  const rejectEliminatedMutation = useMutation({
    mutationFn: async (logId) => {
      const log = eliminatedLogs.find(l => l.id === logId);
      if (!log) return;

      // If pending_review, move to frozen
      if (log.coin_category === 'pending_review') {
        const balances = await base44.entities.CamlycoinBalance.filter({ user_email: targetEmail });
        if (balances.length > 0) {
          const balance = balances[0];
          await base44.entities.CamlycoinBalance.update(balance.id, {
            pending_review_balance: Math.max(0, (balance.pending_review_balance || 0) - log.coins_earned),
            frozen_balance: (balance.frozen_balance || 0) + log.coins_earned
          });
        }

        await base44.entities.QuestionAuditLog.update(logId, {
          coin_category: 'frozen'
        });
      }

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `❌ Admin từ chối câu đã loại bỏ: "${log.question_text.substring(0, 50)}..."\n💰 ${log.coins_earned} → Frozen`,
        processed_by: currentUser.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['eliminated-logs'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      alert('❌ Đã từ chối câu hỏi!');
    }
  });

  // AI Analysis for questions
  const analyzeQuestionWithAI = async (log) => {
    const logId = log.id;
    if (analyzingQuestions.has(logId)) return;

    setAnalyzingQuestions(prev => new Set(prev).add(logId));

    try {
      // Lấy các câu hỏi khác của user để so sánh
      const otherQuestions = allUserLogs
        .filter(l => l.id !== logId)
        .slice(0, 20)
        .map(l => l.question_text);

      const prompt = `Phân tích câu hỏi sau và đưa ra đề xuất:

CÂU HỎI: "${log.question_text}"

THÔNG TIN:
- Ngày hỏi: ${new Date(log.question_date).toLocaleDateString('vi-VN')}
- Câu thứ: ${log.question_number_in_day} trong ngày
- Coins: ${log.coins_earned}
- Phân loại hiện tại: ${log.exclusion_reason}
${log.similar_to_question ? `- Tương tự câu: "${log.similar_to_question}" (${((log.similarity_score || 0) * 100).toFixed(0)}%)` : ''}

CÁC CÂU HỎI KHÁC CỦA USER:
${otherQuestions.slice(0, 10).map((q, i) => `${i + 1}. "${q}"`).join('\n')}

YÊU CẦU:
1. Phân tích xem câu hỏi có phải là:
   - Trùng lặp/tương tự với câu khác? (confidence: 0-100%)
   - Chào hỏi/xã giao không có nội dung? (confidence: 0-100%)
   - Spam/câu hỏi chất lượng thấp? (confidence: 0-100%)
   - Hợp lệ và có giá trị? (confidence: 0-100%)

2. Đề xuất hành động: "approve" (duyệt thưởng), "reject" (từ chối/frozen), hoặc "review" (cần xem xét thêm)

3. Lý do chi tiết cho đề xuất

Trả về JSON:`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            is_duplicate: { type: "boolean" },
            duplicate_confidence: { type: "number" },
            is_greeting: { type: "boolean" },
            greeting_confidence: { type: "number" },
            is_spam: { type: "boolean" },
            spam_confidence: { type: "number" },
            is_valid: { type: "boolean" },
            valid_confidence: { type: "number" },
            recommendation: { type: "string" },
            reason: { type: "string" },
            similar_questions: { 
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setAiAnalysisResults(prev => ({
        ...prev,
        [logId]: result
      }));
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setAnalyzingQuestions(prev => {
        const next = new Set(prev);
        next.delete(logId);
        return next;
      });
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh!');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa 5MB!');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      
      // Refresh user data
      const updatedUser = await base44.auth.me();
      setCurrentUser(updatedUser);
    } catch (error) {
      alert('Lỗi khi upload ảnh. Vui lòng thử lại!');
    }
    setIsUploadingAvatar(false);
  };



  if (!targetEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Không tìm thấy email người dùng</p>
          <Link to={createPageUrl('RewardsManagement')}>
            <Button className="mt-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full">
              Quay lại
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
            <Link to={createPageUrl('RewardsManagement')}>
              <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-900 hover:bg-amber-100">
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
                className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center"
              >
                <User className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Hồ Sơ Người Dùng</h1>
                <p className="text-amber-600 text-xs font-medium">User Profile</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              {targetUser?.avatar_url ? (
                <img
                  src={targetUser.avatar_url}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-amber-400"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}

              {/* Upload button - only show for own profile */}
              {currentUser?.email === targetEmail && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-slate-900 font-bold text-2xl break-all">{targetEmail}</h2>
              <Badge className="bg-amber-100 text-amber-800 mt-2">
                Người Dùng
              </Badge>
            </div>
          </div>

          {/* Wallet Address - Prominent Display */}
          {walletAddress ? (
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 border-2 border-white rounded-2xl p-5 shadow-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-6 h-6 text-white" />
                <span className="text-white font-bold text-lg">Địa Chỉ Ví Web3 (BEP-20)</span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-3 mb-3">
                <p className="text-white font-mono text-sm break-all">{walletAddress}</p>
              </div>
              <Button
                onClick={copyWalletAddress}
                className="w-full bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50"
              >
                {copiedWallet ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Đã Copy!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    Copy Địa Chỉ Ví
                  </>
                )}
              </Button>
              <p className="text-white/90 text-xs mt-3 text-center">
                💡 Sử dụng địa chỉ này để chuyển Camlycoin thưởng
              </p>
            </motion.div>
          ) : (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-orange-600" />
                <span className="text-orange-900 font-semibold">Chưa Có Địa Chỉ Ví</span>
              </div>
              <p className="text-orange-800 text-sm">
                Người dùng chưa cung cấp địa chỉ ví Web3. Yêu cầu họ submit bounty hoặc tạo withdrawal request.
              </p>
            </div>
          )}
        </motion.div>

        {/* My Rank Card */}
        <MyRankCard targetEmail={targetEmail} />

        {/* Level Progress */}
        {userLevel && (
          <LevelProgressCard userLevel={userLevel} />
        )}

        {/* Balance Overview - CHÍNH XÁC TUYỆT ĐỐI */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        >
          {/* Tổng Đã Kiếm - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-xl border-2 border-white">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-white" />
              <span className="text-white/90 text-xs font-medium">Tổng Đã Kiếm</span>
            </div>
            <p className="text-white text-3xl font-bold break-words">
              {(userBalance?.total_earned || 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>

          {/* Sẵn Sàng Thanh Toán - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-300 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-amber-500" />
              <span className="text-slate-700 text-xs font-medium">Sẵn Sàng Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.available_balance || 0).toLocaleString()}
            </p>
            <p className="text-amber-600 text-xs mt-1">⏳ Admin sẽ thanh toán ngày 1/10/20</p>
          </div>

          {/* Chờ Duyệt Thanh Toán - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-orange-300 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-orange-500" />
              <span className="text-slate-700 text-xs font-medium">Chờ Duyệt Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.unpaid_amount || 0).toLocaleString()}
            </p>
            <p className="text-orange-600 text-xs mt-1">⏳ Cần admin duyệt</p>
            
            {/* Quick Approve Buttons - 20%, 30%, 50%, 70%, 100% - ADMIN ONLY */}
            {isAdmin && (userBalance?.unpaid_amount || 0) > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[20, 30, 50, 70, 100].map(percent => (
                  <Button
                    key={percent}
                    onClick={() => approvePercentageMutation.mutate(percent)}
                    disabled={approvePercentageMutation.isPending}
                    size="sm"
                    className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg shadow-md hover:shadow-lg font-bold text-xs"
                  >
                    Duyệt {percent}%
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Tổng Đã Thanh Toán - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <span className="text-slate-700 text-xs font-medium">Tổng Đã Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.paid_amount || 0).toLocaleString()}
            </p>
            <p className="text-green-600 text-xs mt-1">✅ Admin đã chuyển</p>
          </div>

          {/* Chờ Admin Review - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-orange-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-6 h-6 text-orange-500" />
              <span className="text-slate-700 text-xs font-medium">Chờ Admin Review</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.pending_review_balance || 0).toLocaleString()}
            </p>
            <p className="text-orange-600 text-xs mt-1">🔍 Câu 11+ mỗi ngày</p>

            {/* Button Xem Danh Sách - ADMIN ONLY */}
            {isAdmin && (userBalance?.pending_review_balance || 0) > 0 && (
              <Button
                onClick={() => setShowPendingReviewModal(true)}
                size="sm"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg shadow-md hover:shadow-lg font-bold text-xs mt-3"
              >
                Xem Danh Sách ({pendingReviewLogs.length} câu)
              </Button>
            )}
          </div>

          {/* Tổng Bị Đóng Băng - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-red-300 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-6 h-6 text-red-500" />
              <span className="text-slate-700 text-xs font-medium">Tổng Bị Đóng Băng</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.frozen_balance || 0).toLocaleString()}
            </p>
            <p className="text-red-600 text-xs mt-1">❄️ Câu trùng/chào/spam</p>

            {/* Button Xem Lịch Sử - ADMIN ONLY */}
            {isAdmin && (
              <Button
                onClick={() => setShowEliminatedModal(true)}
                size="sm"
                className="w-full bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg shadow-md hover:shadow-lg font-bold text-xs mt-3"
              >
                Xem Lịch Sử ({allUserLogs.length} câu)
              </Button>
            )}
          </div>


        </motion.div>







        {/* Admin Payment Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-white" />
              <div>
                <h3 className="text-white text-xl font-bold">Đã Thanh Toán</h3>
                <p className="text-white/80 text-xs">Admin đã chuyển khoản</p>
              </div>
            </div>
            <p className="text-white text-4xl font-bold">
              {(userBalance?.paid_amount || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
            <p className="text-white text-sm font-semibold mb-2">📅 Lịch Thanh Toán Hàng Tháng</p>
            <div className="flex gap-2">
              <Badge className="bg-white/30 text-white border-white/50">Ngày 1</Badge>
              <Badge className="bg-white/30 text-white border-white/50">Ngày 10</Badge>
              <Badge className="bg-white/30 text-white border-white/50">Ngày 20</Badge>
            </div>
            <p className="text-white/90 text-xs mt-3">
              💡 Admin sẽ chuyển khoản theo lịch trên cho số dư "Sẵn Sàng Thanh Toán"
            </p>
          </div>
        </motion.div>

        {/* Info Box - Explaining Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-3xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-start gap-3">
            <Eye className="w-6 h-6 text-purple-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-purple-900 font-bold mb-3">Giải Thích Phân Loại Camlycoin</h4>
              <div className="space-y-2 text-sm text-purple-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Sẵn Sàng Thanh Toán:</strong> Coins đã được admin duyệt, sẽ chuyển khoản ngày 1/10/20 hàng tháng</p>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Chờ Duyệt Thanh Toán:</strong> Số coins đang chờ admin xét duyệt để chuyển vào Sẵn Sàng Thanh Toán</p>
                </div>
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Đóng Băng:</strong> Coins từ câu hỏi trùng lặp, chào hỏi, spam (không được thanh toán)</p>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Đã Thanh Toán:</strong> Coins đã được chuyển khoản thành công cho user</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Payment Action - Only for Admin */}
        {isAdmin && userBalance && (userBalance.available_balance || 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
          >
            <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Đánh Dấu Thanh Toán
            </h3>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/30">
              <p className="text-white/90 text-sm mb-2">Tổng Sẵn Sàng Thanh Toán:</p>
              <p className="text-white text-3xl font-bold">
                {(userBalance.available_balance || 0).toLocaleString()} Camlycoin
              </p>
            </div>
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="w-full bg-white text-blue-600 rounded-2xl font-bold py-6 text-lg hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Đánh Dấu Đã Thanh Toán
            </Button>
          </motion.div>
        )}

        {/* Pending Review Questions Modal */}
        <AnimatePresence>
          {showPendingReviewModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowPendingReviewModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl my-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-slate-900 text-2xl font-bold">Câu Hỏi Chờ Duyệt Thanh Toán</h3>
                    <p className="text-slate-600 text-sm mt-1">
                      <strong>{pendingReviewLogs.length}</strong> câu hỏi từ câu 11+ mỗi ngày cần xem xét
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPendingReviewModal(false)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {isLoadingLogs ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-16 h-16 text-blue-300 mx-auto mb-4 animate-spin" />
                    <p className="text-slate-700 font-medium">Đang tải câu hỏi...</p>
                  </div>
                ) : pendingReviewLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" />
                    <p className="text-slate-700 font-bold text-lg mb-2">Không Có Câu Hỏi Chờ Duyệt</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {pendingReviewLogs.map((log, idx) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                                ⏳ Chờ Duyệt
                              </Badge>
                              <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                                📊 Câu #{log.question_number_in_day}
                              </Badge>
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                                🪙 {log.coins_earned?.toLocaleString()} Camlycoin
                              </Badge>
                            </div>

                            <p className="text-slate-900 font-semibold mb-2 break-words leading-relaxed">
                              {log.question_text}
                            </p>

                            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(log.question_date).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button
                            onClick={() => approvePendingReviewMutation.mutate(log.id)}
                            disabled={approvePendingReviewMutation.isPending}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl py-3"
                          >
                            {approvePendingReviewMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                            )}
                            Duyệt Thưởng
                          </Button>
                          <Button
                            onClick={() => rejectPendingReviewMutation.mutate(log.id)}
                            disabled={rejectPendingReviewMutation.isPending}
                            className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl py-3"
                          >
                            {rejectPendingReviewMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Từ Chối
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Eliminated Questions Modal */}
        <AnimatePresence>
          {showEliminatedModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowEliminatedModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-8 max-w-4xl w-full shadow-2xl my-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-slate-900 text-2xl font-bold">Lịch Sử Câu Hỏi</h3>
                    <p className="text-slate-600 text-sm mt-1">
                      <strong>{allUserLogs.length}</strong> câu hỏi tổng cộng • 
                      <span className="text-green-600 font-semibold"> {validLogs.length} hợp lệ</span> • 
                      <span className="text-red-600 font-semibold"> {eliminatedLogs.length} đã loại bỏ</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => refetchLogs()}
                      disabled={isLoadingLogs}
                      size="sm"
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      {isLoadingLogs ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowEliminatedModal(false)}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {isLoadingLogs ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-16 h-16 text-purple-300 mx-auto mb-4 animate-spin" />
                    <p className="text-slate-700 font-medium">Đang tải lịch sử câu hỏi...</p>
                  </div>
                ) : allUserLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-orange-300 mx-auto mb-4" />
                    <p className="text-slate-700 font-bold text-lg mb-2">Chưa Có Dữ Liệu Audit</p>
                    <p className="text-slate-600 text-sm mb-4">
                      User này chưa có câu hỏi nào trong QuestionAuditLog.<br/>
                      Cần chạy Comprehensive Audit để phân tích lịch sử câu hỏi.
                    </p>
                    <Button
                      onClick={() => {
                        setShowEliminatedModal(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold"
                    >
                      Đi Đến Audit Button
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {allUserLogs.map((log, idx) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`border-2 rounded-2xl p-5 ${
                          log.exclusion_reason === 'valid' 
                            ? 'bg-green-50 border-green-300' 
                            : log.coin_category === 'frozen' 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-blue-50 border-blue-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {log.exclusion_reason === 'valid' ? (
                                <Badge className="bg-green-100 text-green-800 border border-green-300">
                                  ✅ Hợp Lệ
                                </Badge>
                              ) : (
                                <>
                                  <Badge className={
                                    log.coin_category === 'frozen' 
                                      ? 'bg-red-100 text-red-800 border border-red-300' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                                  }>
                                    {log.coin_category === 'frozen' ? '❄️ Frozen' : '⏳ Pending Review'}
                                  </Badge>
                                  <Badge className={
                                    log.exclusion_reason === 'duplicate' ? 'bg-orange-100 text-orange-800' :
                                    log.exclusion_reason === 'greeting' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-purple-100 text-purple-800'
                                  }>
                                    {log.exclusion_reason === 'duplicate' ? '🔄 Duplicate' :
                                     log.exclusion_reason === 'greeting' ? '👋 Greeting' :
                                     log.exclusion_reason === 'exceeds_daily_limit' ? '📊 Câu 11+' :
                                     log.exclusion_reason}
                                  </Badge>
                                </>
                              )}
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                                🪙 {log.coins_earned?.toLocaleString()} Camlycoin
                              </Badge>
                            </div>

                            <p className="text-slate-900 font-semibold mb-2 break-words leading-relaxed">
                              {log.question_text}
                            </p>

                            <div className="flex flex-wrap gap-2 text-xs text-slate-600 mb-2">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(log.question_date).toLocaleString('vi-VN')}
                              </span>
                              <span className="font-bold">
                                Câu #{log.question_number_in_day} của ngày
                              </span>
                            </div>

                            {log.similar_to_question && (
                              <div className="bg-white/80 border border-orange-300 rounded-xl p-3 mt-2">
                                <p className="text-orange-900 text-xs font-semibold mb-1">
                                  Tương tự ({((log.similarity_score || 0) * 100).toFixed(0)}%):
                                </p>
                                <p className="text-orange-800 text-sm italic">"{log.similar_to_question}"</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* AI Analysis Section */}
                        {!aiAnalysisResults[log.id] && !analyzingQuestions.has(log.id) && (
                          <Button
                            onClick={() => analyzeQuestionWithAI(log)}
                            size="sm"
                            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl py-2 mt-3"
                          >
                            <Activity className="w-4 h-4 mr-2" />
                            Phân Tích AI
                          </Button>
                        )}

                        {analyzingQuestions.has(log.id) && (
                          <div className="bg-purple-50 border border-purple-300 rounded-xl p-3 mt-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                              <p className="text-purple-800 text-sm font-medium">AI đang phân tích...</p>
                            </div>
                          </div>
                        )}

                        {aiAnalysisResults[log.id] && (
                          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-4 mt-3">
                            <div className="flex items-center gap-2 mb-3">
                              <Activity className="w-5 h-5 text-purple-600" />
                              <h4 className="text-purple-900 font-bold">Phân Tích AI</h4>
                            </div>

                            {/* Confidence Scores */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {aiAnalysisResults[log.id].is_duplicate && (
                                <div className="bg-orange-100 border border-orange-300 rounded-lg p-2">
                                  <p className="text-orange-900 text-xs font-semibold">🔄 Trùng lặp</p>
                                  <p className="text-orange-700 text-lg font-bold">
                                    {aiAnalysisResults[log.id].duplicate_confidence}%
                                  </p>
                                </div>
                              )}
                              {aiAnalysisResults[log.id].is_greeting && (
                                <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-2">
                                  <p className="text-yellow-900 text-xs font-semibold">👋 Chào hỏi</p>
                                  <p className="text-yellow-700 text-lg font-bold">
                                    {aiAnalysisResults[log.id].greeting_confidence}%
                                  </p>
                                </div>
                              )}
                              {aiAnalysisResults[log.id].is_spam && (
                                <div className="bg-red-100 border border-red-300 rounded-lg p-2">
                                  <p className="text-red-900 text-xs font-semibold">🚫 Spam</p>
                                  <p className="text-red-700 text-lg font-bold">
                                    {aiAnalysisResults[log.id].spam_confidence}%
                                  </p>
                                </div>
                              )}
                              {aiAnalysisResults[log.id].is_valid && (
                                <div className="bg-green-100 border border-green-300 rounded-lg p-2">
                                  <p className="text-green-900 text-xs font-semibold">✅ Hợp lệ</p>
                                  <p className="text-green-700 text-lg font-bold">
                                    {aiAnalysisResults[log.id].valid_confidence}%
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* AI Recommendation */}
                            <div className={`border-2 rounded-lg p-3 mb-3 ${
                              aiAnalysisResults[log.id].recommendation === 'approve' ? 'bg-green-100 border-green-300' :
                              aiAnalysisResults[log.id].recommendation === 'reject' ? 'bg-red-100 border-red-300' :
                              'bg-blue-100 border-blue-300'
                            }`}>
                              <p className={`font-bold text-sm mb-1 ${
                                aiAnalysisResults[log.id].recommendation === 'approve' ? 'text-green-900' :
                                aiAnalysisResults[log.id].recommendation === 'reject' ? 'text-red-900' :
                                'text-blue-900'
                              }`}>
                                🤖 Đề xuất: {
                                  aiAnalysisResults[log.id].recommendation === 'approve' ? '✅ Duyệt thưởng' :
                                  aiAnalysisResults[log.id].recommendation === 'reject' ? '❌ Từ chối' :
                                  '🔍 Cần xem xét thêm'
                                }
                              </p>
                              <p className="text-slate-700 text-xs leading-relaxed">
                                {aiAnalysisResults[log.id].reason}
                              </p>
                            </div>

                            {/* Similar Questions from AI */}
                            {aiAnalysisResults[log.id].similar_questions && aiAnalysisResults[log.id].similar_questions.length > 0 && (
                              <div className="bg-white/80 border border-purple-300 rounded-lg p-2">
                                <p className="text-purple-900 text-xs font-semibold mb-2">Câu tương tự tìm được:</p>
                                <div className="space-y-1">
                                  {aiAnalysisResults[log.id].similar_questions.slice(0, 3).map((q, i) => (
                                    <p key={i} className="text-purple-800 text-xs italic">• "{q}"</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {log.exclusion_reason !== 'valid' && (
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={() => approveEliminatedMutation.mutate(log.id)}
                              disabled={approveEliminatedMutation.isPending}
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl py-3"
                            >
                              {approveEliminatedMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                              )}
                              Duyệt Thưởng
                            </Button>
                            <Button
                              onClick={() => rejectEliminatedMutation.mutate(log.id)}
                              disabled={rejectEliminatedMutation.isPending}
                              className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl py-3"
                            >
                              {rejectEliminatedMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                              )}
                              Từ Chối
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment Modal */}
        <AnimatePresence>
          {showPaymentModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowPaymentModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-slate-900 text-xl font-bold">Xác Nhận Thanh Toán</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPaymentModal(false)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-6">
                  <p className="text-blue-900 text-sm font-medium mb-2">Tổng Sẵn Sàng Thanh Toán:</p>
                  <p className="text-blue-600 text-3xl font-bold">
                    {(userBalance?.available_balance || 0).toLocaleString()} Camlycoin
                  </p>
                </div>

                <div className="mb-6">
                  <label className="text-slate-700 text-sm font-semibold mb-2 block">
                    Số tiền thanh toán
                  </label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Nhập số Camlycoin đã thanh toán..."
                    className="bg-white border-2 border-blue-300 text-slate-900 rounded-xl text-lg"
                    max={userBalance?.available_balance || 0}
                  />
                  <p className="text-xs text-slate-600 mt-2">
                    💡 Thanh toán định kỳ vào ngày 1, 10, 20 hàng tháng
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentAmount('');
                    }}
                    className="flex-1 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-2xl py-6"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => markAsPaidMutation.mutate(paymentAmount)}
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > (userBalance?.available_balance || 0)}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl py-6 font-bold disabled:opacity-50 shadow-lg hover:shadow-xl"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Xác Nhận Đã Chuyển
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <History className="w-6 h-6 text-amber-500" />
            Lịch Sử Giao Dịch (20 gần nhất)
          </h3>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx, index) => {
                const isPositive = tx.amount > 0;
                
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white border-2 border-amber-100 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-slate-900 font-semibold">{tx.description}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(tx.created_date).toLocaleString('vi-VN')}
                        </p>
                        {tx.processed_by && (
                          <p className="text-xs text-purple-600 mt-1">
                            Xử lý bởi: {tx.processed_by}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
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