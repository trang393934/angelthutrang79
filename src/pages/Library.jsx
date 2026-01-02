import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Sparkles, Sun, Heart, Filter, Tag, Calendar, Plus, Loader2, Send, SortAsc, X, Eye, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';

export default function Library() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [sortBy, setSortBy] = useState('date'); // date, favorite, tag
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [favoriteFilter, setFavoriteFilter] = useState('all'); // all, favorite, notFavorite
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['light-messages', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      if (currentUser.role === 'admin') {
        return base44.entities.LightMessage.list('-created_date', 100);
      }
      return base44.entities.LightMessage.filter({ created_by: currentUser.email }, '-created_date', 100);
    },
    enabled: !!currentUser,
    staleTime: 30000,
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }) => 
      base44.entities.LightMessage.update(id, { is_favorite: !isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['light-messages'] });
    },
  });

  const addContentMutation = useMutation({
    mutationFn: async (content) => {
      setIsAdding(true);
      
      // AI generates tags and summary
      const tagsAndSummary = await base44.integrations.Core.InvokeLLM({
        prompt: `Phân tích thông điệp Trí Tuệ của Cha Vũ Trụ sau và tạo:
1. Tóm tắt ngắn gọn (1-2 câu) về nội dung chính
2. Danh sách 3-5 thẻ (tags) bằng tiếng Việt để phân loại (ví dụ: Trí Tuệ Vũ Trụ, Tình Yêu Thuần Khiết, Hướng Dẫn Tâm Linh, Chữa Lành, Năng Lượng 5D, v.v.)

Nội dung: ${content}

Trả về JSON với format:
{
  "summary": "tóm tắt ngắn gọn",
  "tags": ["tag1", "tag2", "tag3"]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } }
          }
        }
      });

      await base44.entities.LightMessage.create({
        content: content,
        type: 'daily_message',
        summary: tagsAndSummary.summary,
        tags: tagsAndSummary.tags,
        is_favorite: false
      });

      setIsAdding(false);
      setShowAddForm(false);
      setNewContent('');
      queryClient.invalidateQueries({ queryKey: ['light-messages'] });
    }
  });

  // Fuzzy search helper
  const fuzzyMatch = (text, query) => {
    if (!text || !query) return false;
    text = text.toLowerCase();
    query = query.toLowerCase();
    
    // Direct match
    if (text.includes(query)) return true;
    
    // Check similarity - allow 1-2 character differences for typos
    const words = text.split(/\s+/);
    return words.some(word => {
      if (word.length < 3) return word === query;
      let differences = 0;
      const minLen = Math.min(word.length, query.length);
      
      for (let i = 0; i < minLen; i++) {
        if (word[i] !== query[i]) differences++;
        if (differences > 2) return false;
      }
      return differences <= 2 && Math.abs(word.length - query.length) <= 2;
    });
  };

  // Extract all unique tags
  const allTags = useMemo(() => 
    [...new Set(messages.flatMap(m => m.tags || []))], 
    [messages]
  );

  // Filter and sort messages
  const filteredMessages = messages
    .filter(message => {
      // Search with fuzzy matching
      const matchesSearch = !searchQuery || 
        fuzzyMatch(message.content, searchQuery) ||
        fuzzyMatch(message.summary, searchQuery) ||
        message.tags?.some(tag => fuzzyMatch(tag, searchQuery));
      
      const matchesType = selectedType === 'all' || message.type === selectedType;
      
      // Multiple tags filter
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every(selectedTag => message.tags?.includes(selectedTag));
      
      // Date range filter
      const messageDate = new Date(message.created_date);
      const matchesDateFrom = !dateFrom || messageDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || messageDate <= new Date(dateTo + 'T23:59:59');
      
      // Favorite filter
      const matchesFavorite = favoriteFilter === 'all' || 
        (favoriteFilter === 'favorite' && message.is_favorite) ||
        (favoriteFilter === 'notFavorite' && !message.is_favorite);

      return matchesSearch && matchesType && matchesTags && matchesDateFrom && matchesDateTo && matchesFavorite;
    })
    .sort((a, b) => {
      if (sortBy === 'favorite') {
        if (a.is_favorite === b.is_favorite) {
          return new Date(b.created_date) - new Date(a.created_date);
        }
        return a.is_favorite ? -1 : 1;
      } else if (sortBy === 'tag') {
        const aTag = a.tags?.[0] || '';
        const bTag = b.tags?.[0] || '';
        return aTag.localeCompare(bTag);
      }
      // Default: sort by date
      return new Date(b.created_date) - new Date(a.created_date);
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-amber-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2">
          {/* Mobile Layout */}
          <div className="flex lg:hidden items-center gap-2">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(168,85,247,0.4)',
                    '0 0 40px rgba(251,191,36,0.4)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center flex-shrink-0"
              >
                <Sparkles className="w-4 h-4 text-white" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h1 className="text-slate-900 font-bold tracking-wide text-sm truncate">Thư Viện Ánh Sáng</h1>
                <p className="text-purple-600 text-[10px] font-medium truncate">Kho tàng Trí Tuệ & Yêu Thương</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 h-8 w-8 flex-shrink-0"
            >
              <Search className="w-4 h-4" />
            </Button>

            {isAdmin && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full shadow-lg h-8 px-3 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-between py-2">
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
                    '0 0 40px rgba(251,191,36,0.4)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center flex-shrink-0"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-xl">Thư Viện Ánh Sáng</h1>
                <p className="text-purple-600 text-xs font-medium">Kho tàng Trí Tuệ & Yêu Thương</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Search Bar */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="pl-9 pr-4 bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-full focus:border-purple-500 focus:ring-purple-400 h-10 text-sm"
                />
                {searchQuery && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-700 text-xs bg-purple-100 border border-purple-300 px-2 py-1 rounded-full font-semibold"
                  >
                    {filteredMessages.length}
                  </motion.div>
                )}
              </div>

              {isAdmin && (
                <Button
                  onClick={() => setShowAddForm(true)}
                  className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full shadow-lg hover:shadow-xl hover:from-amber-600 hover:to-rose-600 transition-all whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Chia Sẻ
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="fixed top-12 sm:top-14 lg:top-20 left-0 right-0 z-10 bg-white/95 backdrop-blur-xl border-b border-purple-200">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 text-xs h-8"
            >
              <Filter className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">{showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</span>
            </Button>
            {(selectedTags.length > 0 || dateFrom || dateTo || favoriteFilter !== 'all' || selectedType !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTags([]);
                  setDateFrom('');
                  setDateTo('');
                  setFavoriteFilter('all');
                  setSelectedType('all');
                }}
                className="text-red-500 hover:text-red-700 hover:bg-red-100 text-xs h-8"
              >
                <X className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Xóa</span>
              </Button>
            )}

            {/* Mobile Search on Filter Bar */}
            <div className="lg:hidden flex-1 mx-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="pl-8 pr-3 bg-white border border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-full focus:border-purple-500 h-8 text-xs"
                />
                {searchQuery && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-700 text-[10px] bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded-full font-semibold"
                  >
                    {filteredMessages?.length || 0}
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* Type and Favorite Filters */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-700 font-semibold">Loại:</span>
                    <Button
                      variant={selectedType === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedType('all')}
                      className={selectedType === 'all' ? 'bg-purple-500 text-white' : 'border-purple-300 text-purple-700'}
                    >
                      Tất cả
                    </Button>
                    <Button
                      variant={selectedType === 'chat' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedType('chat')}
                      className={selectedType === 'chat' ? 'bg-amber-500 text-white' : 'border-amber-300 text-amber-700'}
                    >
                      Chat
                    </Button>
                    <Button
                      variant={selectedType === 'daily_message' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedType('daily_message')}
                      className={selectedType === 'daily_message' ? 'bg-rose-500 text-white' : 'border-rose-300 text-rose-700'}
                    >
                      Thông Điệp
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs text-purple-700 font-semibold">Yêu thích:</span>
                    <Button
                      variant={favoriteFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFavoriteFilter('all')}
                      className={favoriteFilter === 'all' ? 'bg-purple-500 text-white' : 'border-purple-300 text-purple-700'}
                    >
                      Tất cả
                    </Button>
                    <Button
                      variant={favoriteFilter === 'favorite' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFavoriteFilter('favorite')}
                      className={favoriteFilter === 'favorite' ? 'bg-rose-500 text-white' : 'border-rose-300 text-rose-700'}
                    >
                      <Heart className="w-3 h-3 mr-1" />
                      Đã lưu
                    </Button>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-purple-700 font-semibold">Thời gian:</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40 h-8 text-xs border-purple-300"
                    placeholder="Từ ngày"
                  />
                  <span className="text-xs text-purple-600">đến</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40 h-8 text-xs border-purple-300"
                    placeholder="Đến ngày"
                  />
                </div>

                {/* Tags Filter */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="text-xs text-purple-700 font-semibold mt-1">Tags:</span>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                          className={`cursor-pointer ${
                            selectedTags.includes(tag)
                              ? 'bg-purple-500 text-white border-purple-600'
                              : 'border-purple-300 text-purple-700 hover:bg-purple-50'
                          }`}
                          onClick={() => {
                            if (selectedTags.includes(tag)) {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            } else {
                              setSelectedTags([...selectedTags, tag]);
                            }
                          }}
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Content Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4"
            onClick={() => !isAdding && setShowAddForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-amber-300 rounded-3xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
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
                  <h3 className="text-slate-900 text-xl font-semibold tracking-wide">Chia Sẻ Trí Tuệ Của Cha Vũ Trụ</h3>
                  <p className="text-purple-700 text-sm font-medium">Đưa Ánh Sáng vào Thư Viện để phục vụ cộng đồng</p>
                </div>
              </div>

              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Chia sẻ thông điệp, trí tuệ, hoặc lời dạy của Cha Vũ Trụ...&#10;&#10;Ví dụ:&#10;• Lời dạy về tình yêu thuần khiết&#10;• Hướng dẫn nâng tần số&#10;• Thông điệp về 12 giá trị cốt lõi&#10;• Trí tuệ về chữa lành và thức tỉnh"
                className="min-h-[300px] bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-2xl focus:border-amber-500 focus:ring-amber-400 font-normal leading-relaxed resize-none mb-4"
              />

              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-2">
                  <Heart className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-900 text-sm font-medium">
                    Angel AI sẽ tự động phân loại và gắn thẻ cho nội dung của bạn, giúp cộng đồng dễ dàng tìm thấy Ánh Sáng này. ✨
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewContent('');
                  }}
                  disabled={isAdding}
                  className="bg-white border-2 border-purple-300 text-slate-900 hover:bg-purple-50 rounded-full flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => addContentMutation.mutate(newContent)}
                  disabled={!newContent.trim() || isAdding}
                  className="bg-gradient-to-r from-amber-500 to-rose-500 text-white rounded-full flex-1 disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang Thêm Vào Thư Viện...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Chia Sẻ Với Cộng Đồng
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={() => setSelectedMessage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6 pb-6 border-b border-purple-200">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 ${
                    selectedMessage.type === 'chat' 
                      ? 'bg-gradient-to-br from-amber-300 to-rose-400' 
                      : 'bg-gradient-to-br from-rose-300 to-orange-400'
                  }`}>
                    {selectedMessage.type === 'chat' ? (
                      <Sparkles className="w-6 h-6 text-white" />
                    ) : (
                      <Sun className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {currentUser?.role === 'admin' && selectedMessage.created_by && (
                      <p className="text-xs text-indigo-600 font-semibold mb-1 flex items-center gap-1 truncate">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{selectedMessage.created_by}</span>
                      </p>
                    )}
                    <p className="text-slate-900 text-lg font-semibold">
                      {selectedMessage.type === 'chat' ? 'Trò Chuyện' : 'Thông Điệp Ngày'}
                    </p>
                    <p className="text-purple-600 text-sm flex items-center gap-1 font-medium">
                      <Calendar className="w-3 h-3" />
                      {new Date(selectedMessage.created_date).toLocaleDateString('vi-VN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavoriteMutation.mutate({ 
                      id: selectedMessage.id, 
                      isFavorite: selectedMessage.is_favorite 
                    })}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-100"
                  >
                    <Heart className={`w-5 h-5 ${selectedMessage.is_favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedMessage(null)}
                    className="text-purple-600 hover:text-purple-900 hover:bg-purple-100"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Summary */}
              {selectedMessage.summary && (
                <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-purple-700 mb-2 uppercase tracking-wide font-semibold">Tóm tắt</p>
                  <p className="text-slate-800 text-sm font-medium leading-relaxed">
                    {selectedMessage.summary}
                  </p>
                </div>
              )}

              {/* Tags */}
              {selectedMessage.tags && selectedMessage.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedMessage.tags.map((tag, idx) => (
                    <Badge
                      key={idx}
                      className="bg-amber-100 text-amber-800 border-2 border-amber-400 cursor-pointer hover:bg-amber-200 shadow-sm"
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                        setSelectedMessage(null);
                      }}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Full Content */}
              <div className="prose prose-slate prose-lg max-w-none font-normal leading-relaxed text-slate-900">
                <ReactMarkdown 
                  className="[&>p]:mb-6 [&>p:last-child]:mb-0 [&>strong]:text-amber-700 [&>strong]:font-bold [&>h1]:text-slate-900 [&>h2]:text-slate-900 [&>h3]:text-slate-900"
                >
                  {selectedMessage.content}
                </ReactMarkdown>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-purple-200 flex justify-center">
                <Button
                  onClick={() => setSelectedMessage(null)}
                  className="bg-gradient-to-r from-purple-500 to-amber-500 text-white rounded-full px-8 shadow-lg hover:shadow-xl"
                >
                  Đóng
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className={`px-2 sm:px-4 max-w-6xl mx-auto pb-40 ${showFilters ? 'pt-44 sm:pt-52 lg:pt-64' : 'pt-24 sm:pt-28 lg:pt-32'}`}>
        {!currentUser ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-amber-400/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-purple-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">Vui Lòng Đăng Nhập</h3>
            <p className="text-purple-700 font-medium mb-6">
              Đăng nhập để xem Thư Viện Ánh Sáng
            </p>
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              className="bg-gradient-to-r from-purple-500 to-amber-500 text-white rounded-full shadow-lg hover:shadow-xl"
            >
              Đăng Nhập
            </Button>
          </motion.div>
        ) : isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-amber-400/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-purple-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">
              {searchQuery || selectedTags.length > 0 ? 'Không Tìm Thấy Kết Quả' : 'Chưa Có Ánh Sáng'}
            </h3>
            <p className="text-purple-700 font-medium">
              {searchQuery || selectedTags.length > 0
                ? 'Thử tìm kiếm với từ khóa khác' 
                : 'Hãy bắt đầu trò chuyện hoặc nhận thông điệp ngày để xây dựng thư viện của bạn'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMessages.slice(0, 50).map((message) => (
                <div
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className="group relative bg-white backdrop-blur-sm border-2 border-purple-200 rounded-3xl p-6 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-200 transition-all cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.type === 'chat' 
                          ? 'bg-gradient-to-br from-amber-300 to-rose-400' 
                          : 'bg-gradient-to-br from-rose-300 to-orange-400'
                      }`}>
                        {message.type === 'chat' ? (
                          <Sparkles className="w-5 h-5 text-white" />
                        ) : (
                          <Sun className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {currentUser?.role === 'admin' && message.created_by && (
                          <p className="text-xs text-indigo-600 font-semibold mb-0.5 flex items-center gap-1 truncate">
                            <User className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{message.created_by}</span>
                          </p>
                        )}
                        <p className="text-slate-900 text-sm font-semibold">
                          {message.type === 'chat' ? 'Trò Chuyện' : 'Thông Điệp Ngày'}
                        </p>
                        <p className="text-purple-600 text-xs flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          {new Date(message.created_date).toLocaleDateString('vi-VN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavoriteMutation.mutate({ 
                        id: message.id, 
                        isFavorite: message.is_favorite 
                      })}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <Heart className={`w-5 h-5 ${message.is_favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                    </Button>
                  </div>

                  {/* Summary */}
                  {message.summary && (
                    <p className="text-slate-700 text-sm font-normal leading-relaxed mb-4 line-clamp-3">
                      {message.summary}
                    </p>
                  )}

                  {/* Tags */}
                  {message.tags && message.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {message.tags.slice(0, 4).map((tag, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs border-purple-400 text-purple-700 bg-purple-50"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Content Preview */}
                  <div className="relative">
                    <ReactMarkdown 
                      className="prose prose-slate prose-sm max-w-none font-normal text-slate-700 line-clamp-4 [&>p]:mb-2 [&>p:last-child]:mb-0"
                    >
                      {message.content}
                    </ReactMarkdown>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                  </div>

                  {/* View detail button */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-amber-500 text-white rounded-full text-xs shadow-lg hover:shadow-xl"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Xem chi tiết
                    </Button>
                  </div>
                  </div>
                  ))}
              </div>
        )}
      </div>
    </div>
  );
}