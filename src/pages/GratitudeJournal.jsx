import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ArrowLeft, Mic, MicOff, Send, Sparkles, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function GratitudeJournal() {
  const [activeTab, setActiveTab] = useState('gratitude'); // 'gratitude' or 'repentance'
  const [gratitudes, setGratitudes] = useState(Array(20).fill(''));
  const [repentances, setRepentances] = useState(Array(20).fill(''));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [usedSuggestions, setUsedSuggestions] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));

    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'vi-VN';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (activeTab === 'gratitude') {
          const newGratitudes = [...gratitudes];
          newGratitudes[currentIndex] = transcript;
          setGratitudes(newGratitudes);
        } else {
          const newRepentances = [...repentances];
          newRepentances[currentIndex] = transcript;
          setRepentances(newRepentances);
        }
        setIsListening(false);
        
        // Auto move to next if not last
        if (currentIndex < 19) {
          setCurrentIndex(currentIndex + 1);
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // Generate AI suggestions based on today's chat
  const generateSuggestions = async () => {
    if (!currentUser) return;

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const conversations = await base44.entities.Conversation.filter({ 
        created_by: currentUser.email 
      }, '-created_date', 5);

      const recentChats = conversations
        .filter(c => new Date(c.created_date) >= todayStart)
        .map(c => c.messages?.map(m => m.content).join(' '))
        .join(' ')
        .substring(0, 1000);

      const promptText = activeTab === 'gratitude' 
        ? `Dựa trên cuộc trò chuyện hôm nay của user với Angel AI:
"${recentChats}"

Gợi ý 3-5 điều biết ơn ngắn gọn (10-15 từ mỗi điều) mà user có thể thêm vào Gratitude Journal.

Ví dụ:
- Con biết ơn vì đã được chat với Cha Vũ Trụ hôm nay
- Con biết ơn vì được học hỏi trí tuệ từ Angel AI
- Con biết ơn vì [điều gì đó từ cuộc trò chuyện]

Trả về JSON:
{
  "suggestions": ["điều 1", "điều 2", "điều 3"]
}`
        : `Dựa trên cuộc trò chuyện hôm nay của user với Angel AI:
"${recentChats}"

Gợi ý 3-5 điều sám hối ngắn gọn (10-15 từ mỗi điều) mà user có thể thêm vào.

Ví dụ:
- Con xin sám hối vì đã có lúc thiếu kiên nhẫn với người khác
- Con xin sám hối vì đã để tâm trí bị xao lãng bởi lo âu
- Con xin sám hối vì [điều gì đó cần sám hối]

Trả về JSON:
{
  "suggestions": ["điều 1", "điều 2", "điều 3"]
}`;

      const suggestionsResult = await base44.integrations.Core.InvokeLLM({
        prompt: promptText,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: { type: "array", items: { type: "string" } }
          }
        }
      });

      setSuggestions(suggestionsResult.suggestions || []);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      generateSuggestions();
      setUsedSuggestions(false);
    }
  }, [currentUser, activeTab]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleTextChange = (index, value) => {
    if (activeTab === 'gratitude') {
      const newGratitudes = [...gratitudes];
      newGratitudes[index] = value;
      setGratitudes(newGratitudes);
    } else {
      const newRepentances = [...repentances];
      newRepentances[index] = value;
      setRepentances(newRepentances);
    }
  };

  const applySuggestion = (suggestion) => {
    if (activeTab === 'gratitude') {
      const newGratitudes = [...gratitudes];
      newGratitudes[currentIndex] = suggestion;
      setGratitudes(newGratitudes);
    } else {
      const newRepentances = [...repentances];
      newRepentances[currentIndex] = suggestion;
      setRepentances(newRepentances);
    }
    
    setUsedSuggestions(true);
    
    // Auto move to next
    if (currentIndex < 19) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;

    const currentList = activeTab === 'gratitude' ? gratitudes : repentances;
    const filledItems = currentList.filter(g => g.trim());
    
    if (filledItems.length < 20) {
      alert(`Hãy điền đủ 20 điều ${activeTab === 'gratitude' ? 'biết ơn' : 'sám hối'} nhé con! 💛`);
      return;
    }

    setIsSaving(true);

    try {
      const itemsText = currentList.filter(g => g.trim()).map((g, i) => `${i + 1}. ${g}`).join('\n');
      const isGratitude = activeTab === 'gratitude';
      const rewardAmount = usedSuggestions ? 30000 : 50000;

      // AI summarize and tag
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Tóm tắt và phân tích 20 điều ${isGratitude ? 'biết ơn' : 'sám hối'} sau:

${itemsText}

Trả về JSON:
{
  "summary": "Tóm tắt ngắn gọn (2-3 câu)",
  "tags": ["tag1", "tag2", "tag3"],
  "daily_message": "Lời chúc từ Cha Vũ Trụ dựa trên những điều ${isGratitude ? 'biết ơn' : 'sám hối'} này (3-4 câu)"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            daily_message: { type: "string" }
          }
        }
      });

      // Save to Library
      await base44.entities.LightMessage.create({
        content: `${isGratitude ? '📿 **Gratitude Journal**' : '🙏 **Repentance Journal**'} - ${new Date().toLocaleDateString('vi-VN')}\n\n${itemsText}\n\n**Tóm tắt:** ${analysis.summary}`,
        type: 'daily_message',
        summary: analysis.summary,
        tags: [isGratitude ? 'gratitude' : 'repentance', ...analysis.tags],
        is_favorite: false
      });

      // Save blessing message
      await base44.entities.LightMessage.create({
        content: `🌅 **${isGratitude ? 'Gratitude' : 'Repentance'} Blessing - ${new Date().toLocaleDateString('vi-VN')}**\n\n${analysis.daily_message}\n\n💫 Cha tiếp tục ban phước cho con!`,
        type: 'daily_message',
        summary: `Blessing based on ${isGratitude ? 'gratitude' : 'repentance'}`,
        tags: ['blessing', isGratitude ? 'gratitude' : 'repentance'],
        is_favorite: false
      });

      // Award Camlycoin
      await base44.entities.CamlycoinTransaction.create({
        user_email: currentUser.email,
        amount: rewardAmount,
        type: 'manual_add',
        description: `${isGratitude ? '📿 Gratitude' : '🙏 Repentance'} Journal hoàn thành!\n✨ +${rewardAmount === 50000 ? '20' : '12'} điểm Ánh Sáng\n${usedSuggestions ? '(Dùng gợi ý AI)' : '(Tự viết)'}`
      });

      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: currentUser.email });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.entities.CamlycoinBalance.update(balance.id, {
          balance: (balance.balance || 0) + rewardAmount,
          total_earned: (balance.total_earned || 0) + rewardAmount
        });
      } else {
        await base44.entities.CamlycoinBalance.create({
          user_email: currentUser.email,
          balance: rewardAmount,
          total_earned: rewardAmount,
          total_spent: 0
        });
      }

      setShowSuccess(true);
      setIsSaving(false);

      // Reset after 3 seconds
      setTimeout(() => {
        if (isGratitude) {
          setGratitudes(Array(20).fill(''));
        } else {
          setRepentances(Array(20).fill(''));
        }
        setCurrentIndex(0);
        setShowSuccess(false);
        setUsedSuggestions(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving journal:', error);
      setIsSaving(false);
      alert('Có lỗi xảy ra. Vui lòng thử lại!');
    }
  };

  const currentList = activeTab === 'gratitude' ? gratitudes : repentances;
  const filledCount = currentList.filter(g => g.trim()).length;
  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 20 || currentHour < 6;
  const rewardAmount = usedSuggestions ? 30000 : 50000;

  // Generate stars
  const stars = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 3,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Starry Night Background */}
      <div className="fixed inset-0 pointer-events-none">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-yellow-200"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-indigo-900/80 backdrop-blur-xl border-b border-yellow-400/30 shadow-2xl">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-yellow-300 hover:text-yellow-100 hover:bg-yellow-400/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(251,191,36,0.4)',
                    '0 0 40px rgba(251,191,36,0.6)',
                    '0 0 20px rgba(251,191,36,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center"
              >
                <Heart className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-yellow-100 font-bold tracking-wide text-base lg:text-lg">
                  {activeTab === 'gratitude' ? 'Gratitude Journal' : 'Repentance Journal'}
                </h1>
                <p className="text-yellow-300/80 text-xs">
                  {activeTab === 'gratitude' ? 'Nhật Ký Biết Ơn' : 'Nhật Ký Sám Hối'}
                </p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gradient-to-br from-yellow-300 to-amber-400 rounded-3xl p-8 text-center shadow-2xl max-w-md mx-4"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="w-12 h-12 text-white" />
              </motion.div>
              <h2 className="text-white text-2xl font-bold mb-2">Tuyệt Vời! 🎉</h2>
              <p className="text-white/90 text-lg mb-4">Đã lưu 10 điều biết ơn của con!</p>
              <p className="text-white font-bold text-xl">+50,000 Camlycoin 🪙</p>
              <p className="text-white/80 text-sm mt-2">+10 điểm Ánh Sáng ✨</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="pt-24 pb-32 px-4 max-w-2xl mx-auto relative z-10">
        {!isNightTime ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-yellow-400/20 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10 text-yellow-300/40" />
            </div>
            <h3 className="text-yellow-100 text-xl font-bold mb-2">Chưa Đến Giờ Nhật Ký</h3>
            <p className="text-yellow-300/80 mb-4">
              Gratitude Journal mở sau 20:00 mỗi tối 🌙
            </p>
            <p className="text-yellow-400/60 text-sm">
              Hiện tại: {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </motion.div>
        ) : (
          <>
            {/* Intro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-yellow-100 text-2xl font-bold mb-3">
                Cha Mời Con Chia Sẻ 💛
              </h2>
              
              {/* Tabs */}
              <div className="flex gap-2 bg-indigo-800/50 p-1 rounded-2xl mb-4 max-w-md mx-auto">
                <button
                  onClick={() => {
                    setActiveTab('gratitude');
                    setCurrentIndex(0);
                    setSuggestions([]);
                  }}
                  className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-all ${
                    activeTab === 'gratitude'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-indigo-900 shadow-lg'
                      : 'text-yellow-300 hover:bg-indigo-700/50'
                  }`}
                >
                  📿 Biết Ơn
                </button>
                <button
                  onClick={() => {
                    setActiveTab('repentance');
                    setCurrentIndex(0);
                    setSuggestions([]);
                  }}
                  className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition-all ${
                    activeTab === 'repentance'
                      ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-lg'
                      : 'text-yellow-300 hover:bg-indigo-700/50'
                  }`}
                >
                  🙏 Sám Hối
                </button>
              </div>

              <p className="text-yellow-300/90 text-lg mb-2">
                20 Điều {activeTab === 'gratitude' ? 'Biết Ơn' : 'Sám Hối'} Hôm Nay
              </p>
              <p className="text-yellow-400/70 text-sm">
                {filledCount}/20 điều đã điền
              </p>
            </motion.div>

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <p className="text-yellow-200 text-sm font-semibold">Gợi ý từ AI:</p>
                </div>
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => applySuggestion(suggestion)}
                      className="w-full text-left bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 rounded-xl px-4 py-2 text-yellow-100 text-sm transition-all"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Gratitude Inputs */}
            <div className="space-y-4">
              {gratitudes.map((gratitude, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative ${currentIndex === index ? 'ring-2 ring-yellow-400' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0 mt-2">
                      <span className="text-yellow-300 font-bold text-sm">{index + 1}</span>
                    </div>
                    <Textarea
                      value={gratitude}
                      onChange={(e) => handleTextChange(index, e.target.value)}
                      onFocus={() => setCurrentIndex(index)}
                      placeholder={`Điều biết ơn thứ ${index + 1}...`}
                      className="flex-1 bg-white/5 border-2 border-yellow-400/30 text-yellow-100 placeholder:text-yellow-400/40 rounded-xl min-h-[80px] focus:border-yellow-400 focus:ring-yellow-400/20 backdrop-blur-sm"
                    />
                    {currentIndex === index && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={isListening ? stopListening : startListening}
                        className={`mt-2 ${
                          isListening
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/30'
                        }`}
                      >
                        {isListening ? (
                          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                            <Mic className="w-4 h-4" />
                          </motion.div>
                        ) : (
                          <MicOff className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <Button
                onClick={handleSubmit}
                disabled={filledCount < 10 || isSaving}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-indigo-900 rounded-full py-6 text-lg font-bold shadow-2xl hover:shadow-yellow-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Đang Lưu...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Gửi Lên Cha Vũ Trụ
                  </>
                )}
              </Button>
              {filledCount < 10 && (
                <p className="text-center text-yellow-400/60 text-sm mt-3">
                  Còn {10 - filledCount} điều biết ơn nữa nhé con 💛
                </p>
              )}
              {filledCount === 10 && (
                <p className="text-center text-yellow-300 text-sm mt-3 font-semibold">
                  ✨ Nhận +50,000 Camlycoin khi gửi!
                </p>
              )}
            </motion.div>
          </>
        )}
      </div>

      {/* Note about Push Notifications */}
      <div className="fixed bottom-4 left-4 right-4 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-3 backdrop-blur-sm"
        >
          <p className="text-yellow-300/80 text-xs text-center">
            💡 Push notification mỗi tối 20:00 sẽ hoạt động khi admin bật Backend Functions
          </p>
        </motion.div>
      </div>
    </div>
  );
}