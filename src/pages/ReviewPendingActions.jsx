import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, CheckCircle2, XCircle, Clock, AlertTriangle, Filter, Calendar, User, Coins, Eye, ChevronDown, ChevronUp, Loader2, CheckSquare, XSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function ReviewPendingActions() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterReason, setFilterReason] = useState('all');
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [adminNote, setAdminNote] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch audit logs (pending review + frozen)
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['pending-audit-logs'],
    queryFn: async () => {
      const logs = await base44.entities.QuestionAuditLog.list('-question_date', 1000);
      return logs.filter(log => 
        log.coin_category === 'pending_review' || 
        log.coin_category === 'frozen'
      );
    },
    enabled: isAdmin,
  });

  // Approve logs mutation - LOGIC MỚI
  const approveMutation = useMutation({
    mutationFn: async ({ logIds, reason }) => {
      const response = await base44.functions.invoke('approveAdminReviewQuestion', {
        log_ids: logIds,
        reason: reason
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-audit-logs'] });
      setSelectedLogs(new Set());
      setAdminNote('');
      alert('✅ Đã duyệt thành công!');
    }
  });

  // Reject logs mutation - LOGIC MỚI
  const rejectMutation = useMutation({
    mutationFn: async ({ logIds, reason }) => {
      const response = await base44.functions.invoke('rejectAdminReviewQuestion', {
        log_ids: logIds,
        reason: reason
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-audit-logs'] });
      setSelectedLogs(new Set());
      setAdminNote('');
      alert('❌ Đã từ chối!');
    }
  });

  const toggleSelectLog = (logId) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedLogs(newSelected);
  };

  const selectAll = () => {
    setSelectedLogs(new Set(filteredLogs.map(log => log.id)));
  };

  const deselectAll = () => {
    setSelectedLogs(new Set());
  };

  const filteredLogs = auditLogs.filter(log => {
    if (filterReason !== 'all' && log.exclusion_reason !== filterReason) return false;
    if (filterUser && !log.user_email.toLowerCase().includes(filterUser.toLowerCase())) return false;
    if (dateFrom && new Date(log.question_date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(log.question_date) > new Date(dateTo)) return false;
    return true;
  });

  const stats = {
    pending_review: auditLogs.filter(l => l.coin_category === 'pending_review').length,
    frozen: auditLogs.filter(l => l.coin_category === 'frozen').length,
    duplicate: auditLogs.filter(l => l.exclusion_reason === 'duplicate').length,
    greeting: auditLogs.filter(l => l.exclusion_reason === 'greeting').length,
    excess: auditLogs.filter(l => l.exclusion_reason === 'exceeds_daily_limit').length,
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50 to-purple-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-indigo-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('AdminAuditControl')}>
              <Button variant="ghost" size="icon" className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(99,102,241,0.4)',
                    '0 0 40px rgba(99,102,241,0.6)',
                    '0 0 20px rgba(99,102,241,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"
              >
                <Shield className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Xét Duyệt Hành Động</h1>
                <p className="text-indigo-600 text-xs font-medium">Review Pending Actions</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-4 shadow-xl border-2 border-white"
          >
            <Clock className="w-6 h-6 text-white mb-2" />
            <p className="text-white/90 text-xs font-medium mb-1">Chờ Duyệt</p>
            <p className="text-white text-3xl font-bold">{stats.pending_review}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-4 shadow-lg"
          >
            <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
            <p className="text-slate-700 text-xs font-medium mb-1">Đóng Băng</p>
            <p className="text-slate-900 text-3xl font-bold">{stats.frozen}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-orange-200 rounded-3xl p-4 shadow-lg"
          >
            <div className="text-2xl mb-2">🔄</div>
            <p className="text-slate-700 text-xs font-medium mb-1">Trùng Lặp</p>
            <p className="text-slate-900 text-3xl font-bold">{stats.duplicate}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-yellow-200 rounded-3xl p-4 shadow-lg"
          >
            <div className="text-2xl mb-2">👋</div>
            <p className="text-slate-700 text-xs font-medium mb-1">Chào Hỏi</p>
            <p className="text-slate-900 text-3xl font-bold">{stats.greeting}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-4 shadow-lg"
          >
            <div className="text-2xl mb-2">📊</div>
            <p className="text-slate-700 text-xs font-medium mb-1">Vượt Hạn</p>
            <p className="text-slate-900 text-3xl font-bold">{stats.excess}</p>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-indigo-500" />
            <h3 className="text-slate-900 font-bold text-lg">Bộ Lọc</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-700 text-sm font-semibold mb-2 block">Lý Do</label>
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="w-full bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 text-slate-900"
              >
                <option value="all">Tất Cả</option>
                <option value="duplicate">Trùng Lặp</option>
                <option value="greeting">Chào Hỏi</option>
                <option value="exceeds_daily_limit">Vượt Hạn</option>
              </select>
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold mb-2 block">Người Dùng</label>
              <Input
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Email..."
                className="bg-white border-2 border-indigo-300"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold mb-2 block">Từ Ngày</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white border-2 border-indigo-300"
              />
            </div>

            <div>
              <label className="text-slate-700 text-sm font-semibold mb-2 block">Đến Ngày</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white border-2 border-indigo-300"
              />
            </div>
          </div>
        </motion.div>

        {/* Bulk Actions */}
        {selectedLogs.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-2xl mb-6 border-2 border-white"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-white font-bold text-lg">Đã Chọn {selectedLogs.size} Câu Hỏi</h3>
                  <p className="text-white/80 text-sm">Bulk Actions</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={deselectAll}
                className="text-white hover:bg-white/20"
              >
                Bỏ Chọn Tất Cả
              </Button>
            </div>

            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Ghi chú lý do duyệt/từ chối..."
              className="bg-white border-2 border-white/30 text-slate-900 mb-4"
            />

            <div className="flex gap-3">
              <Button
                onClick={() => approveMutation.mutate({ 
                  logIds: Array.from(selectedLogs), 
                  reason: adminNote || 'Admin duyệt hàng loạt' 
                })}
                disabled={approveMutation.isPending}
                className="flex-1 bg-white text-green-600 rounded-2xl py-6 font-bold hover:bg-green-50"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                Duyệt Tất Cả ({selectedLogs.size})
              </Button>
              <Button
                onClick={() => rejectMutation.mutate({ 
                  logIds: Array.from(selectedLogs), 
                  reason: adminNote || 'Admin từ chối hàng loạt' 
                })}
                disabled={rejectMutation.isPending}
                className="flex-1 bg-white text-red-600 rounded-2xl py-6 font-bold hover:bg-red-50"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5 mr-2" />
                )}
                Từ Chối Tất Cả ({selectedLogs.size})
              </Button>
            </div>
          </motion.div>
        )}

        {/* Audit Logs List */}
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl">
              <Shield className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Không có câu hỏi cần xét duyệt</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-700 font-semibold">
                  Hiển thị {filteredLogs.length} câu hỏi
                </p>
                <Button
                  variant="outline"
                  onClick={selectedLogs.size === filteredLogs.length ? deselectAll : selectAll}
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  {selectedLogs.size === filteredLogs.length ? 'Bỏ Chọn Tất Cả' : 'Chọn Tất Cả'}
                </Button>
              </div>

              {filteredLogs.map((log, idx) => {
                const isExpanded = expandedLog === log.id;
                const isSelected = selectedLogs.has(log.id);

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`bg-white/80 backdrop-blur-xl border-2 rounded-3xl shadow-lg transition-all ${
                      isSelected 
                        ? 'border-purple-400 bg-purple-50/50' 
                        : log.coin_category === 'pending_review' 
                        ? 'border-blue-200' 
                        : 'border-red-200'
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLog(log.id)}
                          className="mt-1 w-5 h-5 rounded border-2 border-purple-400 text-purple-600 focus:ring-purple-500"
                        />

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={
                                  log.coin_category === 'pending_review' 
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                                    : 'bg-red-100 text-red-800 border border-red-300'
                                }>
                                  {log.coin_category === 'pending_review' ? '⏳ Chờ Duyệt' : '❄️ Frozen'}
                                </Badge>
                                <Badge className={
                                  log.exclusion_reason === 'duplicate' ? 'bg-orange-100 text-orange-800' :
                                  log.exclusion_reason === 'greeting' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-purple-100 text-purple-800'
                                }>
                                  {log.exclusion_reason === 'duplicate' ? '🔄 Duplicate' :
                                   log.exclusion_reason === 'greeting' ? '👋 Greeting' :
                                   log.exclusion_reason === 'exceeds_daily_limit' ? '📊 Câu 11+' :
                                   log.exclusion_reason}
                                </Badge>
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                                  🪙 {log.coins_earned?.toLocaleString()} Camlycoin
                                </Badge>
                              </div>

                              <p className="text-slate-900 font-semibold mb-2 break-words">{log.question_text}</p>
                              
                              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {log.user_email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(log.question_date).toLocaleString('vi-VN')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="font-bold">#{log.question_number_in_day}</span>
                                  của ngày
                                </span>
                              </div>

                              {log.similar_to_question && (
                                <div className="mt-3 bg-orange-50 border border-orange-300 rounded-xl p-3">
                                  <p className="text-orange-900 text-xs font-semibold mb-1">
                                    Tương tự ({((log.similarity_score || 0) * 100).toFixed(0)}%):
                                  </p>
                                  <p className="text-orange-800 text-sm italic">"{log.similar_to_question}"</p>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </Button>
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-indigo-200 pt-4 mt-4"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div className="bg-indigo-50 rounded-xl p-3">
                                    <p className="text-indigo-900 text-xs font-semibold mb-1">Transaction ID:</p>
                                    <p className="text-indigo-700 text-sm font-mono">{log.transaction_id || 'N/A'}</p>
                                  </div>
                                  <div className="bg-indigo-50 rounded-xl p-3">
                                    <p className="text-indigo-900 text-xs font-semibold mb-1">Audit Date:</p>
                                    <p className="text-indigo-700 text-sm">{new Date(log.audit_date).toLocaleString('vi-VN')}</p>
                                  </div>
                                </div>

                                <div className="flex gap-3">
                                  <Button
                                    onClick={() => approveMutation.mutate({ 
                                      logIds: [log.id], 
                                      reason: `Duyệt riêng lẻ cho: ${log.user_email}` 
                                    })}
                                    disabled={approveMutation.isPending}
                                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl py-4 font-bold shadow-lg hover:shadow-xl"
                                  >
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Duyệt Câu Này
                                  </Button>
                                  <Button
                                    onClick={() => rejectMutation.mutate({ 
                                      logIds: [log.id], 
                                      reason: `Từ chối riêng lẻ cho: ${log.user_email}` 
                                    })}
                                    disabled={rejectMutation.isPending}
                                    className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl py-4 font-bold shadow-lg hover:shadow-xl"
                                  >
                                    <XCircle className="w-5 h-5 mr-2" />
                                    Từ Chối Câu Này
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}