import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Shield, Eye, FileText, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TransparencyDashboard() {
  const [user, setUser] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Fetch user's balance
  const { data: balance } = useQuery({
    queryKey: ['my-balance', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: user.email });
      return balances[0] || null;
    },
    enabled: !!user
  });

  // Fetch user's audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ['my-audit-logs', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return await base44.entities.QuestionAuditLog.filter({ user_email: user.email }, '-created_date', 1000);
    },
    enabled: !!user
  });

  // Fetch user's transactions
  const { data: transactions } = useQuery({
    queryKey: ['my-transactions', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return await base44.entities.CamlycoinTransaction.filter({ user_email: user.email }, '-created_date', 1000);
    },
    enabled: !!user
  });

  // Fetch user's withdrawals
  const { data: withdrawals } = useQuery({
    queryKey: ['my-withdrawals', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return await base44.entities.WithdrawalRequest.filter({ user_email: user.email }, '-created_date', 100);
    },
    enabled: !!user
  });

  // Calculate breakdown
  const breakdown = React.useMemo(() => {
    if (!auditLogs || !transactions || !withdrawals) return null;

    // Valid questions (first 10/day)
    const logsByDay = {};
    auditLogs.forEach(log => {
      const day = new Date(log.question_date).toISOString().split('T')[0];
      if (!logsByDay[day]) logsByDay[day] = [];
      logsByDay[day].push(log);
    });

    let validQuestions = 0;
    let frozenQuestions = 0;
    Object.values(logsByDay).forEach(dayLogs => {
      const valid = dayLogs.filter(log => log.exclusion_reason === 'valid')
        .sort((a, b) => new Date(a.question_date) - new Date(b.question_date));
      
      validQuestions += valid.slice(0, 10).reduce((sum, log) => sum + Math.floor(log.coins_earned || 0), 0);
    });

    auditLogs.forEach(log => {
      if (log.exclusion_reason !== 'valid' && log.coin_category === 'frozen') {
        frozenQuestions += Math.floor(log.coins_earned || 0);
      }
    });

    const rewards = transactions
      .filter(tx => ['bounty_reward', 'build_reward', 'manual_add', 'admin_adjustment'].includes(tx.type))
      .reduce((sum, tx) => sum + Math.floor(tx.amount || 0), 0);

    const deductions = transactions
      .filter(tx => tx.type === 'manual_deduct')
      .reduce((sum, tx) => sum + Math.floor(Math.abs(tx.amount || 0)), 0);

    const withdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + Math.floor(w.amount || 0), 0);

    return {
      validQuestions,
      frozenQuestions,
      rewards,
      deductions,
      withdrawn,
      calculated_net_valid: validQuestions + rewards - deductions,
      calculated_total: validQuestions + rewards - deductions + frozenQuestions,
      calculated_available: Math.max(0, validQuestions + rewards - deductions - withdrawn)
    };
  }, [auditLogs, transactions, withdrawals]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-600">Vui lòng đăng nhập để xem dashboard</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Dashboard Minh Bạch</h1>
          </div>
          <p className="text-slate-600">Kiểm tra chi tiết số dư và giao dịch của bạn</p>
        </motion.div>

        {/* System Status Alert */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <Card className="bg-yellow-50 border-2 border-yellow-300 p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-yellow-900 font-bold text-lg mb-2">⚠️ Thông Báo Quan Trọng</h3>
                <p className="text-yellow-800 mb-3">
                  Hệ thống đang trong quá trình kiểm tra và hiệu chỉnh để đảm bảo tính chính xác. 
                  Nếu bạn phát hiện sai sót trong số dư, vui lòng sử dụng nút "Báo Cáo Sai Sót" bên dưới.
                </p>
                <p className="text-yellow-700 text-sm font-semibold">
                  ✅ Cam kết: Mọi số liệu sẽ được audit minh bạch và bồi thường nếu có sai sót.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <p className="text-blue-100 text-sm mb-2">Tổng Kiếm Được</p>
            <p className="text-3xl font-bold">{(balance?.total_earned || 0).toLocaleString()}</p>
            <p className="text-blue-200 text-xs mt-2">= Net Valid + Frozen</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <p className="text-green-100 text-sm mb-2">Có Thể Rút</p>
            <p className="text-3xl font-bold">{(balance?.available_for_withdrawal || 0).toLocaleString()}</p>
            <p className="text-green-200 text-xs mt-2">= Net Valid - Paid</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <p className="text-orange-100 text-sm mb-2">Đã Rút</p>
            <p className="text-3xl font-bold">{(balance?.paid_amount || 0).toLocaleString()}</p>
            <p className="text-orange-200 text-xs mt-2">Withdrawals Completed</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['overview', 'breakdown', 'transactions', 'dispute'].map(tab => (
            <Button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              variant={selectedTab === tab ? 'default' : 'outline'}
              className={selectedTab === tab ? 'bg-blue-600' : ''}
            >
              {tab === 'overview' && '📊 Tổng Quan'}
              {tab === 'breakdown' && '🔍 Chi Tiết'}
              {tab === 'transactions' && '📝 Giao Dịch'}
              {tab === 'dispute' && '⚠️ Báo Cáo'}
            </Button>
          ))}
        </div>

        {/* Content */}
        {selectedTab === 'overview' && breakdown && (
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Công Thức Tính Toán</h3>
              <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm space-y-2">
                <div><span className="text-blue-600 font-bold">net_valid_coins</span> = Valid Questions (first 10/day) + Rewards - Deductions</div>
                <div><span className="text-orange-600 font-bold">frozen_balance</span> = Frozen Questions (duplicates, spam, 11+)</div>
                <div><span className="text-purple-600 font-bold">total_earned</span> = net_valid_coins + frozen_balance</div>
                <div><span className="text-green-600 font-bold">available_for_withdrawal</span> = net_valid_coins - paid_amount</div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">So Sánh Số Liệu</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Net Valid Coins</p>
                    <p className="text-lg font-bold text-slate-900">
                      DB: {(balance?.net_valid_coins || 0).toLocaleString()} | 
                      Tính: {(breakdown.calculated_net_valid || 0).toLocaleString()}
                    </p>
                  </div>
                  {Math.abs((balance?.net_valid_coins || 0) - breakdown.calculated_net_valid) === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Available for Withdrawal</p>
                    <p className="text-lg font-bold text-slate-900">
                      DB: {(balance?.available_for_withdrawal || 0).toLocaleString()} | 
                      Tính: {(breakdown.calculated_available || 0).toLocaleString()}
                    </p>
                  </div>
                  {Math.abs((balance?.available_for_withdrawal || 0) - breakdown.calculated_available) === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {selectedTab === 'breakdown' && breakdown && (
          <Card className="p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Phân Tích Chi Tiết</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-slate-700">✅ Valid Questions (first 10/day)</span>
                <span className="font-bold text-green-700">+{breakdown.validQuestions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-slate-700">🎁 Rewards (bounty, build, manual)</span>
                <span className="font-bold text-blue-700">+{breakdown.rewards.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-slate-700">➖ Deductions</span>
                <span className="font-bold text-red-700">-{breakdown.deductions.toLocaleString()}</span>
              </div>
              <div className="h-px bg-slate-300 my-2"></div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-slate-700 font-bold">= Net Valid Coins</span>
                <span className="font-bold text-purple-700 text-xl">{breakdown.calculated_net_valid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-slate-700">❄️ Frozen (spam, duplicates, 11+)</span>
                <span className="font-bold text-orange-700">+{breakdown.frozenQuestions.toLocaleString()}</span>
              </div>
              <div className="h-px bg-slate-300 my-2"></div>
              <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                <span className="text-slate-700 font-bold">= Total Earned</span>
                <span className="font-bold text-slate-900 text-xl">{breakdown.calculated_total.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        )}

        {selectedTab === 'transactions' && (
          <Card className="p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Lịch Sử Giao Dịch</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions?.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-900">{tx.type}</p>
                    <p className="text-xs text-slate-600">{tx.description}</p>
                    <p className="text-xs text-slate-500">{new Date(tx.created_date).toLocaleString()}</p>
                  </div>
                  <span className={`font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {selectedTab === 'dispute' && (
          <Card className="p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Báo Cáo Sai Sót</h3>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-4">
              <h4 className="font-bold text-blue-900 mb-2">📋 Hướng Dẫn</h4>
              <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
                <li>Kiểm tra kỹ số liệu trong tab "Chi Tiết"</li>
                <li>So sánh với tab "Tổng Quan"</li>
                <li>Nếu phát hiện sai sót, nhấn nút bên dưới</li>
                <li>Admin sẽ kiểm tra và phản hồi trong 24h</li>
              </ol>
            </div>
            <Button
              onClick={async () => {
                try {
                  await base44.entities.UserAppeal.create({
                    user_email: user.email,
                    appeal_type: 'balance_discrepancy',
                    description: `User reported balance discrepancy. Current balance: ${JSON.stringify(balance)}, Calculated: ${JSON.stringify(breakdown)}`,
                    status: 'pending',
                    priority: 'high'
                  });
                  alert('✅ Đã gửi báo cáo! Admin sẽ kiểm tra trong 24h.');
                } catch (error) {
                  alert('❌ Lỗi: ' + error.message);
                }
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              Báo Cáo Sai Sót Số Dư
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}