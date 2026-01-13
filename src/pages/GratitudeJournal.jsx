import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Sun, Moon, Send, Calendar, TrendingUp, Award, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

export default function GratitudeJournal() {
  const [currentUser, setCurrentUser] = useState(null);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('both');
  const [isSelfWritten, setIsSelfWritten] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'repentance', 'gratitude', 'both'
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'today', 'week', 'month'
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 5;
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Get current hour in Vietnam timezone
  const currentHour = new Date().getHours();
  const isAfter8PM = currentHour >= 20 || currentHour < 6;

  // Fetch user's posts
  const { data: userPosts = [], isLoading } = useQuery({
    queryKey: ['gratitude-posts', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      try {
        const allPosts = await base44.entities.GratitudeJournal.list('-post_date', 1000);
        return allPosts.filter(post => post.user_email === currentUser.email);
      } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
      }
    },
    enabled: !!currentUser,
  });

  // Count today's posts
  const todayPosts = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return userPosts.filter(post => {
      const postDate = new Date(post.post_date).toISOString().split('T')[0];
      return postDate === today;
    });
  }, [userPosts]);

  const remainingPosts = 3 - todayPosts.length;

  // Filter posts
  const filteredPosts = React.useMemo(() => {
    let filtered = [...userPosts];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(post => post.post_type === filterType);
    }

    // Filter by date
    if (filterDate !== 'all') {
      const now = new Date();
      filtered = filtered.filter(post => {
        const postDate = new Date(post.post_date);
        const daysDiff = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));
        
        if (filterDate === 'today') return daysDiff === 0;
        if (filterDate === 'week') return daysDiff <= 7;
        if (filterDate === 'month') return daysDiff <= 30;
        return true;
      });
    }

    return filtered;
  }, [userPosts, filterType, filterDate]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterDate]);

  // Submit post mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('submitGratitudePost', {
        postContent,
        postType,
        isSelfWritten
      });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gratitude-posts'] });
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
      setPostContent('');
      const bonusInfo = data.isSelfWritten 
        ? `${data.isAfter8PM ? '\n🌙 Bonus sau 20h: +50%' : ''}${data.postType === 'both' ? '\n✨ Bonus cả 2 loại: +20%' : ''}`
        : '\n⚠️ Không có bonus (dựa gợi ý)';
      alert(`✅ ${data.message}\n💰 +${data.coinsEarned} Camlycoin\n📝 ${data.wordCount} từ${bonusInfo}\n📊 Còn ${data.remainingPostsToday} bài trong ngày`);
    },
    onError: (error) => {
      console.error('Submit error:', error);
      alert(`❌ ${error?.response?.data?.error || error.message || 'Có lỗi xảy ra!'}`);
    }
  });

  const handleSubmit = async () => {
    if (!postContent.trim()) {
      alert('Vui lòng nhập nội dung!');
      return;
    }

    const wordCount = postContent.trim().split(/\s+/).length;
    if (wordCount < 50) {
      alert(`Bài viết phải có ít nhất 50 từ!\nHiện tại: ${wordCount} từ`);
      return;
    }

    if (remainingPosts <= 0) {
      alert('Bạn đã đăng đủ 3 bài trong ngày hôm nay!');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  const wordCount = postContent.trim().split(/\s+/).filter(w => w).length;

  const getRewardPreview = () => {
    let base = 0;
    if (wordCount >= 50 && wordCount < 100) base = 5000;
    else if (wordCount >= 100 && wordCount < 200) base = 7500;
    else if (wordCount >= 200) base = 10000;

    let multiplier = 1.0;
    if (isSelfWritten) {
      if (isAfter8PM) multiplier = 1.5;
      if (postType === 'both') multiplier += 0.2;
    }

    return Math.round(base * multiplier);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 text-purple-300 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-900 font-bold text-xl">Đang tải...</p>
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
            <Link to={createPageUrl('Chat')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(236,72,153,0.4)',
                    '0 0 40px rgba(236,72,153,0.6)',
                    '0 0 20px rgba(236,72,153,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center"
              >
                <Heart className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Nhật Ký Biết Ơn</h1>
                <p className="text-pink-600 text-xs font-medium">Gratitude & Repentance</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-4xl mx-auto">
        {/* Time Banner - Enhanced */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
          className={`rounded-3xl p-6 shadow-2xl mb-6 border-2 relative overflow-hidden ${
            isAfter8PM 
              ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-purple-300' 
              : 'bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 border-amber-300'
          }`}
        >
          {/* Animated background */}
          <motion.div
            animate={{ 
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
          />
          
          <div className="relative flex items-center gap-4">
            <motion.div
              animate={{ rotate: isAfter8PM ? [0, 10, -10, 0] : [0, 360] }}
              transition={{ duration: isAfter8PM ? 2 : 20, repeat: Infinity }}
            >
              {isAfter8PM ? (
                <Moon className="w-12 h-12 text-white drop-shadow-lg" />
              ) : (
                <Sun className="w-12 h-12 text-white drop-shadow-lg" />
              )}
            </motion.div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-2xl mb-1 drop-shadow-md">
                {isAfter8PM ? '🌙 Giờ Vàng Sau 20h' : '☀️ Ban Ngày'}
              </h2>
              <p className="text-white/95 text-sm font-medium">
                {isAfter8PM 
                  ? '✨ Bonus +50% khi TỰ VIẾT sau 20h tối!' 
                  : 'Tự viết sau 20h để nhận bonus +50%'}
              </p>
            </div>
            {isAfter8PM && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Badge className="bg-white/30 text-white border-white/50 text-xl px-6 py-3 shadow-lg backdrop-blur-sm">
                  +50% 🎁
                </Badge>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Daily Limit - Enhanced */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, type: "spring" }}
          className="bg-white/90 backdrop-blur-xl border-2 border-pink-300 rounded-3xl p-6 shadow-xl mb-6 relative overflow-hidden"
        >
          <motion.div
            animate={{ 
              x: ['-100%', '100%']
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg"
              >
                <Calendar className="w-7 h-7 text-white" />
              </motion.div>
              <div>
                <p className="text-slate-900 font-bold text-lg">Hạn Mức Hôm Nay</p>
                <p className="text-slate-600 text-sm font-medium">{todayPosts.length}/3 bài đã đăng</p>
              </div>
            </div>
            <motion.div
              animate={{ scale: remainingPosts === 0 ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.5, repeat: remainingPosts === 0 ? Infinity : 0 }}
            >
              <Badge className={`text-lg px-4 py-2 ${
                remainingPosts > 0 
                  ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                  : 'bg-red-100 text-red-800 border-2 border-red-300'
              }`}>
                {remainingPosts > 0 ? `✅ Còn ${remainingPosts} bài` : '⏸️ Hết lượt'}
              </Badge>
            </motion.div>
          </div>
        </motion.div>

        {/* Self-Written Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelfWritten ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gray-300'}`}>
                <span className="text-2xl">{isSelfWritten ? '✍️' : '📝'}</span>
              </div>
              <div>
                <p className="text-slate-900 font-bold text-lg">
                  {isSelfWritten ? 'Tự Viết (Sáng Tạo)' : 'Dựa Gợi Ý Angel AI'}
                </p>
                <p className="text-slate-600 text-sm">
                  {isSelfWritten 
                    ? '✅ Được nhận bonus sau 20h và bonus cả 2 loại' 
                    : '⚠️ Không nhận bonus (chỉ thưởng cơ bản)'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSelfWritten(!isSelfWritten)}
              className={`w-16 h-8 rounded-full transition-all ${
                isSelfWritten ? 'bg-green-500' : 'bg-gray-400'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                isSelfWritten ? 'translate-x-9' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </motion.div>

        {/* Post Type Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Loại Bài Viết
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'repentance', label: 'Sám Hối', icon: '🙏', bonus: '' },
              { value: 'gratitude', label: 'Biết Ơn', icon: '❤️', bonus: '' },
              { value: 'both', label: 'Cả Hai', icon: '✨', bonus: '+20%' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setPostType(option.value)}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  postType === option.value
                    ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-400 shadow-lg'
                    : 'bg-white border-purple-200 hover:border-purple-300'
                }`}
              >
                <div className="text-3xl mb-2">{option.icon}</div>
                <p className="font-bold text-slate-900 text-sm">{option.label}</p>
                {option.bonus && isSelfWritten && (
                  <Badge className="mt-2 bg-amber-100 text-amber-800 text-xs">
                    {option.bonus}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Post Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-pink-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-pink-500" />
            Nội Dung Bài Viết
          </h3>
          <Textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="Hãy viết những suy nghĩ chân thành của bạn về sự sám hối và biết ơn...

Ví dụ:
🙏 Con xin sám hối vì...
❤️ Con biết ơn vì...
✨ Con cam kết sẽ..."
            className="min-h-[300px] text-slate-900 text-base leading-relaxed"
            disabled={remainingPosts <= 0}
          />
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <Badge className={wordCount >= 50 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                {wordCount} từ {wordCount < 50 && `(cần ${50 - wordCount} từ nữa)`}
              </Badge>
              {wordCount >= 50 && (
                <Badge className="bg-purple-100 text-purple-800">
                  💰 ~{getRewardPreview()} Camlycoin
                </Badge>
              )}
            </div>
          </div>
        </motion.div>

        {/* Reward Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 shadow-lg mb-6"
        >
          <h3 className="text-slate-900 font-bold text-lg mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Thang Thưởng
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-amber-200 rounded-xl p-3">
              <p className="text-amber-900 font-bold">50-99 từ</p>
              <p className="text-amber-700 text-sm">5,000 Camlycoin</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3">
              <p className="text-amber-900 font-bold">100-199 từ</p>
              <p className="text-amber-700 text-sm">7,500 Camlycoin</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3">
              <p className="text-amber-900 font-bold">200+ từ</p>
              <p className="text-amber-700 text-sm">10,000 Camlycoin</p>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <p>✍️ <strong>Tự viết:</strong> Được nhận bonus</p>
            <p>🌙 <strong>Bonus sau 20h (tự viết):</strong> +50% thưởng</p>
            <p>✨ <strong>Bonus cả 2 loại (tự viết):</strong> +20% thưởng</p>
            <p>📝 <strong>Dựa gợi ý Angel AI:</strong> Chỉ thưởng cơ bản, không bonus</p>
            <p>📊 <strong>Giới hạn:</strong> 3 bài/ngày</p>
          </div>
        </motion.div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || wordCount < 50 || remainingPosts <= 0}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl py-6 text-lg font-bold shadow-xl hover:shadow-2xl disabled:opacity-50"
        >
          {isSubmitting ? (
            <>Đang đăng...</>
          ) : remainingPosts <= 0 ? (
            <>Đã hết lượt hôm nay</>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Đăng Bài & Nhận {getRewardPreview()} Camlycoin
            </>
          )}
        </Button>

        {/* Recent Posts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 font-bold text-2xl flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <TrendingUp className="w-7 h-7 text-purple-500" />
              </motion.div>
              Bài Viết Gần Đây
            </h3>
            <Badge className="bg-purple-100 text-purple-800 text-sm px-3 py-1">
              {filteredPosts.length} bài
            </Badge>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Type Filter */}
            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
              <p className="text-slate-700 font-semibold mb-3 text-sm">Lọc theo loại:</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'all', label: 'Tất Cả', icon: '📝' },
                  { value: 'repentance', label: 'Sám Hối', icon: '🙏' },
                  { value: 'gratitude', label: 'Biết Ơn', icon: '❤️' },
                  { value: 'both', label: 'Cả Hai', icon: '✨' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterType(option.value)}
                    className={`rounded-xl p-3 border-2 transition-all ${
                      filterType === option.value
                        ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-400 shadow-md scale-105'
                        : 'bg-white border-purple-200 hover:border-purple-300 hover:scale-105'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.icon}</div>
                    <p className="font-semibold text-slate-900 text-xs">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filter */}
            <div className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-2xl p-4">
              <p className="text-slate-700 font-semibold mb-3 text-sm">Lọc theo ngày:</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'all', label: 'Tất Cả', icon: '📅' },
                  { value: 'today', label: 'Hôm Nay', icon: '📌' },
                  { value: 'week', label: '7 Ngày', icon: '📆' },
                  { value: 'month', label: '30 Ngày', icon: '🗓️' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterDate(option.value)}
                    className={`rounded-xl p-3 border-2 transition-all ${
                      filterDate === option.value
                        ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-amber-400 shadow-md scale-105'
                        : 'bg-white border-amber-200 hover:border-amber-300 hover:scale-105'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.icon}</div>
                    <p className="font-semibold text-slate-900 text-xs">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full mx-auto mb-4" />
              <p className="text-slate-700">Đang tải...</p>
            </div>
          ) : userPosts.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-12 text-center">
              <Heart className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Chưa có bài viết nào</p>
              <p className="text-slate-600 text-sm mt-2">Hãy bắt đầu viết bài đầu tiên của bạn!</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-12 text-center">
              <Heart className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Không tìm thấy bài viết</p>
              <p className="text-slate-600 text-sm mt-2">Thử thay đổi bộ lọc hoặc viết bài mới!</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedPosts.map((post, idx) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={
                        post.post_type === 'repentance' ? 'bg-purple-100 text-purple-800' :
                        post.post_type === 'gratitude' ? 'bg-pink-100 text-pink-800' :
                        'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800'
                      }>
                        {post.post_type === 'repentance' ? '🙏 Sám Hối' :
                         post.post_type === 'gratitude' ? '❤️ Biết Ơn' : '✨ Cả Hai'}
                      </Badge>
                      {post.is_self_written ? (
                        <Badge className="bg-green-100 text-green-800">
                          ✍️ Tự viết
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">
                          📝 Gợi ý
                        </Badge>
                      )}
                      {post.is_after_8pm && post.is_self_written && (
                        <Badge className="bg-indigo-100 text-indigo-800">
                          🌙 Sau 20h
                        </Badge>
                      )}
                      <Badge className="bg-amber-100 text-amber-800">
                        💰 +{post.coins_earned?.toLocaleString()}
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-600">
                      {format(new Date(post.post_date), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-slate-900 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {post.post_content}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
                    <span>{post.word_count} từ</span>
                    {post.bonus_multiplier > 1 && (
                      <span className="text-amber-600 font-bold">
                        ×{post.bonus_multiplier} bonus
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 flex items-center justify-center gap-2"
              >
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                >
                  ← Trước
                </Button>
                
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl font-bold transition-all ${
                        currentPage === page
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg scale-110'
                          : 'bg-white border-2 border-purple-200 text-purple-700 hover:border-purple-400 hover:scale-105'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                >
                  Sau →
                </Button>
              </motion.div>
            )}
          </>
          )}
        </motion.div>
      </div>
    </div>
  );
}