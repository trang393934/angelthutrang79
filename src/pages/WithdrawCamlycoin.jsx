import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, Coins, AlertCircle, CheckCircle2, Clock, Send, Loader2, Info } from 'lucide-react';
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

  // Submit withdrawal request
  const submitWithdrawalMutation = useMutation({
    mutationFn: async ({ address, amount }) => {
      await base44.entities.WithdrawalRequest.create({
        user_email: currentUser.email,
        withdrawal_address: address,
        amount: parseFloat(amount),
        status: 'pending',
        verification_status: 'email_verified'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      setWithdrawalAddress('');
      setWithdrawalAmount('');
      alert('✅ Đã gửi yêu cầu rút tiền! Admin sẽ xem xét trong 24-48h.');
    },
    onError: (error) => {
      alert('❌ Lỗi: ' + error.message);
    }
  });

  const availableBalance = userBalance?.available_balance || 0;
  const canWithdraw = availableBalance >= 100000;

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
        {/* Balance Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/90 text-sm mb-1">Số Dư Sẵn Sàng Thanh Toán</p>
              <p className="text-white text-4xl font-bold">
                {availableBalance.toLocaleString()}
              </p>
              <p className="text-white/80 text-xs mt-1">Camlycoin</p>
            </div>
            <Coins className="w-16 h-16 text-white/30" />
          </div>
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
                <p className="text-xs text-slate-600 mt-1">
                  💡 Nhập địa chỉ ví Binance Smart Chain của bạn
                </p>
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
                  max={availableBalance}
                  className="bg-white border-2 border-amber-300 rounded-xl"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Tối đa: {availableBalance.toLocaleString()} Camlycoin
                </p>
              </div>

              <Button
                onClick={() => submitWithdrawalMutation.mutate({ 
                  address: withdrawalAddress, 
                  amount: withdrawalAmount 
                })}
                disabled={
                  !withdrawalAddress || 
                  !withdrawalAmount || 
                  parseFloat(withdrawalAmount) < 100000 || 
                  parseFloat(withdrawalAmount) > availableBalance ||
                  submitWithdrawalMutation.isPending
                }
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-6 font-bold shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {submitWithdrawalMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Gửi Yêu Cầu Rút Tiền
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
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span>Bạn sẽ nhận email thông báo khi yêu cầu được xử lý</span>
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
            Lịch Sử Yêu Cầu Rút Tiền
          </h3>

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
                    className="bg-white border-2 border-amber-100 rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={`border ${statusConfig.className}`}>
                            {statusConfig.label}
                          </Badge>
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold">
                            🪙 {req.amount.toLocaleString()} Camlycoin
                          </Badge>
                        </div>
                        <p className="text-slate-700 text-sm mb-2 break-all">
                          <strong>Địa chỉ:</strong> {req.withdrawal_address}
                        </p>
                        <p className="text-xs text-slate-600">
                          Tạo lúc: {new Date(req.created_date).toLocaleString('vi-VN')}
                        </p>
                        {req.processed_date && (
                          <p className="text-xs text-green-600 mt-1">
                            Xử lý: {new Date(req.processed_date).toLocaleString('vi-VN')}
                          </p>
                        )}
                        {req.rejection_reason && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                            <p className="text-red-800 text-xs">
                              <strong>Lý do từ chối:</strong> {req.rejection_reason}
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