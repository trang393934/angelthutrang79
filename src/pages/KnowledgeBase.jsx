import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Upload, File, Trash2, Eye, X, Plus, Loader2, CheckCircle2, Power } from 'lucide-react';
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
  const queryClient = useQueryClient();

  const { data: knowledgeBase = [], isLoading } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => base44.entities.KnowledgeBase.list('-created_date'),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({
        file: uploadFile
      });

      // Extract content from file
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            content: { type: "string" }
          }
        }
      });

      let content = '';
      if (extractResult.status === 'success' && extractResult.output) {
        content = extractResult.output.content || JSON.stringify(extractResult.output);
      }

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-purple-950 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/50 via-purple-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-purple-300 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(99,102,241,0.4)',
                  '0 0 40px rgba(99,102,241,0.6)',
                  '0 0 20px rgba(99,102,241,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
            >
              <BookOpen className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1">
              <h1 className="text-white font-light tracking-wide">Knowledge Base</h1>
              <p className="text-purple-400/60 text-xs">Kho Tri Thức Của AI</p>
            </div>
            <Button
              onClick={() => setShowUploadForm(true)}
              className="bg-gradient-to-r from-indigo-400 to-purple-400 text-white rounded-full hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Tài Liệu
            </Button>
          </div>
        </div>
      </div>

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
              className="bg-slate-900/95 backdrop-blur-xl border border-indigo-400/30 rounded-3xl p-8 max-w-2xl w-full"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-xl font-light tracking-wide">Upload Tài Liệu Giáo Lý</h3>
                  <p className="text-purple-300/60 text-sm">AI sẽ học và tham khảo khi trả lời</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-purple-200 text-sm mb-2 block">Tiêu đề</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="8 Divine Mantras, Luật Trả Lời, Tầm Nhìn FUN..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/40 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-purple-200 text-sm mb-2 block">Loại tài liệu</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={type === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setType(key)}
                        className={type === key ? typeColors[key] : 'border-white/20 text-white hover:bg-white/10'}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-purple-200 text-sm mb-2 block">File (PDF, TXT, DOC)</label>
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
                      className="flex items-center justify-center gap-3 bg-white/5 border-2 border-dashed border-white/20 rounded-xl p-8 cursor-pointer hover:border-indigo-400/40 hover:bg-white/10 transition-all"
                    >
                      {uploadFile ? (
                        <>
                          <File className="w-8 h-8 text-indigo-400" />
                          <div className="text-left">
                            <p className="text-white font-light">{uploadFile.name}</p>
                            <p className="text-purple-300/60 text-xs">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-purple-300/40" />
                          <div className="text-center">
                            <p className="text-white font-light">Click để chọn file</p>
                            <p className="text-purple-300/60 text-xs">PDF, TXT, DOC hoặc DOCX</p>
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
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full flex-1"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!uploadFile || !title.trim() || isUploading}
                  className="bg-gradient-to-r from-indigo-400 to-purple-400 text-white rounded-full flex-1 disabled:opacity-50"
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
              className="bg-slate-900/98 backdrop-blur-xl border border-indigo-400/30 rounded-3xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-6 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-light mb-2">{selectedDoc.title}</h3>
                    <Badge className={typeColors[selectedDoc.type]}>
                      {typeLabels[selectedDoc.type]}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDoc(null)}
                  className="text-purple-300/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {selectedDoc.summary && (
                <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-2xl p-4 mb-6">
                  <p className="text-indigo-200 text-sm font-light leading-relaxed">
                    {selectedDoc.summary}
                  </p>
                </div>
              )}

              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedDoc.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="border-purple-400/30 text-purple-200">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="prose prose-invert prose-sm max-w-none font-light leading-relaxed text-purple-50">
                <ReactMarkdown className="whitespace-pre-wrap">
                  {selectedDoc.content}
                </ReactMarkdown>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="pt-24 pb-20 px-4 max-w-6xl mx-auto">
        {isLoading ? (
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
            <h3 className="text-white text-xl font-light mb-2">Chưa Có Tài Liệu</h3>
            <p className="text-purple-300/60 font-light mb-6">Upload tài liệu giáo lý để AI học và trả lời chính xác hơn</p>
            <Button
              onClick={() => setShowUploadForm(true)}
              className="bg-gradient-to-r from-indigo-400 to-purple-400 text-white rounded-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Tài Liệu Đầu Tiên
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {knowledgeBase.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 hover:border-indigo-400/30 hover:shadow-xl hover:shadow-indigo-500/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-light truncate">{doc.title}</h3>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Xóa tài liệu này?')) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      className="text-red-300/40 hover:text-red-400 hover:bg-white/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {doc.summary && (
                    <p className="text-purple-100/70 text-sm font-light leading-relaxed mb-4 line-clamp-3">
                      {doc.summary}
                    </p>
                  )}

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {doc.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-indigo-400/30 text-indigo-200/70">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => setSelectedDoc(doc)}
                    size="sm"
                    className="w-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 text-white border border-indigo-400/30 rounded-full hover:from-indigo-400/30 hover:to-purple-400/30"
                  >
                    <Eye className="w-3 h-3 mr-2" />
                    Xem Chi Tiết
                  </Button>

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
    </div>
  );
}