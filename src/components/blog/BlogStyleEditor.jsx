import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Loader2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';

export default function BlogStyleEditor({ currentPost, onStyleChanged }) {
  const [tone, setTone] = useState(currentPost?.tone || 'friendly');
  const [style, setStyle] = useState(currentPost?.style || 'informative');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const regenerateWithNewStyle = async () => {
    if (!currentPost || isRegenerating) return;

    setIsRegenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Hãy VIẾT LẠI hoàn toàn bài blog sau với giọng điệu và văn phong MỚI:

Bài viết gốc:
${currentPost.content}

Giọng điệu MỚI: ${tone === 'professional' ? 'Chuyên nghiệp, uy tín' : tone === 'friendly' ? 'Thân thiện, gần gũi' : tone === 'casual' ? 'Thoải mái, dễ chịu' : tone === 'formal' ? 'Trang trọng, lịch sự' : tone === 'inspiring' ? 'Truyền cảm hứng, động viên' : 'Thơ mộng, nghệ thuật'}
Văn phong MỚI: ${style === 'informative' ? 'Cung cấp thông tin, kiến thức' : style === 'storytelling' ? 'Kể chuyện, có cốt truyện' : style === 'persuasive' ? 'Thuyết phục, lập luận' : style === 'educational' ? 'Giáo dục, hướng dẫn' : 'Đàm thoại, trao đổi'}

GIỮ NGUYÊN:
- Cấu trúc và nội dung chính
- Tiêu đề (có thể điều chỉnh nhẹ cho phù hợp)
- Độ dài tương đương

THAY ĐỔI:
- Cách diễn đạt, từ ngữ
- Giọng văn theo tone/style mới
- Cách mở đầu và kết thúc

Viết bằng tiếng Việt, sử dụng markdown.

Trả về JSON:
{
  "title": "Tiêu đề (có thể điều chỉnh)",
  "content": "Nội dung đã viết lại",
  "excerpt": "Mô tả ngắn mới",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "meta_description": "Meta description mới",
  "meta_keywords": ["keyword1", "keyword2", "keyword3"]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            excerpt: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            meta_description: { type: "string" },
            meta_keywords: { type: "array", items: { type: "string" } }
          }
        }
      });

      onStyleChanged({
        ...currentPost,
        ...result,
        tone,
        style
      });
    } catch (error) {
      alert('Lỗi khi chỉnh sửa văn phong. Vui lòng thử lại!');
    }
    setIsRegenerating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-indigo-300 rounded-3xl p-6 shadow-lg"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center">
          <Palette className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-slate-900 text-lg font-bold">Chỉnh Sửa Văn Phong</h3>
          <p className="text-indigo-700 text-sm font-medium">AI viết lại theo style mới</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-slate-700 text-sm font-semibold mb-2 block">
            Giọng điệu
          </label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="bg-white border-2 border-indigo-300 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">🎯 Chuyên nghiệp</SelectItem>
              <SelectItem value="friendly">😊 Thân thiện</SelectItem>
              <SelectItem value="casual">🌈 Thoải mái</SelectItem>
              <SelectItem value="formal">🎩 Trang trọng</SelectItem>
              <SelectItem value="inspiring">✨ Truyền cảm hứng</SelectItem>
              <SelectItem value="poetic">🌸 Thơ mộng</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-slate-700 text-sm font-semibold mb-2 block">
            Văn phong
          </label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="bg-white border-2 border-indigo-300 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="informative">📚 Thông tin</SelectItem>
              <SelectItem value="storytelling">📖 Kể chuyện</SelectItem>
              <SelectItem value="persuasive">💪 Thuyết phục</SelectItem>
              <SelectItem value="educational">🎓 Giáo dục</SelectItem>
              <SelectItem value="conversational">💬 Đàm thoại</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-300 rounded-2xl p-3 mb-4">
        <p className="text-indigo-900 text-xs font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Hiện tại: <Badge className="bg-indigo-200 text-indigo-800 ml-1">{currentPost?.tone || 'friendly'}</Badge> / <Badge className="bg-indigo-200 text-indigo-800">{currentPost?.style || 'informative'}</Badge>
        </p>
      </div>

      <Button
        onClick={regenerateWithNewStyle}
        disabled={!currentPost || isRegenerating || (tone === currentPost?.tone && style === currentPost?.style)}
        className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl py-6 font-bold shadow-lg hover:shadow-xl disabled:opacity-50"
      >
        {isRegenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Đang Viết Lại...
          </>
        ) : (
          <>
            <RefreshCw className="w-5 h-5 mr-2" />
            Viết Lại Với Style Mới
          </>
        )}
      </Button>
    </motion.div>
  );
}