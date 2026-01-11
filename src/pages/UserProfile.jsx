import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Coins, Wallet, TrendingUp, TrendingDown, Clock, History, Copy, Check, Camera, Loader2, CheckCircle2, DollarSign, X, Activity, Lock, Eye, RefreshCw, XCircle, AlertCircle, Gift, Trophy, Award, Calendar, Filter, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { AnimatePresence } from 'framer-motion';
import LevelProgressCard from '@/components/LevelProgressCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

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
  const [questionFilter, setQuestionFilter] = useState('all');
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [overallInsights, setOverallInsights] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const location = useLocation();

  // ✅ SINGLE SOURCE OF TRUTH: Parse URL once and lock it
  useEffect(() => {
    console.log('🔍 [INIT] UserProfile mounted, URL:', location.search);
    
    const urlParams = new URLSearchParams(location.search);
    const emailFromUrl = urlParams.get('email');
    
    if (emailFromUrl) {
      const decodedEmail = decodeURIComponent(emailFromUrl);
      console.log('✅ [LOCK] targetEmail from URL:', decodedEmail);
      setTargetEmail(decodedEmail);
    }
    
    // Fetch currentUser separately (never affects targetEmail if URL exists)
    base44.auth.me()
      .then(user => {
        console.log('✅ [AUTH] currentUser:', user?.email, 'role:', user?.role);
        setCurrentUser(user);
        
        // ONLY use currentUser email if NO URL param
        if (!emailFromUrl && user) {
          console.log('⚠️ [FALLBACK] No URL - using currentUser email:', user.email);
          setTargetEmail(user.email);
        }
      })
      .catch(err => {
        console.error('❌ [AUTH ERROR]', err);
        setCurrentUser(null);
      });
  }, []); // ⚠️ ONLY RUN ONCE ON MOUNT

  // ✅ Fetch target user details when targetEmail changes
  useEffect(() => {
    if (!targetEmail) return;
    
    console.log('🔍 [FETCH USER] Fetching details for:', targetEmail);
    base44.entities.User.filter({ email: targetEmail })
      .then(users => {
        if (users.length > 0) {
          console.log('✅ [USER FOUND]', users[0].email);
          setTargetUser(users[0]);
        } else {
          console.log('⚠️ [USER NOT FOUND] Using fallback');
          setTargetUser({ email: targetEmail, full_name: targetEmail });
        }
      })
      .catch(error => {
        console.error('❌ [USER FETCH ERROR]', error);
        setTargetUser({ email: targetEmail, full_name: targetEmail });
      });
  }, [targetEmail]);

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
      return await base44.entities.CamlycoinTransaction.filter({ user_email: targetEmail }, '-created_date', 20);
    },
    enabled: !!targetEmail,
  });

  // Fetch ALL audit logs của user (bao gồm cả valid để hiển thị toàn bộ lịch sử)
  const { data: allUserLogs = [], isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['all-user-audit-logs', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      
      // FIX: Fetch logs directly for this user instead of fetching all then filtering
      const userLogs = await base44.entities.QuestionAuditLog.filter({ user_email: targetEmail }, '-question_date', 50000);
      
      console.log('🔍 Total audit logs for', targetEmail, ':', userLogs.length);
      console.log('📊 Breakdown:', {
        valid: userLogs.filter(l => l.exclusion_reason === 'valid').length,
        duplicate: userLogs.filter(l => l.exclusion_reason === 'duplicate').length,
        greeting: userLogs.filter(l => l.exclusion_reason === 'greeting').length,
        exceeds_limit: userLogs.filter(l => l.exclusion_reason === 'exceeds_daily_limit').length,
        frozen: userLogs.filter(l => l.coin_category === 'frozen').length,
        pending_review: userLogs.filter(l => l.coin_category === 'pending_review').length
      });
      
      return userLogs;
    },
    enabled: !!targetEmail && !!currentUser,
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

  // Filter questions by date
  const filteredQuestions = React.useMemo(() => {
    let filtered = [...allUserLogs];
    
    if (questionFilter === 'today') {
      const today = startOfDay(new Date());
      filtered = filtered.filter(log => new Date(log.question_date) >= today);
    } else if (questionFilter === 'week') {
      const weekAgo = subDays(new Date(), 7);
      filtered = filtered.filter(log => new Date(log.question_date) >= weekAgo);
    } else if (questionFilter === 'month') {
      const monthAgo = subDays(new Date(), 30);
      filtered = filtered.filter(log => new Date(log.question_date) >= monthAgo);
    }
    
    return filtered;
  }, [allUserLogs, questionFilter]);

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    const dailyData = new Map();
    
    transactions.forEach(tx => {
      if (tx.amount > 0) {
        const date = format(new Date(tx.created_date), 'yyyy-MM-dd');
        const current = dailyData.get(date) || { date, total: 0, count: 0 };
        dailyData.set(date, {
          date,
          total: current.total + tx.amount,
          count: current.count + 1
        });
      }
    });
    
    return Array.from(dailyData.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }, [transactions]);



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

  // Approve percentage mutation - DUYỆT TỪ ADMIN_REVIEW_PENDING
  const approvePercentageMutation = useMutation({
    mutationFn: async (percentage) => {
      if (!userBalance) return;
      
      const adminReviewAmount = userBalance.admin_review_pending || 0;
      
      if (adminReviewAmount <= 0) return;

      const approveAmount = Math.floor(adminReviewAmount * percentage / 100);
      
      await base44.entities.CamlycoinBalance.update(userBalance.id, {
        admin_review_pending: adminReviewAmount - approveAmount,
        available_balance: (userBalance.available_balance || 0) + approveAmount
      });

      await base44.entities.CamlycoinTransaction.create({
        user_email: targetEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt ${percentage}% Chờ Review (${approveAmount.toLocaleString()}/${adminReviewAmount.toLocaleString()}) Camlycoin → Sẵn Sàng Thanh Toán`,
        processed_by: currentUser.email
      });

      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-audit-logs'] });
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
      const currentAvailable = userBalance.available_for_withdrawal || 0;
      const currentPaid = userBalance.paid_amount || 0;

      if (paidAmount > currentAvailable) {
        alert('Số tiền thanh toán không được lớn hơn số Sẵn Sàng Rút!');
        return;
      }

      // Update paid amount, available_for_withdrawal will be recalculated by formula
      await base44.entities.CamlycoinBalance.update(userBalance.id, {
        paid_amount: currentPaid + paidAmount
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

  // Approve pending review question mutation - LOGIC MỚI
  const approvePendingReviewMutation = useMutation({
    mutationFn: async (logId) => {
      const response = await base44.functions.invoke('approveAdminReviewQuestion', {
        log_ids: [logId],
        reason: 'Admin duyệt từ User Profile'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['user-transactions'] });
    }
  });

  // Reject pending review question mutation - LOGIC MỚI
  const rejectPendingReviewMutation = useMutation({
    mutationFn: async (logId) => {
      const response = await base44.functions.invoke('rejectAdminReviewQuestion', {
        log_ids: [logId],
        reason: 'Admin từ chối từ User Profile'
      });
      return response.data;
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

  // AI Analysis for individual questions
  const analyzeQuestionWithAI = async (log) => {
    const logId = log.id;
    if (analyzingQuestions.has(logId)) return;

    setAnalyzingQuestions(prev => new Set(prev).add(logId));

    try {
      const otherQuestions = allUserLogs
        .filter(l => l.id !== logId)
        .slice(0, 20)
        .map(l => l.question_text);

      const prompt = `Phân tích toàn diện chất lượng câu hỏi sau và đưa ra đánh giá chi tiết:

  CÂU HỎI: "${log.question_text}"

  YÊU CẦU PHÂN TÍCH CHI TIẾT:

  1. ĐIỂM SỐ CHI TIẾT (0-100 cho mỗi tiêu chí):
   - quality_score: Chất lượng tổng thể
   - clarity_score: Độ rõ ràng của câu hỏi
   - depth_score: Độ sâu sắc và chi tiết
   - creativity_score: Tính sáng tạo và độc đáo
   - educational_value: Giá trị học hỏi
   - relevance_score: Độ liên quan đến chủ đề tâm linh/phát triển bản thân
   - uniqueness_score: Mức độ độc đáo so với các câu hỏi thông thường

  2. PHÂN TÍCH ĐIỂM MẠNH (strengths: array):
   - Liệt kê 2-3 điểm mạnh cụ thể của câu hỏi
   - Giải thích tại sao đây là điểm mạnh

  3. PHÂN TÍCH ĐIỂM YẾU (weaknesses: array):
   - Liệt kê 2-3 điểm yếu cần cải thiện
   - Giải thích tác động của điểm yếu

  4. GỢI Ý CẢI THIỆN CỤ THỂ (improvement_suggestions: array of objects):
   Mỗi gợi ý bao gồm:
   - issue: Vấn đề cần sửa
   - suggestion: Cách cải thiện
   - example: Ví dụ câu hỏi đã cải thiện (viết lại câu hỏi gốc theo gợi ý)

  5. CHỦ ĐỀ LIÊN QUAN (related_topics: array of objects):
   Gợi ý 3-5 chủ đề liên quan để mở rộng:
   - topic: Tên chủ đề
   - description: Mô tả ngắn gọn
   - reason: Tại sao liên quan đến câu hỏi gốc

  6. PHÂN LOẠI:
   - is_duplicate: boolean
   - duplicate_confidence: 0-100
   - is_spam: boolean
   - spam_confidence: 0-100
   - is_valid: boolean
   - valid_confidence: 0-100

  7. TÓM TẮT & ĐỀ XUẤT:
   - summary: Tóm tắt ngắn gọn (max 100 chars)
   - recommendation: "approve"/"reject"/"review"
   - reason: Lý do đề xuất chi tiết

  Trả về JSON:`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            quality_score: { type: "number" },
            clarity_score: { type: "number" },
            depth_score: { type: "number" },
            creativity_score: { type: "number" },
            educational_value: { type: "number" },
            relevance_score: { type: "number" },
            uniqueness_score: { type: "number" },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            improvement_suggestions: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  issue: { type: "string" },
                  suggestion: { type: "string" },
                  example: { type: "string" }
                }
              }
            },
            related_topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  description: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            is_duplicate: { type: "boolean" },
            duplicate_confidence: { type: "number" },
            is_spam: { type: "boolean" },
            spam_confidence: { type: "number" },
            is_valid: { type: "boolean" },
            valid_confidence: { type: "number" },
            summary: { type: "string" },
            recommendation: { type: "string" },
            reason: { type: "string" }
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

  // Analyze all questions and generate insights
  const analyzeAllQuestions = async () => {
    if (isAnalyzingAll || allUserLogs.length === 0) return;

    setIsAnalyzingAll(true);
    try {
      const validQuestions = allUserLogs.filter(log => log.exclusion_reason === 'valid');
      const questionsList = validQuestions.slice(0, 30).map((log, i) => 
        `${i + 1}. "${log.question_text}" (${log.coins_earned} coins, ${format(new Date(log.question_date), 'dd/MM/yyyy')})`
      ).join('\n');

      const prompt = `Phân tích tổng thể chất lượng câu hỏi của người dùng và đưa ra insights:

DANH SÁCH CÂU HỎI HỢP LỆ (${validQuestions.length} câu):
${questionsList}

THỐNG KÊ:
- Tổng số câu hỏi: ${allUserLogs.length}
- Câu hỏi hợp lệ: ${validQuestions.length}
- Câu bị loại: ${allUserLogs.length - validQuestions.length}

YÊU CẦU:
1. Đánh giá tổng quan về chất lượng câu hỏi (overall_quality: 0-100)
2. Xu hướng chủ đề yêu thích (top_topics: array of strings)
3. Điểm mạnh chung (strengths: array of strings)
4. Lĩnh vực cần cải thiện (areas_for_improvement: array of strings)
5. Top 3 câu hỏi nổi bật nhất (highlights: array of {question: string, reason: string})
6. Gợi ý phát triển (suggestions: array of strings)

Trả về JSON:`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_quality: { type: "number" },
            top_topics: { type: "array", items: { type: "string" } },
            strengths: { type: "array", items: { type: "string" } },
            areas_for_improvement: { type: "array", items: { type: "string" } },
            highlights: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  question: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            suggestions: { type: "array", items: { type: "string" } }
          }
        }
      });

      setOverallInsights(result);
    } catch (error) {
      console.error('Overall analysis error:', error);
    } finally {
      setIsAnalyzingAll(false);
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



  // Debug render
  console.log('🔍 [RENDER] targetEmail:', targetEmail, 'currentUser:', currentUser?.email);

  if (!targetEmail) {
    console.log('⚠️ [RENDER] No targetEmail - showing error');
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Không tìm thấy email người dùng</p>
          <Link to={createPageUrl('Leaderboard')}>
            <Button className="mt-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full">
              Quay lại
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  console.log('✅ [RENDER] Rendering profile for:', targetEmail);

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

          {/* Sẵn Sàng Rút - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-300 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-amber-500" />
              <span className="text-slate-700 text-xs font-medium">Sẵn Sàng Rút</span>
            </div>
            <p className={`text-3xl font-bold break-words ${
              (userBalance?.available_for_withdrawal || 0) < 0 ? 'text-red-600' : 'text-slate-900'
            }`}>
              {(userBalance?.available_for_withdrawal || 0).toLocaleString()}
            </p>
            <p className="text-amber-600 text-xs mt-1">⏳ = net_valid_coins - paid_amount</p>

            {(userBalance?.available_for_withdrawal || 0) < 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 mt-3">
                <p className="text-red-900 text-xs font-bold mb-1">⚠️ Đã thanh toán thừa</p>
                <p className="text-red-800 text-xs">
                  User cần kiếm thêm <strong>{Math.abs(userBalance.available_for_withdrawal).toLocaleString()}</strong> coins mới rút được
                </p>
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

          {/* Net Valid Coins - TRỰC TIẾP TỪ DATABASE */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-6 h-6 text-blue-500" />
              <span className="text-slate-700 text-xs font-medium">Tổng Điểm Hợp Lệ</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.net_valid_coins || 0).toLocaleString()}
            </p>
            <p className="text-blue-600 text-xs mt-1">💎 10 câu đầu/ngày + hoạt động khác</p>
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
                Xem Lịch Sử ({eliminatedLogs.length} câu)
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
              <h4 className="text-purple-900 font-bold mb-3">Giải Thích Công Thức Camlycoin Mới</h4>
              <div className="space-y-2 text-sm text-purple-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Tổng Kiếm Được:</strong> net_valid_coins + frozen_balance</p>
                </div>
                <div className="flex items-start gap-2">
                  <Coins className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Tổng Điểm Hợp Lệ:</strong> 10 câu đầu tiên/ngày (không tính câu trùng, chào) + hoạt động khác (bounty, build)</p>
                </div>
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Đóng Băng:</strong> Coins từ câu trùng lặp, chào hỏi, spam (không được thanh toán)</p>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Sẵn Sàng Rút:</strong> net_valid_coins - paid_amount (số tiền có thể rút ngay)</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Đã Thanh Toán:</strong> Coins đã được chuyển khoản thành công cho user</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Payment Action - Only for Admin */}
        {isAdmin && userBalance && (userBalance.available_for_withdrawal || 0) > 0 && (
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
              <p className="text-white/90 text-sm mb-2">Tổng Sẵn Sàng Rút:</p>
              <p className="text-white text-3xl font-bold">
                {(userBalance.available_for_withdrawal || 0).toLocaleString()} Camlycoin
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
                  <p className="text-blue-900 text-sm font-medium mb-2">Tổng Sẵn Sàng Rút:</p>
                  <p className="text-blue-600 text-3xl font-bold">
                    {(userBalance?.available_for_withdrawal || 0).toLocaleString()} Camlycoin
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
                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > (userBalance?.available_for_withdrawal || 0)}
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

        {/* Growth Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-8"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-500" />
            Biểu Đồ Tăng Trưởng Camlycoin (30 ngày gần nhất)
          </h3>

          {chartData.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có dữ liệu biểu đồ</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'dd/MM')}
                  stroke="#64748b"
                />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '2px solid #a855f7',
                    borderRadius: '12px',
                    padding: '12px'
                  }}
                  labelFormatter={(date) => format(new Date(date), 'dd/MM/yyyy')}
                  formatter={(value, name) => [
                    name === 'total' ? `${value.toLocaleString()} Camlycoin` : `${value} giao dịch`,
                    name === 'total' ? 'Tổng kiếm' : 'Số giao dịch'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#a855f7" 
                  strokeWidth={3}
                  dot={{ fill: '#a855f7', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* AI Insights Overview */}
        {overallInsights && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
          >
            <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <Activity className="w-6 h-6" />
              AI Insights - Tổng Quan Chất Lượng
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/80 text-sm mb-1">Điểm Chất Lượng Tổng Thể</p>
                <p className="text-white text-4xl font-bold">{overallInsights.overall_quality}/100</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                <p className="text-white/80 text-sm mb-2">Chủ Đề Yêu Thích</p>
                <div className="flex flex-wrap gap-2">
                  {overallInsights.top_topics?.slice(0, 3).map((topic, i) => (
                    <Badge key={i} className="bg-white/30 text-white border-white/50">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {overallInsights.highlights && overallInsights.highlights.length > 0 && (
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30 mb-4">
                <p className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Câu Hỏi Nổi Bật
                </p>
                <div className="space-y-2">
                  {overallInsights.highlights.map((highlight, i) => (
                    <div key={i} className="bg-white/10 rounded-lg p-3">
                      <p className="text-white text-sm font-medium mb-1">"{highlight.question}"</p>
                      <p className="text-white/80 text-xs">💡 {highlight.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overallInsights.strengths && overallInsights.strengths.length > 0 && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <p className="text-white font-semibold mb-2">✨ Điểm Mạnh</p>
                  <ul className="space-y-1">
                    {overallInsights.strengths.map((strength, i) => (
                      <li key={i} className="text-white/90 text-sm">• {strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {overallInsights.suggestions && overallInsights.suggestions.length > 0 && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border border-white/30">
                  <p className="text-white font-semibold mb-2">💡 Gợi Ý Phát Triển</p>
                  <ul className="space-y-1">
                    {overallInsights.suggestions.map((suggestion, i) => (
                      <li key={i} className="text-white/90 text-sm">• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Questions History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-xl mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-500" />
              Câu Hỏi Đã Đóng Góp
            </h3>
            <div className="flex items-center gap-2">
              <Button
                onClick={analyzeAllQuestions}
                disabled={isAnalyzingAll || allUserLogs.length === 0}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                {isAnalyzingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Đang Phân Tích...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 mr-1" />
                    AI Phân Tích Tổng Thể
                  </>
                )}
              </Button>
              <Badge className="bg-blue-100 text-blue-800">
                {filteredQuestions.length} câu
              </Badge>
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex gap-2 mb-6">
            {[
              { value: 'all', label: 'Tất Cả' },
              { value: 'today', label: 'Hôm Nay' },
              { value: 'week', label: '7 Ngày' },
              { value: 'month', label: '30 Ngày' }
            ].map(option => (
              <Button
                key={option.value}
                onClick={() => setQuestionFilter(option.value)}
                size="sm"
                variant={questionFilter === option.value ? 'default' : 'outline'}
                className={questionFilter === option.value 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                  : 'border-blue-300 text-slate-700'
                }
              >
                {option.label}
              </Button>
            ))}
          </div>

          {isLoadingLogs ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-blue-300 mx-auto mb-4 animate-spin" />
              <p className="text-slate-700 font-medium">Đang tải câu hỏi...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-blue-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có câu hỏi nào</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredQuestions.slice(0, 20).map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`border-2 rounded-2xl p-4 ${
                    log.exclusion_reason === 'valid' 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {log.exclusion_reason === 'valid' ? (
                          <Badge className="bg-green-100 text-green-800">✅ Hợp Lệ</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            {log.exclusion_reason === 'duplicate' ? '🔄 Trùng' :
                             log.exclusion_reason === 'greeting' ? '👋 Chào' :
                             log.exclusion_reason === 'exceeds_daily_limit' ? '📊 Câu 11+' :
                             '❌ Loại'}
                          </Badge>
                        )}
                        <Badge className="bg-amber-100 text-amber-800">
                          🪙 {log.coins_earned?.toLocaleString()}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800">
                          #{log.question_number_in_day}
                        </Badge>
                      </div>
                      <p className="text-slate-900 font-medium break-words mb-2">
                        {log.question_text}
                      </p>
                      <p className="text-xs text-slate-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {format(new Date(log.question_date), 'dd/MM/yyyy HH:mm')}
                      </p>
                      </div>
                      </div>

                      {/* AI Analysis Section */}
                      {!aiAnalysisResults[log.id] && !analyzingQuestions.has(log.id) && (
                      <Button
                      onClick={() => analyzeQuestionWithAI(log)}
                      size="sm"
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white mt-3"
                      >
                      <Activity className="w-4 h-4 mr-1" />
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
                        <h4 className="text-purple-900 font-bold">Đánh Giá AI</h4>
                      </div>

                      {/* Quality Scores */}
                      {aiAnalysisResults[log.id].quality_score && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                          <div className="bg-white border border-purple-200 rounded-lg p-2">
                            <p className="text-purple-900 text-xs font-semibold">Chất lượng</p>
                            <p className="text-purple-700 text-xl font-bold">
                              {aiAnalysisResults[log.id].quality_score}/100
                            </p>
                          </div>
                          {aiAnalysisResults[log.id].clarity_score && (
                            <div className="bg-white border border-blue-200 rounded-lg p-2">
                              <p className="text-blue-900 text-xs font-semibold">Rõ ràng</p>
                              <p className="text-blue-700 text-xl font-bold">
                                {aiAnalysisResults[log.id].clarity_score}/100
                              </p>
                            </div>
                          )}
                          {aiAnalysisResults[log.id].depth_score && (
                            <div className="bg-white border border-green-200 rounded-lg p-2">
                              <p className="text-green-900 text-xs font-semibold">Sâu sắc</p>
                              <p className="text-green-700 text-xl font-bold">
                                {aiAnalysisResults[log.id].depth_score}/100
                              </p>
                            </div>
                          )}
                          {aiAnalysisResults[log.id].creativity_score && (
                            <div className="bg-white border border-amber-200 rounded-lg p-2">
                              <p className="text-amber-900 text-xs font-semibold">Sáng tạo</p>
                              <p className="text-amber-700 text-xl font-bold">
                                {aiAnalysisResults[log.id].creativity_score}/100
                              </p>
                            </div>
                          )}
                          {aiAnalysisResults[log.id].relevance_score && (
                            <div className="bg-white border border-indigo-200 rounded-lg p-2">
                              <p className="text-indigo-900 text-xs font-semibold">Liên quan</p>
                              <p className="text-indigo-700 text-xl font-bold">
                                {aiAnalysisResults[log.id].relevance_score}/100
                              </p>
                            </div>
                          )}
                          {aiAnalysisResults[log.id].uniqueness_score && (
                            <div className="bg-white border border-rose-200 rounded-lg p-2">
                              <p className="text-rose-900 text-xs font-semibold">Độc đáo</p>
                              <p className="text-rose-700 text-xl font-bold">
                                {aiAnalysisResults[log.id].uniqueness_score}/100
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Summary */}
                      {aiAnalysisResults[log.id].summary && (
                        <div className="bg-white/80 border border-purple-200 rounded-lg p-3 mb-3">
                          <p className="text-purple-900 text-xs font-semibold mb-1">📝 Tóm tắt</p>
                          <p className="text-purple-800 text-sm">{aiAnalysisResults[log.id].summary}</p>
                        </div>
                      )}

                      {/* Strengths */}
                      {aiAnalysisResults[log.id].strengths && aiAnalysisResults[log.id].strengths.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                          <p className="text-green-900 text-xs font-semibold mb-2">✨ Điểm mạnh</p>
                          <ul className="space-y-1">
                            {aiAnalysisResults[log.id].strengths.map((strength, i) => (
                              <li key={i} className="text-green-800 text-xs">• {strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Improvement Suggestions with Examples */}
                      {aiAnalysisResults[log.id].improvement_suggestions && aiAnalysisResults[log.id].improvement_suggestions.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                          <p className="text-amber-900 text-xs font-semibold mb-2">💡 Gợi ý cải thiện cụ thể</p>
                          <div className="space-y-2">
                            {aiAnalysisResults[log.id].improvement_suggestions.map((item, i) => (
                              <div key={i} className="bg-white/80 rounded-lg p-2">
                                <p className="text-amber-900 text-xs font-bold mb-1">🔸 {item.issue}</p>
                                <p className="text-amber-800 text-xs mb-1">→ {item.suggestion}</p>
                                {item.example && (
                                  <div className="bg-amber-100/50 rounded p-2 mt-1">
                                    <p className="text-amber-700 text-xs italic">✨ Ví dụ: "{item.example}"</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Related Topics */}
                      {aiAnalysisResults[log.id].related_topics && aiAnalysisResults[log.id].related_topics.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-3">
                          <p className="text-indigo-900 text-xs font-semibold mb-2">🌟 Chủ đề liên quan để mở rộng</p>
                          <div className="space-y-2">
                            {aiAnalysisResults[log.id].related_topics.map((topic, i) => (
                              <div key={i} className="bg-white/80 rounded-lg p-2">
                                <p className="text-indigo-900 text-xs font-bold mb-1">📚 {topic.topic}</p>
                                <p className="text-indigo-700 text-xs mb-1">{topic.description}</p>
                                <p className="text-indigo-600 text-xs italic">💭 {topic.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      {aiAnalysisResults[log.id].recommendation && (
                        <div className={`border-2 rounded-lg p-3 ${
                          aiAnalysisResults[log.id].recommendation === 'approve' ? 'bg-green-100 border-green-300' :
                          aiAnalysisResults[log.id].recommendation === 'reject' ? 'bg-red-100 border-red-300' :
                          'bg-blue-100 border-blue-300'
                        }`}>
                          <p className={`font-bold text-sm mb-1 ${
                            aiAnalysisResults[log.id].recommendation === 'approve' ? 'text-green-900' :
                            aiAnalysisResults[log.id].recommendation === 'reject' ? 'text-red-900' :
                            'text-blue-900'
                          }`}>
                            🤖 {aiAnalysisResults[log.id].recommendation === 'approve' ? '✅ Nên duyệt' :
                                aiAnalysisResults[log.id].recommendation === 'reject' ? '❌ Nên từ chối' :
                                '🔍 Cần xem xét'}
                          </p>
                          <p className="text-slate-700 text-xs">{aiAnalysisResults[log.id].reason}</p>
                        </div>
                      )}
                      </div>
                      )}
                      </motion.div>
                      ))}
              {filteredQuestions.length > 20 && (
                <p className="text-center text-sm text-slate-600 mt-4">
                  Hiển thị 20 / {filteredQuestions.length} câu hỏi
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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