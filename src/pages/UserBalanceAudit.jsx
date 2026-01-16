import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Loader2, AlertTriangle, CheckCircle, XCircle, TrendingUp, Wallet, DollarSign, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function UserBalanceAudit() {
  const [userEmail, setUserEmail] = useState('');
  const [auditResults, setAuditResults] = useState(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleAudit = async () => {
    if (!userEmail.trim()) {
      toast.error('Vui lòng nhập email người dùng');
      return;
    }

    setIsAuditing(true);
    try {
      const { data } = await base44.functions.invoke('deepAuditSingleUser', { 
        user_email: userEmail.trim() 
      });
      
      if (data.error) {
        toast.error(data.error);
        setAuditResults(null);
      } else {
        setAuditResults(data);
        if (data.has_discrepancy) {
          toast.warning('Phát hiện chênh lệch trong số dư!');
        } else {
          toast.success('Số dư chính xác, không có chênh lệch');
        }
      }
    } catch (error) {
      toast.error('Lỗi khi audit: ' + error.message);
      setAuditResults(null);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleUpdateBalance = async () => {
    setShowConfirmDialog(false);
    setIsUpdating(true);
    
    try {
      const { data } = await base44.functions.invoke('correctSingleUserBalance', { 
        user_email: userEmail.trim() 
      });
      
      if (data.error) {
        toast.error('Lỗi cập nhật: ' + data.error);
      } else if (data.success) {
        toast.success('Đã cập nhật số dư thành công!');
        // Refresh audit results
        await handleAudit();
      }
    } catch (error) {
      toast.error('Lỗi khi cập nhật số dư: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatNumber = (num) => {
    return (num || 0).toLocaleString('vi-VN');
  };

  const renderDiscrepancyBadge = (value) => {
    if (value === 0) {
      return <Badge className="bg-green-100 text-green-800">Chính xác</Badge>;
    } else if (value > 0) {
      return <Badge className="bg-orange-100 text-orange-800">+{formatNumber(value)}</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">{formatNumber(value)}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-purple-600" />
            Công Cụ Audit Số Dư Người Dùng
          </h1>
          <p className="text-slate-600">Kiểm tra và chỉnh sửa số dư Camlycoin của người dùng một cách chính xác</p>
        </div>

        {/* Search Section */}
        <Card className="mb-6 border-2 border-purple-200 shadow-lg">
          <CardHeader>
            <CardTitle>Tìm Kiếm Người Dùng</CardTitle>
            <CardDescription>Nhập email người dùng cần audit số dư</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="user@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAudit()}
                disabled={isAuditing}
                className="flex-1"
              />
              <Button 
                onClick={handleAudit} 
                disabled={isAuditing || !userEmail.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang Audit...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Audit Người Dùng
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {auditResults && (
          <div className="space-y-6">
            {/* Status Alert */}
            <Alert className={auditResults.has_discrepancy ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'}>
              {auditResults.has_discrepancy ? (
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <AlertDescription className="ml-2">
                {auditResults.has_discrepancy ? (
                  <span className="font-semibold text-orange-900">
                    Phát hiện chênh lệch trong số dư của người dùng: {auditResults.user_email}
                  </span>
                ) : (
                  <span className="font-semibold text-green-900">
                    Số dư của người dùng {auditResults.user_email} chính xác, không có chênh lệch
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Balance Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Balance */}
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardTitle className="text-blue-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Số Dư Hiện Tại (DB)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Earned:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.current_balance.total_earned)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Net Valid:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.current_balance.net_valid)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Frozen:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.current_balance.frozen)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Paid Amount:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.current_balance.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-blue-200">
                      <span className="text-sm font-semibold text-slate-700">Available:</span>
                      <span className="font-bold text-lg text-blue-600">{formatNumber(auditResults.current_balance.available)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Correct Balance */}
              <Card className="border-2 border-green-200">
                <CardHeader className="bg-gradient-to-br from-green-50 to-green-100">
                  <CardTitle className="text-green-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Số Dư Chính Xác
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Earned:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.correct_balance.total_earned)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Net Valid:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.correct_balance.net_valid)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Frozen:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.correct_balance.frozen)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Paid Amount:</span>
                      <span className="font-bold text-slate-900">{formatNumber(auditResults.correct_balance.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-green-200">
                      <span className="text-sm font-semibold text-slate-700">Available:</span>
                      <span className="font-bold text-lg text-green-600">{formatNumber(auditResults.correct_balance.available)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Discrepancies */}
              <Card className="border-2 border-orange-200">
                <CardHeader className="bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardTitle className="text-orange-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Chênh Lệch
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Total Earned:</span>
                      {renderDiscrepancyBadge(auditResults.discrepancies.total_earned)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Net Valid:</span>
                      {renderDiscrepancyBadge(auditResults.discrepancies.net_valid)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Frozen:</span>
                      {renderDiscrepancyBadge(auditResults.discrepancies.frozen)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Paid Amount:</span>
                      {renderDiscrepancyBadge(auditResults.discrepancies.paid_amount)}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-orange-200">
                      <span className="text-sm font-semibold text-slate-700">Available:</span>
                      {renderDiscrepancyBadge(auditResults.discrepancies.available)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logs Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Question Audit Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(auditResults.logs_breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold">{value.count} ({formatNumber(value.total)})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(auditResults.transactions_breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold">{value.count} ({formatNumber(value.total)})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Withdrawals Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Withdrawals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(auditResults.withdrawals_breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-600 capitalize">{key}:</span>
                        <span className="font-semibold">{value.count} ({formatNumber(value.total)})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recovery Analysis */}
            {auditResults.recovery_analysis && (
              <Card className="border-2 border-purple-200">
                <CardHeader>
                  <CardTitle>Recovery Transactions Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Total Recovery Txs:</span>
                      <p className="font-bold text-lg">{auditResults.recovery_analysis.total_recovery_txs}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Valid Recovery:</span>
                      <p className="font-bold text-lg text-green-600">{formatNumber(auditResults.recovery_analysis.valid_recovery)}</p>
                    </div>
                    <div>
                      <span className="text-slate-600">Duplicate Recovery:</span>
                      <p className="font-bold text-lg text-orange-600">{formatNumber(auditResults.recovery_analysis.duplicate_recovery)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Button */}
            {auditResults.has_discrepancy && (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isUpdating}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold px-8 py-6 text-lg"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Đang Cập Nhật...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Áp Dụng Chỉnh Sửa Số Dư
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-6 h-6" />
                Xác Nhận Cập Nhật Số Dư
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>Bạn có chắc chắn muốn cập nhật số dư cho người dùng:</p>
                <p className="font-bold text-slate-900">{userEmail}</p>
                <p>Hành động này sẽ ghi đè số dư hiện tại bằng số dư chính xác được tính toán từ công thức.</p>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 text-sm">
                  <p className="font-semibold text-orange-900 mb-1">Các thay đổi:</p>
                  {auditResults && Object.entries(auditResults.discrepancies).map(([key, value]) => (
                    value !== 0 && (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className={value > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {value > 0 ? '+' : ''}{formatNumber(value)}
                        </span>
                      </div>
                    )
                  ))}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleUpdateBalance}
                className="bg-green-600 hover:bg-green-700"
              >
                Xác Nhận Cập Nhật
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}