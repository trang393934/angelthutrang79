import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

export default function BlogGenerator({ onGenerated }) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('friendly');
  const [style, setStyle] = useState('informative');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateBlog = async () => {
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là một AI writer chuyên nghiệp. Hãy viết một bài blog HOÀN CHỈNH và CHI TIẾT về chủ đề sau:

Chủ đề: ${topic}
${additionalDetails ? `Chi tiết thêm: ${additionalDetails}` : ''}

Yêu cầu:
- Giọng điệu (tone): ${tone === 'professional' ? 'Chuyên nghiệp, uy tín' : tone === 'friendly' ? 'Thân thiện, gần gũi' : tone === 'casual' ? 'Thoải mái, dễ chịu' : tone === 'formal' ? 'Trang trọng, lịch sự' : tone === 'inspiring' ? 'Truyền cảm hứng, động viên' : 'Thơ mộng, nghệ thuật'}
- Văn phong (style): ${style === 'informative' ? 'Cung cấp thông tin, kiến thức' : style === 'storytelling' ? 'Kể chuyện, có cốt truyện' : style === 'persuasive' ? 'Thuyết phục, lập luận' : style === 'educational' ? 'Giáo dục, hướng dẫn' : 'Đàm thoại, trao đổi'}

Cấu trúc bài viết:
1. Tiêu đề hấp dẫn
2. Mở bài thu hút
3. Nội dung chính với các tiểu mục (sử dụng markdown: ##, ###)
4. Kết luận có ý nghĩa
5. Độ dài: 800-1500 từ

Viết bằng tiếng Việt, sử dụng markdown để format (tiêu đề, danh sách, in đậm, v.v.)

Trả về JSON với:
{
  "title": "Tiêu đề bài viết",
  "content": "Nội dung đầy đủ (markdown)",
  "excerpt": "Mô tả ngắn 2-3 câu",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "meta_description": "Meta description cho SEO (150-160 ký tự)",
  "meta_keywords": ["keyword1", "keyword2", "keyword3"],
  "category": "Danh mục phù hợp",
  "word_count": số từ,
  "read_time_minutes": thời gian đọc ước tính
}`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            excerpt: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            meta_description: { type: "string" },
            meta_keywords: { type: "array", items: { type: "string" } },
            category: { type: "string" },
            word_count: { type: "number" },
            read_time_minutes: { type: "number" }
          }
        }
      });

      onGenerated({
        ...result,
        topic,
        tone,
        style
      });
    } catch (error) {
      alert('Lỗi khi tạo blog. Vui lòng thử lại!');
    }
    setIsGenerating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-3xl p-6 shadow-xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          animate={{ 
            boxShadow: [
              '0 0 20px rgba(168,85,247,0.4)',
              '0 0 40px rgba(168,85,247,0.6)',
              '0 0 20px rgba(168,85,247,0.4)',
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
        >
          <Wand2 className="w-6 h-6 text-white" />
        </motion.div>
        <div>
          <h3 className="text-slate-900 text-xl font-bold">AI Blog Generator</h3>
          <p className="text-purple-700 text-sm font-medium">Tạo bài viết tự động bằng AI</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-slate-700 text-sm font-semibold mb-2 block">
            Chủ đề bài viết *
          </label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ví dụ: Lợi ích của thiền định cho sức khỏe tinh thần"
            className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl"
          />
        </div>

        <div>
          <label className="text-slate-700 text-sm font-semibold mb-2 block">
            Chi tiết bổ sung (tùy chọn)
          </label>
          <Textarea
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
            placeholder="Thêm thông tin chi tiết, góc nhìn cụ thể, hoặc điểm nhấn bạn muốn..."
            className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-700 text-sm font-semibold mb-2 block">
              Giọng điệu
            </label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="bg-white border-2 border-purple-300 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Chuyên nghiệp</SelectItem>
                <SelectItem value="friendly">Thân thiện</SelectItem>
                <SelectItem value="casual">Thoải mái</SelectItem>
                <SelectItem value="formal">Trang trọng</SelectItem>
                <SelectItem value="inspiring">Truyền cảm hứng</SelectItem>
                <SelectItem value="poetic">Thơ mộng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-slate-700 text-sm font-semibold mb-2 block">
              Văn phong
            </label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-white border-2 border-purple-300 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informative">Thông tin</SelectItem>
                <SelectItem value="storytelling">Kể chuyện</SelectItem>
                <SelectItem value="persuasive">Thuyết phục</SelectItem>
                <SelectItem value="educational">Giáo dục</SelectItem>
                <SelectItem value="conversational">Đàm thoại</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={generateBlog}
          disabled={!topic.trim() || isGenerating}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl py-6 text-lg font-bold shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Đang Tạo Bài Viết...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Tạo Bài Blog Với AI
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}