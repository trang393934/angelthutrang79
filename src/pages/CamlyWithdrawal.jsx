import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, Send, AlertTriangle, CheckCircle, Loader2, Copy, ExternalLink, Clock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function CamlyWithdrawal() {
  const [currentUser, setCurrentUser] = useState(null);
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user balance
  const { data: userBalance } = useQuery({
    queryKey: ['camlycoin-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || { available_balance: 0, frozen_balance: 0 };
    },
    enabled: !!currentUser,
  });

  // Fetch withdrawal history
  const { data: withdrawals = [] } = useQuery({
    queryKey: ['withdrawal-history', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.WithdrawalRequest.filter({ user_email: currentUser.email }, '-created_date', 20);
    },
    enabled: !!currentUser,
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: async ({ address, amount }) => {
      setIsProcessing(true);
      const response = await base44.functions.invoke('processWithdrawal', {
        action: 'create_request',
        address,
        amount: parseFloat(amount)
      });
      setIsProcessing(false);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.approved) {
        setShowConfirmation(true);
        setWithdrawalAddress('');
        setWithdrawalAmount('');
        queryClient.invalidateQueries({ queryKey: ['withdrawal-history'] });
        queryClient.invalidateQueries({ queryKey: ['camlycoin-balance'] });
      }
    }
  });

  const validateAddress = (addr) => {
    if (!addr) {
      setValidationError('');
      return;
    }

    // Basic validation (40 hex chars with 0x prefix)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(addr)) {
      setValidationError('❌ Địa chỉ BEP-20 không hợp lệ (phải bắt đầu bằng 0x và có 42 ký tự)');
    } else {
      setValidationError('');
    }
  };

  const handleSubmit = () => {
    if (!withdrawalAddress || !withdrawalAmount) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (validationError) {
      alert('Vui lòng kiểm tra lại địa chỉ ví');
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    if (amount <= 0 || isNaN(amount)) {
      alert('Số tiền không hợp lệ');
      return;
    }

    if (!userBalance || amount > userBalance.available_balance) {
      alert('Số dư không đủ');
      return;
    }

    createWithdrawalMutation.mutate({ address: withdrawalAddress, amount });
  };

  const minWithdrawal = userBalance && (userBalance.spam_score || 0) >= 40 ? 200 : 50;
  const spamScore = userBalance?.spam_score || 0;

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
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Rút Camly</h1>
                <p className="text-amber-600 text-xs font-medium">BEP-20 Withdrawal</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-slate-900 text-2xl font-bold mb-2">Thành Công!</h3>
                <p className="text-slate-700 mb-6">
                  Yêu cầu rút Camly đã được gửi. Giao dịch sẽ được xử lý trong vòng 1-24 giờ.
                </p>
                <Button
                  onClick={() => setShowConfirmation(false)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-6 font-bold"
                >
                  Đóng
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-4xl mx-auto">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-3xl p-8 shadow-2xl mb-8 border-2 border-white"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/90 text-sm font-medium mb-1">Số Dư Có Thể Rút</p>
              <p className="text-white text-5xl font-bold">
                {(userBalance?.available_balance || 0).toLocaleString()}
              </p>
              <p className="text-white/80 text-sm mt-1">Camlycoin</p>
            </div>
            <Wallet className="w-16 h-16 text-white/30" />
          </div>

          {userBalance && userBalance.frozen_balance > 0 && (
            <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl p-3 mt-4">
              <p className="text-white/90 text-xs font-medium mb-1">⚠️ Số Dư Đóng Băng</p>
              <p className="text-white text-xl font-bold">{userBalance.frozen_balance.toLocaleString()} Camly</p>
              <p className="text-white/80 text-xs mt-1">Đang được xem xét - không thể rút</p>
            </div>
          )}
        </motion.div>

        {/* Risk Level Indicator */}
        {userBalance && (userBalance.spam_score || 0) >= 40 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-100 border-2 border-orange-400 rounded-3xl p-6 shadow-lg mb-8"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 mt-1" />
              <div>
                <h3 className="text-orange-900 font-bold text-lg mb-2">Điều Kiện Rút Đặc Biệt</h3>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Rút tối thiểu: 200 Camly</li>
                  <li>• Tối đa 50% số dư mỗi tháng</li>
                  <li>• Rút lớn (&gt;1000) cần admin review</li>
                  <li>• Cần {spamScore >= 70 ? '30' : '14'} ngày hoạt động clean</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Withdrawal Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-8 shadow-xl mb-8"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <Send className="w-6 h-6 text-purple-500" />
            Withdrawal Request
          </h3>

          <div className="space-y-6">
            {/* Wallet Address */}
            <div>
              <label className="text-slate-900 font-semibold mb-2 block text-sm">
                Địa Chỉ Ví BEP-20 (BNB Smart Chain)
              </label>
              <Input
                value={withdrawalAddress}
                onChange={(e) => {
                  setWithdrawalAddress(e.target.value);
                  validateAddress(e.target.value);
                }}
                placeholder="0x..."
                className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl text-sm font-mono"
              />
              {validationError && (
                <p className="text-red-600 text-xs mt-2">{validationError}</p>
              )}
              {withdrawalAddress && !validationError && (
                <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Địa chỉ hợp lệ ✓
                </p>
              )}
              <p className="text-slate-600 text-xs mt-2">
                💡 Hỗ trợ: MetaMask, Trust Wallet, Binance Wallet, SafePal, Coin98, và mọi ví BEP-20
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="text-slate-900 font-semibold mb-2 block text-sm">
                Số Lượng Camly
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder={`Tối thiểu ${minWithdrawal} Camly`}
                  className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl text-lg pr-24"
                />
                <Button
                  onClick={() => setWithdrawalAmount((userBalance?.available_balance || 0).toString())}
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-900"
                >
                  Max
                </Button>
              </div>
              <p className="text-slate-600 text-xs mt-2">
                Available: {(userBalance?.available_balance || 0).toLocaleString()} Camly
              </p>
            </div>

            {/* Estimated Fee */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-blue-900 font-semibold text-sm">Phí Gas Ước Tính</span>
                <span className="text-blue-600 font-bold">~0.0005 BNB (~$0.30)</span>
              </div>
              <p className="text-blue-700 text-xs mt-2">
                ⛽ Phí gas do hệ thống thanh toán, user không mất thêm phí
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!withdrawalAddress || !withdrawalAmount || validationError || isProcessing}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl py-6 text-lg font-bold shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Đang Xử Lý...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Gửi Yêu Cầu Rút
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Important Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-purple-50 border-2 border-purple-300 rounded-3xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-purple-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-purple-900 font-bold mb-3">Lưu Ý Quan Trọng</h4>
              <ul className="text-sm text-purple-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Kiểm tra kỹ địa chỉ ví - giao dịch blockchain KHÔNG THỂ hoàn tác</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Chỉ rút về địa chỉ BNB Smart Chain (BEP-20), KHÔNG phải Bitcoin hay Ethereum</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Thời gian xử lý: 1-24 giờ (có thể lâu hơn nếu cần review)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Giới hạn: 1 lần rút mỗi ngày</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600">•</span>
                  <span>Rút lớn (&gt;1000 Camly) sẽ được admin xem xét thủ công</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Withdrawal History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-500" />
            Lịch Sử Rút
          </h3>

          {withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-amber-300 mx-auto mb-3" />
              <p className="text-slate-700 font-medium">Chưa có yêu cầu rút nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w, idx) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white border-2 border-amber-100 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-slate-900 font-bold text-lg">{w.amount.toLocaleString()} Camly</p>
                      <p className="text-xs text-slate-600 font-mono break-all">
                        To: {w.withdrawal_address}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(w.created_date).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <Badge className={
                      w.status === 'completed' ? 'bg-green-100 text-green-800' :
                      w.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      w.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                      w.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      w.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {w.status}
                    </Badge>
                  </div>

                  {w.tx_hash && (
                    <a
                      href={`https://bscscan.com/tx/${w.tx_hash}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on BSCScan
                    </a>
                  )}

                  {w.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2 mt-2">
                      <p className="text-xs text-red-700">❌ {w.rejection_reason}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}