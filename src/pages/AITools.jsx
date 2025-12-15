import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, FileText, Languages, BarChart3, Tags, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function AITools() {
  const [activeTab, setActiveTab] = useState('summarize');
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'summarize', label: 'Tóm Tắt Văn Bản', icon: FileText, gradient: 'from-blue-400 to-cyan-400' },
    { id: 'translate', label: 'Dịch Thuật', icon: Languages, gradient: 'from-purple-400 to-pink-400' },
    { id: 'analyze', label: 'Phân Tích Dữ Liệu', icon: BarChart3, gradient: 'from-green-400 to-emerald-400' },
    { id: 'tag', label: 'Tự Động Gắn Thẻ', icon: Tags, gradient: 'from-amber-400 to-orange-400' },
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'zh', name: '中文 (Chinese)' },
    { code: 'ja', name: '日本語 (Japanese)' },
    { code: 'ko', name: '한국어 (Korean)' },
    { code: 'fr', name: 'Français (French)' },
    { code: 'de', name: 'Deutsch (German)' },
    { code: 'es', name: 'Español (Spanish)' },
    { code: 'pt', name: 'Português (Portuguese)' },
    { code: 'ru', name: 'Русский (Russian)' },
    { code: 'ar', name: 'العربية (Arabic)' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
  ];

  const handleSummarize = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    
    try {
      const summary = await base44.integrations.Core.InvokeLLM({
        prompt: `Hãy tóm tắt văn bản sau một cách súc tích và đầy đủ ý nghĩa. Trích xuất các điểm chính quan trọng nhất.

Văn bản cần tóm tắt:
${input}

Yêu cầu:
- Tóm tắt ngắn gọn nhưng đầy đủ ý
- Trình bày rõ ràng, dễ hiểu
- Giữ nguyên ngôn ngữ của văn bản gốc
- Nêu bật các ý chính quan trọng`,
      });
      
      setResult(summary);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi tóm tắt văn bản. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleTranslate = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    
    try {
      const translation = await base44.integrations.Core.InvokeLLM({
        prompt: `Hãy dịch văn bản sau sang ${languages.find(l => l.code === targetLanguage)?.name}. Dịch chính xác, tự nhiên và giữ nguyên ý nghĩa.

Văn bản cần dịch:
${input}

Yêu cầu:
- Dịch chính xác và tự nhiên
- Giữ nguyên format nếu có
- Phù hợp với văn hóa ngôn ngữ đích
- Chỉ trả về bản dịch, không thêm giải thích`,
      });
      
      setResult(translation);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi dịch văn bản. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleAnalyze = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    
    try {
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Hãy phân tích sâu dữ liệu/thông tin sau và đưa ra các insight quan trọng:

Dữ liệu cần phân tích:
${input}

Yêu cầu phân tích:
1. **Tóm tắt tổng quan**: Nội dung chính là gì?
2. **Xu hướng chính**: Những pattern, xu hướng nổi bật?
3. **Insights quan trọng**: Phát hiện, điểm đáng chú ý?
4. **Gợi ý hành động**: Các bước cải thiện/tối ưu?
5. **Cảnh báo rủi ro**: Điểm cần lưu ý?

Trả lời bằng tiếng Việt, rõ ràng và có cấu trúc.`,
      });
      
      setResult(analysis);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi phân tích dữ liệu. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleTag = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    
    try {
      const tagging = await base44.integrations.Core.InvokeLLM({
        prompt: `Hãy phân loại và gắn thẻ tự động cho tài liệu sau:

Nội dung tài liệu:
${input}

Trả về JSON với format:
{
  "category": "danh mục chính (ví dụ: Tâm linh, Kinh doanh, Công nghệ, Sức khỏe, Giáo dục...)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "summary": "tóm tắt 1-2 câu về nội dung",
  "sentiment": "tích cực/tiêu cực/trung lập",
  "difficulty": "cơ bản/trung bình/nâng cao",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Tags phải:
- Bằng tiếng Việt
- Ngắn gọn, súc tích
- Phản ánh đúng nội dung
- Từ 5-8 tags`,
        response_json_schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            sentiment: { type: "string" },
            difficulty: { type: "string" },
            keywords: { type: "array", items: { type: "string" } }
          }
        }
      });
      
      setResult(JSON.stringify(tagging, null, 2));
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi phân loại tài liệu. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleProcess = () => {
    switch (activeTab) {
      case 'summarize':
        handleSummarize();
        break;
      case 'translate':
        handleTranslate();
        break;
      case 'analyze':
        handleAnalyze();
        break;
      case 'tag':
        handleTag();
        break;
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseTaggingResult = (jsonString) => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  const currentTab = tabs.find(t => t.id === activeTab);
  const Icon = currentTab?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50 to-purple-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/50 via-purple-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-indigo-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(139,92,246,0.4)',
                  '0 0 40px rgba(139,92,246,0.6)',
                  '0 0 20px rgba(139,92,246,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-400 flex items-center justify-center flex-shrink-0"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg truncate">AI Tools</h1>
              <p className="text-purple-600 text-xs font-medium truncate">Công Cụ AI Nâng Cao</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setInput('');
                  setResult('');
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-2xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-br ' + tab.gradient + ' shadow-xl border-2 border-white'
                    : 'bg-white border-2 border-purple-200 hover:border-purple-400 shadow-md'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    activeTab === tab.id ? 'bg-white/30' : 'bg-gradient-to-br ' + tab.gradient
                  }`}>
                    <TabIcon className={`w-6 h-6 ${activeTab === tab.id ? 'text-white' : 'text-white'}`} />
                  </div>
                  <span className={`text-sm font-bold text-center ${
                    activeTab === tab.id ? 'text-white' : 'text-slate-900'
                  }`}>
                    {tab.label}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${currentTab?.gradient} flex items-center justify-center shadow-lg`}>
              {Icon && <Icon className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-lg">{currentTab?.label}</h3>
              <p className="text-purple-700 text-sm font-medium">
                {activeTab === 'summarize' && 'Nhập văn bản dài để AI tóm tắt ngắn gọn'}
                {activeTab === 'translate' && 'Nhập văn bản để AI dịch sang ngôn ngữ khác'}
                {activeTab === 'analyze' && 'Nhập dữ liệu để AI phân tích và đưa ra insight'}
                {activeTab === 'tag' && 'Nhập tài liệu để AI tự động phân loại và gắn thẻ'}
              </p>
            </div>
          </div>

          {activeTab === 'translate' && (
            <div className="mb-4">
              <label className="text-slate-900 text-sm font-semibold mb-2 block">Dịch sang ngôn ngữ:</label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeTab === 'summarize' ? 'Paste văn bản dài cần tóm tắt...' :
              activeTab === 'translate' ? 'Paste văn bản cần dịch...' :
              activeTab === 'analyze' ? 'Paste dữ liệu cần phân tích (text, số liệu, thống kê...)' :
              'Paste nội dung tài liệu cần phân loại và gắn thẻ...'
            }
            className="min-h-[200px] bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-400 rounded-2xl mb-4 font-medium leading-relaxed resize-none"
          />

          <Button
            onClick={handleProcess}
            disabled={!input.trim() || isLoading}
            className={`w-full bg-gradient-to-r ${currentTab?.gradient} text-white rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 font-bold text-lg py-6`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Đang Xử Lý...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                {activeTab === 'summarize' && 'Tóm Tắt Ngay'}
                {activeTab === 'translate' && 'Dịch Ngay'}
                {activeTab === 'analyze' && 'Phân Tích Ngay'}
                {activeTab === 'tag' && 'Phân Loại Ngay'}
              </>
            )}
          </Button>
        </motion.div>

        {/* Result Section */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-lg">Kết Quả</h3>
                    <p className="text-green-700 text-sm font-medium">AI đã xử lý xong</p>
                  </div>
                </div>
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-50 rounded-full"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Đã Copy
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {activeTab === 'tag' ? (
                (() => {
                  const tagData = parseTaggingResult(result);
                  return tagData ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-4">
                        <p className="text-purple-700 text-sm font-semibold mb-2">📂 Danh Mục:</p>
                        <Badge className="bg-purple-600 text-white text-base px-4 py-2">
                          {tagData.category}
                        </Badge>
                      </div>

                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-2xl p-4">
                        <p className="text-blue-700 text-sm font-semibold mb-2">🏷️ Tags:</p>
                        <div className="flex flex-wrap gap-2">
                          {tagData.tags.map((tag, idx) => (
                            <Badge key={idx} className="bg-blue-600 text-white px-3 py-1">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4">
                        <p className="text-amber-700 text-sm font-semibold mb-2">💡 Keywords:</p>
                        <div className="flex flex-wrap gap-2">
                          {tagData.keywords.map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="border-amber-400 text-amber-800 bg-amber-50">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4">
                        <p className="text-green-700 text-sm font-semibold mb-2">📝 Tóm Tắt:</p>
                        <p className="text-slate-900 font-medium leading-relaxed">{tagData.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-2xl p-4">
                          <p className="text-rose-700 text-sm font-semibold mb-2">😊 Cảm Xúc:</p>
                          <Badge className="bg-rose-600 text-white">
                            {tagData.sentiment}
                          </Badge>
                        </div>
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl p-4">
                          <p className="text-indigo-700 text-sm font-semibold mb-2">📊 Độ Khó:</p>
                          <Badge className="bg-indigo-600 text-white">
                            {tagData.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
                      <pre className="text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                        {result}
                      </pre>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 prose prose-slate max-w-none">
                  <ReactMarkdown className="text-slate-900 font-medium leading-relaxed [&>p]:mb-3 [&>ul]:mb-3 [&>ol]:mb-3 [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:font-semibold [&>h3]:mb-2">
                    {result}
                  </ReactMarkdown>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}