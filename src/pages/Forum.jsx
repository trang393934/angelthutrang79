import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, Plus, ThumbsUp, ThumbsDown, Eye, MessageCircle, Pin, Lock, Search, Filter, TrendingUp, Clock, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import TagSelector from '@/components/TagSelector';

export default function Forum() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'general', tags: '' });
  const [selectedPost, setSelectedPost] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch all posts
  const { data: allPosts = [] } = useQuery({
    queryKey: ['forum-posts'],
    queryFn: () => base44.entities.ForumPost.list('-created_date', 1000),
    enabled: !!currentUser,
  });

  // Fetch replies for selected post
  const { data: postReplies = [] } = useQuery({
    queryKey: ['forum-replies', selectedPost?.id],
    queryFn: () => base44.entities.ForumReply.filter({ post_id: selectedPost.id }, '-created_date'),
    enabled: !!selectedPost,
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData) => {
      const tags = postData.tags.split(',').map(t => t.trim()).filter(t => t);
      return base44.entities.ForumPost.create({
        ...postData,
        tags,
        upvotes: 0,
        downvotes: 0,
        upvoted_by: [],
        downvoted_by: [],
        reply_count: 0,
        view_count: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      setShowNewPost(false);
      setNewPost({ title: '', content: '', category: 'general', tags: '' });
    }
  });

  // Create reply mutation
  const createReplyMutation = useMutation({
    mutationFn: async (content) => {
      const reply = await base44.entities.ForumReply.create({
        post_id: selectedPost.id,
        content,
        upvotes: 0,
        downvotes: 0,
        upvoted_by: [],
        downvoted_by: []
      });

      // Update reply count
      await base44.entities.ForumPost.update(selectedPost.id, {
        reply_count: (selectedPost.reply_count || 0) + 1
      });

      // Create notification for post author
      if (selectedPost.created_by !== currentUser.email) {
        await base44.entities.Notification.create({
          user_email: selectedPost.created_by,
          type: 'forum_reply',
          title: '💬 Có người trả lời bài viết của bạn',
          content: `${currentUser.email} đã trả lời: "${content.substring(0, 100)}..."`,
          reference_id: selectedPost.id,
          reference_type: 'forum_post',
          from_user: currentUser.email,
          is_read: false
        });
      }

      return reply;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies'] });
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      setReplyContent('');
    }
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ id, type, voteType, currentVotes }) => {
      const isPost = type === 'post';
      const entity = isPost ? base44.entities.ForumPost : base44.entities.ForumReply;
      
      const upvotedBy = currentVotes.upvoted_by || [];
      const downvotedBy = currentVotes.downvoted_by || [];
      
      let newUpvotes = currentVotes.upvotes || 0;
      let newDownvotes = currentVotes.downvotes || 0;
      let newUpvotedBy = [...upvotedBy];
      let newDownvotedBy = [...downvotedBy];
      
      const wasUpvoted = upvotedBy.includes(currentUser.email);
      
      if (voteType === 'up') {
        if (wasUpvoted) {
          newUpvotes--;
          newUpvotedBy = newUpvotedBy.filter(e => e !== currentUser.email);
        } else {
          newUpvotes++;
          newUpvotedBy.push(currentUser.email);
          if (downvotedBy.includes(currentUser.email)) {
            newDownvotes--;
            newDownvotedBy = newDownvotedBy.filter(e => e !== currentUser.email);
          }
          
          // Create notification for upvote (only on first upvote)
          if (currentVotes.created_by !== currentUser.email) {
            await base44.entities.Notification.create({
              user_email: currentVotes.created_by,
              type: 'forum_upvote',
              title: '👍 Có người thích bài của bạn',
              content: `${currentUser.email} đã upvote ${isPost ? 'bài đăng' : 'câu trả lời'} của bạn`,
              reference_id: id,
              reference_type: isPost ? 'forum_post' : 'forum_reply',
              from_user: currentUser.email,
              is_read: false
            });
          }
        }
      } else {
        if (downvotedBy.includes(currentUser.email)) {
          newDownvotes--;
          newDownvotedBy = newDownvotedBy.filter(e => e !== currentUser.email);
        } else {
          newDownvotes++;
          newDownvotedBy.push(currentUser.email);
          if (upvotedBy.includes(currentUser.email)) {
            newUpvotes--;
            newUpvotedBy = newUpvotedBy.filter(e => e !== currentUser.email);
          }
        }
      }
      
      await entity.update(id, {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        upvoted_by: newUpvotedBy,
        downvoted_by: newDownvotedBy
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      queryClient.invalidateQueries({ queryKey: ['forum-replies'] });
    }
  });

  // View post
  const handleViewPost = async (post) => {
    setSelectedPost(post);
    // Increment view count
    await base44.entities.ForumPost.update(post.id, {
      view_count: (post.view_count || 0) + 1
    });
    queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
  };

  // Filter and sort posts
  const filteredPosts = allPosts
    .filter(post => {
      if (categoryFilter !== 'all' && post.category !== categoryFilter) return false;
      if (searchQuery && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
        case 'replies':
          return (b.reply_count || 0) - (a.reply_count || 0);
        case 'views':
          return (b.view_count || 0) - (a.view_count || 0);
        default:
          return new Date(b.created_date) - new Date(a.created_date);
      }
    });

  const categories = [
    { value: 'general', label: '💬 Tổng Hợp', color: 'from-blue-400 to-cyan-400' },
    { value: 'qa', label: '❓ Hỏi Đáp', color: 'from-purple-400 to-indigo-400' },
    { value: 'experience', label: '✨ Chia Sẻ', color: 'from-amber-400 to-orange-400' },
    { value: 'feedback', label: '💡 Góp Ý', color: 'from-green-400 to-emerald-400' },
    { value: 'announcement', label: '📢 Thông Báo', color: 'from-red-400 to-pink-400' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(168,85,247,0.4)',
                    '0 0 40px rgba(168,85,247,0.6)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
              >
                <MessageSquare className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Diễn Đàn</h1>
                <p className="text-purple-600 text-xs font-medium">Community Forum</p>
              </div>
            </div>

            <Button
              onClick={() => setShowNewPost(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tạo Bài
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài đăng..."
                className="pl-10 bg-white border-2 border-purple-300 rounded-xl"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border-2 border-purple-300 rounded-xl px-4 py-2 text-slate-900"
            >
              <option value="all">Tất Cả Danh Mục</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border-2 border-purple-300 rounded-xl px-4 py-2 text-slate-900"
            >
              <option value="recent">🕒 Mới Nhất</option>
              <option value="popular">🔥 Phổ Biến</option>
              <option value="replies">💬 Nhiều Trả Lời</option>
              <option value="views">👁️ Nhiều Xem</option>
            </select>
          </div>
        </motion.div>

        {/* Posts List */}
        {!selectedPost ? (
          <div className="space-y-4">
            {filteredPosts.map((post, idx) => {
              const category = categories.find(c => c.value === post.category);
              const netVotes = (post.upvotes || 0) - (post.downvotes || 0);
              
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleViewPost(post)}
                  className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <div className="flex gap-4">
                    {/* Vote Column */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          voteMutation.mutate({ id: post.id, type: 'post', voteType: 'up', currentVotes: post });
                        }}
                        className={`p-2 rounded-lg transition-all ${
                          post.upvoted_by?.includes(currentUser?.email)
                            ? 'bg-green-100 text-green-600'
                            : 'hover:bg-green-50 text-slate-600'
                        }`}
                      >
                        <ThumbsUp className="w-5 h-5" />
                      </button>
                      <span className={`font-bold text-lg ${
                        netVotes > 0 ? 'text-green-600' : netVotes < 0 ? 'text-red-600' : 'text-slate-600'
                      }`}>
                        {netVotes}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          voteMutation.mutate({ id: post.id, type: 'post', voteType: 'down', currentVotes: post });
                        }}
                        className={`p-2 rounded-lg transition-all ${
                          post.downvoted_by?.includes(currentUser?.email)
                            ? 'bg-red-100 text-red-600'
                            : 'hover:bg-red-50 text-slate-600'
                        }`}
                      >
                        <ThumbsDown className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {post.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
                        <Badge className={`bg-gradient-to-r ${category.color} text-white`}>
                          {category.label}
                        </Badge>
                        {post.tags?.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <h3 className="text-slate-900 font-bold text-lg mb-2">{post.title}</h3>
                      <p className="text-slate-600 text-sm mb-3 line-clamp-2">{post.content}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>👤 {post.created_by}</span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          {post.reply_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {post.view_count || 0}
                        </span>
                        <span>{new Date(post.created_date).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredPosts.length === 0 && (
              <div className="text-center py-12 bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl">
                <MessageSquare className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                <p className="text-slate-700 font-medium">Chưa có bài đăng nào</p>
              </div>
            )}
          </div>
        ) : (
          /* Post Detail View */
          <div>
            <Button
              onClick={() => setSelectedPost(null)}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay Lại
            </Button>

            {/* Post Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-6 shadow-xl mb-6"
            >
              <div className="flex gap-4 mb-6">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => voteMutation.mutate({ id: selectedPost.id, type: 'post', voteType: 'up', currentVotes: selectedPost })}
                    className={`p-2 rounded-lg transition-all ${
                      selectedPost.upvoted_by?.includes(currentUser?.email)
                        ? 'bg-green-100 text-green-600'
                        : 'hover:bg-green-50 text-slate-600'
                    }`}
                  >
                    <ThumbsUp className="w-6 h-6" />
                  </button>
                  <span className="font-bold text-2xl text-slate-900">
                    {(selectedPost.upvotes || 0) - (selectedPost.downvotes || 0)}
                  </span>
                  <button
                    onClick={() => voteMutation.mutate({ id: selectedPost.id, type: 'post', voteType: 'down', currentVotes: selectedPost })}
                    className={`p-2 rounded-lg transition-all ${
                      selectedPost.downvoted_by?.includes(currentUser?.email)
                        ? 'bg-red-100 text-red-600'
                        : 'hover:bg-red-50 text-slate-600'
                    }`}
                  >
                    <ThumbsDown className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1">
                  <h2 className="text-slate-900 font-bold text-2xl mb-3">{selectedPost.title}</h2>
                  <div className="prose prose-slate max-w-none mb-4">
                    <ReactMarkdown>{selectedPost.content}</ReactMarkdown>
                  </div>
                  <div className="text-sm text-slate-600">
                    Đăng bởi <strong>{selectedPost.created_by}</strong> • {new Date(selectedPost.created_date).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Replies */}
            <div className="space-y-4 mb-6">
              <h3 className="text-slate-900 font-bold text-xl">
                {postReplies.length} Trả Lời
              </h3>

              {postReplies.map((reply, idx) => (
                <motion.div
                  key={reply.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4 shadow-lg"
                >
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => voteMutation.mutate({ id: reply.id, type: 'reply', voteType: 'up', currentVotes: reply })}
                        className={`p-1 rounded-lg transition-all ${
                          reply.upvoted_by?.includes(currentUser?.email)
                            ? 'bg-green-100 text-green-600'
                            : 'hover:bg-green-50 text-slate-600'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-slate-900">
                        {(reply.upvotes || 0) - (reply.downvotes || 0)}
                      </span>
                      <button
                        onClick={() => voteMutation.mutate({ id: reply.id, type: 'reply', voteType: 'down', currentVotes: reply })}
                        className={`p-1 rounded-lg transition-all ${
                          reply.downvoted_by?.includes(currentUser?.email)
                            ? 'bg-red-100 text-red-600'
                            : 'hover:bg-red-50 text-slate-600'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1">
                      <div className="prose prose-slate max-w-none text-sm mb-2">
                        <ReactMarkdown>{reply.content}</ReactMarkdown>
                      </div>
                      <div className="text-xs text-slate-600">
                        {reply.created_by} • {new Date(reply.created_date).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Reply Form */}
            {!selectedPost.is_locked && (
              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-6 shadow-xl">
                <h3 className="text-slate-900 font-bold text-lg mb-4">Trả Lời</h3>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Nhập câu trả lời của bạn..."
                  className="mb-4 min-h-[120px]"
                />
                <Button
                  onClick={() => createReplyMutation.mutate(replyContent)}
                  disabled={!replyContent.trim() || createReplyMutation.isPending}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                >
                  Gửi Trả Lời
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Post Modal */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewPost(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <h3 className="text-slate-900 font-bold text-2xl mb-6">Tạo Bài Đăng Mới</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-700 font-semibold mb-2 block">Tiêu Đề</label>
                  <Input
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="Nhập tiêu đề bài đăng..."
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold mb-2 block">Danh Mục</label>
                  <select
                    value={newPost.category}
                    onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-2"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold mb-2 block">Nội Dung (Markdown)</label>
                  <Textarea
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    placeholder="Nhập nội dung bài đăng..."
                    className="min-h-[200px]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold mb-2 block">Tags</label>
                  <TagSelector
                    selectedTags={newPost.tags ? newPost.tags.split(',').map(t => t.trim()).filter(Boolean) : []}
                    onChange={(tags) => setNewPost({ ...newPost, tags: tags.join(',') })}
                    category={newPost.category}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setShowNewPost(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => createPostMutation.mutate(newPost)}
                    disabled={!newPost.title || !newPost.content || createPostMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  >
                    Đăng Bài
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}