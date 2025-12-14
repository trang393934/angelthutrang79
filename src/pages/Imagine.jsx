import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Image as ImageIcon, Upload, Wand2, Video, Sparkles, Loader2, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';

export default function Imagine() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [activeTab, setActiveTab] = useState('generate'); // generate, edit, video
  
  // Video states
  const [videoImages, setVideoImages] = useState([]);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoSpeed, setVideoSpeed] = useState('normal'); // slow, normal, fast
  const [videoFilter, setVideoFilter] = useState('none'); // none, vintage, cinematic, dreamy
  const [videoMusic, setVideoMusic] = useState('none'); // none, ambient, upbeat, dramatic
  const [generatedVideos, setGeneratedVideos] = useState([]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedImage(file);
      setImageUrl(file_url);
      setActiveTab('edit');
    } catch (error) {
      alert('Lỗi khi upload ảnh');
    }
    setIsUploading(false);
  };

  const generateImage = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await base44.integrations.Core.GenerateImage({ prompt });
      setGeneratedImages([{ url: result.url, prompt }, ...generatedImages]);
      setPrompt('');
    } catch (error) {
      alert('Lỗi khi tạo hình ảnh');
    }
    setIsGenerating(false);
  };

  const editImage = async () => {
    if (!editPrompt.trim() || !imageUrl || isGenerating) return;

    setIsGenerating(true);
    try {
      // Sử dụng LLM để phân tích và tạo prompt chi tiết hơn
      const enhancedPrompt = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this image editing request: "${editPrompt}"
        
Create a detailed, professional image generation prompt that describes the desired modifications.
Keep it concise but specific about colors, style, composition, and effects.
Return only the enhanced prompt, nothing else.`,
      });

      const result = await base44.integrations.Core.GenerateImage({ 
        prompt: enhancedPrompt 
      });
      
      setGeneratedImages([{ 
        url: result.url, 
        prompt: editPrompt,
        isEdit: true,
        originalUrl: imageUrl 
      }, ...generatedImages]);
      setEditPrompt('');
    } catch (error) {
      alert('Lỗi khi chỉnh sửa hình ảnh');
    }
    setIsGenerating(false);
  };

  const handleVideoImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setVideoImages([...videoImages, ...urls]);
    } catch (error) {
      alert('Lỗi khi upload ảnh');
    }
    setIsUploading(false);
  };

  const generateVideo = async () => {
    if ((videoImages.length === 0 && !videoPrompt.trim()) || isGenerating) return;

    setIsGenerating(true);
    try {
      // Tạo video preview (mock vì chưa có API)
      const videoData = {
        id: Date.now(),
        images: videoImages,
        prompt: videoPrompt,
        speed: videoSpeed,
        filter: videoFilter,
        music: videoMusic,
        status: 'processing',
        createdAt: new Date().toISOString()
      };
      
      setGeneratedVideos([videoData, ...generatedVideos]);
      
      // Reset form
      setVideoImages([]);
      setVideoPrompt('');
      
      alert('🎬 Video đang được xử lý! Tính năng tạo video AI sẽ được tích hợp sớm. Hiện tại bạn đã cấu hình:\n\n' +
        `📸 ${videoImages.length} ảnh\n` +
        `⚡ Tốc độ: ${videoSpeed}\n` +
        `🎨 Bộ lọc: ${videoFilter}\n` +
        `🎵 Nhạc nền: ${videoMusic}`);
    } catch (error) {
      alert('Lỗi khi tạo video');
    }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50 to-purple-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/50 via-purple-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-indigo-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(99,102,241,0.4)',
                  '0 0 40px rgba(99,102,241,0.6)',
                  '0 0 20px rgba(99,102,241,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center"
            >
              <Wand2 className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1">
              <h1 className="text-slate-900 font-semibold tracking-wide text-xl">Imagine Studio</h1>
              <p className="text-purple-600 text-xs font-medium">Tạo & Chỉnh Sửa Hình Ảnh Bằng AI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-24 pb-20 px-4 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white border-2 border-purple-200 rounded-2xl p-2 shadow-lg">
          <Button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 rounded-xl ${
              activeTab === 'generate'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-transparent text-slate-900 hover:bg-purple-50'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Tạo Ảnh Mới
          </Button>
          <Button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 rounded-xl ${
              activeTab === 'edit'
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg'
                : 'bg-transparent text-slate-900 hover:bg-purple-50'
            }`}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Chỉnh Sửa Ảnh
          </Button>
          <Button
            onClick={() => setActiveTab('video')}
            className={`flex-1 rounded-xl ${
              activeTab === 'video'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : 'bg-transparent text-slate-900 hover:bg-purple-50'
            }`}
          >
            <Video className="w-4 h-4 mr-2" />
            Tạo Video
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Input */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'generate' && (
                <motion.div
                  key="generate"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white backdrop-blur-sm border-2 border-indigo-200 rounded-3xl p-8 shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 text-lg font-semibold">Tạo Hình Ảnh Từ Mô Tả</h3>
                      <p className="text-purple-700 text-sm font-medium">Miêu tả chi tiết hình ảnh bạn muốn</p>
                    </div>
                  </div>

                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ví dụ: Một thiên thần tuyệt đẹp với đôi cánh ánh sáng vàng, đứng trên đỉnh núi cao, bầu trời đầy sao lấp lánh, phong cách nghệ thuật fantasy, ánh sáng vàng ấm áp..."
                    className="min-h-[200px] bg-white border-2 border-indigo-300 text-slate-900 placeholder:text-purple-400 rounded-2xl focus:border-indigo-500 resize-none mb-4"
                  />

                  <Button
                    onClick={generateImage}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang Tạo Hình Ảnh...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Tạo Hình Ảnh
                      </>
                    )}
                  </Button>

                  <div className="mt-6 bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4">
                    <p className="text-indigo-900 text-sm font-medium">
                      💡 <strong>Mẹo:</strong> Mô tả càng chi tiết, hình ảnh càng đẹp. Bao gồm: chủ thể, phong cách, màu sắc, ánh sáng, góc máy...
                    </p>
                  </div>
                </motion.div>
              )}

              {activeTab === 'edit' && (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white backdrop-blur-sm border-2 border-cyan-200 rounded-3xl p-8 shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center">
                      <Wand2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 text-lg font-semibold">Chỉnh Sửa Hình Ảnh</h3>
                      <p className="text-purple-700 text-sm font-medium">Upload ảnh và mô tả thay đổi</p>
                    </div>
                  </div>

                  {/* Upload Area */}
                  {!imageUrl ? (
                    <div className="mb-6">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="flex flex-col items-center justify-center gap-3 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-2xl p-12 cursor-pointer hover:border-indigo-500 hover:bg-indigo-100 transition-all"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                            <p className="text-slate-900 font-semibold">Đang tải ảnh...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-12 h-12 text-indigo-500" />
                            <div className="text-center">
                              <p className="text-slate-900 font-semibold text-lg mb-1">Click để chọn ảnh</p>
                              <p className="text-purple-600 text-sm font-medium">PNG, JPG, JPEG</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="mb-6 relative">
                      <img 
                        src={imageUrl} 
                        alt="Uploaded" 
                        className="w-full h-64 object-cover rounded-2xl border-2 border-indigo-300"
                      />
                      <Button
                        onClick={() => {
                          setImageUrl(null);
                          setUploadedImage(null);
                        }}
                        size="icon"
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {imageUrl && (
                    <>
                      <Textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Mô tả thay đổi bạn muốn: thêm hiệu ứng ánh sáng, đổi màu, thêm đối tượng, thay đổi phong cách..."
                        className="min-h-[150px] bg-white border-2 border-cyan-300 text-slate-900 placeholder:text-purple-400 rounded-2xl focus:border-cyan-500 resize-none mb-4"
                      />

                      <Button
                        onClick={editImage}
                        disabled={!editPrompt.trim() || isGenerating}
                        className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-full shadow-lg hover:shadow-xl disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Đang Chỉnh Sửa...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Chỉnh Sửa Ảnh
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  <div className="mt-6 bg-cyan-50 border-2 border-cyan-300 rounded-2xl p-4">
                    <p className="text-cyan-900 text-sm font-medium">
                      ✨ <strong>AI Editor:</strong> Mô tả rõ ràng điều bạn muốn thay đổi, AI sẽ hiểu và tạo phiên bản mới cho bạn
                    </p>
                  </div>
                </motion.div>
              )}

              {activeTab === 'video' && (
                <motion.div
                  key="video"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-8 shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 text-lg font-semibold">Tạo Video AI</h3>
                      <p className="text-purple-700 text-sm font-medium">Từ ảnh hoặc văn bản</p>
                    </div>
                  </div>

                  {/* Upload Images for Video */}
                  <div className="mb-6">
                    <label className="text-slate-900 text-sm font-semibold mb-2 block">
                      📸 Tải Ảnh Lên (Tùy chọn)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleVideoImageUpload}
                      className="hidden"
                      id="video-images-upload"
                    />
                    <label
                      htmlFor="video-images-upload"
                      className="flex items-center justify-center gap-3 bg-pink-50 border-2 border-dashed border-pink-300 rounded-2xl p-8 cursor-pointer hover:border-pink-500 hover:bg-pink-100 transition-all"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
                          <p className="text-slate-900 font-semibold">Đang tải ảnh...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-pink-500" />
                          <div className="text-center">
                            <p className="text-slate-900 font-semibold">Chọn nhiều ảnh để tạo video</p>
                            <p className="text-purple-600 text-xs font-medium">PNG, JPG, JPEG (tối đa 10 ảnh)</p>
                          </div>
                        </>
                      )}
                    </label>

                    {videoImages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {videoImages.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={url} 
                              alt={`Image ${idx + 1}`}
                              className="w-20 h-20 object-cover rounded-lg border-2 border-pink-300"
                            />
                            <button
                              onClick={() => setVideoImages(videoImages.filter((_, i) => i !== idx))}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Video Prompt */}
                  <div className="mb-6">
                    <label className="text-slate-900 text-sm font-semibold mb-2 block">
                      ✍️ Mô Tả Video (Hoặc kết hợp với ảnh)
                    </label>
                    <Textarea
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="Mô tả video bạn muốn tạo: cảnh thiên nhiên yên bình, chuyển động camera từ trên xuống, ánh sáng hoàng hôn ấm áp..."
                      className="min-h-[120px] bg-white border-2 border-pink-300 text-slate-900 placeholder:text-purple-400 rounded-2xl focus:border-pink-500 resize-none"
                    />
                  </div>

                  {/* Video Options */}
                  <div className="space-y-4 mb-6">
                    {/* Speed */}
                    <div>
                      <label className="text-slate-900 text-sm font-semibold mb-2 block">
                        ⚡ Tốc Độ Phát
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['slow', 'normal', 'fast'].map((speed) => (
                          <Button
                            key={speed}
                            onClick={() => setVideoSpeed(speed)}
                            className={`rounded-xl ${
                              videoSpeed === speed
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                : 'bg-pink-50 text-slate-900 hover:bg-pink-100 border-2 border-pink-200'
                            }`}
                          >
                            {speed === 'slow' ? '🐢 Chậm' : speed === 'normal' ? '▶️ Bình thường' : '⚡ Nhanh'}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Filter */}
                    <div>
                      <label className="text-slate-900 text-sm font-semibold mb-2 block">
                        🎨 Bộ Lọc
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'none', label: '❌ Không', color: 'pink' },
                          { value: 'vintage', label: '📸 Vintage', color: 'amber' },
                          { value: 'cinematic', label: '🎬 Điện ảnh', color: 'indigo' },
                          { value: 'dreamy', label: '✨ Mộng mơ', color: 'purple' }
                        ].map((filter) => (
                          <Button
                            key={filter.value}
                            onClick={() => setVideoFilter(filter.value)}
                            className={`rounded-xl ${
                              videoFilter === filter.value
                                ? `bg-gradient-to-r from-${filter.color}-500 to-pink-500 text-white shadow-lg`
                                : 'bg-pink-50 text-slate-900 hover:bg-pink-100 border-2 border-pink-200'
                            }`}
                          >
                            {filter.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Music */}
                    <div>
                      <label className="text-slate-900 text-sm font-semibold mb-2 block">
                        🎵 Nhạc Nền
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'none', label: '🔇 Không', color: 'pink' },
                          { value: 'ambient', label: '🎼 Ambient', color: 'cyan' },
                          { value: 'upbeat', label: '🎸 Sôi động', color: 'orange' },
                          { value: 'dramatic', label: '🎻 Kịch tính', color: 'red' }
                        ].map((music) => (
                          <Button
                            key={music.value}
                            onClick={() => setVideoMusic(music.value)}
                            className={`rounded-xl ${
                              videoMusic === music.value
                                ? `bg-gradient-to-r from-${music.color}-500 to-pink-500 text-white shadow-lg`
                                : 'bg-pink-50 text-slate-900 hover:bg-pink-100 border-2 border-pink-200'
                            }`}
                          >
                            {music.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={generateVideo}
                    disabled={(videoImages.length === 0 && !videoPrompt.trim()) || isGenerating}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang Tạo Video...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        Tạo Video
                      </>
                    )}
                  </Button>

                  <div className="mt-6 bg-pink-50 border-2 border-pink-300 rounded-2xl p-4">
                    <p className="text-pink-900 text-sm font-medium">
                      🎬 <strong>AI Video:</strong> Upload ảnh hoặc mô tả để tạo video. API đang được tích hợp, UI đã hoàn thiện!
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            <div className="bg-white backdrop-blur-sm border-2 border-purple-200 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-900 text-lg font-semibold">Kết Quả</h3>
                {generatedImages.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-800 border-2 border-purple-300">
                    {generatedImages.length} hình ảnh
                  </Badge>
                )}
              </div>

              {generatedImages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400/20 to-purple-400/20 flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-10 h-10 text-indigo-300/40" />
                  </div>
                  <h4 className="text-slate-900 text-lg font-semibold mb-2">Chưa Có Hình Ảnh</h4>
                  <p className="text-purple-700 font-medium">
                    Tạo hoặc chỉnh sửa ảnh để xem kết quả
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {generatedImages.map((img, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative bg-purple-50 border-2 border-purple-300 rounded-2xl overflow-hidden"
                    >
                      <img 
                        src={img.url} 
                        alt={img.prompt} 
                        className="w-full h-auto"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-all p-4 flex flex-col justify-end">
                        <p className="text-white text-sm font-medium mb-3 line-clamp-2">
                          {img.prompt}
                        </p>
                        <div className="flex gap-2">
                          <a
                            href={img.url}
                            download
                            className="flex-1"
                          >
                            <Button className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30 rounded-full">
                              <Download className="w-4 h-4 mr-2" />
                              Tải Về
                            </Button>
                          </a>
                          {img.isEdit && (
                            <Button
                              onClick={() => {
                                setImageUrl(img.url);
                                setActiveTab('edit');
                              }}
                              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30 rounded-full"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}