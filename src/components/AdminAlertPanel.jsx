import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Eye, X, Clock, TrendingUp, Wallet, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

export default function AdminAlertPanel() {
  const [selectedAlert, setSelectedAlert] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      return base44.entities.AdminAlert.list('-created_date', 100);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId) => {
      const user = await base44.auth.me();
      await base44.entities.AdminAlert.update(alertId, {
        status: 'acknowledged',
        acknowledged_by: user.email,
        acknowledged_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, notes }) => {
      const user = await base44.auth.me();
      await base44.entities.AdminAlert.update(alertId, {
        status: 'resolved',
        resolved_by: user.email,
        resolved_date: new Date().toISOString(),
        resolution_notes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      setSelectedAlert(null);
    }
  });

  const newAlerts = alerts.filter(a => a.status === 'new');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');
  const criticalCount = newAlerts.filter(a => a.severity === 'critical').length;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'from-red-500 to-rose-600';
      case 'high': return 'from-orange-500 to-amber-500';
      case 'medium': return 'from-yellow-500 to-amber-400';
      case 'low': return 'from-blue-500 to-indigo-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'high_balance': return Wallet;
      case 'multiple_withdrawals': return Activity;
      case 'review_spike': return TrendingUp;
      default: return AlertCircle;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl">
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-purple-300 border-t-purple-600 rounded-full mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Đang tải cảnh báo...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-purple-500" />
            <div>
              <h3 className="text-slate-900 font-bold text-xl">Cảnh Báo Hệ Thống</h3>
              <p className="text-purple-600 text-xs font-medium">Real-time Monitoring</p>
            </div>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-500 text-white text-lg px-4 py-1">
                {criticalCount} Critical
              </Badge>
            )}
            <Badge className="bg-purple-100 text-purple-800">
              {newAlerts.length} mới
            </Badge>
          </div>
        </div>

        {newAlerts.length === 0 && acknowledgedAlerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" />
            <p className="text-slate-700 font-medium text-lg">Không có cảnh báo</p>
            <p className="text-slate-600 text-sm">Hệ thống đang hoạt động bình thường</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {/* New Alerts */}
            {newAlerts.map((alert, index) => {
              const Icon = getAlertIcon(alert.alert_type);
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-gradient-to-r ${getSeverityColor(alert.severity)} rounded-2xl p-4 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition-all`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className="bg-white/90 text-slate-900 font-bold text-xs">
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="text-white/80 text-xs">
                            {format(new Date(alert.created_date), 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <h4 className="text-white font-bold mb-1">{alert.title}</h4>
                        <p className="text-white/90 text-sm">{alert.message}</p>
                      </div>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledgeMutation.mutate(alert.id);
                      }}
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg flex-shrink-0"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Xem
                    </Button>
                  </div>
                </motion.div>
              );
            })}

            {/* Acknowledged Alerts */}
            {acknowledgedAlerts.slice(0, 5).map((alert) => {
              const Icon = getAlertIcon(alert.alert_type);
              return (
                <motion.div
                  key={alert.id}
                  className="bg-white border-2 border-slate-200 rounded-2xl p-4 opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-slate-100 text-slate-700 text-xs">Đã xem</Badge>
                        <span className="text-slate-500 text-xs">
                          {format(new Date(alert.created_date), 'dd/MM HH:mm')}
                        </span>
                      </div>
                      <h4 className="text-slate-700 font-semibold text-sm">{alert.title}</h4>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAlert(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-900 text-2xl font-bold">Chi Tiết Cảnh Báo</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedAlert(null)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className={`bg-gradient-to-r ${getSeverityColor(selectedAlert.severity)} rounded-2xl p-6 mb-6 text-white`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-white/90 text-slate-900 font-bold">
                    {selectedAlert.severity.toUpperCase()}
                  </Badge>
                  <Badge className="bg-white/20 text-white border-white/30">
                    {selectedAlert.alert_type}
                  </Badge>
                </div>
                <h4 className="text-xl font-bold mb-2">{selectedAlert.title}</h4>
                <p className="text-white/90">{selectedAlert.message}</p>
              </div>

              {selectedAlert.data && (
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 mb-6">
                  <p className="text-slate-700 font-semibold mb-3">Chi tiết dữ liệu:</p>
                  <pre className="text-xs text-slate-600 overflow-x-auto">
                    {JSON.stringify(selectedAlert.data, null, 2)}
                  </pre>
                </div>
              )}

              <div className="text-xs text-slate-500 mb-6">
                <p>Tạo lúc: {format(new Date(selectedAlert.created_date), 'dd/MM/yyyy HH:mm:ss')}</p>
                {selectedAlert.acknowledged_by && (
                  <p>Đã xem bởi: {selectedAlert.acknowledged_by} lúc {format(new Date(selectedAlert.acknowledged_date), 'dd/MM/yyyy HH:mm')}</p>
                )}
              </div>

              <div className="flex gap-3">
                {selectedAlert.status === 'new' && (
                  <Button
                    onClick={() => acknowledgeMutation.mutate(selectedAlert.id)}
                    className="flex-1 bg-blue-500 text-white rounded-xl"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Đánh Dấu Đã Xem
                  </Button>
                )}
                <Button
                  onClick={() => resolveMutation.mutate({ 
                    alertId: selectedAlert.id, 
                    notes: 'Đã xử lý từ Alert Panel' 
                  })}
                  className="flex-1 bg-green-500 text-white rounded-xl"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Đánh Dấu Đã Giải Quyết
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}