import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Search, Play, FileText, Users, TrendingUp, BarChart3, Clock, Ban, Unlock, Mail, Bell, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AuditDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, appeals, audit_logs
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch audit logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.SpamAuditLog.list('-audit_date', 100),
    enabled: isAdmin,
  });

  // Fetch appeals
  const { data: appeals = [] } = useQuery({
    queryKey: ['user-appeals'],
    queryFn: () => base44.entities.UserAppeal.list('-created_date', 50),
    enabled: isAdmin,
  });

  // Fetch all transactions for coin flow analysis
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all-transactions-audit'],
    queryFn: () => base44.entities.CamlycoinTransaction.list('-created_date', 500),
    enabled: isAdmin,
  });

  // Fetch all balances for user analysis
  const { data: allBalances = [] } = useQuery({
    queryKey: ['all-balances-audit'],
    queryFn: () => base44.entities.CamlycoinBalance.list('-spam_score'),
    enabled: isAdmin,
  });

  const runAuditMutation = useMutation({
    mutationFn: async ({ mode, user_email }) => {
      setIsRunningAudit(true);
      const response = await base44.functions.invoke('auditSpamAccounts', { 
        mode, 
        user_email,
        batch_size: 100
      });
      setAuditResults(response.data);
      setIsRunningAudit(false);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      return response.data;
    }
  });

  const handleAppealMutation = useMutation({
    mutationFn: async ({ appeal_id, action, admin_response }) => {
      const appeals = await base44.entities.UserAppeal.filter({ id: appeal_id });
      if (appeals.length === 0) return;
      
      const appeal = appeals[0];
      
      await base44.entities.UserAppeal.update(appeal_id, {
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_response,
        reviewed_by: currentUser.email,
        reviewed_date: new Date().toISOString()
      });

      // If approved, unfreeze coins
      if (action === 'approve') {
        const balances = await base44.entities.CamlycoinBalance.filter({ user_email: appeal.user_email });
        if (balances.length > 0) {
          const balance = balances[0];
          await base44.entities.CamlycoinBalance.update(balance.id, {
            available_balance: (balance.available_balance || 0) + (balance.frozen_balance || 0),
            frozen_balance: 0,
            audit_status: 'clean',
            spam_score: 0
          });

          // Create transaction log
          await base44.entities.CamlycoinTransaction.create({
            user_email: appeal.user_email,
            amount: 0,
            type: 'admin_adjustment',
            description: `✅ Appeal approved - ${balance.frozen_balance} coins unfrozen`,
            processed_by: currentUser.email
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['user-appeals'] });
      queryClient.invalidateQueries({ queryKey: ['all-balances-audit'] });
      setSelectedAppeal(null);
      setAdminResponse('');
    }
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ user_email, reason }) => {
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          audit_status: 'banned',
          frozen_balance: balance.balance,
          available_balance: 0
        });

        // Log the ban
        await base44.asServiceRole.entities.SpamAuditLog.create({
          user_email,
          audit_date: new Date().toISOString(),
          total_questions: 0,
          spam_questions: 0,
          spam_ratio: 1,
          spam_score: 100,
          detection_reasons: [reason],
          questions_per_hour: 0,
          coins_frozen: balance.balance,
          action_taken: 'banned',
          admin_notes: `Banned by ${currentUser.email}`
        });

        // Send alert
        await base44.functions.invoke('sendAdminAlert', {
          alert_type: 'frozen_coins',
          user_email,
          details: `Admin ${currentUser.email} banned user. Reason: ${reason}`,
          severity: 'high'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['all-balances-audit'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    }
  });

  const unfreezeUserMutation = useMutation({
    mutationFn: async ({ user_email, reason }) => {
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          available_balance: balance.balance,
          frozen_balance: 0,
          audit_status: 'clean',
          spam_score: 0
        });

        // Create transaction log
        await base44.entities.CamlycoinTransaction.create({
          user_email,
          amount: 0,
          type: 'admin_adjustment',
          description: `✅ Admin unfroze all coins - ${reason}`,
          processed_by: currentUser.email
        });
      }

      queryClient.invalidateQueries({ queryKey: ['all-balances-audit'] });
    }
  });

  // Calculate chart data
  const chartData = React.useMemo(() => {
    // Daily coin flow (last 7 days)
    const dailyFlow = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days.push(dateStr);
      dailyFlow[dateStr] = { date: dateStr, issued: 0, frozen: 0 };
    }

    allTransactions.forEach(tx => {
      const dateStr = tx.created_date.split('T')[0];
      if (dailyFlow[dateStr] && tx.amount > 0) {
        dailyFlow[dateStr].issued += tx.amount;
      }
    });

    auditLogs.forEach(log => {
      const dateStr = log.audit_date.split('T')[0];
      if (dailyFlow[dateStr]) {
        dailyFlow[dateStr].frozen += (log.coins_frozen || 0);
      }
    });

    // Spam score distribution
    const scoreDistribution = {
      clean: allBalances.filter(b => (b.spam_score || 0) < 20).length,
      low: allBalances.filter(b => (b.spam_score || 0) >= 20 && (b.spam_score || 0) < 40).length,
      medium: allBalances.filter(b => (b.spam_score || 0) >= 40 && (b.spam_score || 0) < 70).length,
      high: allBalances.filter(b => (b.spam_score || 0) >= 70).length,
    };

    return {
      dailyFlow: last7Days.map(date => dailyFlow[date]),
      scoreDistribution: [
        { name: 'Clean', value: scoreDistribution.clean, color: '#10b981' },
        { name: 'Low Risk', value: scoreDistribution.low, color: '#fbbf24' },
        { name: 'Medium Risk', value: scoreDistribution.medium, color: '#f97316' },
        { name: 'High Risk', value: scoreDistribution.high, color: '#ef4444' }
      ]
    };
  }, [allTransactions, auditLogs, allBalances]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('RewardsManagement')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(147,51,234,0.4)',
                    '0 0 40px rgba(147,51,234,0.6)',
                    '0 0 20px rgba(147,51,234,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
              >
                <Shield className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Spam Audit Dashboard</h1>
                <p className="text-purple-600 text-xs font-medium">Fraud Detection & Account Review</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { id: 'overview', label: 'Overview & Charts', icon: BarChart3 },
            { id: 'appeals', label: 'User Appeals', icon: FileText },
            { id: 'audit_logs', label: 'Audit History', icon: Clock }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl py-6 font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl'
                    : 'bg-white border-2 border-purple-200 text-slate-900 hover:border-purple-400'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </Button>
            );
          })}
        </div>
        {/* Overview Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-xl border-2 border-white"
          >
            <Users className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Total Users Audited</p>
            <p className="text-white text-3xl font-bold">{auditLogs.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 shadow-xl border-2 border-white"
          >
            <AlertTriangle className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">High Risk Accounts</p>
            <p className="text-white text-3xl font-bold">
              {auditLogs.filter(log => log.spam_score >= 70).length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 shadow-xl border-2 border-white"
          >
            <FileText className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Pending Appeals</p>
            <p className="text-white text-3xl font-bold">
              {appeals.filter(a => a.status === 'pending').length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-xl border-2 border-white"
          >
            <TrendingUp className="w-8 h-8 text-white mb-3" />
            <p className="text-white/90 text-sm font-medium mb-1">Total Frozen</p>
            <p className="text-white text-3xl font-bold">
              {allBalances.reduce((sum, b) => sum + (b.frozen_balance || 0), 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Coin Flow Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-xl"
          >
            <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Coin Flow (7 ngày qua)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData.dailyFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="issued" stroke="#3b82f6" strokeWidth={3} name="Issued" />
                <Line type="monotone" dataKey="frozen" stroke="#ef4444" strokeWidth={3} name="Frozen" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Spam Score Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
          >
            <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Phân Bố Spam Score
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData.scoreDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Run Audit Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-8"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
            <Play className="w-6 h-6 text-purple-500" />
            Run Spam Audit
          </h3>

          <div className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Email cụ thể (để trống = audit tất cả)"
                className="flex-1 bg-white border-2 border-purple-300 rounded-xl"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => runAuditMutation.mutate({ mode: 'dry_run', user_email: searchEmail || null })}
                disabled={isRunningAudit}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl shadow-lg"
              >
                {isRunningAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Dry Run (Test Only)
              </Button>

              <Button
                onClick={() => runAuditMutation.mutate({ mode: 'execute', user_email: searchEmail || null })}
                disabled={isRunningAudit}
                className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl shadow-lg"
              >
                {isRunningAudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Execute (Freeze Coins)
              </Button>
            </div>

            {auditResults && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 mt-4">
                <h4 className="font-bold text-slate-900 mb-2">Audit Results:</h4>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-600">High Risk</p>
                    <p className="text-2xl font-bold text-red-600">{auditResults.summary.high_risk}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Medium Risk</p>
                    <p className="text-2xl font-bold text-orange-600">{auditResults.summary.medium_risk}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Low Risk</p>
                    <p className="text-2xl font-bold text-yellow-600">{auditResults.summary.low_risk}</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditResults.results.map((result, idx) => (
                    <div key={idx} className="bg-white border border-purple-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{result.user_email}</span>
                        <Badge className={
                          result.risk_level === 'HIGH' ? 'bg-red-100 text-red-800' :
                          result.risk_level === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {result.spam_score.toFixed(0)} / 100
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <p>Questions: {result.total_questions} | Coins: {result.total_coins.toLocaleString()}</p>
                        <p>Reasons: {result.detection_reasons.join(', ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Flagged Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Flagged Accounts ({allBalances.filter(b => (b.spam_score || 0) >= 50).length})
            </h3>
            <Button
              onClick={async () => {
                await base44.functions.invoke('sendAdminAlert', {
                  alert_type: 'high_spam_score',
                  user_email: 'system',
                  details: `${allBalances.filter(b => (b.spam_score || 0) >= 70).length} high-risk accounts detected`,
                  severity: 'high'
                });
                alert('Alert sent to all admins!');
              }}
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full"
            >
              <Bell className="w-4 h-4 mr-2" />
              Send Alert
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allBalances
              .filter(b => (b.spam_score || 0) >= 50)
              .slice(0, 20)
              .map((balance) => (
                <div key={balance.id} className="bg-white border-2 border-red-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{balance.user_email}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge className={
                          balance.spam_score >= 70 ? 'bg-red-100 text-red-800' :
                          'bg-orange-100 text-orange-800'
                        }>
                          Score: {balance.spam_score?.toFixed(0) || 0}
                        </Badge>
                        <Badge variant="outline" className="border-slate-300">
                          Frozen: {(balance.frozen_balance || 0).toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => {
                          const reason = prompt('Lý do unfreeze:');
                          if (reason) {
                            unfreezeUserMutation.mutate({ user_email: balance.user_email, reason });
                          }
                        }}
                        size="sm"
                        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full"
                      >
                        <Unlock className="w-4 h-4 mr-1" />
                        Unfreeze
                      </Button>
                      <Button
                        onClick={() => {
                          const reason = prompt('Lý do ban (PERMANENT):');
                          if (reason && confirm('Chắc chắn BAN user này?')) {
                            banUserMutation.mutate({ user_email: balance.user_email, reason });
                          }
                        }}
                        size="sm"
                        variant="outline"
                        className="border-red-400 text-red-700 hover:bg-red-50 rounded-full"
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        Ban
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
            </motion.div>
          )}

          {/* Appeals Tab */}
          {activeTab === 'appeals' && (
            <motion.div
              key="appeals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            User Appeals Management
          </h3>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { status: 'pending', label: 'Pending', color: 'yellow' },
              { status: 'approved', label: 'Approved', color: 'green' },
              { status: 'rejected', label: 'Rejected', color: 'red' }
            ].map(tab => {
              const count = appeals.filter(a => a.status === tab.status).length;
              return (
                <Badge
                  key={tab.status}
                  className={`cursor-pointer px-4 py-2 ${
                    tab.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    tab.color === 'green' ? 'bg-green-100 text-green-800 border-green-300' :
                    'bg-red-100 text-red-800 border-red-300'
                  }`}
                >
                  {tab.label} ({count})
                </Badge>
              );
            })}
          </div>

          <div className="space-y-3">
            {appeals.filter(a => a.status === 'pending').map((appeal) => (
              <div key={appeal.id} className="bg-white border-2 border-amber-200 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-bold text-slate-900 text-lg">{appeal.user_email}</p>
                      <Badge className="bg-amber-100 text-amber-800">{appeal.appeal_type}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs text-red-600 font-medium mb-1">Frozen Amount</p>
                        <p className="text-red-700 font-bold text-xl">{appeal.frozen_amount?.toLocaleString()}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-xs text-blue-600 font-medium mb-1">Submitted</p>
                        <p className="text-blue-700 font-semibold text-sm">
                          {new Date(appeal.created_date).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
                  <p className="text-sm text-amber-900 font-semibold mb-2">User's Explanation:</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{appeal.explanation}</p>
                  
                  {appeal.evidence_urls && appeal.evidence_urls.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-amber-700 font-medium mb-2">Evidence:</p>
                      {appeal.evidence_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" className="text-xs text-blue-600 hover:underline block">
                          🔗 Evidence {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-purple-50 border border-purple-300 rounded-xl p-3 mb-4">
                  <p className="text-xs text-purple-700 font-medium mb-2">Admin Response:</p>
                  <Textarea
                    value={selectedAppeal === appeal.id ? adminResponse : ''}
                    onChange={(e) => {
                      setSelectedAppeal(appeal.id);
                      setAdminResponse(e.target.value);
                    }}
                    placeholder="Nhập phản hồi cho user..."
                    className="bg-white border-purple-200 text-slate-900 text-sm min-h-[80px]"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAppealMutation.mutate({
                      appeal_id: appeal.id,
                      action: 'approve',
                      admin_response: adminResponse || 'Approved - coins unfrozen'
                    })}
                    disabled={selectedAppeal !== appeal.id || !adminResponse}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve & Unfreeze
                  </Button>
                  <Button
                    onClick={() => handleAppealMutation.mutate({
                      appeal_id: appeal.id,
                      action: 'reject',
                      admin_response: adminResponse || 'Rejected'
                    })}
                    disabled={selectedAppeal !== appeal.id || !adminResponse}
                    className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Appeal
                  </Button>
                </div>
              </div>
            ))}

            {appeals.filter(a => a.status === 'pending').length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-700 font-medium">No pending appeals</p>
              </div>
            )}
          </div>
        </motion.div>
            </motion.div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === 'audit_logs' && (
            <motion.div
              key="audit_logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-purple-500" />
            Audit History (Recent 50)
          </h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {auditLogs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="bg-white border-2 border-purple-200 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{log.user_email}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(log.audit_date).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={
                      log.action_taken === 'banned' ? 'bg-red-100 text-red-800' :
                      log.action_taken === 'frozen' ? 'bg-orange-100 text-orange-800' :
                      log.action_taken === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }>
                      {log.action_taken}
                    </Badge>
                    <Badge variant="outline" className="border-purple-300">
                      Score: {log.spam_score.toFixed(0)}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-2">
                    <p className="text-xs text-purple-600 font-medium">Questions</p>
                    <p className="text-purple-900 font-bold">{log.total_questions}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-2">
                    <p className="text-xs text-red-600 font-medium">Spam Ratio</p>
                    <p className="text-red-900 font-bold">{(log.spam_ratio * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-2">
                    <p className="text-xs text-orange-600 font-medium">Frozen</p>
                    <p className="text-orange-900 font-bold">{(log.coins_frozen || 0).toLocaleString()}</p>
                  </div>
                </div>

                {log.detection_reasons && log.detection_reasons.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-xs text-slate-600 font-medium mb-2">Detection Reasons:</p>
                    <div className="space-y-1">
                      {log.detection_reasons.map((reason, idx) => (
                        <p key={idx} className="text-xs text-slate-700">• {reason}</p>
                      ))}
                    </div>
                  </div>
                )}

                {log.admin_notes && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-2">
                    <p className="text-xs text-blue-700">📝 {log.admin_notes}</p>
                  </div>
                )}
              </motion.div>
            ))}

            {auditLogs.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                <p className="text-slate-700 font-medium">No audit logs yet</p>
              </div>
            )}
          </div>
        </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}