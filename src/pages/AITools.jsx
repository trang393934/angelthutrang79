import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, FileText, Languages, BarChart3, Tags, Loader2, Copy, CheckCircle2, Music, PenTool, Lightbulb } from 'lucide-react';
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
  const [musicStyle, setMusicStyle] = useState('pop');
  const [musicMood, setMusicMood] = useState('happy');
  const [artistReference, setArtistReference] = useState('');
  const [similarSongs, setSimilarSongs] = useState('');
  const [melodyDescription, setMelodyDescription] = useState('');
  const [musicMessages, setMusicMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const tabs = [
    { id: 'create', label: 'Tạo Nội Dung', icon: PenTool, gradient: 'from-indigo-400 to-purple-400' },
    { id: 'ideas', label: 'Gợi Ý Ý Tưởng', icon: Lightbulb, gradient: 'from-yellow-400 to-amber-400' },
    { id: 'summarize', label: 'Tóm Tắt Văn Bản', icon: FileText, gradient: 'from-blue-400 to-cyan-400' },
    { id: 'translate', label: 'Dịch Thuật', icon: Languages, gradient: 'from-purple-400 to-pink-400' },
    { id: 'analyze', label: 'Phân Tích Dữ Liệu', icon: BarChart3, gradient: 'from-green-400 to-emerald-400' },
    { id: 'tag', label: 'Tự Động Gắn Thẻ', icon: Tags, gradient: 'from-amber-400 to-orange-400' },
    { id: 'music', label: 'Tạo Lời Bài Hát', icon: Music, gradient: 'from-rose-400 to-pink-400' },
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

  const handleCreate = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    
    try {
      const content = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là một writer chuyên nghiệp với khả năng sáng tạo nội dung xuất sắc. Hãy tạo một bài viết/nội dung hoàn chỉnh, chất lượng cao dựa trên chủ đề sau:

**Chủ đề:** ${input}

**Yêu cầu nội dung:**

1. **Cấu trúc hoàn chỉnh:**
   - Tiêu đề hấp dẫn và SEO-friendly
   - Phần mở đầu thu hút (hook)
   - Nội dung chính có cấu trúc rõ ràng
   - Kết luận mạnh mẽ với call-to-action

2. **Chất lượng nội dung:**
   - Thông tin chính xác, đáng tin cậy
   - Ngôn ngữ phù hợp với đối tượng độc giả
   - Sử dụng ví dụ cụ thể, số liệu (nếu phù hợp)
   - Hình ảnh nghệ thuật, giàu cảm xúc
   - Giọng văn tự nhiên, dễ đọc

3. **Định dạng:**
   - Chia thành các phần với heading rõ ràng
   - Bullet points cho thông tin quan trọng
   - Đoạn văn ngắn gọn (3-5 câu)
   - Highlight các ý chính

4. **Tối ưu SEO (nếu là bài blog):**
   - Keywords tự nhiên
   - Meta description gợi ý
   - Subheadings với từ khóa

Hãy tạo nội dung HOÀN CHỈNH, sẵn sàng để xuất bản!`,
      });
      
      setResult(content);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi tạo nội dung. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleIdeas = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    
    try {
      const ideas = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là một content strategist sáng tạo. Dựa trên chủ đề/từ khóa sau, hãy đề xuất các ý tưởng nội dung phong phú và đa dạng:

**Chủ đề/Từ khóa:** ${input}

**Hãy đề xuất 15-20 ý tưởng nội dung theo format sau:**

## 🎯 Bài Viết Blog/Article
1. [Tiêu đề hấp dẫn] - [Mô tả ngắn gọn về nội dung]
2. [Tiêu đề hấp dẫn] - [Mô tả ngắn gọn về nội dung]
... (5-7 ý tưởng)

## 📱 Social Media Content
1. [Concept] - [Platform phù hợp] - [Format: Video/Image/Carousel]
2. [Concept] - [Platform phù hợp] - [Format]
... (3-5 ý tưởng)

## 🎬 Video Content
1. [Tiêu đề video] - [Góc độ độc đáo]
2. [Tiêu đề video] - [Góc độ độc đáo]
... (3-4 ý tưởng)

## 📧 Email Marketing
1. [Subject line] - [Nội dung chính]
2. [Subject line] - [Nội dung chính]
... (2-3 ý tưởng)

## 💡 Content Series
1. [Tên series] - [Các tập đề xuất]
2. [Tên series] - [Các tập đề xuất]
... (2-3 series)

**Lưu ý:**
- Ý tưởng phải sáng tạo, độc đáo
- Phù hợp với xu hướng hiện tại
- Có tính thực tiễn cao
- Đa dạng về format và platform
- Có tiềm năng viral/engagement cao

Trình bày rõ ràng, dễ hiểu bằng tiếng Việt!`,
      });
      
      setResult(ideas);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi tạo ý tưởng. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

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

  const handleMusic = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setResult('');
    const userMessage = { role: 'user', content: input };
    setMusicMessages([userMessage]);
    
    try {
      const musicGeneration = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là một nhạc sĩ chuyên nghiệp và producer âm nhạc. Hãy tạo lời bài hát hoàn chỉnh cùng hướng dẫn sản xuất chi tiết:

📝 **THÔNG TIN ĐẦU VÀO:**
Chủ đề/Nội dung: ${input}
Thể loại nhạc: ${musicStyle}
Tâm trạng: ${musicMood}
${artistReference ? `Ca sĩ/Ban nhạc tham khảo: ${artistReference}` : ''}
${similarSongs ? `Các bài hát tương tự: ${similarSongs}` : ''}
${melodyDescription ? `Mô tả giai điệu: ${melodyDescription}` : ''}

🎵 **YÊU CẦU SÁNG TÁC:**

1. **CẤU TRÚC BÀI HÁT ĐẦY ĐỦ**: 
   - [Intro] - Mở đầu bắt tai
   - [Verse 1] - Câu chuyện bắt đầu
   - [Pre-Chorus] - Xây dựng cảm xúc (nếu phù hợp)
   - [Chorus] - Hook chính, dễ nhớ
   - [Verse 2] - Phát triển câu chuyện
   - [Chorus] - Lặp lại hook
   - [Bridge] - Đổi màu, climax cảm xúc
   - [Chorus] - Final hook với biến tấu
   - [Outro] - Kết thúc ấn tượng

2. **LỜI BÀI HÁT**:
   - Phù hợp với thể loại ${musicStyle}${artistReference ? ` (phong cách ${artistReference})` : ''}
   - Thể hiện tâm trạng ${musicMood}
   - Có vần điệu, nhịp nhàng, dễ hát
   - Cảm xúc chân thực, sâu sắc
   - Ngôn ngữ đẹp, hình ảnh nghệ thuật
   - Hook chorus phải catchy và memorable
   ${melodyDescription ? `- Lời phải khớp với giai điệu: ${melodyDescription}` : ''}

3. **CHI TIẾT SẢN XUẤT & ARRANGEMENT**:
   
   🎹 **Nhạc Cụ & Layers**:
   - Main instruments (Piano, Guitar, Synth, Bass, Drums...)
   - Supporting instruments
   - Sound effects và atmosphere
   - Layer theo từng đoạn
   
   ⚡ **Tempo & Rhythm**:
   - BPM (Beats Per Minute) cụ thể
   - Time signature (4/4, 3/4, 6/8...)
   - Groove và feel
   - Drum pattern gợi ý
   
   🎤 **Vocal Performance**:
   - Cách hát từng đoạn (belting, falsetto, whisper, powerful...)
   - Harmony và backing vocals
   - Vocal effects (reverb, delay, autotune...)
   - Ad-libs và variations
   
   🎛️ **Production Notes**:
   - EQ và mixing tips
   - Build-ups và drops (nếu có)
   - Dynamic range (quiet → loud)
   - Transitions giữa các đoạn
   - Special effects cho từng phần
   
   🎺 **Chord Progression**:
   - Hợp âm chính cho Verse
   - Hợp âm cho Chorus
   - Chord changes cho Bridge
   - Key signature và modulation (nếu có)

4. **CẢM HỨNG NGHỆ SĨ**:
   ${artistReference ? `- Học hỏi từ ${artistReference}: phong cách vocal, arrangement, production style` : '- Tạo phong cách độc đáo'}
   ${similarSongs ? `- Lấy cảm hứng từ: ${similarSongs} (về cấu trúc, vibe, production)` : ''}

Trình bày chuyên nghiệp, chi tiết như một nhạc sĩ & producer thực thụ. Mỗi phần cần có giải thích cụ thể để có thể sản xuất ngay!`,
      });
      
      setResult(musicGeneration);
      setMusicMessages([userMessage, { role: 'assistant', content: musicGeneration }]);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra khi tạo lời bài hát. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleMusicChat = async () => {
    if (!chatInput.trim() || isLoading || musicMessages.length === 0) return;
    
    setIsLoading(true);
    const userMessage = { role: 'user', content: chatInput };
    const updatedMessages = [...musicMessages, userMessage];
    setMusicMessages(updatedMessages);
    setChatInput('');
    
    try {
      const conversationHistory = updatedMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`
      ).join('\n\n');
      
      const refinedMusic = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là một nhạc sĩ chuyên nghiệp. Dựa trên cuộc trò chuyện trước đó, hãy chỉnh sửa/cải thiện lời bài hát theo yêu cầu mới.

Lịch sử trò chuyện:
${conversationHistory}

Thể loại: ${musicStyle}
Tâm trạng: ${musicMood}

Hãy:
- Giữ nguyên cấu trúc bài hát tốt
- Áp dụng chỉnh sửa theo yêu cầu mới nhất
- Đảm bảo lời bài hát vẫn hay, có vần điệu
- Trình bày đầy đủ như bản gốc

Trả về bài hát đã được chỉnh sửa hoàn chỉnh.`,
      });
      
      setResult(refinedMusic);
      setMusicMessages([...updatedMessages, { role: 'assistant', content: refinedMusic }]);
    } catch (error) {
      setResult('❌ Có lỗi xảy ra. Vui lòng thử lại.');
    }
    
    setIsLoading(false);
  };

  const handleProcess = () => {
    switch (activeTab) {
      case 'create':
        handleCreate();
        break;
      case 'ideas':
        handleIdeas();
        break;
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
      case 'music':
        handleMusic();
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
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
            <div className="text-center">
              <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">AI Tools</h1>
              <p className="text-purple-600 text-xs font-medium">Công Cụ AI Nâng Cao</p>
            </div>
          </div>
          
          <div className="w-10 flex-shrink-0" />
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
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
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    activeTab === tab.id ? 'bg-white/30' : 'bg-gradient-to-br ' + tab.gradient
                  }`}>
                    <TabIcon className={`w-6 h-6 ${activeTab === tab.id ? 'text-white' : 'text-white'}`} />
                  </div>
                  <span className={`text-sm font-bold text-center leading-tight ${
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
                {activeTab === 'create' && 'Nhập chủ đề để AI tạo nội dung hoàn chỉnh'}
                {activeTab === 'ideas' && 'Nhập chủ đề để AI gợi ý các ý tưởng nội dung sáng tạo'}
                {activeTab === 'summarize' && 'Nhập văn bản dài để AI tóm tắt ngắn gọn'}
                {activeTab === 'translate' && 'Nhập văn bản để AI dịch sang ngôn ngữ khác'}
                {activeTab === 'analyze' && 'Nhập dữ liệu để AI phân tích và đưa ra insight'}
                {activeTab === 'tag' && 'Nhập tài liệu để AI tự động phân loại và gắn thẻ'}
                {activeTab === 'music' && 'Mô tả chủ đề hoặc cảm xúc để AI sáng tác lời bài hát'}
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

          {activeTab === 'music' && (
            <div className="space-y-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">🎵 Thể loại nhạc:</label>
                  <Select value={musicStyle} onValueChange={setMusicStyle}>
                    <SelectTrigger className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pop">Pop - Nhạc Pop</SelectItem>
                      <SelectItem value="rock">Rock - Nhạc Rock</SelectItem>
                      <SelectItem value="ballad">Ballad - Nhạc Ballad</SelectItem>
                      <SelectItem value="rap">Rap/Hip-Hop</SelectItem>
                      <SelectItem value="edm">EDM - Electronic Dance</SelectItem>
                      <SelectItem value="jazz">Jazz - Nhạc Jazz</SelectItem>
                      <SelectItem value="blues">Blues - Nhạc Blues</SelectItem>
                      <SelectItem value="country">Country - Nhạc Đồng Quê</SelectItem>
                      <SelectItem value="folk">Folk - Nhạc Dân Gian</SelectItem>
                      <SelectItem value="soul">Soul/R&B</SelectItem>
                      <SelectItem value="classical">Classical - Cổ Điển</SelectItem>
                      <SelectItem value="indie">Indie - Độc Lập</SelectItem>
                      <SelectItem value="acoustic">Acoustic - Nguyên Âm</SelectItem>
                      <SelectItem value="spiritual">Spiritual - Tâm Linh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-slate-900 text-sm font-semibold mb-2 block">💫 Tâm trạng:</label>
                  <Select value={musicMood} onValueChange={setMusicMood}>
                    <SelectTrigger className="bg-white border-2 border-purple-300 text-slate-900 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="happy">😊 Vui vẻ, tươi sáng</SelectItem>
                      <SelectItem value="sad">😢 Buồn, u sầu</SelectItem>
                      <SelectItem value="romantic">💕 Lãng mạn, ngọt ngào</SelectItem>
                      <SelectItem value="energetic">⚡ Mạnh mẽ, năng động</SelectItem>
                      <SelectItem value="peaceful">🕊️ Yên bình, thanh thản</SelectItem>
                      <SelectItem value="melancholic">🌧️ Sầu muộn, hoài niệm</SelectItem>
                      <SelectItem value="motivational">🔥 Động lực, truyền cảm hứng</SelectItem>
                      <SelectItem value="dreamy">✨ Mơ màng, mộng mơ</SelectItem>
                      <SelectItem value="angry">😠 Giận dữ, nổi loạn</SelectItem>
                      <SelectItem value="spiritual">🙏 Tâm linh, thiền định</SelectItem>
                      <SelectItem value="nostalgic">⏰ Hoài cổ, nhớ nhung</SelectItem>
                      <SelectItem value="hopeful">🌈 Hy vọng, lạc quan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-slate-900 font-bold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Tùy Chọn Nâng Cao (Tùy Chọn)
                </h4>
                
                <div>
                  <label className="text-slate-700 text-xs font-semibold mb-1.5 block">🎤 Ca sĩ/Ban nhạc muốn hướng tới:</label>
                  <input
                    type="text"
                    value={artistReference}
                    onChange={(e) => setArtistReference(e.target.value)}
                    placeholder="Ví dụ: Taylor Swift, The Beatles, BTS, Sơn Tùng M-TP..."
                    className="w-full bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-300 rounded-xl px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 text-xs font-semibold mb-1.5 block">🎧 Các bài hát tương tự:</label>
                  <input
                    type="text"
                    value={similarSongs}
                    onChange={(e) => setSimilarSongs(e.target.value)}
                    placeholder="Ví dụ: Shape of You, Bohemian Rhapsody, Lạc Trôi..."
                    className="w-full bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-300 rounded-xl px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-700 text-xs font-semibold mb-1.5 block">🎼 Mô tả giai điệu (nếu có):</label>
                  <Textarea
                    value={melodyDescription}
                    onChange={(e) => setMelodyDescription(e.target.value)}
                    placeholder="Ví dụ: Verse bắt đầu chậm với piano, Chorus nổi lên mạnh mẽ với guitar điện và drums, Bridge có solo guitar..."
                    className="min-h-[80px] bg-white border-2 border-purple-300 text-slate-900 placeholder:text-purple-300 rounded-xl text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeTab === 'create' ? 'Nhập chủ đề bạn muốn tạo nội dung...\n\nVí dụ:\n- Bài blog về lợi ích của thiền định\n- Bài viết giới thiệu sản phẩm công nghệ mới\n- Bài đăng mạng xã hội về du lịch\n- Email marketing cho khóa học online' :
              activeTab === 'ideas' ? 'Nhập chủ đề/từ khóa để AI gợi ý ý tưởng...\n\nVí dụ:\n- Phát triển bản thân\n- Marketing số\n- Sức khỏe tinh thần\n- Khởi nghiệp' :
              activeTab === 'summarize' ? 'Paste văn bản dài cần tóm tắt...' :
              activeTab === 'translate' ? 'Paste văn bản cần dịch...' :
              activeTab === 'analyze' ? 'Paste dữ liệu cần phân tích (text, số liệu, thống kê...)' :
              activeTab === 'tag' ? 'Paste nội dung tài liệu cần phân loại và gắn thẻ...' :
              'Nhập chủ đề, câu chuyện hoặc cảm xúc bạn muốn viết thành bài hát...\n\nVí dụ:\n- Một câu chuyện tình yêu buồn\n- Về hành trình tìm kiếm ánh sáng nội tâm\n- Về sự thay đổi của cuộc sống\n- Bài hát động viên vượt qua khó khăn'
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
                {activeTab === 'create' && 'Tạo Nội Dung Ngay'}
                {activeTab === 'ideas' && 'Gợi Ý Ý Tưởng Ngay'}
                {activeTab === 'summarize' && 'Tóm Tắt Ngay'}
                {activeTab === 'translate' && 'Dịch Ngay'}
                {activeTab === 'analyze' && 'Phân Tích Ngay'}
                {activeTab === 'tag' && 'Phân Loại Ngay'}
                {activeTab === 'music' && 'Sáng Tác Ngay 🎵'}
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

              {activeTab === 'music' && musicMessages.length > 0 && (
                <div className="mt-6 bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Music className="w-5 h-5 text-rose-600" />
                    <h4 className="text-slate-900 font-bold">💬 Chỉnh Sửa & Tinh Chỉnh Lời Bài Hát</h4>
                  </div>
                  
                  <div className="max-h-[300px] overflow-y-auto mb-4 space-y-3 bg-white/50 rounded-xl p-3">
                    {musicMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl ${
                          msg.role === 'user'
                            ? 'bg-white border-2 border-rose-300 ml-8'
                            : 'bg-rose-100 border-2 border-rose-200 mr-8'
                        }`}
                      >
                        <p className="text-xs font-semibold text-rose-700 mb-1">
                          {msg.role === 'user' ? '👤 Bạn' : '🎵 AI Nhạc Sĩ'}
                        </p>
                        <p className="text-slate-900 text-sm whitespace-pre-wrap">
                          {msg.content.length > 200 && msg.role === 'user'
                            ? msg.content
                            : msg.role === 'user'
                            ? msg.content
                            : msg.content.substring(0, 200) + '... (xem kết quả đầy đủ ở trên)'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleMusicChat()}
                      placeholder="Ví dụ: Làm đoạn Chorus thêm catchy hơn, Thay đổi verse 2..."
                      className="flex-1 bg-white border-2 border-rose-300 text-slate-900 placeholder:text-rose-400 rounded-xl px-4 py-2 focus:border-rose-500 focus:ring-rose-500 outline-none font-medium"
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleMusicChat}
                      disabled={!chatInput.trim() || isLoading}
                      className="bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}