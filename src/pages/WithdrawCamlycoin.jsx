import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, Coins, AlertCircle, CheckCircle2, Clock, Send, Loader2, Info, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function WithdrawCamlycoin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [showAutoClaimModal, setShowAutoClaimModal] = useState(false);
  const [autoClaimAmount, setAutoClaimAmount] = useState('');
  const [autoClaimAddress, setAutoClaimAddress] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
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

  // Fetch user's withdrawal requests
  const { data: withdrawalRequests = [] } = useQuery({
    queryKey: ['withdrawal-requests', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.WithdrawalRequest.filter({ user_email: currentUser.email }, '-created_date');
    },
    enabled: !!currentUser,
  });

  // Auto-fill địa chỉ ví từ lịch sử
  useEffect(() => {
    if (withdrawalRequests.length > 0 && !withdrawalAddress) {
      const lastAddress = withdrawalRequests[0].withdrawal_address;
      setWithdrawalAddress(lastAddress);
      setAutoClaimAddress(lastAddress);
    }
  }, [withdrawalRequests, withdrawalAddress]);



  // Calculate total withdrawn today (all successful withdrawals created today)
  const todayWithdrawnAmount = withdrawalRequests
    .filter(req => {
      const reqDate = new Date(req.created_date);
      const today = new Date();
      return reqDate.toDateString() === today.toDateString() && 
             (req.status === 'pending' || req.status === 'approved' || req.status === 'processing' || req.status === 'completed');
    })
    .reduce((sum, req) => sum + req.amount, 0);

  const DAILY_LIMIT = 500000;
  const remainingDailyLimit = Math.max(0, DAILY_LIMIT - todayWithdrawnAmount);

  // Submit AUTO withdrawal request
  const submitWithdrawalMutation = useMutation({
    mutationFn: async ({ address, amount }) => {
      const requestAmount = parseFloat(amount);

      // Validate min/max
      if (requestAmount < 100000) {
        throw new Error('Số tiền rút tối thiểu 100,000 Camlycoin');
      }

      if (requestAmount > 500000) {
        throw new Error('Số tiền rút tối đa 500,000 Camlycoin/ngày');
      }

      // Call auto-process function
      const response = await base44.functions.invoke('autoProcessWithdrawalRequest', {
        withdrawal_address: address,
        amount: requestAmount
      });

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      setWithdrawalAddress('');
      setWithdrawalAmount('');
      alert(`✅ Rút tiền tự động thành công!\n💰 ${data.amount_withdrawn.toLocaleString()} Camlycoin đã được chuyển vào ví\n📬 TX: ${data.tx_hash}\n⛽ Gas: ${data.gas_fee_bnb.toFixed(8)} BNB`);
    },
    onError: (error) => {
      alert('❌ Lỗi: ' + error.message);
    }
  });

  // Custom auto-claim mutation - Instant withdrawal
  const customAutoClaimMutation = useMutation({
    mutationFn: async ({ amount, address }) => {
      const requestAmount = parseFloat(amount);

      // Validate
      if (requestAmount < 100000) {
        throw new Error('Số tiền rút tối thiểu 100,000 Camlycoin');
      }

      if (requestAmount > 500000) {
        throw new Error('Số tiền rút tối đa 500,000 Camlycoin/ngày');
      }

      // Call auto-process function
      const response = await base44.functions.invoke('autoProcessWithdrawalRequest', {
        withdrawal_address: address,
        amount: requestAmount
      });

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      setShowAutoClaimModal(false);
      setAutoClaimAmount('');
      alert(`✅ Rút tiền tự động thành công!\n💰 ${data.amount_withdrawn.toLocaleString()} Camlycoin đã được chuyển vào ví\n📬 TX: ${data.tx_hash}\n⛽ Gas: ${data.gas_fee_bnb.toFixed(8)} BNB`);
    },
    onError: (error) => {
      alert('❌ Lỗi: ' + error.message);
    }
  });

  const availableBalance = userBalance?.available_balance || 0;
  const canWithdraw = availableBalance >= 100000;
  
  // Gas fee estimate in Camlycoin (assuming 0.0005 BNB ~ $0.30 ~ 13,636 Camlycoin at $0.000022/coin)
  const estimatedGasFeeInCamly = 13636;
  const hasEnoughForGas = availableBalance > 100000 + estimatedGasFeeInCamly;

  const getStatusBadge = (status) => {
    const configs = {
      pending: { label: '⏳ Chờ Duyệt', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      approved: { label: '✅ Đã Duyệt', className: 'bg-green-100 text-green-800 border-green-300' },
      processing: { label: '🔄 Đang Xử Lý', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      completed: { label: '✅ Hoàn Tất', className: 'bg-green-100 text-green-800 border-green-300' },
      rejected: { label: '❌ Từ Chối', className: 'bg-red-100 text-red-800 border-red-300' },
      failed: { label: '❌ Thất Bại', className: 'bg-red-100 text-red-800 border-red-300' }
    };
    return configs[status] || configs.pending;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-300/50 via-orange-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('CamlycoinHistory')}>
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
                className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center"
              >
                <Wallet className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Rút Camlycoin</h1>
                <p className="text-amber-600 text-xs font-medium">Withdrawal Request</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-4xl mx-auto">
        {/* Balance Display with Auto-Claim */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-white/90 text-sm mb-1">Số Dư Sẵn Sàng Thanh Toán</p>
              <p className="text-white text-4xl font-bold">
                {availableBalance.toLocaleString()}
              </p>
              <p className="text-white/80 text-xs mt-1">Camlycoin</p>
            </div>
            <Coins className="w-16 h-16 text-white/30" />
          </div>
          
          {/* Daily Limit Info */}
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/90 text-xs font-semibold">Giới Hạn Rút Hôm Nay</p>
                <p className="text-white text-lg font-bold">{remainingDailyLimit.toLocaleString()} / {DAILY_LIMIT.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-xs">Đã rút</p>
                <p className="text-white/90 text-sm font-bold">{todayWithdrawnAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-2 bg-white/20 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-400 to-emerald-400 h-full transition-all"
                style={{ width: `${Math.min(100, (todayWithdrawnAmount / DAILY_LIMIT) * 100)}%` }}
              />
            </div>
          </div>
          
          {canWithdraw && (
            <Button
              onClick={() => setShowAutoClaimModal(true)}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl py-4 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              🚀 Auto-Claim (Tùy Chỉnh)
            </Button>
          )}
          
          {/* Gas Fee Warning */}
          {canWithdraw && !hasEnoughForGas && (
            <div className="bg-red-100 border-2 border-red-300 rounded-2xl p-4 mt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-900 font-bold text-sm mb-1">
                    ⚠️ Cảnh Báo: Số Dư Thấp Cho Phí Gas
                  </p>
                  <p className="text-red-800 text-xs leading-relaxed">
                    Số dư của bạn (<strong>{availableBalance.toLocaleString()}</strong>) có thể không đủ để trừ phí gas (~<strong>{estimatedGasFeeInCamly.toLocaleString()}</strong> Camlycoin).<br/>
                    Để an toàn, nên có ít nhất <strong>{(100000 + estimatedGasFeeInCamly).toLocaleString()}</strong> Camlycoin trước khi rút.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Withdrawal Form */}
        {canWithdraw ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-8"
          >
            <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
              <Send className="w-6 h-6 text-amber-500" />
              Tạo Yêu Cầu Rút Tiền
            </h3>

            {/* Gas Fee Estimate */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-5 h-5 text-blue-600" />
                <p className="text-blue-900 font-bold text-sm">Phí Gas Ước Tính</p>
              </div>
              <p className="text-blue-800 text-xs">
                Mỗi giao dịch rút Camlycoin mất khoảng <strong>~0.0005 BNB</strong> phí gas trên BSC (khoảng $0.30 USD)
              </p>
              <p className="text-blue-700 text-xs mt-1">
                💡 Phí này do mạng BSC thu, không phải Angel AI
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-slate-700 text-sm font-semibold mb-2 block">
                  Địa chỉ ví BEP-20 (BSC)
                </label>
                <Input
                  value={withdrawalAddress}
                  onChange={(e) => setWithdrawalAddress(e.target.value)}
                  placeholder="0x..."
                  className="bg-white border-2 border-amber-300 rounded-xl"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-600">
                    💡 Nhập địa chỉ ví Binance Smart Chain
                  </p>
                  {withdrawalRequests.length > 0 && withdrawalAddress === withdrawalRequests[0].withdrawal_address && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      ✅ Đã lưu
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-700 text-sm font-semibold mb-2 block">
                  Số lượng Camlycoin
                </label>
                <Input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="Tối thiểu 100,000"
                  min="100000"
                  max={Math.min(availableBalance, remainingDailyLimit)}
                  className="bg-white border-2 border-amber-300 rounded-xl"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-600">
                    Tối đa: {Math.min(availableBalance, remainingDailyLimit).toLocaleString()} Camlycoin
                  </p>
                  <p className="text-xs text-orange-600 font-semibold">
                    Giới hạn/ngày: {remainingDailyLimit.toLocaleString()}
                  </p>
                </div>
              </div>



              {remainingDailyLimit <= 0 && (
                <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-red-900 font-bold text-sm mb-1">
                        ⚠️ Đã hết giới hạn rút hôm nay
                      </p>
                      <p className="text-red-800 text-xs">
                        Bạn đã rút {todayWithdrawnAmount.toLocaleString()} Camlycoin hôm nay. Vui lòng quay lại vào ngày mai.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
              onClick={() => submitWithdrawalMutation.mutate({ 
                address: withdrawalAddress, 
                amount: withdrawalAmount 
              })}
              disabled={
                !withdrawalAddress || 
                !withdrawalAmount || 
                parseFloat(withdrawalAmount) < 100000 || 
                parseFloat(withdrawalAmount) > 500000 ||
                parseFloat(withdrawalAmount) > availableBalance ||
                parseFloat(withdrawalAmount) > remainingDailyLimit ||
                submitWithdrawalMutation.isPending ||
                remainingDailyLimit <= 0
              }
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-6 font-bold shadow-lg hover:shadow-xl disabled:opacity-50"
              >
              {submitWithdrawalMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  ⚡ Rút Tự Động Ngay
                </>
              )}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-300 rounded-3xl p-6 shadow-lg mb-8"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-orange-600 flex-shrink-0" />
              <div>
                <h3 className="text-orange-900 font-bold text-lg mb-2">
                  Chưa Đủ Điều Kiện Rút Tiền
                </h3>
                <p className="text-orange-800 text-sm mb-3">
                  Bạn cần có ít nhất <strong>100,000 Camlycoin</strong> trong mục "Sẵn Sàng Thanh Toán" để có thể rút.
                </p>
                <div className="bg-white/60 border border-orange-300 rounded-xl p-3">
                  <p className="text-orange-900 text-sm">
                    Hiện tại: <strong>{availableBalance.toLocaleString()}</strong> Camlycoin<br/>
                    Cần thêm: <strong>{Math.max(0, 100000 - availableBalance).toLocaleString()}</strong> Camlycoin
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-3xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-blue-900 font-bold mb-2">Lưu Ý Quan Trọng</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span>Ngưỡng rút tối thiểu: <strong>100,000 Camlycoin</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold mt-0.5">⚡</span>
                  <span>Giới hạn rút: <strong>500,000 Camlycoin/người/ngày</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold mt-0.5">⚠️</span>
                  <span>Phí gas (~13,636 Camlycoin) sẽ được trừ từ số dư khi rút</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span>Chỉ rút được từ số dư <strong>"Sẵn Sàng Thanh Toán"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span>Admin sẽ xử lý trong <strong>24-48 giờ</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span>Địa chỉ ví phải là <strong>BEP-20 (BSC)</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">⚡</span>
                  <span><strong>RÚT TỰ ĐỘNG:</strong> Tiền sẽ được chuyển ngay lập tức vào ví của bạn (không cần admin duyệt)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 font-bold mt-0.5">📊</span>
                  <span>Giới hạn: <strong>100,000 - 500,000 Camlycoin/ngày</strong></span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Withdrawal History - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              Lịch Sử Yêu Cầu Rút Tiền
            </h3>
            <Badge className="bg-purple-100 text-purple-800 border-purple-300">
              {withdrawalRequests.length} yêu cầu
            </Badge>
          </div>

          {/* Summary Stats */}
          {withdrawalRequests.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-yellow-700 text-xs font-medium">⏳ Chờ Duyệt</p>
                <p className="text-yellow-900 text-xl font-bold">
                  {withdrawalRequests.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-green-700 text-xs font-medium">✅ Hoàn Tất</p>
                <p className="text-green-900 text-xl font-bold">
                  {withdrawalRequests.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-700 text-xs font-medium">❌ Từ Chối</p>
                <p className="text-red-900 text-xl font-bold">
                  {withdrawalRequests.filter(r => r.status === 'rejected').length}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-purple-700 text-xs font-medium">Tổng Đã Rút</p>
                <p className="text-purple-900 text-lg font-bold">
                  {withdrawalRequests.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {withdrawalRequests.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có yêu cầu rút tiền nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawalRequests.map((req, index) => {
                const statusConfig = getStatusBadge(req.status);
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white border-2 border-amber-100 rounded-2xl p-5 hover:shadow-lg transition-all"
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
                          {req.gas_fee_bnb && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                              ⛽ {req.gas_fee_bnb} BNB
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-700 text-sm mb-2 break-all">
                          <strong>Địa chỉ:</strong> {req.withdrawal_address}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Tạo: {new Date(req.created_date).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {req.processed_date && (
                          <p className="text-xs text-green-600 mt-1">
                            ✅ Xử lý: {new Date(req.processed_date).toLocaleString('vi-VN')} bởi {req.processed_by || 'Admin'}
                          </p>
                        )}
                        {req.rejection_reason && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                            <p className="text-red-800 text-xs">
                              <strong>❌ Lý do từ chối:</strong> {req.rejection_reason}
                            </p>
                          </div>
                        )}
                        {req.tx_hash && (
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mt-2">
                            <p className="text-green-900 text-xs font-bold mb-2">✅ Giao Dịch Thành Công</p>
                            <a
                              href={`https://bscscan.com/tx/${req.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-700 text-xs break-all hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="break-all">{req.tx_hash}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Auto-Claim Modal */}
        <AnimatePresence>
          {showAutoClaimModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowAutoClaimModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-slate-900 text-xl font-bold flex items-center gap-2">
                      🚀 Auto-Claim Tùy Chỉnh
                    </h3>
                    <p className="text-slate-600 text-sm mt-1">Tạo yêu cầu rút tự động</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAutoClaimModal(false)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-slate-700 text-sm font-semibold mb-2 block">
                      Số lượng Camlycoin
                    </label>
                    <Input
                      type="number"
                      value={autoClaimAmount}
                      onChange={(e) => setAutoClaimAmount(e.target.value)}
                      placeholder={`Max: ${Math.min(availableBalance, remainingDailyLimit).toLocaleString()}`}
                      min="100000"
                      max={Math.min(availableBalance, remainingDailyLimit)}
                      className="bg-white border-2 border-purple-300 rounded-xl"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAutoClaimAmount(Math.min(availableBalance, remainingDailyLimit).toString())}
                        className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                      >
                        Tối Đa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAutoClaimAmount('100000')}
                        className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        100K
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAutoClaimAmount('500000')}
                        className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        500K
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 text-sm font-semibold mb-2 block">
                      Địa chỉ ví BEP-20
                    </label>
                    <Input
                      value={autoClaimAddress}
                      onChange={(e) => setAutoClaimAddress(e.target.value)}
                      placeholder="0x..."
                      className="bg-white border-2 border-purple-300 rounded-xl"
                    />
                    <p className="text-xs text-slate-600 mt-1">
                      {withdrawalRequests.length > 0 && autoClaimAddress === withdrawalRequests[0].withdrawal_address ? 
                        '✅ Địa chỉ đã lưu' : 
                        '💡 Địa chỉ ví Binance Smart Chain'}
                    </p>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
                    <p className="text-green-900 text-xs leading-relaxed">
                      <strong>⚡ Rút Tự Động:</strong> Tiền sẽ được chuyển <strong>NGAY LẬP TỨC</strong> vào ví của bạn mà không cần admin duyệt. 
                      Bạn sẽ nhận email xác nhận với transaction hash.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowAutoClaimModal(false)}
                    className="flex-1 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-2xl"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => customAutoClaimMutation.mutate({ 
                      amount: autoClaimAmount, 
                      address: autoClaimAddress 
                    })}
                    disabled={
                      !autoClaimAmount || 
                      !autoClaimAddress || 
                      parseFloat(autoClaimAmount) < 100000 ||
                      parseFloat(autoClaimAmount) > Math.min(availableBalance, remainingDailyLimit) ||
                      customAutoClaimMutation.isPending
                    }
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {customAutoClaimMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Xác Nhận
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}