import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, Lock, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function WalletBreakdown() {
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user balance
  const { data: userBalance } = useQuery({
    queryKey: ['balance-breakdown', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || null;
    },
    enabled: !!currentUser,
  });

  // Fetch audit logs for this user
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs-user', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.QuestionAuditLog.filter({ user_email: currentUser.email }, '-question_date', 500);
    },
    enabled: !!currentUser,
  });

  const submitAppealMutation = useMutation({
    mutationFn: async ({ appeal_type, explanation }) => {
      return base44.functions.invoke('handleUserAppeal', {
        action: 'submit_appeal',
        appeal_type,
        explanation,
        evidence_urls: []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-appeals'] });
      setShowAppealForm(false);
      setAppealText('');
      alert('Kháng cáo đã được gửi! Admin sẽ xem xét trong 7-14 ngày.');
    }
  });

  const frozenLogs = auditLogs.filter(log => log.coin_category === 'frozen');
  const pendingReviewLogs = auditLogs.filter(log => log.coin_category === 'pending_review');
  const validLogs = auditLogs.filter(log => log.coin_category === 'pending_withdrawal');

  const categories = [
    {
      id: 'valid',
      title: 'Sẵn Sàng Rút',
      icon: CheckCircle,
      amount: userBalance?.pending_withdrawal_balance || 0,
      color: 'from-green-400 to-emerald-500',
      borderColor: 'border-green-300',
      logs: validLogs,
      description: 'Coins hợp lệ, đã được xác minh qua audit'
    },
    {
      id: 'pending',
      title: 'Chờ Review',
      icon: Clock,
      amount: userBalance?.pending_review_balance || 0,
      color: 'from-blue-400 to-indigo-500',
      borderColor: 'border-blue-300',
      logs: pendingReviewLogs,
      description: 'Coins từ câu hỏi thứ 11+ mỗi ngày, cần admin xem xét'
    },
    {
      id: 'frozen',
      title: 'Đóng Băng',
      icon: Lock,
      amount: userBalance?.frozen_balance || 0,
      color: 'from-red-400 to-rose-500',
      borderColor: 'border-red-300',
      logs: frozenLogs,
      description: 'Coins từ câu hỏi trùng lặp hoặc greeting, cần appeal để review'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('CamlycoinHistory')}>
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
                <Wallet className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Chi Tiết Ví</h1>
                <p className="text-purple-600 text-xs font-medium">Wallet Breakdown</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Appeal Form Modal */}
      <AnimatePresence>
        {showAppealForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAppealForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl"
            >
              <h3 className="text-slate-900 text-2xl font-bold mb-4">Gửi Kháng Cáo</h3>
              <p className="text-slate-700 mb-4 text-sm">
                Nếu bạn cho rằng coins bị frozen/pending không chính xác, hãy giải thích lý do. Admin sẽ xem xét trong 7-14 ngày.
              </p>

              <Textarea
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                placeholder="Giải thích tại sao bạn cho rằng câu hỏi không phải spam/duplicate/greeting..."
                className="bg-white border-2 border-purple-300 text-slate-900 min-h-[120px] mb-4"
              />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAppealForm(false);
                    setAppealText('');
                  }}
                  className="flex-1 border-2 border-slate-300 rounded-2xl"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => submitAppealMutation.mutate({
                    appeal_type: 'unfreeze_coins',
                    explanation: appealText
                  })}
                  disabled={!appealText.trim()}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl disabled:opacity-50"
                >
                  Gửi Kháng Cáo
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-4xl mx-auto">
        {/* Total Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-8 shadow-2xl mb-8 border-2 border-white"
        >
          <p className="text-white/90 text-sm font-medium mb-1">Tổng Số Dư</p>
          <p className="text-white text-5xl font-bold mb-2">
            {(userBalance?.balance || 0).toLocaleString()}
          </p>
          <p className="text-white/80 text-sm">Camlycoin</p>
          
          {userBalance?.last_audit_date && (
            <p className="text-white/70 text-xs mt-3">
              Audit lần cuối: {new Date(userBalance.last_audit_date).toLocaleString('vi-VN')}
            </p>
          )}
        </motion.div>

        {/* Categories */}
        <div className="space-y-4 mb-8">
          {categories.map((category, idx) => {
            const Icon = category.icon;
            const isExpanded = expandedCategory === category.id;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-white/80 backdrop-blur-xl border-2 ${category.borderColor} rounded-3xl shadow-xl overflow-hidden`}
              >
                <div 
                  onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                  className="p-6 cursor-pointer hover:bg-purple-50/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${category.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-slate-900 font-bold text-lg">{category.title}</h3>
                        <p className="text-slate-600 text-xs">{category.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-slate-900 font-bold text-2xl">{category.amount.toLocaleString()}</p>
                        <p className="text-slate-600 text-xs">Camlycoin</p>
                      </div>
                      {category.logs.length > 0 && (
                        <div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && category.logs.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-purple-200"
                    >
                      <div className="p-6 bg-purple-50/30 max-h-96 overflow-y-auto">
                        <div className="space-y-2">
                          {category.logs.slice(0, 50).map((log, idx) => (
                            <div key={log.id} className="bg-white border border-purple-200 rounded-2xl p-3">
                              <div className="flex items-start justify-between mb-2">
                                <Badge className={
                                  log.exclusion_reason === 'duplicate' ? 'bg-red-100 text-red-800' :
                                  log.exclusion_reason === 'greeting' ? 'bg-orange-100 text-orange-800' :
                                  log.exclusion_reason === 'exceeds_daily_limit' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }>
                                  {log.exclusion_reason === 'duplicate' ? '🔄 Duplicate' :
                                   log.exclusion_reason === 'greeting' ? '👋 Greeting' :
                                   log.exclusion_reason === 'exceeds_daily_limit' ? '📊 Limit Exceeded' :
                                   '✅ Valid'}
                                </Badge>
                                <span className="text-purple-700 font-bold">+{log.coins_earned}</span>
                              </div>
                              <p className="text-sm text-slate-800 mb-1">{log.question_text}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                  {new Date(log.question_date).toLocaleString('vi-VN')}
                                </p>
                                {log.question_number_in_day && (
                                  <Badge variant="outline" className="text-xs">
                                    Question #{log.question_number_in_day} of day
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {category.logs.length > 50 && (
                          <p className="text-xs text-slate-600 text-center mt-3">
                            Showing 50 of {category.logs.length} questions
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Appeal Button */}
        {userBalance && (userBalance.frozen_balance > 0 || userBalance.pending_review_balance > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-6 shadow-2xl border-2 border-white"
          >
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-6 h-6 text-white" />
              <div>
                <h3 className="text-white font-bold text-lg">Không Đồng Ý Với Kết Quả?</h3>
                <p className="text-white/90 text-sm">Gửi kháng cáo để admin xem xét lại</p>
              </div>
            </div>
            <Button
              onClick={() => setShowAppealForm(true)}
              className="w-full bg-white text-orange-600 rounded-2xl py-4 font-bold hover:bg-orange-50 shadow-lg"
            >
              📝 Gửi Kháng Cáo
            </Button>
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border-2 border-purple-300 rounded-3xl p-6 shadow-lg mt-8"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-purple-600 mt-1" />
            <div>
              <h4 className="text-purple-900 font-bold mb-2">Giải Thích Phân Loại</h4>
              <ul className="text-sm text-purple-800 space-y-2">
                <li><strong>✅ Sẵn Sàng Rút:</strong> Câu hỏi hợp lệ, có giá trị tri thức, được audit xác nhận</li>
                <li><strong>⏳ Chờ Review:</strong> Câu hỏi từ lượt 11 trở đi mỗi ngày (giới hạn 10 câu/ngày được thưởng)</li>
                <li><strong>❄️ Đóng Băng:</strong> Câu hỏi trùng lặp hoặc chỉ chào hỏi (không có ý định học hỏi)</li>
              </ul>
              <p className="text-xs text-purple-700 mt-3">
                💡 Nếu không đồng ý, bạn có thể gửi kháng cáo để admin xem xét lại
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}