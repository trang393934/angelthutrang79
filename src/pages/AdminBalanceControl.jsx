import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Eye,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminBalanceControl() {
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const queryClient = useQueryClient();

  // Lấy danh sách alerts về sai lệch cần duyệt
  const { data: pendingReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['pending-balance-reviews'],
    queryFn: async () => {
      const alerts = await base44.entities.AdminAlert.filter({
        alert_type: 'high_balance',
        status: 'new'
      }, '-created_date', 50);
      return alerts.filter(a => a.user_email); // Chỉ lấy alerts có user_email
    },
    refetchInterval: 30000
  });

  // Audit user cụ thể
  const auditUserMutation = useMutation({
    mutationFn: async (email) => {
      const response = await base44.functions.invoke('deepAuditSingleUser', { user_email: email });
      return response.data;
    },
    onSuccess: (data) => {
      setSelectedUser(data);
      toast.success('Đã audit user thành công');
    },
    onError: () => {
      toast.error('Lỗi khi audit user');
    }
  });

  // Approve và sửa balance
  const approveCorrectionMutation = useMutation({
    mutationFn: async ({ email, alertId }) => {
      const response = await base44.functions.invoke('correctSingleUserBalance', { user_email: email });
      
      // Acknowledge alert
      if (alertId) {
        const alert = await base44.entities.AdminAlert.get(alertId);
        await base44.entities.AdminAlert.update(alertId, {
          status: 'resolved',
          resolved_by: (await base44.auth.me()).email,
          resolved_date: new Date().toISOString(),
          resolution_notes: 'Balance đã được sửa và approve'
        });
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-balance-reviews'] });
      toast.success('Đã sửa balance thành công');
      setSelectedUser(null);
    },
    onError: () => {
      toast.error('Lỗi khi sửa balance');
    }
  });

  // Reject correction
  const rejectCorrectionMutation = useMutation({
    mutationFn: async ({ alertId, reason }) => {
      const alert = await base44.entities.AdminAlert.get(alertId);
      await base44.entities.AdminAlert.update(alertId, {
        status: 'resolved',
        resolved_by: (await base44.auth.me()).email,
        resolved_date: new Date().toISOString(),
        resolution_notes: `Rejected: ${reason}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-balance-reviews'] });
      toast.info('Đã reject correction');
      setSelectedUser(null);
    }
  });

  // Chạy validation trước khi thực hiện transaction
  const validateTransactionMutation = useMutation({
    mutationFn: async (txData) => {
      const response = await base44.functions.invoke('validateCoinTransaction', txData);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.validation.is_valid) {
        toast.success('Transaction hợp lệ');
      } else {
        toast.error('Transaction KHÔNG hợp lệ');
      }
    }
  });

  // Chạy monitoring
  const runMonitoringMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('monitorBalanceDiscrepancies', {});
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Monitoring complete: ${data.findings.critical_alerts.length} critical, ${data.findings.warnings.length} warnings`);
      queryClient.invalidateQueries({ queryKey: ['pending-balance-reviews'] });
    }
  });

  const handleSearch = () => {
    if (searchEmail.trim()) {
      auditUserMutation.mutate(searchEmail.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-600" />
              Balance Control Center
            </h1>
            <p className="text-slate-600 mt-1">Kiểm soát và sửa lỗi balance cho users</p>
          </div>
          
          <Button
            onClick={() => runMonitoringMutation.mutate()}
            disabled={runMonitoringMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {runMonitoringMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Chạy Monitoring
          </Button>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending Reviews
              {pendingReviews && pendingReviews.length > 0 && (
                <Badge className="ml-2 bg-red-500">{pendingReviews.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="search">Tìm User</TabsTrigger>
            <TabsTrigger value="validate">Validate Transaction</TabsTrigger>
          </TabsList>

          {/* Pending Reviews */}
          <TabsContent value="pending" className="space-y-4">
            {reviewsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : !pendingReviews || pendingReviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-slate-600">Không có sai lệch nào cần duyệt</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingReviews.map((alert) => (
                  <Card key={alert.id} className="border-l-4 border-l-orange-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{alert.user_email}</CardTitle>
                          <CardDescription className="mt-1">{alert.title}</CardDescription>
                        </div>
                        <Badge variant="destructive">{alert.severity}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold text-slate-700">Hiện tại:</p>
                            <p>Total: {(alert.data?.current?.total_earned || 0).toLocaleString()}</p>
                            <p>Frozen: {(alert.data?.current?.frozen || 0).toLocaleString()}</p>
                            <p>Available: {(alert.data?.current?.available || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700">Đề xuất:</p>
                            <p className="text-green-600">Total: {(alert.data?.correct?.total_earned || 0).toLocaleString()}</p>
                            <p className="text-green-600">Frozen: {(alert.data?.correct?.frozen || 0).toLocaleString()}</p>
                            <p className="text-green-600">Available: {(alert.data?.correct?.available || 0).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="font-semibold text-slate-700">Thay đổi:</p>
                          <div className="flex gap-4 mt-1">
                            <span className={alert.data?.diffs?.total_earned >= 0 ? 'text-green-600' : 'text-red-600'}>
                              Total: {alert.data?.diffs?.total_earned >= 0 ? '+' : ''}{(alert.data?.diffs?.total_earned || 0).toLocaleString()}
                            </span>
                            <span className={alert.data?.diffs?.available >= 0 ? 'text-green-600' : 'text-red-600'}>
                              Available: {alert.data?.diffs?.available >= 0 ? '+' : ''}{(alert.data?.diffs?.available || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveCorrectionMutation.mutate({ 
                            email: alert.user_email, 
                            alertId: alert.id 
                          })}
                          disabled={approveCorrectionMutation.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approve & Sửa
                        </Button>
                        
                        <Button
                          onClick={() => {
                            const reason = prompt('Lý do reject:');
                            if (reason) {
                              rejectCorrectionMutation.mutate({ alertId: alert.id, reason });
                            }
                          }}
                          disabled={rejectCorrectionMutation.isPending}
                          variant="outline"
                          className="flex-1"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>

                        <Button
                          onClick={() => auditUserMutation.mutate(alert.user_email)}
                          variant="outline"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tìm User */}
          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit User Cụ Thể</CardTitle>
                <CardDescription>Nhập email để kiểm tra chi tiết balance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button 
                    onClick={handleSearch}
                    disabled={auditUserMutation.isPending}
                  >
                    {auditUserMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {selectedUser && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{selectedUser.user_email}</h3>
                      {selectedUser.has_discrepancy ? (
                        <Badge variant="destructive">Có sai lệch</Badge>
                      ) : (
                        <Badge className="bg-green-500">Chính xác</Badge>
                      )}
                    </div>

                    {selectedUser.has_discrepancy && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Hiện tại (DB)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-sm">
                              <p>Total: {(selectedUser.current_balance?.total_earned || 0).toLocaleString()}</p>
                              <p>Frozen: {(selectedUser.current_balance?.frozen || 0).toLocaleString()}</p>
                              <p>Available: {(selectedUser.current_balance?.available || 0).toLocaleString()}</p>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Đúng (Calculated)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-sm text-green-600">
                              <p>Total: {(selectedUser.correct_balance?.total_earned || 0).toLocaleString()}</p>
                              <p>Frozen: {(selectedUser.correct_balance?.frozen || 0).toLocaleString()}</p>
                              <p>Available: {(selectedUser.correct_balance?.available || 0).toLocaleString()}</p>
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="border-orange-200 bg-orange-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              Sai lệch
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-1 text-sm">
                            {Object.entries(selectedUser.discrepancies || {}).map(([key, value]) => (
                              value !== 0 && (
                                <p key={key} className={value > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {key}: {value > 0 ? '+' : ''}{value.toLocaleString()}
                                </p>
                              )
                            ))}
                          </CardContent>
                        </Card>

                        <Button
                          onClick={() => approveCorrectionMutation.mutate({ 
                            email: selectedUser.user_email 
                          })}
                          disabled={approveCorrectionMutation.isPending}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Sửa Balance
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Validate Transaction */}
          <TabsContent value="validate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Validate Transaction Trước Khi Tạo</CardTitle>
                <CardDescription>Kiểm tra tính hợp lệ để tránh tạo sai lệch mới</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm">
                  Tính năng này giúp kiểm tra trước khi tạo transaction mới, 
                  phát hiện trùng lặp, số tiền bất thường, và các vấn đề tiềm ẩn.
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  Sử dụng function: validateCoinTransaction
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}