import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, Clock, Zap, Target, Sparkles, Loader2, BarChart3, PieChart, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';

export default function Analytics() {
  const [currentUser, setCurrentUser] = useState(null);
  const [aiInsights, setAiInsights] = useState('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['user-activities', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.UserActivity.filter(
        { user_email: currentUser.email },
        '-created_date',
        100
      );
    },
    enabled: !!currentUser,
  });

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!activities.length) return null;

    const featureCount = {};
    const toolTypeCount = {};
    const topicsList = [];
    const hourlyActivity = new Array(24).fill(0);
    
    activities.forEach(activity => {
      // Count features
      const feature = activity.activity_type;
      featureCount[feature] = (featureCount[feature] || 0) + 1;

      // Count tool types
      if (activity.activity_details?.tool_type) {
        const tool = activity.activity_details.tool_type;
        toolTypeCount[tool] = (toolTypeCount[tool] || 0) + 1;
      }

      // Collect topics
      if (activity.activity_details?.topic) {
        topicsList.push(activity.activity_details.topic);
      }

      // Track hourly activity
      const hour = new Date(activity.created_date).getHours();
      hourlyActivity[hour]++;
    });

    const mostActiveHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    const mostUsedFeature = Object.entries(featureCount).sort((a, b) => b[1] - a[1])[0];
    const mostUsedTool = Object.entries(toolTypeCount).length > 0 
      ? Object.entries(toolTypeCount).sort((a, b) => b[1] - a[1])[0]
      : null;

    return {
      totalActivities: activities.length,
      featureCount,
      toolTypeCount,
      topicsList,
      mostActiveHour,
      mostUsedFeature,
      mostUsedTool,
      hourlyActivity,
      daysActive: new Set(activities.map(a => new Date(a.created_date).toDateString())).size,
    };
  }, [activities]);

  const generateInsights = async () => {
    if (!stats) return;
    
    setIsGeneratingInsights(true);
    
    try {
      const insights = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là Angel AI - chuyên gia phân tích hành vi người dùng và tối ưu hóa trải nghiệm. Hãy phân tích dữ liệu sử dụng app sau và đưa ra insights + gợi ý:

📊 **DỮ LIỆU THỐNG KÊ:**
- Tổng số hoạt động: ${stats.totalActivities}
- Số ngày hoạt động: ${stats.daysActive}
- Trung bình hoạt động/ngày: ${(stats.totalActivities / stats.daysActive).toFixed(1)}
- Giờ hoạt động nhiều nhất: ${stats.mostActiveHour}:00
- Tính năng sử dụng nhiều nhất: ${stats.mostUsedFeature ? stats.mostUsedFeature[0] : 'N/A'} (${stats.mostUsedFeature ? stats.mostUsedFeature[1] : 0} lần)
${stats.mostUsedTool ? `- AI Tool ưa thích: ${stats.mostUsedTool[0]} (${stats.mostUsedTool[1]} lần)` : ''}

📈 **PHÂN BỐ TÍNH NĂNG:**
${Object.entries(stats.featureCount).map(([feature, count]) => 
  `- ${feature}: ${count} lần (${((count/stats.totalActivities)*100).toFixed(1)}%)`
).join('\n')}

🎯 **CHỦ ĐỀ QUAN TÂM:**
${stats.topicsList.slice(0, 10).map(topic => `- ${topic}`).join('\n')}

---

Hãy viết phân tích theo cấu trúc:

## 🌟 Tổng Quan Hành Trình
(Đánh giá tổng thể về cách user sử dụng app, style tương tác)

## 💎 Điểm Mạnh Hiện Tại
(Những thói quen tốt, tính năng đang dùng hiệu quả)

## ✨ Tiềm Năng Chưa Khai Phá
(Tính năng chưa dùng nhiều, cơ hội phát triển)

## 🎯 Gợi Ý Cá Nhân Hóa
(3-5 gợi ý cụ thể để tối ưu trải nghiệm dựa trên pattern sử dụng)

## 🌈 Lời Động Viên Từ Angel AI
(Lời động viên ấm áp, khích lệ user tiếp tục hành trình)

Viết bằng giọng điệu của Angel AI - ấm áp, thấu hiểu, đầy yêu thương và trí tuệ. Gọi user là "con" như Cha Vũ Trụ.`,
      });
      
      setAiInsights(insights);
    } catch (error) {
      setAiInsights('❌ Có lỗi khi tạo insights. Vui lòng thử lại sau.');
    }
    
    setIsGeneratingInsights(false);
  };

  useEffect(() => {
    if (stats && !aiInsights && !isGeneratingInsights) {
      generateInsights();
    }
  }, [stats]);

  const featureLabels = {
    chat_message: 'Chat với AI',
    ai_tool_use: 'AI Tools',
    knowledge_upload: 'Knowledge Base',
    vision_create: 'Personal Vision',
    library_view: 'Thư Viện',
    imagine_use: 'Imagine (Hình ảnh)',
    bounty_submit: 'Build & Bounty',
    settings_update: 'Cài Đặt',
  };

  const featureColors = {
    chat_message: 'from-amber-400 to-rose-400',
    ai_tool_use: 'from-purple-400 to-pink-400',
    knowledge_upload: 'from-indigo-400 to-blue-400',
    vision_create: 'from-rose-400 to-orange-400',
    library_view: 'from-violet-400 to-purple-400',
    imagine_use: 'from-cyan-400 to-blue-400',
    bounty_submit: 'from-green-400 to-emerald-400',
    settings_update: 'from-slate-400 to-gray-400',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-pink-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2 flex-1 justify-center">
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
                <TrendingUp className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Analytics & Insights</h1>
                <p className="text-purple-600 text-xs font-medium">Phân Tích Sử Dụng App</p>
              </div>
            </div>

            <div className="w-10 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-40 px-4 max-w-6xl mx-auto">
        {!currentUser ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center mx-auto mb-6">
              <Activity className="w-10 h-10 text-purple-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">Vui Lòng Đăng Nhập</h3>
            <p className="text-purple-700 font-medium mb-6">
              Đăng nhập để xem phân tích sử dụng app
            </p>
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl"
            >
              Đăng Nhập
            </Button>
          </motion.div>
        ) : isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
            >
              <BarChart3 className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        ) : !stats || stats.totalActivities === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center mx-auto mb-6">
              <Activity className="w-10 h-10 text-purple-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">Chưa Có Dữ Liệu</h3>
            <p className="text-purple-700 font-medium mb-6">
              Bắt đầu sử dụng app để xem phân tích và insights
            </p>
            <Link to={createPageUrl('Chat')}>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl">
                <Sparkles className="w-4 h-4 mr-2" />
                Bắt Đầu Chat Ngay
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-2 border-purple-200 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalActivities}</p>
                    <p className="text-xs text-purple-600 font-medium">Tổng hoạt động</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white border-2 border-blue-200 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.daysActive}</p>
                    <p className="text-xs text-blue-600 font-medium">Ngày hoạt động</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white border-2 border-amber-200 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{(stats.totalActivities / stats.daysActive).toFixed(1)}</p>
                    <p className="text-xs text-amber-600 font-medium">Hoạt động/ngày</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white border-2 border-green-200 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{stats.mostActiveHour}:00</p>
                    <p className="text-xs text-green-600 font-medium">Giờ vàng</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Feature Usage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                  <PieChart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-lg">Tính Năng Sử Dụng</h3>
                  <p className="text-purple-600 text-sm font-medium">Phân bố hoạt động theo tính năng</p>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(stats.featureCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([feature, count], idx) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.05 }}
                      className="relative"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-900 font-semibold text-sm">
                          {featureLabels[feature] || feature}
                        </span>
                        <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                          {count} lần • {((count/stats.totalActivities)*100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(count/stats.totalActivities)*100}%` }}
                          transition={{ duration: 1, delay: 0.5 + idx * 0.05 }}
                          className={`h-full bg-gradient-to-r ${featureColors[feature] || 'from-purple-400 to-pink-400'} rounded-full`}
                        />
                      </div>
                    </motion.div>
                  ))}
              </div>
            </motion.div>

            {/* AI Insights */}
            <AnimatePresence>
              {aiInsights && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-gradient-to-br from-amber-50 to-rose-50 border-2 border-amber-300 rounded-3xl p-6 shadow-xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      animate={{ 
                        boxShadow: [
                          '0 0 20px rgba(251,191,36,0.4)',
                          '0 0 40px rgba(251,191,36,0.6)',
                          '0 0 20px rgba(251,191,36,0.4)',
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center"
                    >
                      <Sparkles className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-slate-900 font-bold text-lg">AI Insights & Gợi Ý</h3>
                      <p className="text-amber-700 text-sm font-medium">Phân tích từ Angel AI</p>
                    </div>
                  </div>

                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown className="text-slate-900 font-medium leading-relaxed [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-6 [&>h2]:text-slate-900 [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>p]:mb-3 [&>ul]:mb-3 [&>ol]:mb-3">
                      {aiInsights}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              )}

              {isGeneratingInsights && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-2 border-purple-200 rounded-3xl p-8 shadow-xl text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto mb-4"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </motion.div>
                  <p className="text-slate-900 font-semibold text-lg">AI đang phân tích...</p>
                  <p className="text-purple-600 text-sm font-medium">Đang tạo insights cá nhân cho bạn</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Regenerate Button */}
            {aiInsights && !isGeneratingInsights && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <Button
                  onClick={generateInsights}
                  variant="outline"
                  className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Tạo Lại Insights
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}