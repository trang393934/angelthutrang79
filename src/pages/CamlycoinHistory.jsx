import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Coins, Heart, AlertTriangle, Sparkles, Calendar, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

export default function CamlycoinHistory() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('history'); // history, analysis

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch user's Camlycoin balance
  const { data: balance } = useQuery({
    queryKey: ['camlycoin-balance', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      return balances[0] || { balance: 0, total_earned: 0, total_spent: 0 };
    },
    enabled: !!currentUser,
  });

  // Fetch user's transaction history
  const { data: transactions = [] } = useQuery({
    queryKey: ['camlycoin-transactions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.CamlycoinTransaction.filter(
        { user_email: currentUser.email },
        '-created_date'
      );
    },
    enabled: !!currentUser,
  });

  // Calculate statistics
  const positiveTransactions = transactions.filter(t => t.amount > 0);
  const negativeTransactions = transactions.filter(t => t.amount < 0);
  const averagePositive = positiveTransactions.length > 0 
    ? positiveTransactions.reduce((sum, t) => sum + t.amount, 0) / positiveTransactions.length 
    : 0;
  const averageNegative = negativeTransactions.length > 0 
    ? Math.abs(negativeTransactions.reduce((sum, t) => sum + t.amount, 0) / negativeTransactions.length)
    : 0;

  const getTransactionColor = (amount) => {
    if (amount > 0) return 'text-green-600';
    return 'text-red-600';
  };

  const getTransactionIcon = (amount) => {
    if (amount > 0) return <TrendingUp className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getHeartLevel = () => {
    if (!balance) return { level: 'Mới Bắt Đầu', color: 'from-gray-400 to-gray-600', stars: 1, reward: 5000 };
    
    const netPositive = (balance.total_earned || 0) - (balance.total_spent || 0);
    
    if (netPositive >= 10000) return { level: 'Đại Minh Sư', color: 'from-yellow-400 to-amber-600', stars: 5, reward: 10000 };
    if (netPositive >= 9000) return { level: 'Tỉnh Thức Cao', color: 'from-purple-400 to-pink-600', stars: 4, reward: 9000 };
    if (netPositive >= 7000) return { level: 'Thuần Khiết', color: 'from-blue-400 to-indigo-600', stars: 3, reward: 7000 };
    if (netPositive >= 5000) return { level: 'Học Hỏi', color: 'from-green-400 to-emerald-600', stars: 2, reward: 5000 };
    return { level: 'Mới Bắt Đầu', color: 'from-gray-400 to-gray-600', stars: 1, reward: 5000 };
  };

  const heartLevel = getHeartLevel();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-amber-50 to-rose-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-300/50 via-rose-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-amber-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Chat')}>
              <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-900 hover:bg-amber-100 flex-shrink-0">
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
                className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center flex-shrink-0"
              >
                <Coins className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Lịch Sử Camlycoin</h1>
                <p className="text-amber-600 text-xs font-medium">Hành Trình Tâm & Năng Lượng</p>
              </div>
            </div>

            <div className="w-10 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-20 px-4 max-w-6xl mx-auto">
        {/* Balance Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white backdrop-blur-sm border-2 border-amber-300 rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-amber-700 text-sm font-semibold mb-2">Số Dư Hiện Tại</p>
                <div className="flex items-center gap-3">
                  <Coins className="w-12 h-12 text-amber-500" />
                  <span className="text-5xl font-black text-slate-900">
                    {balance?.balance || 0}
                  </span>
                  <span className="text-2xl text-amber-600 font-bold">Camlycoin</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl px-6 py-4">
                  <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700 text-xs font-semibold mb-1">Tổng Nhận</p>
                  <p className="text-2xl font-black text-green-900">{balance?.total_earned || 0}</p>
                </div>

                <div className="text-center bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl px-6 py-4">
                  <TrendingDown className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 text-xs font-semibold mb-1">Tổng Trừ</p>
                  <p className="text-2xl font-black text-red-900">{balance?.total_spent || 0}</p>
                </div>
              </div>
            </div>

            {/* Heart Level */}
            <div className="mt-6 pt-6 border-t border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${heartLevel.color} flex items-center justify-center`}>
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold text-lg">{heartLevel.level}</p>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Sparkles
                          key={i}
                          className={`w-3 h-3 ${i < heartLevel.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={`bg-gradient-to-r ${heartLevel.color} text-white border-0 text-sm px-4 py-2 mb-2`}>
                    Cấp {heartLevel.stars}/5
                  </Badge>
                  <p className="text-amber-600 text-xs font-bold">
                    Thưởng: {heartLevel.reward.toLocaleString()} coin
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setActiveTab('history')}
            variant={activeTab === 'history' ? 'default' : 'outline'}
            className={activeTab === 'history' 
              ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full flex-1' 
              : 'border-amber-300 text-slate-900 hover:bg-amber-50 rounded-full flex-1'}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Lịch Sử Giao Dịch
          </Button>
          <Button
            onClick={() => setActiveTab('analysis')}
            variant={activeTab === 'analysis' ? 'default' : 'outline'}
            className={activeTab === 'analysis' 
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex-1' 
              : 'border-purple-300 text-slate-900 hover:bg-purple-50 rounded-full flex-1'}
          >
            <Heart className="w-4 h-4 mr-2" />
            Phân Tích Tâm
          </Button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {transactions.length === 0 ? (
                <div className="text-center py-20 bg-white border-2 border-amber-200 rounded-3xl">
                  <Coins className="w-16 h-16 text-amber-300 mx-auto mb-4" />
                  <p className="text-slate-900 font-semibold text-lg mb-2">Chưa Có Giao Dịch</p>
                  <p className="text-amber-600">Hãy bắt đầu trò chuyện với Angel AI để nhận Camlycoin!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-white border-2 rounded-2xl p-6 shadow-lg ${
                        transaction.amount > 0 
                          ? 'border-green-300 hover:border-green-400' 
                          : 'border-red-300 hover:border-red-400'
                      } transition-all`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            transaction.amount > 0 
                              ? 'bg-gradient-to-br from-green-100 to-emerald-100' 
                              : 'bg-gradient-to-br from-red-100 to-rose-100'
                          }`}>
                            {getTransactionIcon(transaction.amount)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {transaction.amount < 0 && (
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                              )}
                              <p className="text-slate-900 font-semibold line-clamp-2">
                                {transaction.description}
                              </p>
                            </div>
                            <p className="text-slate-600 text-xs">
                              {format(new Date(transaction.created_date), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`text-2xl font-black ${getTransactionColor(transaction.amount)}`}>
                            {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                          </p>
                          <p className="text-xs text-slate-500">Camlycoin</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Overall Heart Analysis */}
                <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${heartLevel.color} flex items-center justify-center`}>
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-slate-900 font-bold text-lg">Cấp Độ Tâm</h3>
                  </div>
                  <p className="text-slate-700 mb-4">
                    Con đang ở cấp độ <span className="font-bold text-purple-600">{heartLevel.level}</span> trong hành trình phát triển tâm linh.
                  </p>
                  <div className="space-y-3">
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
                      <p className="text-purple-900 font-semibold mb-2">Hướng Dẫn Nâng Cao:</p>
                      <ul className="text-purple-800 text-sm space-y-1">
                        {heartLevel.level === 'Mới Bắt Đầu' && (
                          <>
                            <li>• Hãy thường xuyên hỏi những câu hỏi sâu sắc</li>
                            <li>• Tránh những suy nghĩ tiêu cực</li>
                            <li>• Học hỏi giáo lý của Cha Vũ Trụ</li>
                            <li>• Đạt 5,000 coin để lên cấp Học Hỏi</li>
                          </>
                        )}
                        {heartLevel.level === 'Học Hỏi' && (
                          <>
                            <li>• Tiếp tục duy trì tâm học hỏi</li>
                            <li>• Hướng tới sự thuần khiết trong suy nghĩ</li>
                            <li>• Đọc 8 Divine Mantras mỗi ngày</li>
                            <li>• Đạt 7,000 coin để lên cấp Thuần Khiết</li>
                          </>
                        )}
                        {heartLevel.level === 'Thuần Khiết' && (
                          <>
                            <li>• Chia sẻ trí tuệ với người khác</li>
                            <li>• Sống trong tình yêu vô điều kiện</li>
                            <li>• Nâng cao tần số năng lượng</li>
                            <li>• Đạt 9,000 coin để lên cấp Tỉnh Thức Cao</li>
                          </>
                        )}
                        {heartLevel.level === 'Tỉnh Thức Cao' && (
                          <>
                            <li>• Hướng dẫn người khác trên con đường ánh sáng</li>
                            <li>• Sống trong trạng thái 5D</li>
                            <li>• Kết nối với Cha trong mọi hành động</li>
                            <li>• Đạt 10,000 coin để lên cấp Đại Minh Sư</li>
                          </>
                        )}
                        {heartLevel.level === 'Đại Minh Sư' && (
                          <>
                            <li>• Bạn là ánh sáng cho thế giới</li>
                            <li>• Truyền bá tình yêu thuần khiết</li>
                            <li>• Sống trong ý chí của Cha</li>
                            <li>• Bạn đã đạt cấp cao nhất! 🏆</li>
                          </>
                        )}
                      </ul>
                    </div>

                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                      <p className="text-amber-900 font-bold mb-2 text-center">💰 Hệ Thống Thưởng</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">⭐ Cấp 1 - Mới Bắt Đầu:</span>
                          <span className="font-bold text-gray-900">5,000 coin</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-green-600">⭐⭐ Cấp 2 - Học Hỏi:</span>
                          <span className="font-bold text-green-900">5,000 coin</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-600">⭐⭐⭐ Cấp 3 - Thuần Khiết:</span>
                          <span className="font-bold text-blue-900">7,000 coin</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-purple-600">⭐⭐⭐⭐ Cấp 4 - Tỉnh Thức:</span>
                          <span className="font-bold text-purple-900">9,000 coin</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-amber-600">⭐⭐⭐⭐⭐ Cấp 5 - Đại Minh Sư:</span>
                          <span className="font-bold text-amber-900">10,000 coin</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="bg-white border-2 border-rose-300 rounded-3xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="w-10 h-10 text-rose-500" />
                    <h3 className="text-slate-900 font-bold text-lg">Thống Kê</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                      <p className="text-green-900 font-semibold mb-1">Câu Hỏi Tích Cực</p>
                      <p className="text-3xl font-black text-green-600">{positiveTransactions.length}</p>
                      <p className="text-green-700 text-xs mt-1">
                        Trung bình: +{averagePositive.toFixed(1)} coin/câu
                      </p>
                    </div>

                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                      <p className="text-red-900 font-semibold mb-1">Cần Cải Thiện</p>
                      <p className="text-3xl font-black text-red-600">{negativeTransactions.length}</p>
                      <p className="text-red-700 text-xs mt-1">
                        Trung bình: -{averageNegative.toFixed(1)} coin/câu
                      </p>
                    </div>

                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                      <p className="text-amber-900 font-semibold mb-1">Tổng Tương Tác</p>
                      <p className="text-3xl font-black text-amber-600">{transactions.length}</p>
                      <p className="text-amber-700 text-xs mt-1">
                        Tỷ lệ tích cực: {transactions.length > 0 ? ((positiveTransactions.length / transactions.length) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guidance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 bg-gradient-to-br from-amber-50 to-rose-50 border-2 border-amber-300 rounded-3xl p-6"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-slate-900 font-bold text-lg mb-2">Lời Nhắc Nhở Từ Cha Vũ Trụ</p>
                    <p className="text-slate-700 leading-relaxed">
                      Mỗi câu hỏi, mỗi suy nghĩ của con đều tạo nên năng lượng và ảnh hưởng đến vận mệnh. 
                      Hãy giữ tâm trong sáng, thuần khiết và luôn hướng về ánh sáng. 
                      Camlycoin không chỉ là phần thưởng, mà là sự phản chiếu trạng thái tâm của con.
                      Khi tâm con càng sáng, con sẽ thu hút được nhiều phước lành và cơ hội hơn trong cuộc sống. 💫
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}