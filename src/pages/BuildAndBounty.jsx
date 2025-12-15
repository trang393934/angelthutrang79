import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Code, Gift, Send, Sparkles, Trophy, Users, MessageSquare, Bug, Globe, FileText, Loader2, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function BuildAndBounty() {
  const [activeTab, setActiveTab] = useState('build');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: ideas = [] } = useQuery({
    queryKey: ['build-ideas'],
    queryFn: () => base44.entities.BuildIdea.list('-created_date'),
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
4. Suggested reward points (10-100)

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
        reward_points: 10000,
        votes: 0
      });

      setIsSubmitting(false);
      setIdeaTitle('');
      setIdeaDescription('');
      queryClient.invalidateQueries({ queryKey: ['build-ideas'] });
    }
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, currentVotes }) => 
      base44.entities.BuildIdea.update(id, { votes: currentVotes + 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-ideas'] });
    },
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
      title: 'Tìm và báo cáo Bug',
      description: 'Phát hiện và báo cáo lỗi bảo mật hoặc bug trong ứng dụng',
      category: 'bug',
      reward: 10000,
      icon: Bug,
      gradient: 'from-red-400 to-orange-400'
    },
    {
      id: 3,
      title: 'Dịch tài liệu sang ngôn ngữ khác',
      description: 'Dịch Knowledge Base hoặc tài liệu giáo lý sang English, Chinese, v.v.',
      category: 'translation',
      reward: 10000,
      icon: FileText,
      gradient: 'from-purple-400 to-pink-400'
    },
    {
      id: 4,
      title: 'Góp code và tính năng mới',
      description: 'Đóng góp code, fix bug, hoặc phát triển tính năng mới cho Angel AI',
      category: 'code',
      reward: 10000,
      icon: Code,
      gradient: 'from-green-400 to-emerald-400'
    },
    {
      id: 5,
      title: 'Tạo nội dung giáo dục',
      description: 'Viết bài hướng dẫn, video tutorial, hoặc tài liệu giáo dục về Angel AI',
      category: 'content',
      reward: 10000,
      icon: MessageSquare,
      gradient: 'from-amber-400 to-yellow-400'
    },
    {
      id: 6,
      title: 'Tham gia và xây dựng cộng đồng',
      description: 'Tích cực trả lời câu hỏi, hỗ trợ thành viên mới trong cộng đồng',
      category: 'community',
      reward: 10000,
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
        </div>
      </div>

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
                      </div>
                      <Button
                        onClick={() => voteMutation.mutate({ id: idea.id, currentVotes: idea.votes })}
                        variant="outline"
                        size="sm"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        {idea.votes}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
                      <span>Bởi {idea.created_by}</span>
                      <span>•</span>
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