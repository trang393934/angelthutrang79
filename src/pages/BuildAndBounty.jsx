import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Code, Gift, Send, Sparkles, Trophy, Users, MessageSquare, Bug, Globe, FileText, Loader2, CheckCircle2, Star, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MultiWalletConnect from '@/components/wallet/MultiWalletConnect';
import { toast } from 'sonner';

export default function BuildAndBounty() {
  const [activeTab, setActiveTab] = useState('build');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletBalances, setWalletBalances] = useState({});
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [proofLink, setProofLink] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
    
    // Check if wallet is already connected
    const savedWallet = localStorage.getItem('walletAddress');
    const savedNetwork = localStorage.getItem('selectedNetwork');
    if (savedWallet && savedNetwork) {
      setWalletAddress(savedWallet);
      setSelectedNetwork(savedNetwork);
      loadWalletBalances(savedWallet, savedNetwork);
    }

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else if (accounts[0] !== walletAddress) {
      const newAddress = accounts[0];
      setWalletAddress(newAddress);
      localStorage.setItem('walletAddress', newAddress);
      if (selectedNetwork) {
        loadWalletBalances(newAddress, selectedNetwork);
      }
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const { data: ideas = [] } = useQuery({
    queryKey: ['build-ideas', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      // Admin sees all, regular users see only their own
      if (currentUser.role === 'admin') {
        return base44.entities.BuildIdea.list('-created_date');
      }
      return base44.entities.BuildIdea.filter({ created_by: currentUser.email }, '-created_date');
    },
    enabled: !!currentUser,
  });

  const submitIdeaMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      // AI analyzes the idea
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Phân tích ý tưởng đóng góp cho dự án Angel AI sau:

Tiêu đề: ${ideaTitle}
Mô tả: ${ideaDescription}

Hãy đánh giá:
1. Category (code/content/idea/community/design/marketing)
2. Impact level (low/medium/high)
3. Feasibility (low/medium/high)
4. Reward Camlycoin: Tất cả các ý tưởng đóng góp đều nhận 30,000 Camlycoin (mức thưởng cố định)

Trả về JSON:`,
        response_json_schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            impact: { type: "string" },
            feasibility: { type: "string" },
            reward_points: { type: "number" }
          }
        }
      });

      await base44.entities.BuildIdea.create({
        title: ideaTitle,
        description: ideaDescription,
        category: analysis.category,
        status: 'pending',
        impact: analysis.impact,
        feasibility: analysis.feasibility,
        reward_points: 30000,
        votes: 0
      });

      setIsSubmitting(false);
      setIdeaTitle('');
      setIdeaDescription('');
      queryClient.invalidateQueries({ queryKey: ['build-ideas'] });
      toast.success('✅ Đã gửi ý tưởng!', {
        description: 'Admin sẽ xem xét và phê duyệt trong vòng 3-5 ngày.',
        duration: 4000,
      });
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error('❌ Gửi ý tưởng thất bại', {
        description: error.message,
        duration: 4000,
      });
    }
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, currentVotes }) => 
      base44.entities.BuildIdea.update(id, { votes: currentVotes + 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-ideas'] });
    },
  });

  const approveIdeaMutation = useMutation({
    mutationFn: async (idea) => {
      // Update idea status
      await base44.entities.BuildIdea.update(idea.id, {
        status: 'approved'
      });

      // Create transaction
      await base44.entities.CamlycoinTransaction.create({
        user_email: idea.created_by,
        amount: idea.reward_points,
        type: 'build_reward',
        description: `✅ Ý tưởng được duyệt: ${idea.title}`,
        reference_id: idea.id,
        processed_by: currentUser.email
      });

      // Update user balance - LOGIC MỚI: Cộng vào available_balance (Sẵn Sàng Thanh Toán)
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: idea.created_by });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          total_earned: (balance.total_earned || 0) + idea.reward_points,
          available_balance: (balance.available_balance || 0) + idea.reward_points
        });
      } else {
        await base44.entities.CamlycoinBalance.create({
          user_email: idea.created_by,
          total_earned: idea.reward_points,
          available_balance: idea.reward_points,
          admin_review_pending: 0,
          frozen_balance: 0,
          paid_amount: 0
        });
      }

      // Update UserLevel.total_points = total_earned - frozen_balance
      const userLevels = await base44.entities.UserLevel.filter({ user_email: idea.created_by });
      if (userLevels.length > 0) {
        const currentLevel = userLevels[0];
        const frozenBalance = balances.length > 0 ? (balances[0].frozen_balance || 0) : 0;
        const newTotalPoints = (balances.length > 0 ? (balances[0].total_earned || 0) : idea.reward_points) - frozenBalance + idea.reward_points;
        await base44.entities.UserLevel.update(currentLevel.id, {
          total_points: newTotalPoints
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-ideas'] });
    },
  });

  const rejectIdeaMutation = useMutation({
    mutationFn: (ideaId) => 
      base44.entities.BuildIdea.update(ideaId, { status: 'rejected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-ideas'] });
      toast.info('ℹ️ Đã từ chối ý tưởng', {
        description: 'Ý tưởng đã được đánh dấu là từ chối',
        duration: 3000,
      });
    },
  });

  const handleWalletConnect = (walletData) => {
    setWalletAddress(walletData.address);
    setSelectedNetwork(walletData.network);
    setWalletBalances({
      native: {
        symbol: walletData.symbol,
        balance: walletData.balance
      }
    });

    localStorage.setItem('walletAddress', walletData.address);
    localStorage.setItem('selectedNetwork', walletData.network);
    localStorage.setItem('walletType', walletData.walletType);
  };

  const disconnectWallet = () => {
    setWalletAddress('');
    setWalletBalances({});
    setSelectedNetwork('');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('selectedNetwork');
  };

  const submitTaskMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) {
        return;
      }

      await base44.entities.BountySubmission.create({
        task_id: selectedTask.id,
        task_title: selectedTask.title,
        proof_link: proofLink,
        description: taskDescription,
        wallet_address: walletAddress,
        status: 'pending',
        reward_amount: selectedTask.reward
      });

      setShowTaskModal(false);
      setProofLink('');
      setTaskDescription('');
    },
    onSuccess: () => {
      toast.success('✅ Đã gửi bằng chứng!', {
        description: 'Team sẽ xem xét trong vòng 3-5 ngày',
        duration: 4000,
      });
    },
    onError: (error) => {
      toast.error('❌ Gửi thất bại', {
        description: error.message,
        duration: 4000,
      });
    }
  });

  const bountyTasks = [
    {
      id: 1,
      title: 'Chia sẻ Angel AI trên Social Media',
      description: 'Post về Angel AI trên Facebook, Twitter, Instagram với hashtag #AngelAI #FUNEcosystem',
      category: 'social',
      reward: 10000,
      icon: Globe,
      gradient: 'from-blue-400 to-cyan-400'
    },
    {
      id: 2,
      title: 'Tìm và báo cáo Bug (Nhỏ)',
      description: 'Phát hiện và báo cáo lỗi UI nhỏ hoặc bug không nghiêm trọng',
      category: 'bug',
      reward: 20000,
      icon: Bug,
      gradient: 'from-orange-400 to-amber-400'
    },
    {
      id: 7,
      title: 'Tìm và báo cáo Bug (Nghiêm trọng)',
      description: 'Phát hiện lỗi bảo mật hoặc bug nghiêm trọng ảnh hưởng đến hệ thống',
      category: 'bug',
      reward: 50000,
      icon: Bug,
      gradient: 'from-red-400 to-orange-400'
    },
    {
      id: 3,
      title: 'Dịch tài liệu sang ngôn ngữ khác',
      description: 'Dịch Knowledge Base hoặc tài liệu giáo lý sang English, Chinese, v.v.',
      category: 'translation',
      reward: 30000,
      icon: FileText,
      gradient: 'from-purple-400 to-pink-400'
    },
    {
      id: 4,
      title: 'Góp code và tính năng mới',
      description: 'Đóng góp code, fix bug, hoặc phát triển tính năng mới cho Angel AI',
      category: 'code',
      reward: 40000,
      icon: Code,
      gradient: 'from-green-400 to-emerald-400'
    },
    {
      id: 5,
      title: 'Tạo nội dung giáo dục chất lượng cao',
      description: 'Viết bài hướng dẫn chi tiết, video tutorial, hoặc tài liệu giáo dục chuyên sâu về Angel AI',
      category: 'content',
      reward: 40000,
      icon: MessageSquare,
      gradient: 'from-amber-400 to-yellow-400'
    },
    {
      id: 6,
      title: 'Xây dựng & Quản lý Cộng đồng',
      description: 'Tích cực trả lời câu hỏi, hỗ trợ thành viên mới, tổ chức sự kiện cộng đồng',
      category: 'community',
      reward: 30000,
      icon: Users,
      gradient: 'from-indigo-400 to-purple-400'
    },
  ];

  const categoryColors = {
    code: 'bg-green-500 text-white',
    content: 'bg-blue-500 text-white',
    idea: 'bg-purple-500 text-white',
    community: 'bg-pink-500 text-white',
    design: 'bg-amber-500 text-white',
    marketing: 'bg-rose-500 text-white',
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    completed: 'bg-blue-100 text-blue-800 border-blue-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-pink-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(168,85,247,0.4)',
                  '0 0 40px rgba(236,72,153,0.4)',
                  '0 0 20px rgba(168,85,247,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0"
            >
              <Gift className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg truncate">Build & Bounty</h1>
              <p className="text-purple-600 text-xs font-medium truncate">Đóng Góp & Nhận Thưởng</p>
            </div>
          </div>
          {walletAddress ? (
            <div className="flex items-center gap-2">
              <div className="bg-green-50 border border-green-300 rounded-full px-3 py-1 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <div className="text-xs">
                  <p className="text-green-900 font-mono font-semibold">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                  {walletBalances.native && (
                    <p className="text-green-700 font-bold">
                      {walletBalances.native.balance} {walletBalances.native.symbol}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={disconnectWallet}
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                setSelectedNetwork('Binance Smart Chain');
                setShowWalletModal(true);
              }}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full flex-shrink-0 text-xs px-3"
            >
              <Wallet className="w-3 h-3 mr-1" />
              Kết nối ví
            </Button>
          )}
        </div>
      </div>

      {/* Wallet Connection Modal */}
      <MultiWalletConnect
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
        selectedNetwork={selectedNetwork || 'Binance Smart Chain'}
      />

      {/* Task Submission Modal */}
      <AnimatePresence>
        {showTaskModal && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTaskModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${selectedTask.gradient} flex items-center justify-center`}>
                    {React.createElement(selectedTask.icon, { className: "w-6 h-6 text-white" })}
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-xl font-semibold">{selectedTask.title}</h3>
                    <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white mt-1">
                      🪙 {selectedTask.reward.toLocaleString()} Camlycoin
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTaskModal(false)}
                  className="text-purple-600 hover:bg-purple-100"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Link bằng chứng *</label>
                  <Input
                    value={proofLink}
                    onChange={(e) => setProofLink(e.target.value)}
                    placeholder="https://twitter.com/... hoặc https://github.com/..."
                    className="bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-xl"
                  />
                  <p className="text-xs text-purple-600 mt-1">Post social media, repo GitHub, hoặc link file</p>
                </div>

                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Mô tả cách hoàn thành</label>
                  <Textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Mô tả chi tiết về cách bạn hoàn thành nhiệm vụ..."
                    className="min-h-[100px] bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-2xl resize-none"
                  />
                </div>

                {walletAddress && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-green-700 text-sm font-semibold mb-1">Ví đã kết nối:</p>
                        <p className="text-green-900 font-mono text-sm">{walletAddress}</p>
                      </div>
                      {isLoadingBalances && (
                        <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                      )}
                    </div>
                    {walletBalances.native && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-200">
                        <Badge className="bg-green-200 text-green-900 border border-green-400">
                          {selectedNetwork}
                        </Badge>
                        <p className="text-green-900 font-bold">
                          {walletBalances.native.balance} {walletBalances.native.symbol}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (!walletAddress) {
                      setShowTaskModal(false);
                      setShowWalletModal(true);
                      return;
                    }
                    submitTaskMutation.mutate();
                  }}
                  disabled={!proofLink.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 font-bold text-lg py-6"
                >
                  {walletAddress ? (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Gửi Bằng Chứng
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5 mr-2" />
                      Kết Nối Ví Để Tiếp Tục
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.button
            onClick={() => setActiveTab('build')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`p-6 rounded-3xl transition-all ${
              activeTab === 'build'
                ? 'bg-gradient-to-br from-purple-400 to-pink-400 shadow-xl border-2 border-white'
                : 'bg-white border-2 border-purple-200 hover:border-purple-400 shadow-md'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                activeTab === 'build' ? 'bg-white/30' : 'bg-gradient-to-br from-purple-400 to-pink-400'
              }`}>
                <Code className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className={`text-lg font-bold mb-1 ${activeTab === 'build' ? 'text-white' : 'text-slate-900'}`}>
                  Build
                </h3>
                <p className={`text-sm ${activeTab === 'build' ? 'text-white/90' : 'text-purple-700'}`}>
                  Đóng góp ý tưởng & xây dựng
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            onClick={() => setActiveTab('bounty')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`p-6 rounded-3xl transition-all ${
              activeTab === 'bounty'
                ? 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-xl border-2 border-white'
                : 'bg-white border-2 border-amber-200 hover:border-amber-400 shadow-md'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                activeTab === 'bounty' ? 'bg-white/30' : 'bg-gradient-to-br from-amber-400 to-orange-400'
              }`}>
                <Gift className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className={`text-lg font-bold mb-1 ${activeTab === 'bounty' ? 'text-white' : 'text-slate-900'}`}>
                  Bounty
                </h3>
                <p className={`text-sm ${activeTab === 'bounty' ? 'text-white/90' : 'text-amber-700'}`}>
                  Nhiệm vụ & nhận thưởng
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Build Section */}
        <AnimatePresence mode="wait">
          {activeTab === 'build' && (
            <motion.div
              key="build"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Submit Idea Form */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-lg">Đóng Góp Ý Tưởng</h3>
                    <p className="text-purple-700 text-sm font-medium">Chia sẻ ý tưởng và nhận phần thưởng</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    value={ideaTitle}
                    onChange={(e) => setIdeaTitle(e.target.value)}
                    placeholder="Tiêu đề ý tưởng..."
                    className="bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-xl font-medium"
                  />

                  <Textarea
                    value={ideaDescription}
                    onChange={(e) => setIdeaDescription(e.target.value)}
                    placeholder="Mô tả chi tiết ý tưởng của bạn..."
                    className="min-h-[120px] bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-2xl font-medium leading-relaxed resize-none"
                  />

                  <Button
                    onClick={() => submitIdeaMutation.mutate()}
                    disabled={!ideaTitle.trim() || !ideaDescription.trim() || isSubmitting}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 font-bold text-lg py-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Đang Gửi...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Gửi Ý Tưởng
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Ideas List */}
              <div className="space-y-4">
                <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  Ý Tưởng Từ Cộng Đồng
                </h3>

                {ideas.map((idea, index) => (
                  <motion.div
                    key={idea.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h4 className="text-slate-900 font-bold text-lg mb-2">{idea.title}</h4>
                        <p className="text-slate-700 text-sm leading-relaxed mb-3">{idea.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={categoryColors[idea.category]}>
                            {idea.category}
                          </Badge>
                          <Badge variant="outline" className={statusColors[idea.status]}>
                            {idea.status === 'pending' && '⏳ Chờ duyệt'}
                            {idea.status === 'approved' && '✅ Đã duyệt'}
                            {idea.status === 'completed' && '🎉 Hoàn thành'}
                            {idea.status === 'rejected' && '❌ Từ chối'}
                          </Badge>
                          <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                            🪙 {idea.reward_points.toLocaleString()} Camlycoin
                          </Badge>
                        </div>

                        {/* Admin Action Buttons */}
                        {currentUser?.role === 'admin' && idea.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              onClick={() => approveIdeaMutation.mutate(idea)}
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-md hover:shadow-lg"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Duyệt
                            </Button>
                            <Button
                              onClick={() => rejectIdeaMutation.mutate(idea.id)}
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50 rounded-full"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Từ chối
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => voteMutation.mutate({ id: idea.id, currentVotes: idea.votes })}
                        variant="outline"
                        size="sm"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full flex-shrink-0"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        {idea.votes}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
                      {currentUser?.role === 'admin' && (
                        <>
                          <span>Bởi {idea.created_by}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{new Date(idea.created_date).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </motion.div>
                ))}

                {ideas.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="text-slate-700 font-medium">Chưa có ý tưởng nào. Hãy là người đầu tiên đóng góp!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Bounty Section */}
          {activeTab === 'bounty' && (
            <motion.div
              key="bounty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <Trophy className="w-8 h-8 text-amber-500" />
                  <div>
                    <h3 className="text-slate-900 font-bold text-xl">Chương Trình Bounty</h3>
                    <p className="text-amber-700 text-sm font-medium">
                      Hoàn thành nhiệm vụ và nhận token/coin miễn phí
                    </p>
                  </div>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Tham gia các nhiệm vụ dưới đây để góp phần xây dựng Angel AI và nhận phần thưởng xứng đáng. 
                  Mỗi nhiệm vụ có mức thưởng khác nhau tùy theo độ khó và giá trị đóng góp.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bountyTasks.map((task, index) => {
                  const Icon = task.icon;
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -5 }}
                      className="group relative bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg hover:shadow-2xl hover:border-purple-400 transition-all"
                    >
                      <div className={`absolute top-4 right-4 w-12 h-12 rounded-full bg-gradient-to-br ${task.gradient} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      <div className="mb-4">
                        <h4 className="text-slate-900 font-bold text-lg mb-2 pr-14">{task.title}</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{task.description}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-base px-4 py-2 shadow-md">
                          🪙 {task.reward.toLocaleString()} Camlycoin
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                          className={`bg-gradient-to-r ${task.gradient} text-white rounded-full shadow-md hover:shadow-lg`}
                        >
                          Bắt Đầu
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Info Section */}
              <div className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Làm Thế Nào Để Nhận Thưởng?
                </h3>
                <ol className="space-y-3 text-slate-700 leading-relaxed">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
                    <span>Chọn nhiệm vụ phù hợp với kỹ năng của bạn</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
                    <span>Hoàn thành nhiệm vụ và gửi bằng chứng (link, screenshot, code, v.v.)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</span>
                    <span>Team Angel AI sẽ xem xét và phê duyệt trong vòng 3-5 ngày</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">4</span>
                    <span>Nhận token/coin trực tiếp vào ví của bạn 🎉</span>
                  </li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}