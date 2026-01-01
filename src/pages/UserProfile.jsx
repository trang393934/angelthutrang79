import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Coins, Wallet, TrendingUp, TrendingDown, Clock, History, Copy, Check, Camera, Loader2, CheckCircle2, DollarSign, X, Activity, Lock, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { AnimatePresence } from 'framer-motion';

export default function UserProfile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
    enabled: !!targetEmail && !!isAdmin,
  });

  // Fetch target user's transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['user-transactions', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: targetEmail }, '-created_date', 20);
    },
    enabled: !!targetEmail && !!isAdmin,
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
    },
    onError: (error) => {
      alert('❌ Lỗi khi chạy audit: ' + error.message);
    }
  });

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

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

        {/* Balance Overview - New Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {/* Total Balance */}
          <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-3xl p-6 shadow-xl border-2 border-white">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-6 h-6 text-white" />
              <span className="text-white/90 text-xs font-medium">Tổng Số Dư</span>
            </div>
            <p className="text-white text-3xl font-bold break-words">
              {(userBalance?.balance || 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>

          {/* Sẵn Sàng Thanh Toán */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <span className="text-slate-700 text-xs font-medium">Sẵn Sàng Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.available_balance || 0).toLocaleString()}
            </p>
            <p className="text-green-600 text-xs mt-1">✅ Admin Chuyển Khoản</p>
          </div>

          {/* Chờ Xét Duyệt (Pending Review) */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-blue-500" />
              <span className="text-slate-700 text-xs font-medium">Chờ Xét Duyệt</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.pending_review_balance || 0).toLocaleString()}
            </p>
            <p className="text-blue-600 text-xs mt-1">⏳ Câu 11+</p>
          </div>

          {/* Đóng Băng (Frozen) */}
          <div className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-6 h-6 text-red-500" />
              <span className="text-slate-700 text-xs font-medium">Đóng Băng</span>
            </div>
            <p className="text-slate-900 text-3xl font-bold break-words">
              {(userBalance?.frozen_balance || 0).toLocaleString()}
            </p>
            <p className="text-red-600 text-xs mt-1">❄️ Trùng/Chào</p>
          </div>
        </motion.div>

        {/* Debug Info - Admin Only */}
        {userBalance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-yellow-50 border-2 border-yellow-300 rounded-3xl p-6 shadow-lg mb-8"
          >
            <h3 className="text-yellow-900 font-bold mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Chi Tiết Balance (Debug)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">balance:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.balance || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">available_balance:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.available_balance || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">pending_review_balance:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.pending_review_balance || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">frozen_balance:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.frozen_balance || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">pending_withdrawal_balance:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.pending_withdrawal_balance || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">unpaid_amount:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.unpaid_amount || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">paid_amount:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.paid_amount || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">total_earned:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.total_earned || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-yellow-200">
                <p className="text-yellow-700 text-xs mb-1">total_spent:</p>
                <p className="text-yellow-900 font-bold">{(userBalance.total_spent || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 bg-white rounded-xl p-3 border border-yellow-300">
              <p className="text-yellow-800 text-xs font-semibold">
                📊 Công thức: balance = available_balance + pending_review_balance + frozen_balance
              </p>
              <p className="text-yellow-900 font-bold mt-2">
                Tính toán: {(userBalance.available_balance || 0).toLocaleString()} + {(userBalance.pending_review_balance || 0).toLocaleString()} + {(userBalance.frozen_balance || 0).toLocaleString()} = {((userBalance.available_balance || 0) + (userBalance.pending_review_balance || 0) + (userBalance.frozen_balance || 0)).toLocaleString()}
              </p>
              {((userBalance.available_balance || 0) + (userBalance.pending_review_balance || 0) + (userBalance.frozen_balance || 0)) !== (userBalance.balance || 0) && (
                <div className="mt-3 p-3 bg-red-100 border border-red-400 rounded-lg">
                  <p className="text-red-800 font-bold text-sm">
                    ⚠️ CẢNH BÁO: Số liệu không khớp!
                  </p>
                  <p className="text-red-700 text-xs mt-1">
                    Chênh lệch: {Math.abs(((userBalance.available_balance || 0) + (userBalance.pending_review_balance || 0) + (userBalance.frozen_balance || 0)) - (userBalance.balance || 0)).toLocaleString()} Camlycoin
                  </p>
                  <p className="text-red-600 text-xs mt-2">
                    💡 Balance phải được cập nhật = tổng các thành phần. Cần chạy lại comprehensive audit để đồng bộ.
                  </p>
                  <Button
                    onClick={() => runAuditMutation.mutate()}
                    disabled={runAuditMutation.isPending}
                    className="w-full mt-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                  >
                    {runAuditMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang Chạy Audit...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Chạy Comprehensive Audit
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}

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
                  <p><strong>Sẵn Sàng Thanh Toán:</strong> Coins hợp lệ, admin sẽ chuyển khoản ngày 1/10/20 hàng tháng</p>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Chờ Xét Duyệt:</strong> Coins từ câu hỏi thứ 11+ mỗi ngày (giới hạn 10 câu/ngày)</p>
                </div>
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p><strong>Đóng Băng:</strong> Coins từ câu hỏi trùng lặp hoặc chỉ chào hỏi (không học hỏi kiến thức)</p>
                </div>
              </div>
              <p className="text-xs text-purple-700 mt-3">
                💡 Xem chi tiết tại <Link to={createPageUrl('WalletBreakdown')} className="underline font-bold">Wallet Breakdown</Link>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Payment Action - Only for Admin */}
        {userBalance && (userBalance.available_balance || 0) > 0 && (
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