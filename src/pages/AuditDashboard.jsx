import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Search, Play, FileText, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AuditDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');
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
            audit_status: 'clean'
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['user-appeals'] });
    }
  });

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
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

        {/* Appeals Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            User Appeals ({appeals.filter(a => a.status === 'pending').length} pending)
          </h3>

          <div className="space-y-3">
            {appeals.filter(a => a.status === 'pending').map((appeal) => (
              <div key={appeal.id} className="bg-white border-2 border-amber-200 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-900">{appeal.user_email}</p>
                    <p className="text-sm text-slate-600">Frozen: {appeal.frozen_amount?.toLocaleString()} Camlycoin</p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">{appeal.appeal_type}</Badge>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                  <p className="text-sm text-slate-800 font-medium mb-1">Explanation:</p>
                  <p className="text-sm text-slate-700">{appeal.explanation}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const response = prompt('Admin response (optional):');
                      handleAppealMutation.mutate({
                        appeal_id: appeal.id,
                        action: 'approve',
                        admin_response: response || 'Approved - coins unfrozen'
                      });
                    }}
                    size="sm"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve & Unfreeze
                  </Button>
                  <Button
                    onClick={() => {
                      const response = prompt('Reason for rejection:');
                      if (response) {
                        handleAppealMutation.mutate({
                          appeal_id: appeal.id,
                          action: 'reject',
                          admin_response: response
                        });
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
              </div>
            ))}

            {appeals.filter(a => a.status === 'pending').length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-700 font-medium">No pending appeals</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}