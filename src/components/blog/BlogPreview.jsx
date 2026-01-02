import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Clock, Tag, Calendar, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';

export default function BlogPreview({ post }) {
  if (!post) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-amber-300 rounded-3xl p-8 shadow-xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-slate-900 text-lg font-bold">Preview</h3>
          <p className="text-amber-700 text-sm font-medium">Xem trước bài viết</p>
        </div>
      </div>

      {/* Featured Image Placeholder */}
      {post.featured_image_url && (
        <img
          src={post.featured_image_url}
          alt={post.title}
          className="w-full h-64 object-cover rounded-2xl mb-6 border-2 border-amber-200"
        />
      )}

      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 leading-tight">
        {post.title}
      </h1>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-slate-200">
        {post.category && (
          <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
            {post.category}
          </Badge>
        )}
        {post.read_time_minutes && (
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Clock className="w-4 h-4" />
            {post.read_time_minutes} phút đọc
          </div>
        )}
        {post.word_count && (
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            {post.word_count} từ
          </div>
        )}
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {post.created_by || 'AI Generated'}
        </div>
      </div>

      {/* Excerpt */}
      {post.excerpt && (
        <div className="bg-gradient-to-r from-amber-50 to-rose-50 border-2 border-amber-200 rounded-2xl p-4 mb-6">
          <p className="text-slate-700 text-lg font-medium leading-relaxed italic">
            {post.excerpt}
          </p>
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {post.tags.map((tag, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="border-amber-400 text-amber-800 bg-amber-50"
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-slate prose-lg max-w-none">
        <ReactMarkdown
          className="[&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h1]:text-slate-900
                     [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-5 [&>h2]:text-slate-900
                     [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:text-slate-800
                     [&>p]:mb-4 [&>p]:leading-relaxed [&>p]:text-slate-700
                     [&>ul]:mb-4 [&>ul]:ml-6 [&>ul]:list-disc
                     [&>ol]:mb-4 [&>ol]:ml-6 [&>ol]:list-decimal
                     [&>li]:mb-2 [&>li]:text-slate-700
                     [&>strong]:text-amber-700 [&>strong]:font-bold
                     [&>em]:text-purple-700 [&>em]:italic
                     [&>blockquote]:border-l-4 [&>blockquote]:border-amber-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-slate-600"
        >
          {post.content}
        </ReactMarkdown>
      </div>

      {/* SEO Meta (for reference) */}
      {post.meta_description && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" />
            SEO Metadata
          </h4>
          <div className="bg-indigo-50 border border-indigo-300 rounded-xl p-4 space-y-2">
            <div>
              <p className="text-xs text-indigo-700 font-semibold mb-1">Meta Description:</p>
              <p className="text-sm text-slate-700">{post.meta_description}</p>
            </div>
            {post.meta_keywords && post.meta_keywords.length > 0 && (
              <div>
                <p className="text-xs text-indigo-700 font-semibold mb-1">Keywords:</p>
                <div className="flex flex-wrap gap-1">
                  {post.meta_keywords.map((keyword, idx) => (
                    <Badge key={idx} className="bg-indigo-200 text-indigo-800 text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}