import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Sparkles, Sun, Heart, Filter, Tag, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';

export default function Library() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTag, setSelectedTag] = useState(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['light-messages'],
    queryFn: () => base44.entities.LightMessage.list('-created_date'),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }) => 
      base44.entities.LightMessage.update(id, { is_favorite: !isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['light-messages'] });
    },
  });

  // Extract all unique tags
  const allTags = [...new Set(messages.flatMap(m => m.tags || []))];

  // Filter messages
  const filteredMessages = messages.filter(message => {
    const matchesSearch = !searchQuery || 
      message.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === 'all' || message.type === selectedType;
    const matchesTag = !selectedTag || message.tags?.includes(selectedTag);

    return matchesSearch && matchesType && matchesTag;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-purple-950 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-amber-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-300 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(168,85,247,0.4)',
                    '0 0 40px rgba(251,191,36,0.4)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-white font-light tracking-wide text-xl">Thư Viện Ánh Sáng</h1>
                <p className="text-purple-400/60 text-xs">Kho tàng Trí Tuệ & Yêu Thương</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo nội dung, chủ đề, hoặc thẻ..."
              className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-purple-300/40 rounded-full focus:border-amber-400/30 focus:ring-amber-400/20"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="fixed top-[140px] left-0 right-0 z-10 bg-slate-950/60 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-purple-300/60" />
            <Button
              variant={selectedType === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType('all')}
              className={selectedType === 'all' ? 'bg-purple-500/20 text-purple-200' : 'text-purple-300/60 hover:text-white hover:bg-white/10'}
            >
              Tất Cả
            </Button>
            <Button
              variant={selectedType === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType('chat')}
              className={selectedType === 'chat' ? 'bg-amber-500/20 text-amber-200' : 'text-purple-300/60 hover:text-white hover:bg-white/10'}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Trò Chuyện
            </Button>
            <Button
              variant={selectedType === 'daily_message' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType('daily_message')}
              className={selectedType === 'daily_message' ? 'bg-rose-500/20 text-rose-200' : 'text-purple-300/60 hover:text-white hover:bg-white/10'}
            >
              <Sun className="w-3 h-3 mr-1" />
              Thông Điệp Ngày
            </Button>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <Tag className="w-4 h-4 text-purple-300/60" />
              {allTags.slice(0, 10).map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all ${
                    selectedTag === tag
                      ? 'bg-purple-500/30 text-purple-200 border-purple-400/50'
                      : 'border-white/20 text-purple-300/70 hover:bg-white/10'
                  }`}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-[220px] pb-20 px-4 max-w-6xl mx-auto">
        {isLoading ? (
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
            <h3 className="text-white text-xl font-light mb-2">
              {searchQuery || selectedTag ? 'Không Tìm Thấy Kết Quả' : 'Chưa Có Ánh Sáng'}
            </h3>
            <p className="text-purple-300/60 font-light">
              {searchQuery || selectedTag 
                ? 'Thử tìm kiếm với từ khóa khác' 
                : 'Hãy bắt đầu trò chuyện hoặc nhận thông điệp ngày để xây dựng thư viện của bạn'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 hover:border-amber-400/30 hover:shadow-xl hover:shadow-amber-500/10 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                      <div>
                        <p className="text-white text-sm font-light">
                          {message.type === 'chat' ? 'Trò Chuyện' : 'Thông Điệp Ngày'}
                        </p>
                        <p className="text-purple-300/50 text-xs flex items-center gap-1">
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
                      className="text-rose-300/40 hover:text-rose-400 hover:bg-white/10 transition-colors"
                    >
                      <Heart className={`w-5 h-5 ${message.is_favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
                    </Button>
                  </div>

                  {/* Summary */}
                  {message.summary && (
                    <p className="text-purple-100/80 text-sm font-light leading-relaxed mb-4 line-clamp-3">
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
                          className="text-xs border-purple-400/30 text-purple-200/70 bg-purple-500/10"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Content Preview */}
                  <div className="relative">
                    <ReactMarkdown 
                      className="prose prose-invert prose-sm max-w-none font-light text-purple-50/70 line-clamp-4 [&>p]:mb-2 [&>p:last-child]:mb-0"
                    >
                      {message.content}
                    </ReactMarkdown>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent" />
                  </div>

                  {/* Hover overlay for full content */}
                  <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-lg rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden z-10 p-6">
                    <div className="h-full overflow-y-auto">
                      <ReactMarkdown 
                        className="prose prose-invert prose-sm max-w-none font-light text-purple-50 [&>p]:mb-4 [&>p:last-child]:mb-0"
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}