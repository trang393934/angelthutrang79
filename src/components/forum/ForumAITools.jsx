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
      prompt: `Hãy tóm tắt cuộc thảo luận sau đây một cách súc tích và đầy đủ ý nghĩa:

${threadContent}

Tóm tắt theo cấu trúc:
1. Chủ đề chính
2. Các quan điểm chính
3. Kết luận/Insight quan trọng

Viết bằng tiếng Việt, dễ hiểu.`
    });

    setResult(summary);
    setIsProcessing(false);
  };

  const suggestReplies = async () => {
    setIsProcessing(true);
    setActiveTab('suggestions');

    const suggestions = await base44.integrations.Core.InvokeLLM({
      prompt: `Dựa trên bài đăng diễn đàn sau, hãy gợi ý 3 câu trả lời chất lượng cao:

Tiêu đề: ${post.title}
Nội dung: ${post.content}

Tạo 3 góc nhìn khác nhau:
1. Góc nhìn thực tiễn/kinh nghiệm
2. Góc nhìn học thuật/nghiên cứu
3. Góc nhìn sáng tạo/độc đáo

Mỗi gợi ý khoảng 100-150 từ.`,
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
      prompt: `Phân tích nội dung diễn đàn sau để phát hiện vấn đề:

${allContent.map(c => `${c.type === 'post' ? 'BÀI ĐĂNG' : 'TRẢ LỜI'} từ ${c.author}:\n${c.content}`).join('\n\n---\n\n')}

Kiểm tra:
- Ngôn ngữ thù địch, xúc phạm
- Spam, quảng cáo
- Thông tin sai lệch
- Nội dung không phù hợp

Trả về JSON với đánh giá cho từng nội dung.`,
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
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-slate-900 font-bold">AI Tools</h3>
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