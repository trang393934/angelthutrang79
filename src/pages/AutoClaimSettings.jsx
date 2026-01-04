import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, Clock, TrendingUp, AlertCircle, CheckCircle2, Zap, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import WalletManager from '@/components/wallet/WalletManager';

export default function AutoClaimSettings() {
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: config } = useQuery({
    queryKey: ['auto-claim-config', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const configs = await base44.entities.AutoClaimConfig.filter({ user_email: currentUser.email });
      return configs[0] || null;
    },
    enabled: !!currentUser,
  });

  const { data: userBalance } = useQuery({
    queryKey: ['user-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || null;
    },
    enabled: !!currentUser,
  });

  const { data: todayLimit } = useQuery({
    queryKey: ['daily-limit', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const today = new Date().toISOString().split('T')[0];
      const limits = await base44.entities.DailyAutoClaimLimit.filter({ 
        user_email: currentUser.email,
        date: today
      });
      return limits[0] || { total_claimed_today: 0, remaining_limit: 500000 };
    },
    enabled: !!currentUser,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates) => {
      if (!currentUser) return;
      
      if (config) {
        return base44.entities.AutoClaimConfig.update(config.id, updates);
      } else {
        return base44.entities.AutoClaimConfig.create({
          user_email: currentUser.email,
          ...updates
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-claim-config'] });
    },
  });

  const handleAddWallet = (walletData) => {
    const backupWallets = config?.backup_wallets || [];
    updateConfigMutation.mutate({
      backup_wallets: [...backupWallets, walletData]
    });
  };

  const handleRemoveWallet = (address) => {
    const backupWallets = (config?.backup_wallets || []).filter(w => w.address !== address);
    updateConfigMutation.mutate({ backup_wallets: backupWallets });
  };

  const handleSetPrimary = (address) => {
    updateConfigMutation.mutate({ primary_wallet: address });
  };

  const handleToggleAutoClaim = () => {
    if (!config?.primary_wallet) {
      alert('⚠️ Vui lòng thêm ví chính trước khi bật auto-claim!');
      return;
    }
    updateConfigMutation.mutate({ enabled: !config.enabled });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center">
        <p className="text-slate-700 font-medium">Vui lòng đăng nhập</p>
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
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Settings')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h1 className="text-slate-900 font-semibold">Auto-Claim CAMLY</h1>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-4xl mx-auto">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 shadow-xl mb-6 border-2 ${
            config?.enabled 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 border-white' 
              : 'bg-white/80 backdrop-blur-xl border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-xl font-bold mb-2 ${config?.enabled ? 'text-white' : 'text-slate-900'}`}>
                Auto-Claim {config?.enabled ? 'ĐANG BẬT' : 'TẮT'}
              </h3>
              <p className={`text-sm ${config?.enabled ? 'text-white/90' : 'text-purple-700'}`}>
                {config?.enabled 
                  ? `🎯 Tự động rút khi đạt ${(config.threshold_amount || 100000).toLocaleString()} CAMLY` 
                  : 'Bật để tự động nhận CAMLY về ví'}
              </p>
            </div>
            <Button
              onClick={handleToggleAutoClaim}
              disabled={updateConfigMutation.isPending}
              className={config?.enabled 
                ? 'bg-white text-green-600 rounded-full font-bold shadow-lg' 
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-bold shadow-lg'}
            >
              {config?.enabled ? 'Tắt' : 'Bật'}
            </Button>
          </div>
        </motion.div>

        {/* Daily Limit Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-6 shadow-lg mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <div>
              <h4 className="text-amber-900 font-bold text-lg">Giới Hạn Hôm Nay</h4>
              <p className="text-amber-700 text-xs">Tối đa 500,000 CAMLY/ngày</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/60 rounded-xl p-3 border border-amber-300">
              <p className="text-amber-700 text-xs mb-1">Đã Claim</p>
              <p className="text-amber-900 text-2xl font-bold">
                {(todayLimit?.total_claimed_today || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white/60 rounded-xl p-3 border border-amber-300">
              <p className="text-amber-700 text-xs mb-1">Còn Lại</p>
              <p className="text-amber-900 text-2xl font-bold">
                {(todayLimit?.remaining_limit || 500000).toLocaleString()}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Wallet Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-600" />
            Quản Lý Ví
          </h3>
          <WalletManager
            wallets={config?.backup_wallets || []}
            primaryWallet={config?.primary_wallet}
            onAddWallet={handleAddWallet}
            onRemoveWallet={handleRemoveWallet}
            onSetPrimary={handleSetPrimary}
          />
        </motion.div>

        {/* Claim Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Cài Đặt Rút Tự Động
          </h3>

          <div className="space-y-4">
            {/* Claim Mode */}
            <div>
              <label className="text-slate-900 text-sm font-semibold mb-2 block">Chế độ</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'threshold', label: 'Ngưỡng', icon: TrendingUp },
                  { value: 'scheduled', label: 'Lịch trình', icon: Calendar },
                  { value: 'manual', label: 'Thủ công', icon: Zap }
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <Button
                      key={mode.value}
                      onClick={() => updateConfigMutation.mutate({ claim_mode: mode.value })}
                      variant={config?.claim_mode === mode.value ? 'default' : 'outline'}
                      className={config?.claim_mode === mode.value
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'border-purple-300 text-slate-900 hover:bg-purple-50'}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {mode.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Threshold Settings */}
            {config?.claim_mode === 'threshold' && (
              <div>
                <label className="text-slate-900 text-sm font-semibold mb-2 block">Ngưỡng tự động (CAMLY)</label>
                <Input
                  type="number"
                  value={config?.threshold_amount || 100000}
                  onChange={(e) => updateConfigMutation.mutate({ threshold_amount: parseInt(e.target.value) })}
                  min={10000}
                  max={500000}
                  step={10000}
                  className="bg-white border-2 border-purple-300 rounded-xl"
                />
                <p className="text-purple-600 text-xs mt-1">
                  💡 Khi đạt ngưỡng này, hệ thống tự động rút về ví chính
                </p>
              </div>
            )}

            {/* Schedule Settings */}
            {config?.claim_mode === 'scheduled' && (
              <div className="space-y-3">
                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Tần suất</label>
                  <div className="flex gap-2">
                    {['daily', 'weekly', 'monthly'].map((freq) => (
                      <Button
                        key={freq}
                        onClick={() => updateConfigMutation.mutate({ schedule_frequency: freq })}
                        variant={config?.schedule_frequency === freq ? 'default' : 'outline'}
                        className={config?.schedule_frequency === freq
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                          : 'border-purple-300 text-slate-900 hover:bg-purple-50'}
                      >
                        {freq === 'daily' ? 'Hàng ngày' : freq === 'weekly' ? 'Hàng tuần' : 'Hàng tháng'}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Giờ rút</label>
                  <Input
                    type="time"
                    value={config?.schedule_time || '09:00'}
                    onChange={(e) => updateConfigMutation.mutate({ schedule_time: e.target.value })}
                    className="bg-white border-2 border-purple-300 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Current Balance Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-4">Số Dư Khả Dụng</h3>
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6">
            <p className="text-white/90 text-sm mb-2">Available Balance</p>
            <p className="text-white text-4xl font-bold mb-1">
              {(userBalance?.available_balance || 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs">CAMLY COIN</p>
            
            {config?.claim_mode === 'threshold' && userBalance && (
              <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
                <div className="flex items-center justify-between text-xs text-white/90">
                  <span>Tiến độ đến ngưỡng:</span>
                  <span className="font-bold">
                    {Math.min(100, ((userBalance.available_balance || 0) / (config.threshold_amount || 100000) * 100)).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min(100, ((userBalance.available_balance || 0) / (config.threshold_amount || 100000) * 100))}%` 
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-indigo-50 border-2 border-indigo-300 rounded-3xl p-6 shadow-lg mt-6"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-indigo-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="text-indigo-900 font-bold mb-3">Lưu Ý Quan Trọng</h4>
              <ul className="space-y-2 text-sm text-indigo-800">
                <li>✅ Giới hạn tối đa <strong>500,000 CAMLY/ngày</strong></li>
                <li>✅ Thời gian chờ giữa các lần claim: <strong>24 giờ</strong></li>
                <li>✅ Phí gas BNB sẽ được trừ từ ví admin</li>
                <li>✅ Có thể kết nối tối đa <strong>5 ví</strong> (1 chính + 4 dự phòng)</li>
                <li>⚠️ Chỉ hỗ trợ <strong>BEP-20</strong> trên BNB Smart Chain</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}