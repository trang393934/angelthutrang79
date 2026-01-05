import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, CheckCircle, XCircle, Loader2, ExternalLink, Clock, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function WithdrawalManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch all withdrawal requests
  const { data: withdrawals = [] } = useQuery({
    queryKey: ['all-withdrawals'],
    queryFn: () => base44.entities.WithdrawalRequest.list('-created_date', 200),
    enabled: isAdmin,
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async (withdrawal_id) => {
      setIsProcessing(true);
      const response = await base44.functions.invoke('transferCamlyToWallet', {
        withdrawalRequestId: withdrawal_id
      });
      setIsProcessing(false);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-withdrawals'] });
      alert(`✅ Chuyển tiền thành công!\n💰 Số tiền: ${data.amount.toLocaleString()} Camlycoin\n📬 TX: ${data.tx_hash}\n⛽ Gas: ${data.gas_fee_bnb.toFixed(6)} BNB`);
    },
    onError: (error) => {
      setIsProcessing(false);
      alert('❌ Lỗi: ' + (error.response?.data?.error || error.message));
    }
  });

  const approveWithdrawalMutation = useMutation({
    mutationFn: async (withdrawal_id) => {
      // First approve
      await base44.entities.WithdrawalRequest.update(withdrawal_id, {
        status: 'approved',
        processed_by: currentUser.email,
        processed_date: new Date().toISOString()
      });

      // Then auto-transfer
      setIsProcessing(true);
      const response = await base44.functions.invoke('transferCamlyToWallet', {
        withdrawalRequestId: withdrawal_id
      });
      setIsProcessing(false);
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-withdrawals'] });
      alert(`✅ Đã duyệt và chuyển tiền thành công!\n💰 ${data.amount.toLocaleString()} Camlycoin\n📬 TX: ${data.tx_hash}`);
    },
    onError: (error) => {
      setIsProcessing(false);
      alert('❌ Lỗi: ' + (error.response?.data?.error || error.message));
    }
  });

  const rejectWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawal_id, reason }) => {
      await base44.functions.invoke('processWithdrawal', {
        action: 'reject',
        withdrawal_id,
        reason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-withdrawals'] });
    }
  });

  const filteredWithdrawals = withdrawals.filter(w => {
    if (filterStatus === 'all') return true;
    return w.status === filterStatus;
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Wallet className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('RewardsManagement')}>
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
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Withdrawal Management</h1>
                <p className="text-amber-600 text-xs font-medium">Admin Panel</p>
              </div>
            </div>

            <Button
              onClick={async () => {
                if (confirm('Chạy Auto-Process cho tất cả withdrawal pending?')) {
                  try {
                    const response = await base44.functions.invoke('autoProcessWithdrawal', {});
                    const results = response.data.results;
                    alert(`✅ Hoàn tất!\n\n🤖 Auto-approved: ${results.autoApproved}\n💸 Auto-transferred: ${results.autoTransferred}\n⏸️ Manual review: ${results.manualReviewRequired}\n❌ Errors: ${results.errors.length}`);
                    queryClient.invalidateQueries({ queryKey: ['all-withdrawals'] });
                  } catch (error) {
                    alert('❌ Lỗi: ' + error.message);
                  }
                }
              }}
              size="sm"
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full font-bold shadow-lg hover:shadow-xl"
            >
              🤖 Auto-Process All
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl p-6 shadow-xl border-2 border-white">
            <Clock className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Pending</p>
            <p className="text-white text-3xl font-bold">
              {withdrawals.filter(w => w.status === 'pending').length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-xl border-2 border-white">
            <Send className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Processing</p>
            <p className="text-white text-3xl font-bold">
              {withdrawals.filter(w => w.status === 'processing' || w.status === 'approved').length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 shadow-xl border-2 border-white">
            <CheckCircle className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Completed</p>
            <p className="text-white text-3xl font-bold">
              {withdrawals.filter(w => w.status === 'completed').length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl p-6 shadow-xl border-2 border-white">
            <XCircle className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Rejected</p>
            <p className="text-white text-3xl font-bold">
              {withdrawals.filter(w => w.status === 'rejected').length}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['pending', 'approved', 'processing', 'completed', 'rejected', 'all'].map(status => (
            <Button
              key={status}
              onClick={() => setFilterStatus(status)}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              className={filterStatus === status 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full'
                : 'border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full'
              }
            >
              {status.toUpperCase()} ({withdrawals.filter(w => status === 'all' ? true : w.status === status).length})
            </Button>
          ))}
        </div>

        {/* Withdrawals List */}
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal) => (
            <motion.div
              key={withdrawal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-lg"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-bold text-slate-900 text-xl">{withdrawal.amount.toLocaleString()} Camly</p>
                    <Badge className={
                      withdrawal.status === 'completed' ? 'bg-green-100 text-green-800' :
                      withdrawal.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                      withdrawal.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                      withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      withdrawal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {withdrawal.status}
                    </Badge>
                    <Badge className={
                      withdrawal.risk_level === 'high' ? 'bg-red-100 text-red-800' :
                      withdrawal.risk_level === 'medium' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }>
                      {withdrawal.risk_level} risk
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>User:</strong> {withdrawal.user_email}
                  </p>
                  <p className="text-xs text-slate-600 font-mono break-all mb-2">
                    <strong>Address:</strong> {withdrawal.withdrawal_address}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(withdrawal.created_date).toLocaleString('vi-VN')}
                  </p>
                  {withdrawal.gas_fee_bnb && (
                    <p className="text-xs text-slate-600 mt-1">
                      <strong>Gas Fee:</strong> ~{withdrawal.gas_fee_bnb.toFixed(6)} BNB
                    </p>
                  )}
                </div>
              </div>

              {withdrawal.tx_hash && (
                <a
                  href={`https://bscscan.com/tx/${withdrawal.tx_hash}`}
                  target="_blank"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-3"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Transaction on BSCScan
                </a>
              )}

              {withdrawal.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                  <p className="text-sm text-red-700">❌ {withdrawal.rejection_reason}</p>
                </div>
              )}

              {/* Auto-Approval Badge */}
              {withdrawal.status === 'pending' && 
               withdrawal.amount >= 100000 && 
               withdrawal.amount <= 500000 && 
               withdrawal.risk_level === 'low' && 
               !withdrawal.requires_manual_review && (
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 mb-3">
                  <p className="text-green-900 text-sm font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    ✅ Đủ điều kiện Auto-Approval
                  </p>
                  <p className="text-green-700 text-xs mt-1">
                    Số tiền: 100K-500K ✓ | Risk: Low ✓
                  </p>
                </div>
              )}

              {/* Admin Actions */}
              {withdrawal.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => approveWithdrawalMutation.mutate(withdrawal.id)}
                    disabled={isProcessing || approveWithdrawalMutation.isPending}
                    size="sm"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full"
                  >
                    {(isProcessing || approveWithdrawalMutation.isPending) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Duyệt & Chuyển
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      const reason = prompt('Lý do reject:');
                      if (reason) {
                        rejectWithdrawalMutation.mutate({ withdrawal_id: withdrawal.id, reason });
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 rounded-full"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}

              {withdrawal.status === 'approved' && (
                <Button
                  onClick={() => processWithdrawalMutation.mutate(withdrawal.id)}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing on Blockchain...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      💸 Chuyển Tiền Đến Ví
                    </>
                  )}
                </Button>
              )}
            </motion.div>
          ))}

          {filteredWithdrawals.length === 0 && (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Không có withdrawal nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}