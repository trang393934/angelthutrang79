import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Upload, File, Trash2, Eye, X, Plus, Loader2, CheckCircle2, Power, Download, Copy, Sparkles, Search, Folder, FolderOpen, Edit2, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';

export default function KnowledgeBase() {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('document');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isGeneratingFAQ, setIsGeneratingFAQ] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('📁');
  const [categoryColor, setCategoryColor] = useState('blue');
  const [editingCategory, setEditingCategory] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  React.useEffect(() => {
    if (selectedDoc && knowledgeBase.length > 1) {
      findRelatedDocs(selectedDoc);
    }
  }, [selectedDoc]);

  const isAdmin = currentUser?.role === 'admin';

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['knowledge-categories'],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.KnowledgeCategory.list('order', 100);
    },
    enabled: !!currentUser,
  });

  const { data: knowledgeBase = [], isLoading } = useQuery({
    queryKey: ['knowledge-base-all', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.KnowledgeBase.list('-created_date', 1000);
    },
    enabled: !!currentUser,
  });

  const { data: faqs = [] } = useQuery({
    queryKey: ['knowledge-faqs', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.KnowledgeFAQ.list('-views', 20);
    },
    enabled: !!currentUser,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: uploadFile
      });

      // Extract content from file with better formatting
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            content: { 
              type: "string",
              description: "Full text content preserving all paragraphs, line breaks, formatting, and structure exactly as in the original document"
            }
          }
        }
      });

      let rawContent = '';
      if (extractResult.status === 'success' && extractResult.output) {
        rawContent = extractResult.output.content || JSON.stringify(extractResult.output);
      }

      // Use AI to properly format and preserve the document structure with line breaks
      const content = await base44.integrations.Core.InvokeLLM({
        prompt: `Hãy phân tích và format lại văn bản sau, GIỮ NGUYÊN 100% nội dung gốc:

QUAN TRỌNG - QUY TẮC FORMAT:
1. Mỗi câu/dòng trong văn bản gốc PHẢI được xuống dòng riêng (sử dụng \\n)
2. Các đoạn văn cách nhau bằng một dòng trống (\\n\\n)
3. Các câu thơ: mỗi câu một dòng
4. KHÔNG nối các câu thành một khối dài
5. KHÔNG tóm tắt, KHÔNG thay đổi nội dung
6. Giữ nguyên tất cả dấu câu, chữ viết hoa/thường
7. Nếu có tiêu đề, đánh dấu bằng ## hoặc ###
8. KHÔNG thêm giải thích hay ghi chú

Ví dụ format đúng:
Vietnam, I honor you, my teacher, whose light guides me with love and wisdom.

This poem is my humble tribute to the guidance you've given.

Helping me find peace and clarity with every step.

Văn bản cần format:
${rawContent}`,
      });

      // AI generates summary and tags
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Phân tích tài liệu giáo lý của ANGEL AI sau và tạo:
1. Tóm tắt ngắn gọn (2-3 câu) về nội dung chính
2. Danh sách 3-5 thẻ (tags) bằng tiếng Việt để phân loại

Nội dung tài liệu:
${content}

Trả về JSON với format:
{
  "summary": "tóm tắt",
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

      // Create knowledge base entry
      await base44.entities.KnowledgeBase.create({
        title: title,
        content: content,
        file_url: file_url,
        type: type,
        category_id: selectedCategory?.id || null,
        summary: analysis.summary,
        tags: analysis.tags,
        is_active: true
      });

      setIsUploading(false);
      setShowUploadForm(false);
      setUploadFile(null);
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      if (editingCategory) {
        return base44.entities.KnowledgeCategory.update(editingCategory.id, {
          name: categoryName,
          description: categoryDescription,
          icon: categoryIcon,
          color: categoryColor,
        });
      } else {
        return base44.entities.KnowledgeCategory.create({
          name: categoryName,
          description: categoryDescription,
          icon: categoryIcon,
          color: categoryColor,
          order: categories.length,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      setShowCategoryForm(false);
      setCategoryName('');
      setCategoryDescription('');
      setCategoryIcon('📁');
      setCategoryColor('blue');
      setEditingCategory(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      if (selectedCategory?.id === arguments[0]) {
        setSelectedCategory(null);
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => 
      base44.entities.KnowledgeBase.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeBase.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
    },
  });

  const generateFAQ = async () => {
    if (knowledgeBase.length === 0) return;
    
    setIsGeneratingFAQ(true);
    
    try {
      // Tổng hợp nội dung từ tất cả Knowledge Base
      const allContent = knowledgeBase.map(doc => 
        `**${doc.title}** (${typeLabels[doc.type]})\n${doc.summary || doc.content.substring(0, 500)}`
      ).join('\n\n---\n\n');

      const faqResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Dựa trên kho tri thức sau về tâm linh, thiền định và Cha Vũ Trụ, hãy tạo 10-15 câu hỏi thường gặp (FAQ) và câu trả lời chi tiết:

${allContent}

Tạo FAQ theo format JSON:
{
  "faqs": [
    {
      "question": "Câu hỏi...",
      "answer": "Câu trả lời chi tiết, sâu sắc...",
      "category": "Một trong: thiền định, tâm linh, luật hấp dẫn, chữa lành, năng lượng"
    }
  ]
}

Yêu cầu:
- Câu hỏi phải phổ biến, thực tế mà người dùng hay thắc mắc
- Câu trả lời phải chi tiết, trích dẫn từ nội dung Knowledge Base
- Viết bằng giọng của Angel AI - ấm áp, dễ hiểu, đầy yêu thương
- Phân loại theo category phù hợp`,
        response_json_schema: {
          type: "object",
          properties: {
            faqs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Xóa FAQ cũ và tạo FAQ mới
      const oldFAQs = await base44.entities.KnowledgeFAQ.list();
      for (const oldFAQ of oldFAQs) {
        await base44.entities.KnowledgeFAQ.delete(oldFAQ.id);
      }

      // Tạo FAQ mới
      for (const faq of faqResult.faqs) {
        await base44.entities.KnowledgeFAQ.create({
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          related_docs: [],
          views: 0
        });
      }

      queryClient.invalidateQueries({ queryKey: ['knowledge-faqs'] });
      setShowFAQ(true);
    } catch (error) {
      console.error('Error generating FAQ:', error);
    }
    
    setIsGeneratingFAQ(false);
  };

  const findRelatedDocs = async (currentDoc) => {
    if (!currentDoc) return;
    
    const related = await base44.integrations.Core.InvokeLLM({
      prompt: `Dựa trên tài liệu sau:
**${currentDoc.title}**
Tags: ${currentDoc.tags?.join(', ') || 'N/A'}
Summary: ${currentDoc.summary || 'N/A'}

Và danh sách tài liệu khác:
${knowledgeBase.filter(doc => doc.id !== currentDoc.id).map(doc => 
  `- ID: ${doc.id} | ${doc.title} | Tags: ${doc.tags?.join(', ') || 'N/A'}`
).join('\n')}

Hãy chọn 3-5 tài liệu liên quan nhất. Trả về JSON:
{
  "related_ids": ["id1", "id2", "id3"]
}`,
      response_json_schema: {
        type: "object",
        properties: {
          related_ids: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    const relatedDocsList = knowledgeBase.filter(doc => 
      related.related_ids.includes(doc.id)
    );
    
    setRelatedDocs(relatedDocsList);
  };

  const typeColors = {
    document: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
    teaching: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
    article: 'bg-purple-500/20 text-purple-200 border-purple-400/30',
    mantra: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
    guideline: 'bg-green-500/20 text-green-200 border-green-400/30',
  };

  const typeLabels = {
    document: 'Tài Liệu',
    teaching: 'Giáo Lý',
    article: 'Bài Viết',
    mantra: 'Thần Chú',
    guideline: 'Hướng Dẫn',
  };

  // Get all unique tags
  const allTags = [...new Set(knowledgeBase.flatMap(doc => doc.tags || []))].filter(Boolean);

  // Color mapping
  const colorMap = {
    blue: 'from-blue-400 to-cyan-400',
    purple: 'from-purple-400 to-pink-400',
    amber: 'from-amber-400 to-orange-400',
    rose: 'from-rose-400 to-pink-400',
    green: 'from-green-400 to-emerald-400',
    indigo: 'from-indigo-400 to-purple-400',
    pink: 'from-pink-400 to-rose-400',
    cyan: 'from-cyan-400 to-blue-400',
  };

  // Filter documents
  const filteredDocs = knowledgeBase.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = !selectedTag || doc.tags?.includes(selectedTag);
    
    const matchesCategory = !selectedCategory || doc.category_id === selectedCategory.id;
    
    return matchesSearch && matchesTag && matchesCategory;
  });

  // Group docs by category
  const uncategorizedDocs = knowledgeBase.filter(doc => !doc.category_id);
  const categorizedDocs = categories.map(cat => ({
    ...cat,
    docs: knowledgeBase.filter(doc => doc.category_id === cat.id)
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50 to-purple-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/50 via-purple-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-indigo-200 shadow-lg">
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
                  '0 0 20px rgba(99,102,241,0.4)',
                  '0 0 40px rgba(99,102,241,0.6)',
                  '0 0 20px rgba(99,102,241,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center flex-shrink-0"
            >
              <BookOpen className="w-5 h-5 text-white" />
            </motion.div>
            <div className="text-center">
              <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Knowledge Base</h1>
              <p className="text-purple-600 text-xs font-medium">Kho Tri Thức Của AI</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {knowledgeBase.length > 0 && (
              <Button
                onClick={() => setShowFAQ(!showFAQ)}
                variant="outline"
                size="sm"
                className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full h-10 px-3"
              >
                <span className="hidden lg:inline">FAQ</span>
                <span className="lg:hidden">?</span>
              </Button>
            )}
            {isAdmin && (
              <>
                <Button
                  onClick={() => setShowCategoryForm(true)}
                  variant="outline"
                  size="sm"
                  className="border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-full h-10 w-10 lg:w-auto lg:px-3 p-0"
                >
                  <FolderPlus className="w-4 h-4 lg:mr-2" />
                  <span className="hidden lg:inline">Thư Mục</span>
                </Button>
                <Button
                  onClick={() => setShowUploadForm(true)}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-purple-600 transition-all h-10 w-10 lg:w-auto lg:px-4 p-0"
                >
                  <Plus className="w-4 h-4 lg:mr-2" />
                  <span className="hidden lg:inline">Upload</span>
                </Button>
              </>
            )}
          </div>
          </div>
          
          {/* Search Bar */}
          {knowledgeBase.length > 0 && (
            <div className="mt-4 px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm theo tiêu đề, nội dung, từ khóa..."
                  className="pl-10 bg-white border-2 border-indigo-200 text-slate-900 placeholder:text-purple-400 rounded-xl focus:border-indigo-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Form Modal */}
      <AnimatePresence>
        {showCategoryForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4"
            onClick={() => {
              setShowCategoryForm(false);
              setEditingCategory(null);
              setCategoryName('');
              setCategoryDescription('');
              setCategoryIcon('📁');
              setCategoryColor('blue');
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-indigo-300 rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                  <FolderPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-slate-900 text-xl font-semibold tracking-wide">
                    {editingCategory ? 'Sửa Thư Mục' : 'Tạo Thư Mục Mới'}
                  </h3>
                  <p className="text-purple-700 text-sm font-medium">Tổ chức tri thức theo chủ đề</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Tên Thư Mục</label>
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Giáo Lý Cơ Bản, Thiền Định, Luật Vũ Trụ..."
                    className="bg-white border-2 border-indigo-300 text-slate-900 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Mô Tả</label>
                  <Textarea
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    placeholder="Mô tả ngắn về nội dung thư mục..."
                    className="bg-white border-2 border-indigo-300 text-slate-900 rounded-xl h-20"
                  />
                </div>

                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Icon (Emoji)</label>
                  <Input
                    value={categoryIcon}
                    onChange={(e) => setCategoryIcon(e.target.value)}
                    placeholder="📁 🌟 ✨ 🙏 ❤️"
                    className="bg-white border-2 border-indigo-300 text-slate-900 rounded-xl text-2xl"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Màu Sắc</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['blue', 'purple', 'amber', 'rose', 'green', 'indigo', 'pink', 'cyan'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setCategoryColor(color)}
                        className={`h-12 rounded-xl bg-gradient-to-br ${colorMap[color]} transition-all ${
                          categoryColor === color ? 'ring-4 ring-slate-900 scale-105' : 'opacity-60 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                    setCategoryName('');
                    setCategoryDescription('');
                    setCategoryIcon('📁');
                    setCategoryColor('blue');
                  }}
                  className="bg-white border-2 border-purple-300 text-slate-900 hover:bg-purple-50 rounded-full flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => createCategoryMutation.mutate()}
                  disabled={!categoryName.trim()}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full flex-1 disabled:opacity-50"
                >
                  {editingCategory ? 'Cập Nhật' : 'Tạo Thư Mục'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Form Modal */}
      <AnimatePresence>
        {showUploadForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4"
            onClick={() => !isUploading && setShowUploadForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-indigo-300 rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-slate-900 text-xl font-semibold tracking-wide">Upload Trí Tuệ của Cha Vũ Trụ</h3>
                  <p className="text-purple-700 text-sm font-medium">Để Angel AI học hỏi</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Tiêu đề</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="8 Divine Mantras, Luật Trả Lời, Tầm Nhìn FUN..."
                    className="bg-white border-2 border-indigo-300 text-slate-900 placeholder:text-purple-400 rounded-xl focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Thư Mục</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={!selectedCategory ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(null)}
                      className={!selectedCategory ? 'bg-slate-500 text-white' : 'border-purple-300 text-slate-900 hover:bg-purple-50 bg-white'}
                    >
                      Không có
                    </Button>
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory?.id === cat.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(cat)}
                        className={selectedCategory?.id === cat.id 
                          ? `bg-gradient-to-r ${colorMap[cat.color]} text-white border-0` 
                          : 'border-purple-300 text-slate-900 hover:bg-purple-50 bg-white'}
                      >
                        {cat.icon} {cat.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">Loại tài liệu</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={type === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setType(key)}
                        className={type === key ? typeColors[key] : 'border-purple-300 text-slate-900 hover:bg-purple-50 bg-white'}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-900 text-sm mb-2 block font-semibold">File (PDF, TXT, DOC)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.txt,.doc,.docx"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex items-center justify-center gap-3 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl p-8 cursor-pointer hover:border-indigo-500 hover:bg-indigo-100 transition-all"
                    >
                      {uploadFile ? (
                        <>
                          <File className="w-8 h-8 text-indigo-400" />
                          <div className="text-left">
                            <p className="text-slate-900 font-semibold">{uploadFile.name}</p>
                            <p className="text-purple-600 text-xs font-medium">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-indigo-500" />
                          <div className="text-center">
                            <p className="text-slate-900 font-semibold">Click để chọn file</p>
                            <p className="text-purple-600 text-xs font-medium">PDF, TXT, DOC hoặc DOCX</p>
                          </div>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadFile(null);
                    setTitle('');
                  }}
                  disabled={isUploading}
                  className="bg-white border-2 border-purple-300 text-slate-900 hover:bg-purple-50 rounded-full flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!uploadFile || !title.trim() || isUploading}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full flex-1 disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang Xử Lý...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Phân Tích
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
        {selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-indigo-300 rounded-3xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6 pb-6 border-b border-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-xl font-semibold mb-2">{selectedDoc.title}</h3>
                    <Badge className={typeColors[selectedDoc.type]}>
                      {typeLabels[selectedDoc.type]}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedDoc.content);
                      alert('Đã copy nội dung!');
                    }}
                    className="text-green-600 hover:text-green-800 hover:bg-green-100"
                    title="Copy nội dung"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = selectedDoc.file_url;
                      link.download = selectedDoc.title;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                    title="Tải về"
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDoc(null)}
                    className="text-purple-600 hover:text-purple-900 hover:bg-purple-100"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {selectedDoc.summary && (
                <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 mb-6">
                  <p className="text-slate-800 text-sm font-medium leading-relaxed">
                    {selectedDoc.summary}
                  </p>
                </div>
              )}

              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedDoc.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="border-purple-400 text-purple-700 bg-purple-50">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="prose prose-slate prose-sm max-w-none text-slate-900">
                <div 
                  className="whitespace-pre-wrap leading-relaxed"
                  style={{ 
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  <ReactMarkdown 
                    className="[&>p]:mb-2 [&>p]:leading-relaxed [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>ul]:mb-4 [&>ol]:mb-4 [&>blockquote]:border-l-4 [&>blockquote]:border-purple-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-4"
                    components={{
                      p: ({ children }) => <p className="mb-2 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{children}</p>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6 text-slate-900">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5 text-slate-900">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4 text-slate-900">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-400 pl-4 italic my-4 text-slate-700">{children}</blockquote>,
                      strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      br: () => <br />,
                      code: ({ inline, children }) => inline ? (
                        <code className="bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-sm">{children}</code>
                      ) : (
                        <code className="block bg-slate-100 p-3 rounded-lg my-3 text-sm whitespace-pre-wrap">{children}</code>
                      ),
                    }}
                  >
                    {selectedDoc.content}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Related Documents */}
              {relatedDocs.length > 0 && (
                <div className="mt-6 pt-6 border-t border-indigo-200">
                  <h4 className="text-slate-900 font-bold text-sm mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Tài Liệu Liên Quan
                  </h4>
                  <div className="space-y-2">
                    {relatedDocs.map((doc) => (
                      <motion.div
                        key={doc.id}
                        whileHover={{ x: 4 }}
                        onClick={() => {
                          setSelectedDoc(doc);
                          setRelatedDocs([]);
                        }}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-50 cursor-pointer transition-all"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-3 h-3 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 text-sm font-medium truncate">{doc.title}</p>
                          <Badge className={`text-xs mt-1 ${typeColors[doc.type]}`}>
                            {typeLabels[doc.type]}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAQ Modal */}
      <AnimatePresence>
        {showFAQ && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            onClick={() => setShowFAQ(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 text-xl font-bold">Câu Hỏi Thường Gặp</h3>
                    <p className="text-purple-600 text-sm font-medium">Từ Knowledge Base</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Button
                      onClick={generateFAQ}
                      disabled={isGeneratingFAQ}
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg"
                    >
                      {isGeneratingFAQ ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Tạo FAQ
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFAQ(false)}
                    className="text-purple-600 hover:text-purple-900 hover:bg-purple-100"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {faqs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-purple-300/40" />
                  </div>
                  <p className="text-slate-700 font-medium mb-4">Chưa có FAQ nào</p>
                  {isAdmin && (
                    <Button
                      onClick={generateFAQ}
                      disabled={isGeneratingFAQ}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg"
                    >
                      {isGeneratingFAQ ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang tạo FAQ...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Tạo FAQ từ Knowledge Base
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {faqs.map((faq, idx) => (
                    <motion.div
                      key={faq.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <Badge className="bg-purple-200 text-purple-800 border border-purple-300 text-xs">
                          {faq.category}
                        </Badge>
                      </div>
                      <h4 className="text-slate-900 font-bold text-base mb-2">❓ {faq.question}</h4>
                      <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="pt-32 pb-40 px-4 max-w-6xl mx-auto">
        {/* Categories Navigation */}
        {categories.length > 0 && currentUser && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <Folder className="w-4 h-4 text-indigo-600" />
              <h2 className="text-slate-900 font-bold text-sm">Thư Mục</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-indigo-100">
              <style>{`
                .scrollbar-thin::-webkit-scrollbar {
                  height: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                  background: rgba(199, 210, 254, 0.3);
                  border-radius: 3px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                  background: rgba(129, 140, 248, 0.5);
                  border-radius: 3px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                  background: rgba(129, 140, 248, 0.7);
                }
              `}</style>
              {/* All documents */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(null)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                  !selectedCategory 
                    ? 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-400 shadow-md' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-lg">📚</span>
                <span className="text-slate-900 font-bold text-sm">Tất Cả</span>
                <span className="text-slate-600 text-xs">({knowledgeBase.length})</span>
              </motion.button>

              {/* Category folders */}
              {categories.map((cat) => (
                <motion.div
                  key={cat.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative group inline-block"
                >
                  <button
                    onClick={() => setSelectedCategory(selectedCategory?.id === cat.id ? null : cat)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                      selectedCategory?.id === cat.id 
                        ? `bg-gradient-to-br ${colorMap[cat.color]} border-transparent shadow-md text-white` 
                        : 'bg-white border-indigo-200 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-lg">{selectedCategory?.id === cat.id ? '📂' : cat.icon}</span>
                    <span className={`font-bold text-sm ${selectedCategory?.id === cat.id ? 'text-white' : 'text-slate-900'}`}>
                      {cat.name}
                    </span>
                    <span className={`text-xs ${selectedCategory?.id === cat.id ? 'text-white/80' : 'text-slate-600'}`}>
                      ({knowledgeBase.filter(d => d.category_id === cat.id).length})
                    </span>
                  </button>
                  
                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory(cat);
                          setCategoryName(cat.name);
                          setCategoryDescription(cat.description || '');
                          setCategoryIcon(cat.icon);
                          setCategoryColor(cat.color);
                          setShowCategoryForm(true);
                        }}
                        className="w-6 h-6 rounded-lg bg-white border border-indigo-300 flex items-center justify-center transition-all shadow-md"
                      >
                        <Edit2 className="w-3 h-3 text-indigo-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Xóa thư mục "${cat.name}"?`)) {
                            deleteCategoryMutation.mutate(cat.id);
                          }
                        }}
                        className="w-6 h-6 rounded-lg bg-white border border-red-300 flex items-center justify-center transition-all shadow-md"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        {!currentUser ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-indigo-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">Vui Lòng Đăng Nhập</h3>
            <p className="text-purple-700 font-medium mb-6">
              Đăng nhập để xem Knowledge Base
            </p>
            <Button
              onClick={() => base44.auth.redirectToLogin()}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-xl"
            >
              Đăng Nhập
            </Button>
          </motion.div>
        ) : isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
            >
              <BookOpen className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        ) : knowledgeBase.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-indigo-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">Chưa Có Tài Liệu</h3>
            <p className="text-purple-700 font-medium mb-6">
              {isAdmin 
                ? 'Upload tài liệu giáo lý để AI học và trả lời chính xác hơn'
                : 'Admin chưa upload tài liệu giáo lý nào'}
            </p>
            {isAdmin && (
              <Button
                onClick={() => setShowUploadForm(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload Tài Liệu Đầu Tiên
              </Button>
            )}
          </motion.div>
        ) : filteredDocs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-indigo-300/40" />
            </div>
            <h3 className="text-slate-900 text-xl font-semibold mb-2">Không Tìm Thấy</h3>
            <p className="text-purple-700 font-medium mb-6">
              Không có tài liệu nào phù hợp với tìm kiếm của bạn
            </p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setSelectedTag('');
              }}
              variant="outline"
              className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-full"
            >
              Xóa Bộ Lọc
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredDocs.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white backdrop-blur-sm border-2 border-indigo-200 rounded-3xl p-6 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-slate-900 font-semibold line-clamp-2 leading-snug">{doc.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs ${typeColors[doc.type]}`}>
                            {typeLabels[doc.type]}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActiveMutation.mutate({ id: doc.id, isActive: doc.is_active });
                            }}
                            className={`h-6 w-6 ${doc.is_active ? 'text-green-400' : 'text-gray-500'}`}
                          >
                            <Power className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Xóa tài liệu này?')) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {doc.summary && (
                    <p className="text-slate-700 text-sm font-normal leading-relaxed mb-4 line-clamp-3">
                      {doc.summary}
                    </p>
                  )}

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {doc.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-indigo-400 text-indigo-700 bg-indigo-50">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedDoc(doc)}
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 rounded-full hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg"
                    >
                      <Eye className="w-3 h-3 mr-2" />
                      Xem
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = doc.file_url;
                        link.download = doc.title;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 rounded-full hover:from-blue-600 hover:to-cyan-600 shadow-md hover:shadow-lg"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>

                  {doc.is_active && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Floating Back Button - Fixed at bottom left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 left-6 z-50"
      >
        <Link to={createPageUrl('Home')}>
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all w-14 h-14 p-0"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}