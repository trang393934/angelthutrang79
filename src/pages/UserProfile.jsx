import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Coins, Wallet, TrendingUp, TrendingDown, Clock, History, Copy, Check, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function UserProfile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
    
    // Get email from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    if (email) {
      setTargetEmail(email);
      // Fetch target user info
      base44.entities.User.filter({ email: email }).then(users => {
        if (users.length > 0) {
          setTargetUser(users[0]);
        }
      });
    }
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch target user's balance
  const { data: userBalance } = useQuery({
    queryKey: ['user-balance', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: targetEmail });
      return balances[0] || { balance: 0, total_earned: 0, total_spent: 0 };
    },
    enabled: !!targetEmail && !!isAdmin,
  });

  // Fetch target user's transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['user-transactions', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      return base44.entities.CamlycoinTransaction.filter({ user_email: targetEmail }, '-created_date', 20);
    },
    enabled: !!targetEmail && !!isAdmin,
  });

  // Fetch bounty submissions to get wallet address
  const { data: submissions = [] } = useQuery({
    queryKey: ['user-submissions', targetEmail],
    queryFn: async () => {
      if (!targetEmail) return [];
      const allSubmissions = await base44.entities.BountySubmission.list();
      return allSubmissions.filter(sub => sub.created_by === targetEmail);
    },
    enabled: !!targetEmail && !!isAdmin,
  });

  const walletAddress = submissions.length > 0 ? submissions[0].wallet_address : null;

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh!');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa 5MB!');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      
      // Refresh user data
      const updatedUser = await base44.auth.me();
      setCurrentUser(updatedUser);
    } catch (error) {
      alert('Lỗi khi upload ảnh. Vui lòng thử lại!');
    }
    setIsUploadingAvatar(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Chỉ Admin mới có quyền truy cập</p>
        </div>
      </div>
    );
  }

  if (!targetEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-xl">Không tìm thấy email người dùng</p>
          <Link to={createPageUrl('RewardsManagement')}>
            <Button className="mt-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full">
              Quay lại
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-orange-50 relative">
      {/* Background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-300/50 via-orange-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('RewardsManagement')}>
              <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-900 hover:bg-amber-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(251,191,36,0.4)',
                    '0 0 40px rgba(251,191,36,0.6)',
                    '0 0 20px rgba(251,191,36,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center"
              >
                <User className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Hồ Sơ Người Dùng</h1>
                <p className="text-amber-600 text-xs font-medium">User Profile</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              {targetUser?.avatar_url ? (
                <img
                  src={targetUser.avatar_url}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-amber-400"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}
              
              {/* Upload button - only show for own profile */}
              {currentUser?.email === targetEmail && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-slate-900 font-bold text-2xl break-all">{targetEmail}</h2>
              <Badge className="bg-amber-100 text-amber-800 mt-2">
                Người Dùng
              </Badge>
            </div>
          </div>

          {/* Wallet Address */}
          {walletAddress && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-purple-600" />
                <span className="text-slate-900 font-semibold">Địa Chỉ Ví</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-slate-700 font-mono text-sm break-all flex-1">{walletAddress}</p>
                <Button
                  onClick={copyWalletAddress}
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full"
                >
                  {copiedWallet ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Balance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-3xl p-6 shadow-xl border-2 border-white">
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-8 h-8 text-white" />
              <span className="text-white/90 text-sm font-medium">Số Dư Hiện Tại</span>
            </div>
            <p className="text-white text-4xl font-bold">
              {(userBalance?.balance || 0).toLocaleString()}
            </p>
            <p className="text-white/80 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="text-slate-700 text-sm font-medium">Tổng Kiếm Được</span>
            </div>
            <p className="text-slate-900 text-4xl font-bold">
              {(userBalance?.total_earned || 0).toLocaleString()}
            </p>
            <p className="text-green-600 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-8 h-8 text-blue-500" />
              <span className="text-slate-700 text-sm font-medium">Đã Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-4xl font-bold">
              {(userBalance?.paid_amount || 0).toLocaleString()}
            </p>
            <p className="text-blue-600 text-xs mt-1">Camlycoin</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border-2 border-orange-200 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-8 h-8 text-orange-500" />
              <span className="text-slate-700 text-sm font-medium">Chưa Thanh Toán</span>
            </div>
            <p className="text-slate-900 text-4xl font-bold">
              {(userBalance?.unpaid_amount || 0).toLocaleString()}
            </p>
            <p className="text-orange-600 text-xs mt-1">Camlycoin</p>
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
        >
          <h3 className="text-slate-900 font-bold text-xl mb-6 flex items-center gap-2">
            <History className="w-6 h-6 text-amber-500" />
            Lịch Sử Giao Dịch (20 gần nhất)
          </h3>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx, index) => {
                const isPositive = tx.amount > 0;
                
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white border-2 border-amber-100 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-slate-900 font-semibold">{tx.description}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(tx.created_date).toLocaleString('vi-VN')}
                        </p>
                        {tx.processed_by && (
                          <p className="text-xs text-purple-600 mt-1">
                            Xử lý bởi: {tx.processed_by}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-600">Camlycoin</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}