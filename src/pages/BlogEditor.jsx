import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, FileText, Sparkles, Eye, EyeOff, Plus, Loader2, Image as ImageIcon, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BlogGenerator from '@/components/blog/BlogGenerator';
import BlogStyleEditor from '@/components/blog/BlogStyleEditor';
import BlogPreview from '@/components/blog/BlogPreview';

export default function BlogEditor() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPost, setCurrentPost] = useState(null);
  const [showGenerator, setShowGenerator] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Fetch all blog posts
  const { data: blogPosts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: () => base44.entities.BlogPost.list('-created_date'),
    enabled: !!currentUser,
  });

  // Save blog mutation
  const saveBlogMutation = useMutation({
    mutationFn: async (postData) => {
      if (currentPost?.id) {
        return base44.entities.BlogPost.update(currentPost.id, postData);
      } else {
        return base44.entities.BlogPost.create(postData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      alert('✅ Đã lưu bài viết!');
      setCurrentPost(null);
      setShowGenerator(true);
      setEditMode(false);
    },
  });

  // Delete blog mutation
  const deleteBlogMutation = useMutation({
    mutationFn: (id) => base44.entities.BlogPost.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      if (currentPost?.id === deleteBlogMutation.variables) {
        setCurrentPost(null);
        setShowGenerator(true);
      }
    },
  });

  const handleGenerated = (generatedData) => {
    setCurrentPost(generatedData);
    setShowGenerator(false);
    setShowPreview(true);
  };

  const handleStyleChanged = (updatedPost) => {
    setCurrentPost(updatedPost);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh!');
      return;
    }

    setIsUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCurrentPost(prev => ({ ...prev, featured_image_url: file_url }));
    } catch (error) {
      alert('Lỗi khi upload ảnh!');
    }
    setIsUploadingImage(false);
  };

  const loadPostForEdit = (post) => {
    setCurrentPost(post);
    setShowGenerator(false);
    setShowPreview(true);
    setEditMode(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
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
                <FileText className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">AI Blog Editor</h1>
                <p className="text-purple-600 text-xs font-medium">Tạo & Chỉnh Sửa Blog</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Generator & Style Editor */}
          <div className="lg:col-span-1 space-y-6">
            {/* Toggle between generator and style editor */}
            {showGenerator ? (
              <BlogGenerator onGenerated={handleGenerated} />
            ) : currentPost ? (
              <>
                <BlogStyleEditor 
                  currentPost={currentPost} 
                  onStyleChanged={handleStyleChanged}
                />
                
                {/* Upload Featured Image */}
                <div className="bg-white border-2 border-green-300 rounded-3xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 text-lg font-bold">Ảnh Đại Diện</h3>
                      <p className="text-green-700 text-sm font-medium">Upload ảnh cho bài viết</p>
                    </div>
                  </div>

                  {currentPost.featured_image_url && (
                    <img
                      src={currentPost.featured_image_url}
                      alt="Featured"
                      className="w-full h-40 object-cover rounded-xl mb-3 border border-green-200"
                    />
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="featured-image-upload"
                  />
                  <label htmlFor="featured-image-upload">
                    <Button
                      disabled={isUploadingImage}
                      asChild
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl"
                    >
                      <span>
                        {isUploadingImage ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ImageIcon className="w-4 h-4 mr-2" />
                        )}
                        {currentPost.featured_image_url ? 'Thay Đổi Ảnh' : 'Upload Ảnh'}
                      </span>
                    </Button>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl py-6 font-bold shadow-lg hover:shadow-xl"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="w-5 h-5 mr-2" />
                        Ẩn Preview
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5 mr-2" />
                        Xem Preview
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => saveBlogMutation.mutate(currentPost)}
                    disabled={saveBlogMutation.isPending}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl py-6 font-bold shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {saveBlogMutation.isPending ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5 mr-2" />
                    )}
                    Lưu Bài Viết
                  </Button>

                  <Button
                    onClick={() => {
                      setCurrentPost(null);
                      setShowGenerator(true);
                      setShowPreview(false);
                      setEditMode(false);
                    }}
                    variant="outline"
                    className="w-full border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-2xl py-6 font-bold"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Tạo Bài Mới
                  </Button>
                </div>
              </>
            ) : null}

            {/* Saved Posts List */}
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-lg">
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Bài Viết Đã Lưu ({blogPosts.length})
              </h3>

              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-purple-300 mx-auto mb-2 animate-spin" />
                  <p className="text-slate-600 text-sm">Đang tải...</p>
                </div>
              ) : blogPosts.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm">Chưa có bài viết nào</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {blogPosts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group bg-slate-50 border border-slate-200 rounded-xl p-3 hover:bg-purple-50 hover:border-purple-300 transition-all cursor-pointer"
                      onClick={() => loadPostForEdit(post)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 font-semibold text-sm truncate mb-1">
                            {post.title}
                          </p>
                          <div className="flex flex-wrap gap-1 mb-1">
                            <Badge className={`text-xs ${
                              post.status === 'published' ? 'bg-green-100 text-green-800' :
                              post.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {post.status}
                            </Badge>
                            {post.category && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                {post.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            {new Date(post.created_date).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Xóa bài viết này?')) {
                              deleteBlogMutation.mutate(post.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-100 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Preview or Editor */}
          <div className="lg:col-span-2">
            {currentPost ? (
              <>
                {/* Manual Edit Mode */}
                {editMode && (
                  <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 shadow-xl mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-slate-900 text-lg font-bold flex items-center gap-2">
                        <Edit className="w-5 h-5 text-purple-500" />
                        Chỉnh Sửa Thủ Công
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditMode(false)}
                        className="text-purple-600 hover:bg-purple-100"
                      >
                        Đóng
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-slate-700 text-sm font-semibold mb-2 block">
                          Tiêu đề
                        </label>
                        <Input
                          value={currentPost.title}
                          onChange={(e) => setCurrentPost({ ...currentPost, title: e.target.value })}
                          className="bg-white border-2 border-purple-300 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="text-slate-700 text-sm font-semibold mb-2 block">
                          Nội dung (Markdown)
                        </label>
                        <Textarea
                          value={currentPost.content}
                          onChange={(e) => setCurrentPost({ ...currentPost, content: e.target.value })}
                          className="bg-white border-2 border-purple-300 rounded-xl min-h-[400px] font-mono text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-slate-700 text-sm font-semibold mb-2 block">
                          Excerpt (Mô tả ngắn)
                        </label>
                        <Textarea
                          value={currentPost.excerpt}
                          onChange={(e) => setCurrentPost({ ...currentPost, excerpt: e.target.value })}
                          className="bg-white border-2 border-purple-300 rounded-xl min-h-[80px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview */}
                <AnimatePresence>
                  {showPreview && <BlogPreview post={currentPost} />}
                </AnimatePresence>

                {/* Edit Button */}
                {!editMode && (
                  <Button
                    onClick={() => setEditMode(true)}
                    className="mt-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl px-6 py-3 font-bold shadow-lg hover:shadow-xl"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Chỉnh Sửa Thủ Công
                  </Button>
                )}
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-br from-amber-50 to-rose-50 border-2 border-amber-300 rounded-3xl p-12 text-center shadow-xl"
              >
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity }
                  }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center mx-auto mb-6 shadow-2xl"
                >
                  <Sparkles className="w-12 h-12 text-white" />
                </motion.div>
                <h2 className="text-slate-900 text-2xl font-bold mb-3">
                  Bắt Đầu Tạo Blog Với AI
                </h2>
                <p className="text-amber-800 text-lg font-medium mb-6">
                  Nhập chủ đề bên trái để AI tự động tạo bài viết cho bạn
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge className="bg-purple-100 text-purple-800 text-sm">✨ Tự động tạo nội dung</Badge>
                  <Badge className="bg-indigo-100 text-indigo-800 text-sm">🎨 Điều chỉnh văn phong</Badge>
                  <Badge className="bg-pink-100 text-pink-800 text-sm">🏷️ Tạo tags & SEO</Badge>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}