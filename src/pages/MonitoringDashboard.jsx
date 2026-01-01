import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, TrendingUp, Users, Coins, AlertTriangle, CheckCircle, Clock, BarChart3, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function MonitoringDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [timeRange, setTimeRange] = useState('24h'); // 24h, 7d, 30d

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch all transactions for analysis
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: () => base44.entities.CamlycoinTransaction.list('-created_date', 1000),
    enabled: isAdmin,
  });

  // Fetch all balances
  const { data: allBalances = [] } = useQuery({
    queryKey: ['all-balances'],
    queryFn: () => base44.entities.CamlycoinBalance.list('-balance'),
    enabled: isAdmin,
  });

  // Fetch recent audit logs
  const { data: recentAudits = [] } = useQuery({
    queryKey: ['recent-audits'],
    queryFn: () => base44.entities.SpamAuditLog.list('-audit_date', 50),
    enabled: isAdmin,
  });

  // Calculate time-based metrics
  const metrics = React.useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    
    if (timeRange === '24h') cutoff.setHours(cutoff.getHours() - 24);
    else if (timeRange === '7d') cutoff.setDate(cutoff.getDate() - 7);
    else if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);

    const recentTx = allTransactions.filter(tx => new Date(tx.created_date) >= cutoff);
    
    const totalIssued = recentTx.filter(tx => tx.amount > 0 && tx.type !== 'manual_add').reduce((sum, tx) => sum + tx.amount, 0);
    const totalQuestions = recentTx.filter(tx => tx.amount > 0 && tx.type !== 'manual_add').length;
    const uniqueUsers = new Set(recentTx.filter(tx => tx.amount > 0).map(tx => tx.user_email)).size;
    
    // Calculate hourly rate
    const hoursInRange = (now - cutoff) / (1000 * 60 * 60);
    const questionsPerHour = totalQuestions / hoursInRange;
    const coinsPerHour = totalIssued / hoursInRange;

    // Top earners in this period
    const userEarnings = {};
    recentTx.forEach(tx => {
      if (tx.amount > 0 && tx.type !== 'manual_add') {
        userEarnings[tx.user_email] = (userEarnings[tx.user_email] || 0) + tx.amount;
      }
    });
    const topEarners = Object.entries(userEarnings)
      .map(([email, amount]) => ({ email, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Flagged users (high spam score)
    const flaggedUsers = allBalances.filter(b => (b.spam_score || 0) >= 50);

    // Recent anomalies - users with very high question rate
    const userQuestionCounts = {};
    recentTx.forEach(tx => {
      if (tx.amount > 0 && tx.type !== 'manual_add') {
        userQuestionCounts[tx.user_email] = (userQuestionCounts[tx.user_email] || 0) + 1;
      }
    });
    const anomalies = Object.entries(userQuestionCounts)
      .filter(([_, count]) => count / hoursInRange > 15) // More than 15 questions/hour
      .map(([email, count]) => ({ email, count, rate: (count / hoursInRange).toFixed(1) }));

    return {
      totalIssued,
      totalQuestions,
      uniqueUsers,
      questionsPerHour: questionsPerHour.toFixed(1),
      coinsPerHour: coinsPerHour.toFixed(0),
      topEarners,
      flaggedUsers,
      anomalies
    };
  }, [allTransactions, allBalances, timeRange]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Activity className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50 to-indigo-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-blue-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('RewardsManagement')}>
              <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-900 hover:bg-blue-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(59,130,246,0.4)',
                    '0 0 40px rgba(59,130,246,0.6)',
                    '0 0 20px rgba(59,130,246,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
              >
                <Activity className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Real-Time Monitoring</h1>
                <p className="text-blue-600 text-xs font-medium">Coin Flow & Fraud Detection</p>
              </div>
            </div>

            <div className="flex gap-2">
              {['24h', '7d', '30d'].map(range => (
                <Button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  className={timeRange === range ? 'bg-blue-500 text-white' : 'border-blue-300 text-blue-700'}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-xl border-2 border-white"
          >
            <Coins className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Coins Issued</p>
            <p className="text-white text-3xl font-bold">{metrics.totalIssued.toLocaleString()}</p>
            <p className="text-white/80 text-xs mt-1">{metrics.coinsPerHour}/hour</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg"
          >
            <BarChart3 className="w-8 h-8 text-green-500 mb-3" />
            <p className="text-slate-700 text-sm font-medium mb-1">Questions Asked</p>
            <p className="text-slate-900 text-3xl font-bold">{metrics.totalQuestions}</p>
            <p className="text-green-600 text-xs mt-1">{metrics.questionsPerHour}/hour</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
          >
            <Users className="w-8 h-8 text-purple-500 mb-3" />
            <p className="text-slate-700 text-sm font-medium mb-1">Active Users</p>
            <p className="text-slate-900 text-3xl font-bold">{metrics.uniqueUsers}</p>
            <p className="text-purple-600 text-xs mt-1">unique users</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-6 shadow-lg"
          >
            <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
            <p className="text-slate-700 text-sm font-medium mb-1">Flagged Accounts</p>
            <p className="text-slate-900 text-3xl font-bold">{metrics.flaggedUsers.length}</p>
            <p className="text-red-600 text-xs mt-1">high risk</p>
          </motion.div>
        </div>

        {/* Anomalies Alert */}
        {metrics.anomalies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-red-500 to-orange-600 rounded-3xl p-6 shadow-2xl mb-8 border-2 border-white"
          >
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-8 h-8 text-white" />
              <div>
                <h3 className="text-white font-bold text-xl">⚠️ Real-Time Anomalies Detected</h3>
                <p className="text-white/90 text-sm">Users với tốc độ câu hỏi bất thường (>15/giờ)</p>
              </div>
            </div>
            <div className="space-y-2">
              {metrics.anomalies.map((anomaly, idx) => (
                <div key={idx} className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-white font-semibold">{anomaly.email}</span>
                  <Badge className="bg-white/30 text-white">
                    {anomaly.rate} questions/hour
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top Earners */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-8"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            Top Earners (Last {timeRange})
          </h3>
          <div className="space-y-2">
            {metrics.topEarners.map((user, idx) => (
              <div key={idx} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500 text-white w-8 h-8 flex items-center justify-center rounded-full">
                    {idx + 1}
                  </Badge>
                  <span className="text-slate-900 font-semibold">{user.email}</span>
                </div>
                <span className="text-amber-600 font-bold">{user.amount.toLocaleString()} coins</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Audit Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-purple-500" />
            Recent Audit Activity
          </h3>
          <div className="space-y-2">
            {recentAudits.slice(0, 10).map((audit, idx) => (
              <div key={idx} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl p-3">
                <div>
                  <p className="text-slate-900 font-semibold">{audit.user_email}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(audit.audit_date).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={
                    audit.action_taken === 'frozen' ? 'bg-red-100 text-red-800' :
                    audit.action_taken === 'under_review' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }>
                    {audit.action_taken}
                  </Badge>
                  <p className="text-xs text-slate-600 mt-1">Score: {audit.spam_score.toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}