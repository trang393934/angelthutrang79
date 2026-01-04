import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Database, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

export default function DataIntegrityCheck() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const result = await base44.functions.invoke('validateAndFixAllBalances', {});
      setValidationReport(result.data);
    } catch (error) {
      alert('❌ Lỗi khi validate: ' + error.message);
    }
    setIsValidating(false);
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-pink-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('AdminDashboard')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <h1 className="text-slate-900 font-semibold">Data Integrity Check</h1>
            </div>

            <Button
              onClick={runValidation}
              disabled={isValidating}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {isValidating ? 'Đang Kiểm Tra...' : 'Validate & Fix All'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {!validationReport ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 360],
              }}
              transition={{ 
                scale: { duration: 2, repeat: Infinity },
                rotate: { duration: 20, repeat: Infinity, ease: "linear" }
              }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto mb-6 shadow-2xl"
            >
              <Database className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-slate-900 text-2xl font-bold mb-4">Kiểm Tra Tính Toàn Vẹn Dữ Liệu</h2>
            <p className="text-purple-700 font-medium mb-8 max-w-2xl mx-auto">
              Quét toàn bộ database để phát hiện và tự động sửa các sai lệch trong balance của users
            </p>
            <Button
              onClick={runValidation}
              disabled={isValidating}
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-8 py-6 text-lg shadow-xl hover:shadow-2xl"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Đang Quét Database...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Bắt Đầu Kiểm Tra
                </>
              )}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 shadow-xl border-2 border-white">
                <Database className="w-8 h-8 text-white mb-2" />
                <p className="text-white/90 text-xs mb-1">Tổng Users</p>
                <p className="text-white text-3xl font-bold">{validationReport.summary.total_users}</p>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-6 shadow-xl border-2 border-white">
                <AlertTriangle className="w-8 h-8 text-white mb-2" />
                <p className="text-white/90 text-xs mb-1">Có Vấn Đề</p>
                <p className="text-white text-3xl font-bold">{validationReport.summary.inconsistent_count}</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl border-2 border-white">
                <CheckCircle2 className="w-8 h-8 text-white mb-2" />
                <p className="text-white/90 text-xs mb-1">Đã Fix</p>
                <p className="text-white text-3xl font-bold">{validationReport.summary.fixed_count}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 shadow-xl border-2 border-white">
                <TrendingUp className="w-8 h-8 text-white mb-2" />
                <p className="text-white/90 text-xs mb-1">Tỷ Lệ Chính Xác</p>
                <p className="text-white text-3xl font-bold">
                  {((1 - validationReport.summary.inconsistent_count / validationReport.summary.total_users) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Inconsistent Users Detail */}
            {validationReport.report.inconsistent_users.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl border-2 border-red-300 rounded-3xl p-6 shadow-xl">
                <h3 className="text-red-900 font-bold text-xl mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  Users Có Sai Lệch Đã Fix ({validationReport.report.inconsistent_users.length})
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {validationReport.report.inconsistent_users.map((user, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-red-50 border-2 border-red-300 rounded-2xl p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <Link 
                            to={createPageUrl('UserProfile') + '?email=' + encodeURIComponent(user.email)}
                            className="text-slate-900 font-bold text-lg hover:text-purple-600 transition-colors"
                          >
                            {user.email}
                          </Link>
                          <div className="flex gap-2 mt-2">
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              {user.transaction_count} transactions
                            </Badge>
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              {user.audit_log_count} audit logs
                            </Badge>
                          </div>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                      </div>

                      <div className="space-y-2 text-sm">
                        {user.issues.map((issue, i) => (
                          <div key={i} className="bg-white/60 border border-red-200 rounded-lg p-3">
                            <p className="text-red-900 font-mono">{issue}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white/80 rounded-lg p-3 border border-red-200">
                          <p className="text-red-700 font-bold mb-2">❌ Trước Fix:</p>
                          <div className="space-y-1 font-mono text-slate-700">
                            <p>Tổng Kiếm: {user.current.total_earned.toLocaleString()}</p>
                            <p>Chờ Duyệt: {user.current.unpaid_amount.toLocaleString()}</p>
                            <p>Available: {user.current.available_balance.toLocaleString()}</p>
                            <p>Frozen: {user.current.frozen_balance.toLocaleString()}</p>
                            <p>Pending Review: {user.current.pending_review_balance.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3 border border-green-200">
                          <p className="text-green-700 font-bold mb-2">✅ Sau Fix:</p>
                          <div className="space-y-1 font-mono text-slate-700">
                            <p>Tổng Kiếm: {user.expected.total_earned.toLocaleString()}</p>
                            <p>Chờ Duyệt: {user.expected.unpaid_amount.toLocaleString()}</p>
                            <p>Available: {user.expected.available_balance.toLocaleString()}</p>
                            <p>Frozen: {user.expected.frozen_balance.toLocaleString()}</p>
                            <p>Pending Review: {user.expected.pending_review_balance.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* All Clean */}
            {validationReport.report.inconsistent_users.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-12 shadow-2xl text-center"
              >
                <CheckCircle2 className="w-20 h-20 text-white mx-auto mb-6" />
                <h3 className="text-white text-3xl font-bold mb-3">✨ Database Hoàn Hảo!</h3>
                <p className="text-white/90 text-lg">
                  Tất cả {validationReport.summary.total_users} users đều có dữ liệu chính xác 100%
                </p>
              </motion.div>
            )}

            {/* Errors */}
            {validationReport.report.errors.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl border-2 border-orange-300 rounded-3xl p-6 shadow-xl">
                <h3 className="text-orange-900 font-bold text-xl mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  Errors ({validationReport.report.errors.length})
                </h3>
                <div className="space-y-2">
                  {validationReport.report.errors.map((err, idx) => (
                    <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-orange-900 font-semibold">{err.email}</p>
                      <p className="text-orange-700 text-sm">{err.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Re-run Button */}
            <div className="text-center">
              <Button
                onClick={runValidation}
                disabled={isValidating}
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-8 py-6 shadow-xl"
              >
                {isValidating ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5 mr-2" />
                )}
                Chạy Lại Kiểm Tra
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}