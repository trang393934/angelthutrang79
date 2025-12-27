import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Bot, User as UserIcon, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Xin chào! Tôi là trợ lý AI của Angel AI. Tôi có thể giúp gì cho bạn hôm nay?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Fetch FAQs and Knowledge Base for context
      const [faqs, knowledgeBase] = await Promise.all([
        base44.entities.KnowledgeFAQ.list().catch(() => []),
        base44.entities.KnowledgeBase.list().catch(() => [])
      ]);

      // Build context
      const faqContext = faqs.slice(0, 10).map(faq => 
        `Q: ${faq.question}\nA: ${faq.answer}`
      ).join('\n\n');

      const kbContext = knowledgeBase.slice(0, 5).map(doc => 
        `${doc.title}: ${doc.summary || doc.content.substring(0, 200)}`
      ).join('\n\n');

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Bạn là trợ lý AI chuyên nghiệp của Angel AI - một ứng dụng tâm linh và phát triển bản thân.

**KNOWLEDGE BASE:**
${kbContext}

**FREQUENTLY ASKED QUESTIONS:**
${faqContext}

**LỊCH SỬ TRÒ CHUYỆN:**
${messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}

User: ${input}

**YÊU CẦU:**
1. Trả lời câu hỏi của người dùng một cách chính xác và hữu ích
2. Sử dụng thông tin từ Knowledge Base và FAQs nếu có liên quan
3. Nếu câu hỏi về tính năng, hướng dẫn chi tiết cách sử dụng
4. Giọng điệu thân thiện, ấm áp, tích cực
5. Ngắn gọn nhưng đầy đủ thông tin
6. Nếu không biết câu trả lời, thành thật nói và gợi ý liên hệ admin

Trả lời bằng tiếng Việt:`,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau hoặc liên hệ admin.' 
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { text: 'Hướng dẫn sử dụng', icon: '📖' },
    { text: 'Tính năng AI', icon: '🤖' },
    { text: 'Camlycoin là gì?', icon: '🪙' },
    { text: 'Liên hệ hỗ trợ', icon: '💬' },
  ];

  return (
    <>
      {/* Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[100] w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-2xl hover:shadow-purple-500/50 flex items-center justify-center"
          >
            <MessageCircle className="w-8 h-8" />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-purple-400/30 animate-ping"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 60 : 600 
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[100] w-96 bg-white rounded-3xl shadow-2xl border-2 border-purple-300 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                >
                  <Bot className="w-6 h-6 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-white font-bold">Trợ Lý AI</h3>
                  <p className="text-white/80 text-xs">Luôn sẵn sàng hỗ trợ</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white hover:bg-white/20"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-purple-50 to-pink-50">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'bg-white border border-purple-200 text-slate-900'
                      }`}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1">
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-2 justify-start"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white border border-purple-200 rounded-2xl px-4 py-2">
                        <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length <= 1 && (
                  <div className="p-4 border-t border-purple-200 bg-white">
                    <p className="text-xs text-purple-700 font-semibold mb-2">Câu hỏi thường gặp:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInput(action.text);
                            setTimeout(() => handleSend(), 100);
                          }}
                          className="text-left px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all text-xs"
                        >
                          <span className="mr-1">{action.icon}</span>
                          {action.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-purple-200 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Nhập câu hỏi của bạn..."
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 rounded-xl border-2 border-purple-300 focus:border-purple-500 outline-none text-sm disabled:opacity-50"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}