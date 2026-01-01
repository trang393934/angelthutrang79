import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Loader2, CheckCircle, Users, BarChart3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminAuditControl() {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch pending review items across all users
  const { data: allBalances = [] } = useQuery({
    queryKey: ['all-balances-pending'],
    queryFn: () => base44.entities.CamlycoinBalance.list('-pending_review_balance'),
    enabled: isAdmin,
  });

  const runAuditMutation = useMutation({
    mutationFn: async ({ target_email, batch_size, audit_all }) => {
      setIsRunning(true);
      const response = await base44.functions.invoke('comprehensiveAudit', {
        target_user_email: target_email || null,
        batch_size: batch_size || 50,
        audit_all: audit_all || false
      });
      setAuditResults(response.data);
      setIsRunning(false);
      queryClient.invalidateQueries();
      return response.data;
    }
  });

  const approvePendingReviewMutation = useMutation({
    mutationFn: async ({ user_email }) => {
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email });
      if (balances.length > 0) {
        const balance = balances[0];
        const pendingAmount = balance.pending_review_balance || 0;
        
        await base44.entities.CamlycoinBalance.update(balance.id, {
          pending_withdrawal_balance: (balance.pending_withdrawal_balance || 0) + pendingAmount,
          available_balance: (balance.available_balance || 0) + pendingAmount,
          pending_review_balance: 0
        });

        // Log transaction
        await base44.entities.CamlycoinTransaction.create({
          user_email,
          amount: 0,
          type: 'admin_adjustment',
          description: `✅ Admin approved pending review coins: +${pendingAmount} to available`,
          processed_by: currentUser.email
        });
      }

      queryClient.invalidateQueries({ queryKey: ['all-balances-pending'] });
    }
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  const totalPendingReview = allBalances.reduce((sum, b) => sum + (b.pending_review_balance || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('AuditDashboard')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Comprehensive Audit</h1>
                <p className="text-purple-600 text-xs font-medium">100% Question Review System</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Run Audit Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-8 shadow-xl mb-8"
        >
          <h3 className="text-slate-900 font-bold text-2xl mb-6 flex items-center gap-2">
            <Play className="w-6 h-6 text-indigo-500" />
            Run Comprehensive Audit
          </h3>

          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 mb-6">
            <p className="text-sm text-indigo-900 font-medium mb-2">
              📊 Audit sẽ review 100% câu hỏi của users từ câu đầu tiên, phân loại:
            </p>
            <ul className="text-xs text-indigo-800 space-y-1 ml-4">
              <li>• Duplicate questions (similarity &gt;85%) → Frozen</li>
              <li>• Greetings/non-questions → Frozen</li>
              <li>• Questions 11+ per day → Pending Review</li>
              <li>• Valid questions → Pending Withdrawal</li>
            </ul>
          </div>

          <Input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Email cụ thể (để trống = audit batch 50 users)"
            className="bg-white border-2 border-indigo-300 mb-4 rounded-xl"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => runAuditMutation.mutate({ 
                target_email: targetEmail || null,
                batch_size: 50
              })}
              disabled={isRunning}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl py-6 text-lg font-bold shadow-2xl disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Running Audit...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Audit 50 Users
                </>
              )}
            </Button>

            <Button
              onClick={() => runAuditMutation.mutate({ 
                target_email: null,
                batch_size: null,
                audit_all: true
              })}
              disabled={isRunning}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-6 text-lg font-bold shadow-2xl disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Running Full Audit...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 mr-2" />
                  Audit ALL Users
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Audit Results */}
        {auditResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-8 shadow-xl mb-8"
          >
            <h3 className="text-slate-900 font-bold text-2xl mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              Audit Results
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                <p className="text-xs text-red-600 font-medium mb-1">Total Frozen</p>
                <p className="text-red-700 text-3xl font-bold">{auditResults.summary.total_frozen.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <p className="text-xs text-blue-600 font-medium mb-1">Pending Review</p>
                <p className="text-blue-700 text-3xl font-bold">{auditResults.summary.total_pending_review.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                <p className="text-xs text-green-600 font-medium mb-1">Valid</p>
                <p className="text-green-700 text-3xl font-bold">{auditResults.summary.total_valid.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditResults.results.map((result, idx) => (
                <div key={idx} className="bg-white border-2 border-green-200 rounded-2xl p-4">
                  <p className="font-bold text-slate-900 mb-2">{result.user_email}</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-slate-600">Total Q</p>
                      <p className="font-bold text-slate-900">{result.total_questions}</p>
                    </div>
                    <div>
                      <p className="text-red-600">Frozen</p>
                      <p className="font-bold text-red-700">{result.frozen_coins.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-blue-600">Pending</p>
                      <p className="font-bold text-blue-700">{result.pending_review_coins.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-green-600">Valid</p>
                      <p className="font-bold text-green-700">{result.valid_coins.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pending Review Approval Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-8 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-2xl mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Pending Review Approval ({totalPendingReview.toLocaleString()} coins)
          </h3>

          <div className="space-y-3">
            {allBalances.filter(b => (b.pending_review_balance || 0) > 0).map((balance) => (
              <div key={balance.id} className="bg-white border-2 border-blue-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{balance.user_email}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Pending: <strong>{balance.pending_review_balance.toLocaleString()} Camly</strong>
                    </p>
                  </div>
                  <Button
                    onClick={() => approvePendingReviewMutation.mutate({ user_email: balance.user_email })}
                    size="sm"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve → Available
                  </Button>
                </div>
              </div>
            ))}

            {allBalances.filter(b => (b.pending_review_balance || 0) > 0).length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                <p className="text-slate-700 font-medium">No pending review items</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}