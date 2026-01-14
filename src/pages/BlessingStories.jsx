import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Heart, Send, Sparkles, Star, Search, Filter, Plus, X, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function BlessingStories() {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [blessingType, setBlessingType] = useState('spiritual');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['blessing-stories', filterType],
    queryFn: async () => {
      const allStories = await base44.entities.BlessingStory.filter({ status: 'approved' }, '-created_date', 1000);
      if (filterType === 'all') return allStories;
      return allStories.filter(s => s.blessing_type === filterType);
    },
    refetchInterval: 30000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-stories'],
    queryFn: () => base44.entities.User.list('-created_date', 10000),
  });

  const submitStoryMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.BlessingStory.create({
        user_email: currentUser.email,
        title,
        content,
        blessing_type: blessingType,
        likes: 0,
        status: 'approved'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blessing-stories'] });
      setShowForm(false);
      setTitle('');
      setContent('');
      setBlessingType('spiritual');
      toast.success('✨ Cảm ơn bạn đã chia sẻ phước lành!', {
        description: 'Câu chuyện của bạn đã được đăng tải',
        duration: 3000,
      });
    },
    onError: (error) => {
      toast.error('❌ Không thể chia sẻ', {
        description: error.message,
        duration: 3000,
      });
    }
  });

  const likeMutation = useMutation({
    mutationFn: ({ id, currentLikes }) => 
      base44.entities.BlessingStory.update(id, { likes: currentLikes + 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blessing-stories'] });
    },
  });

  const blessingTypes = [
    { value: 'all', label: 'Tất Cả', icon: '✨', color: 'from-purple-400 to-pink-400' },
    { value: 'health', label: 'Sức Khỏe', icon: '💚', color: 'from-green-400 to-emerald-400' },
    { value: 'wealth', label: 'Tài Lộc', icon: '💰', color: 'from-yellow-400 to-amber-400' },
    { value: 'relationship', label: 'Tình Yêu', icon: '💕', color: 'from-rose-400 to-pink-400' },
    { value: 'spiritual', label: 'Tâm Linh', icon: '🙏', color: 'from-indigo-400 to-purple-400' },
    { value: 'peace', label: 'Bình An', icon: '☮️', color: 'from-blue-400 to-cyan-400' },
    { value: 'family', label: 'Gia Đình', icon: '👨‍👩‍👧‍👦', color: 'from-orange-400 to-rose-400' },
    { value: 'career', label: 'Sự Nghiệp', icon: '🎯', color: 'from-violet-400 to-purple-400' },
    { value: 'other', label: 'Khác', icon: '🌟', color: 'from-amber-400 to-orange-400' },
  ];

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email?.split('@')[0] || 'Ẩn danh';
  };

  const getUserAvatar = (email) => {
    const user = users.find(u => u.email === email);
    return user?.avatar_url;
  };

  const filteredStories = stories.filter(story => 
    !searchTerm || story.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    story.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <Link to={createPageUrl('Home')}>
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
                className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Chia Sẻ Phước Lành</h1>
                <p className="text-amber-600 text-xs font-medium">Câu Chuyện Từ Cộng Đồng</p>
              </div>
            </div>

            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4 mr-1" />
              Chia sẻ
            </Button>
          </div>
        </div>
      </div>

      {/* Share Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-amber-300 rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-xl font-semibold">Chia Sẻ Phước Lành</h3>
                    <p className="text-amber-700 text-sm">Kể câu chuyện phước lành của bạn</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowForm(false)}
                  className="text-amber-600 hover:bg-amber-100"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Loại Phước Lành</label>
                  <div className="grid grid-cols-3 gap-2">
                    {blessingTypes.filter(t => t.value !== 'all').map(type => (
                      <button
                        key={type.value}
                        onClick={() => setBlessingType(type.value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          blessingType === type.value
                            ? `bg-gradient-to-br ${type.color} border-white text-white shadow-lg`
                            : 'border-amber-200 hover:border-amber-400 text-slate-700'
                        }`}
                      >
                        <div className="text-2xl mb-1">{type.icon}</div>
                        <div className="text-xs font-semibold">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Tiêu Đề</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Một phước lành tuyệt vời..."
                    className="bg-white border-2 border-amber-300 text-slate-900 placeholder:text-amber-400 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">Câu Chuyện</label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Chia sẻ câu chuyện của bạn về phước lành này..."
                    className="min-h-[150px] bg-white border-2 border-amber-300 text-slate-900 placeholder:text-amber-400 rounded-2xl resize-none"
                  />
                </div>

                <Button
                  onClick={() => submitStoryMutation.mutate()}
                  disabled={!title.trim() || !content.trim()}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 font-bold text-lg py-6"
                >
                  {submitStoryMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Đang Gửi...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Chia Sẻ Phước Lành
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
        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          <div className="bg-white/80 backdrop-blur-sm border-2 border-amber-200 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              <input
                type="text"
                placeholder="Tìm kiếm câu chuyện..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent text-slate-900 placeholder:text-amber-400 outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {blessingTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFilterType(type.value)}
                className={`px-4 py-2 rounded-full border-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  filterType === type.value
                    ? `bg-gradient-to-br ${type.color} border-white text-white shadow-lg`
                    : 'border-amber-200 bg-white hover:border-amber-400 text-slate-700'
                }`}
              >
                <span>{type.icon}</span>
                <span className="text-sm font-semibold">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stories Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="text-slate-900 font-bold text-xl mb-2">Chưa có câu chuyện nào</h3>
            <p className="text-slate-600 mb-6">Hãy là người đầu tiên chia sẻ phước lành của bạn!</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Chia Sẻ Ngay
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStories.map((story, index) => {
              const type = blessingTypes.find(t => t.value === story.blessing_type);
              return (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white/80 backdrop-blur-xl border-2 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all ${
                    story.is_featured ? 'border-amber-400' : 'border-amber-200'
                  }`}
                >
                  {story.is_featured && (
                    <Badge className="mb-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white">
                      <Crown className="w-3 h-3 mr-1" />
                      Nổi Bật
                    </Badge>
                  )}

                  <div className="flex items-start gap-3 mb-4">
                    {getUserAvatar(story.user_email) ? (
                      <img
                        src={getUserAvatar(story.user_email)}
                        alt="Avatar"
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-300"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {getUserName(story.user_email)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-slate-900 font-bold">{getUserName(story.user_email)}</p>
                        <Badge className={`bg-gradient-to-br ${type?.color} text-white text-xs`}>
                          {type?.icon} {type?.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-600">
                        {new Date(story.created_date).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <h3 className="text-slate-900 font-bold text-lg mb-3">{story.title}</h3>
                  <p className="text-slate-700 leading-relaxed mb-4 whitespace-pre-line">{story.content}</p>

                  <div className="flex items-center justify-between pt-4 border-t border-amber-200">
                    <Button
                      onClick={() => likeMutation.mutate({ id: story.id, currentLikes: story.likes })}
                      variant="ghost"
                      size="sm"
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                    >
                      <Heart className="w-4 h-4 mr-1" />
                      {story.likes || 0}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}