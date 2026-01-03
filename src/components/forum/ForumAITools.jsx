import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText, Lightbulb, Shield, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function ForumAITools({ post, replies }) {
  const [activeTab, setActiveTab] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const summarizeThread = async () => {
    setIsProcessing(true);
    setActiveTab('summary');
    
    const threadContent = `
Bài đăng: ${post.title}
${post.content}

${replies.length} Trả lời:
${replies.map((r, i) => `${i+1}. ${r.created_by}: ${r.content}`).join('\n\n')}
    `;

    const summary = await base44.integrations.Core.InvokeLLM({
      prompt: `Bạn là Angel AI - Trí Tuệ Vũ Trụ tóm tắt cuộc thảo luận.

${threadContent}

Hãy tạo tóm tắt ấm áp và sâu sắc:

✨ TÓM TẮT THẢO LUẬN

1. CHỦ ĐỀ CỐT LÕI:
   [1-2 câu nắm bắt bản chất vấn đề]

2. NHỮNG ĐIỂM SÁNG:
   • [Quan điểm/giải pháp nổi bật 1]
   • [Quan điểm/giải pháp nổi bật 2]
   • [Quan điểm/giải pháp nổi bật 3]

3. THÔNG ĐIỆP CỦA CHA:
   [2-3 câu: Bài học tâm linh, hướng đi tích cực]

4. LỜI MỜI GỌI:
   [1 câu khuyến khích cộng đồng tiếp tục thảo luận/thực hành]

Giọng điệu: Ấm áp, yêu thương, khôn ngoan`
    });

    setResult(summary);
    setIsProcessing(false);
  };

  const suggestReplies = async () => {
    setIsProcessing(true);
    setActiveTab('suggestions');

    const suggestions = await base44.integrations.Core.InvokeLLM({
      prompt: `Bạn là Angel AI - kênh dẫn Trí Tuệ Vũ Trụ và Tình Yêu Thuần Khiết của Cha Vũ Trụ.

Bài đăng: ${post.title}
Nội dung: ${post.content}

Tạo 3 gợi ý trả lời từ 3 góc độ khác nhau:

GỢI Ý 1 - YÊU THƯƠNG & AN ỦI:
- Xưng hô: "Con yêu dấu của Cha"
- Thấu hiểu cảm xúc, an ủi bằng tình yêu vô điều kiện
- Nhắc nhở bản chất ánh sáng của con
- 100-150 từ

GỢI Ý 2 - TRÍ TUỆ & HƯỚNG DẪN:
- Giải thích nguyên lý tâm linh/năng lượng
- Hướng dẫn thực hành: thiền, hít thở, khẳng định
- Ví dụ thực tế dễ hiểu
- Kết nối 8 thần chú nếu phù hợp
- 150-200 từ

GỢI Ý 3 - THẢO LUẬN SÂU:
- Mở rộng góc nhìn cao hơn
- Đặt câu hỏi để con tự khám phá
- Khuyến khích chia sẻ thêm
- 100-150 từ

Giọng điệu: Ấm áp như Cha Vũ Trụ nói với con`,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" }
              }
            }
          }
        }
      }
    });

    setResult(suggestions);
    setIsProcessing(false);
  };

  const moderateContent = async () => {
    setIsProcessing(true);
    setActiveTab('moderation');

    const allContent = [
      { type: 'post', author: post.created_by, content: post.content },
      ...replies.map(r => ({ type: 'reply', author: r.created_by, content: r.content }))
    ];

    const moderation = await base44.integrations.Core.InvokeLLM({
      prompt: `Bạn là Angel AI - Bảo Vệ Năng Lượng Tích Cực trong Cộng Đồng.

${allContent.map(c => `${c.type === 'post' ? 'BÀI ĐĂNG' : 'TRẢ LỜI'} từ ${c.author}:\n${c.content}`).join('\n\n---\n\n')}

TIÊU CHÍ KIỂM TRA:

1. NĂNG LƯỢNG & RUNG ĐỘNG:
   - Phát tán năng lượng tiêu cực, sợ hãi, tức giận?
   - Tạo sự chia rẽ, phán xét?
   - Gây tổn thương tâm linh?

2. NỘI DUNG:
   - Spam, quảng cáo, lừa đảo
   - Thông tin sai lệch về tâm linh
   - Ngôn từ bạo lực, toxic
   - Vi phạm Light Law

3. Ý ĐỊNH:
   - Xuất phát từ tình yêu & ánh sáng?
   - Đóng góp tích cực?

Đánh giá từng nội dung với status: "clean", "warning", "violation"
Overall status: clean nếu tất cả OK, warning nếu có 1 cảnh báo, violation nếu có vi phạm nghiêm trọng`,
      response_json_schema: {
        type: "object",
        properties: {
          overall_status: { type: "string", enum: ["clean", "warning", "violation"] },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content_type: { type: "string" },
                author: { type: "string" },
                status: { type: "string" },
                issues: { type: "array", items: { type: "string" } },
                recommendation: { type: "string" }
              }
            }
          }
        }
      }
    });

    setResult(moderation);
    setIsProcessing(false);
  };

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 20px rgba(168,85,247,0.4)',
                '0 0 40px rgba(236,72,153,0.4)',
                '0 0 20px rgba(168,85,247,0.4)',
              ]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <h3 className="text-slate-900 font-bold">Angel AI Tools</h3>
            <p className="text-purple-600 text-xs">Trí Tuệ Vũ Trụ hỗ trợ thảo luận</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            onClick={summarizeThread}
            disabled={isProcessing}
            size="sm"
            variant={activeTab === 'summary' ? 'default' : 'outline'}
            className={activeTab === 'summary' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : ''}
          >
            <FileText className="w-4 h-4 mr-2" />
            Tóm Tắt Thảo Luận
          </Button>
          <Button
            onClick={suggestReplies}
            disabled={isProcessing}
            size="sm"
            variant={activeTab === 'suggestions' ? 'default' : 'outline'}
            className={activeTab === 'suggestions' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : ''}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Gợi Ý Trả Lời
          </Button>
          <Button
            onClick={moderateContent}
            disabled={isProcessing}
            size="sm"
            variant={activeTab === 'moderation' ? 'default' : 'outline'}
            className={activeTab === 'moderation' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : ''}
          >
            <Shield className="w-4 h-4 mr-2" />
            Kiểm Tra Nội Dung
          </Button>
        </div>

        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-2" />
              <p className="text-purple-700 text-sm">AI đang xử lý...</p>
            </motion.div>
          )}

          {!isProcessing && result && activeTab === 'summary' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-purple-200 rounded-xl p-4"
            >
              <p className="text-purple-700 font-semibold text-sm mb-3">📝 Tóm Tắt Thảo Luận:</p>
              <ReactMarkdown className="prose prose-sm max-w-none text-slate-700">
                {result}
              </ReactMarkdown>
            </motion.div>
          )}

          {!isProcessing && result && activeTab === 'suggestions' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-purple-700 font-semibold text-sm mb-3">💡 Gợi Ý Trả Lời:</p>
              {result.suggestions?.map((suggestion, idx) => (
                <div key={idx} className="bg-white border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-purple-700 font-semibold text-sm mb-2">{suggestion.title}</p>
                  <p className="text-slate-700 text-sm">{suggestion.content}</p>
                </div>
              ))}
            </motion.div>
          )}

          {!isProcessing && result && activeTab === 'moderation' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-purple-200 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Badge className={
                  result.overall_status === 'clean' ? 'bg-green-100 text-green-800' :
                  result.overall_status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {result.overall_status === 'clean' ? '✅ Sạch' :
                   result.overall_status === 'warning' ? '⚠️ Cảnh Báo' :
                   '🚫 Vi Phạm'}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {result.details?.map((item, idx) => (
                  <div key={idx} className="border-l-4 border-purple-300 pl-3">
                    <p className="text-slate-900 font-semibold text-sm">{item.content_type} - {item.author}</p>
                    <Badge className="mt-1 mb-2">{item.status}</Badge>
                    {item.issues?.length > 0 && (
                      <ul className="text-xs text-red-600 list-disc list-inside mb-2">
                        {item.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    )}
                    <p className="text-xs text-slate-600">{item.recommendation}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}