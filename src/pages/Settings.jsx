import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings as SettingsIcon, Save, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [preferences, setPreferences] = useState({
    response_style: 'friendly',
    tone: 'gentle',
    topics_of_interest: [],
    personal_notes: ''
  });
  const [newTopic, setNewTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: userPrefs, isLoading } = useQuery({
    queryKey: ['user-preferences', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const prefs = await base44.entities.UserPreferences.filter({ created_by: currentUser.email });
      return prefs[0] || null;
    },
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (userPrefs) {
      setPreferences({
        response_style: userPrefs.response_style || 'friendly',
        tone: userPrefs.tone || 'gentle',
        topics_of_interest: userPrefs.topics_of_interest || [],
        personal_notes: userPrefs.personal_notes || ''
      });
    }
  }, [userPrefs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      if (userPrefs) {
        await base44.entities.UserPreferences.update(userPrefs.id, preferences);
      } else {
        await base44.entities.UserPreferences.create(preferences);
      }
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    }
  });

  const addTopic = () => {
    if (newTopic.trim()) {
      setPreferences({
        ...preferences,
        topics_of_interest: [...preferences.topics_of_interest, newTopic.trim()]
      });
      setNewTopic('');
    }
  };

  const removeTopic = (index) => {
    setPreferences({
      ...preferences,
      topics_of_interest: preferences.topics_of_interest.filter((_, i) => i !== index)
    });
  };

  const styleOptions = [
    { value: 'formal', label: 'Trang Trọng', desc: 'Chuyên nghiệp, trang trọng' },
    { value: 'friendly', label: 'Thân Thiện', desc: 'Gần gũi, ấm áp' },
    { value: 'concise', label: 'Ngắn Gọn', desc: 'Súc tích, đi thẳng vào vấn đề' },
    { value: 'detailed', label: 'Chi Tiết', desc: 'Giải thích sâu, đầy đủ' },
  ];

  const toneOptions = [
    { value: 'gentle', label: 'Nhẹ Nhàng', desc: 'Dịu dàng, êm ái' },
    { value: 'energetic', label: 'Năng Động', desc: 'Tràn đầy năng lượng' },
    { value: 'peaceful', label: 'Bình An', desc: 'Yên tĩnh, thanh thản' },
    { value: 'motivational', label: 'Động Viên', desc: 'Khích lệ, truyền cảm hứng' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-purple-950 relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/50 via-purple-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-purple-300 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(139,92,246,0.4)',
                  '0 0 40px rgba(139,92,246,0.6)',
                  '0 0 20px rgba(139,92,246,0.4)',
                ]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-400 flex items-center justify-center"
            >
              <SettingsIcon className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-white font-light tracking-wide">Cài Đặt AI</h1>
              <p className="text-purple-400/60 text-xs">Cá nhân hóa trải nghiệm</p>
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={isSaving}
            className="bg-gradient-to-r from-violet-400 to-purple-400 text-white rounded-full hover:shadow-lg hover:shadow-violet-500/30"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang Lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Lưu Cài Đặt
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-24 pb-20 px-4 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-purple-400 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Response Style */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-white text-lg font-light mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Phong Cách Trả Lời
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {styleOptions.map((option) => (
                  <motion.div
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPreferences({ ...preferences, response_style: option.value })}
                    className={`p-4 rounded-2xl cursor-pointer transition-all ${
                      preferences.response_style === option.value
                        ? 'bg-violet-500/20 border-2 border-violet-400/50'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-white font-light mb-1">{option.label}</p>
                    <p className="text-purple-300/60 text-xs">{option.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Tone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-white text-lg font-light mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Giọng Điệu
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {toneOptions.map((option) => (
                  <motion.div
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPreferences({ ...preferences, tone: option.value })}
                    className={`p-4 rounded-2xl cursor-pointer transition-all ${
                      preferences.tone === option.value
                        ? 'bg-purple-500/20 border-2 border-purple-400/50'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-white font-light mb-1">{option.label}</p>
                    <p className="text-purple-300/60 text-xs">{option.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Topics of Interest */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-white text-lg font-light mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Chủ Đề Quan Tâm
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                  placeholder="Thêm chủ đề (ví dụ: Thiền, Chữa lành, Tài chính...)"
                  className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-purple-300/40 rounded-xl px-4 py-2 focus:border-amber-400/30 focus:ring-amber-400/20 outline-none"
                />
                <Button
                  onClick={addTopic}
                  className="bg-gradient-to-r from-amber-400 to-rose-400 text-white rounded-xl"
                >
                  Thêm
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {preferences.topics_of_interest.map((topic, idx) => (
                  <Badge
                    key={idx}
                    className="bg-amber-500/20 text-amber-200 border-amber-400/30 cursor-pointer hover:bg-amber-500/30"
                    onClick={() => removeTopic(idx)}
                  >
                    {topic} ×
                  </Badge>
                ))}
                {preferences.topics_of_interest.length === 0 && (
                  <p className="text-purple-300/50 text-sm">Chưa có chủ đề nào</p>
                )}
              </div>
            </motion.div>

            {/* Personal Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6"
            >
              <h3 className="text-white text-lg font-light mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-400" />
                Ghi Chú Cá Nhân
              </h3>
              <Textarea
                value={preferences.personal_notes}
                onChange={(e) => setPreferences({ ...preferences, personal_notes: e.target.value })}
                placeholder="Chia sẻ về bản thân để AI hiểu bạn hơn...&#10;&#10;Ví dụ:&#10;• Tôi đang trên hành trình chữa lành nội tâm&#10;• Tôi quan tâm đến phát triển bản thân và tâm linh&#10;• Tôi muốn học cách kết nối với năng lượng vũ trụ"
                className="min-h-[150px] bg-white/5 border-white/10 text-white placeholder:text-purple-300/40 rounded-2xl focus:border-rose-400/30 focus:ring-rose-400/20 font-light leading-relaxed resize-none"
              />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}