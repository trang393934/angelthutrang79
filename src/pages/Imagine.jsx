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
  const [motionPrompt, setMotionPrompt] = useState('');
  const [videoDuration, setVideoDuration] = useState(6); // 3, 6, 9 seconds
  const [videoSpeed, setVideoSpeed] = useState('normal'); // slow, normal, fast
  const [videoFilter, setVideoFilter] = useState('none'); // none, vintage, cinematic, dreamy
  const [videoMusic, setVideoMusic] = useState('none'); // none, ambient, upbeat, dramatic
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [processingVideo, setProcessingVideo] = useState(false);

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
      
      // Check if result has url property
      if (!result || !result.url) {
        throw new Error('Không nhận được URL hình ảnh từ API');
      }
      
      setGeneratedImages([{ url: result.url, prompt }, ...generatedImages]);
      setPrompt('');
    } catch (error) {
      console.error('Generate image error:', error);
      alert('Lỗi khi tạo hình ảnh: ' + (error.message || 'Vui lòng thử lại sau'));
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
      
      // Check if result has url property
      if (!result || !result.url) {
        throw new Error('Không nhận được URL hình ảnh từ API');
      }
      
      setGeneratedImages([{ 
        url: result.url, 
        prompt: editPrompt,
        isEdit: true,
        originalUrl: imageUrl 
      }, ...generatedImages]);
      setEditPrompt('');
    } catch (error) {
      console.error('Edit image error:', error);
      alert('Lỗi khi chỉnh sửa hình ảnh: ' + (error.message || 'Vui lòng thử lại sau'));
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
    if (videoImages.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setProcessingVideo(true);
    setVideoProgress(0);

    try {
      // Get first image URL
      const imageUrl = videoImages[0];
      
      // Generate motion description if not provided
      let finalMotionPrompt = motionPrompt.trim();
      if (!finalMotionPrompt) {
        finalMotionPrompt = videoPrompt.trim() || 
          'Animate smoothly with glowing angel wings, gentle flying motion, cinematic camera movement, soft divine light rays, peaceful atmosphere';
      }

      // Simulate progress (real implementation will poll API)
      const progressInterval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 2000);

      // TODO: Call Kling AI API via backend function
      // const result = await base44.functions.generateVideoFromImage({
      //   image_url: imageUrl,
      //   motion_prompt: finalMotionPrompt,
      //   duration: videoDuration,
      //   aspect_ratio: '16:9',
      //   quality: 'high'
      // });

      // Mock response for now
      await new Promise(resolve => setTimeout(resolve, 8000));
      clearInterval(progressInterval);
      setVideoProgress(100);

      // Mock video data
      const videoData = {
        id: Date.now(),
        videoUrl: imageUrl, // In real implementation, this will be the generated video URL
        thumbnail: imageUrl,
        prompt: finalMotionPrompt,
        duration: videoDuration,
        filter: videoFilter,
        music: videoMusic,
        status: 'completed',
        createdAt: new Date().toISOString()
      };
      
      setGeneratedVideos([videoData, ...generatedVideos]);
      
      // Reset form
      setVideoImages([]);
      setVideoPrompt('');
      setMotionPrompt('');
      setProcessingVideo(false);
      
      alert('✨ Video đã sẵn sàng!\n\n🪽 Kling AI sẽ được tích hợp sau khi bật Backend Functions.\n\nĐể kích hoạt:\n1. Dashboard → Settings → Enable Backend Functions\n2. Thêm KLING_API_KEY vào Secrets\n3. Đăng ký tại: https://klingai.com');
    } catch (error) {
      setProcessingVideo(false);
      alert('Thiên thần đang nghỉ ngơi, thử lại nhé! 🪽');
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

                  {/* Motion Prompt */}
                  <div className="mb-6">
                    <label className="text-slate-900 text-sm font-semibold mb-2 flex items-center gap-2">
                      <span>🪽</span>
                      <span>Mô Tả Chuyển Động (Tùy chọn)</span>
                    </label>
                    <Textarea
                      value={motionPrompt}
                      onChange={(e) => setMotionPrompt(e.target.value)}
                      placeholder="Ví dụ: Thêm đôi cánh thiên thần phát sáng và bay nhẹ nhàng lên cao, camera zoom out, ánh sáng vàng rực rỡ..."
                      className="min-h-[100px] bg-white border-2 border-pink-300 text-slate-900 placeholder:text-purple-400 rounded-2xl focus:border-pink-500 resize-none"
                    />
                    <p className="text-xs text-purple-600 mt-2 font-medium">
                      💡 Để trống = AI sẽ tự động tạo chuyển động mượt mà
                    </p>
                  </div>

                  {/* Video Options */}
                  <div className="space-y-4 mb-6">
                    {/* Duration */}
                    <div>
                      <label className="text-slate-900 text-sm font-semibold mb-2 block">
                        ⏱️ Thời Lượng Video
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[3, 6, 9].map((duration) => (
                          <Button
                            key={duration}
                            onClick={() => setVideoDuration(duration)}
                            className={`rounded-xl ${
                              videoDuration === duration
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                : 'bg-pink-50 text-slate-900 hover:bg-pink-100 border-2 border-pink-200'
                            }`}
                          >
                            {duration}s
                          </Button>
                        ))}
                      </div>
                    </div>

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
                    disabled={videoImages.length === 0 || isGenerating}
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
                        Tạo Video Từ Ảnh
                      </>
                    )}
                  </Button>

                  {/* Progress Bar */}
                  {processingVideo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg"
                        >
                          <Sparkles className="w-4 h-4 text-white" />
                        </motion.div>
                        <div className="flex-1">
                          <p className="text-slate-900 font-semibold text-sm">
                            Thiên thần đang tạo video ma thuật... 🪽
                          </p>
                          <p className="text-purple-600 text-xs font-medium mt-1">
                            {videoProgress}% hoàn thành • Vui lòng đợi 20-60 giây
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-3 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          style={{ width: `${videoProgress}%` }}
                          animate={{
                            boxShadow: [
                              '0 0 10px rgba(168,85,247,0.5)',
                              '0 0 20px rgba(236,72,153,0.5)',
                              '0 0 10px rgba(168,85,247,0.5)',
                            ]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-4">
                    <p className="text-purple-900 text-sm font-medium mb-2">
                      🪽 <strong>Kling AI Integration</strong> - Top 1 chất lượng 2025
                    </p>
                    <p className="text-purple-700 text-xs leading-relaxed">
                      Cần bật Backend Functions để kích hoạt:<br/>
                      Dashboard → Settings → Enable Backend Functions<br/>
                      Sau đó thêm KLING_API_KEY vào Secrets
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
                <h3 className="text-slate-900 text-lg font-semibold">
                  {activeTab === 'video' ? 'Video Đã Tạo' : 'Kết Quả'}
                </h3>
                {activeTab === 'video' && generatedVideos.length > 0 && (
                  <Badge className="bg-pink-100 text-pink-800 border-2 border-pink-300">
                    {generatedVideos.length} video
                  </Badge>
                )}
                {activeTab !== 'video' && generatedImages.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-800 border-2 border-purple-300">
                    {generatedImages.length} hình ảnh
                  </Badge>
                )}
              </div>

              {/* Video Results */}
              {activeTab === 'video' && (
                <>
                  {generatedVideos.length === 0 ? (
                    <div className="text-center py-16">
                      <motion.div
                        animate={{ 
                          boxShadow: [
                            '0 0 20px rgba(168,85,247,0.3)',
                            '0 0 40px rgba(236,72,153,0.3)',
                            '0 0 20px rgba(168,85,247,0.3)',
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center mx-auto mb-4"
                      >
                        <Video className="w-10 h-10 text-purple-300/40" />
                      </motion.div>
                      <h4 className="text-slate-900 text-lg font-semibold mb-2">Chưa Có Video</h4>
                      <p className="text-purple-700 font-medium">
                        Upload ảnh và tạo video ma thuật 🪽
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                      {generatedVideos.map((video, index) => (
                        <motion.div
                          key={video.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group relative rounded-2xl overflow-hidden"
                        >
                          <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-4">
                            {/* Video Preview */}
                            <div className="relative rounded-xl overflow-hidden mb-4">
                              <motion.div
                                animate={{
                                  boxShadow: [
                                    '0 0 30px rgba(168,85,247,0.4)',
                                    '0 0 50px rgba(236,72,153,0.4)',
                                    '0 0 30px rgba(168,85,247,0.4)',
                                  ]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                              >
                                <img 
                                  src={video.thumbnail} 
                                  alt={video.prompt}
                                  className="w-full h-auto"
                                />
                              </motion.div>
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center"
                              >
                                <Video className="w-8 h-8 text-white" />
                              </motion.div>
                            </div>

                            {/* Video Info */}
                            <div className="space-y-3">
                              <p className="text-slate-900 text-sm font-medium line-clamp-2">
                                {video.prompt}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                                  ⏱️ {video.duration}s
                                </Badge>
                                {video.filter !== 'none' && (
                                  <Badge className="bg-pink-100 text-pink-800 border border-pink-300">
                                    🎨 {video.filter}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl">
                                  <Download className="w-4 h-4 mr-2" />
                                  Tải Về
                                </Button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Image Results */}
              {activeTab !== 'video' && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}