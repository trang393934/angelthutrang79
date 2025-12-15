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
    <div className="min-h-screen bg-white relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-r from-violet-500 to-purple-600 shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <motion.div
              animate={{ 
                rotate: [0, 360]
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
            >
              <SettingsIcon className="w-5 h-5 text-white" />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-white text-lg lg:text-xl font-bold tracking-wide truncate">Cài Đặt AI</h1>
              <p className="text-white/90 text-xs lg:text-sm font-semibold truncate">Cá nhân hóa trải nghiệm</p>
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={isSaving}
            className="bg-white text-violet-600 rounded-full hover:bg-white/90 font-bold shadow-lg flex-shrink-0 text-xs lg:text-sm px-3 lg:px-4 h-9 lg:h-10"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 lg:mr-2 animate-spin" />
                <span className="hidden lg:inline">Đang Lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 lg:mr-2" />
                <span className="hidden lg:inline">Lưu Cài Đặt</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-28 px-4 max-w-4xl mx-auto">
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
              className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-3xl p-6 shadow-lg"
            >
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
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
                        ? 'bg-violet-600 border-2 border-violet-700 shadow-lg'
                        : 'bg-white border-2 border-violet-200 hover:border-violet-400'
                    }`}
                  >
                    <p className={`font-bold mb-1 ${preferences.response_style === option.value ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                    <p className={`text-xs ${preferences.response_style === option.value ? 'text-white/80' : 'text-slate-600'}`}>{option.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Tone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
            >
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
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
                        ? 'bg-purple-600 border-2 border-purple-700 shadow-lg'
                        : 'bg-white border-2 border-purple-200 hover:border-purple-400'
                    }`}
                  >
                    <p className={`font-bold mb-1 ${preferences.tone === option.value ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                    <p className={`text-xs ${preferences.tone === option.value ? 'text-white/80' : 'text-slate-600'}`}>{option.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Topics of Interest */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 shadow-lg"
            >
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                Chủ Đề Quan Tâm
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                  placeholder="Thêm chủ đề (ví dụ: Thiền, Chữa lành, Tài chính...)"
                  className="flex-1 bg-white border-2 border-amber-300 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 py-2 focus:border-amber-500 focus:ring-amber-500 outline-none font-medium"
                />
                <Button
                  onClick={addTopic}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600"
                >
                  Thêm
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {preferences.topics_of_interest.map((topic, idx) => (
                  <Badge
                    key={idx}
                    className="bg-amber-200 text-amber-900 border-2 border-amber-400 cursor-pointer hover:bg-amber-300 font-bold"
                    onClick={() => removeTopic(idx)}
                  >
                    {topic} ×
                  </Badge>
                ))}
                {preferences.topics_of_interest.length === 0 && (
                  <p className="text-slate-500 text-sm font-medium">Chưa có chủ đề nào</p>
                )}
              </div>
            </motion.div>

            {/* Personal Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 rounded-3xl p-6 shadow-lg"
            >
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-600" />
                Ghi Chú Cá Nhân
              </h3>
              <Textarea
                value={preferences.personal_notes}
                onChange={(e) => setPreferences({ ...preferences, personal_notes: e.target.value })}
                placeholder="Chia sẻ về bản thân để AI hiểu bạn hơn...&#10;&#10;Ví dụ:&#10;• Tôi đang trên hành trình chữa lành nội tâm&#10;• Tôi quan tâm đến phát triển bản thân và tâm linh&#10;• Tôi muốn học cách kết nối với năng lượng vũ trụ"
                className="min-h-[150px] bg-white border-2 border-rose-300 text-slate-900 placeholder:text-slate-400 rounded-2xl focus:border-rose-500 focus:ring-rose-500 font-medium leading-relaxed resize-none"
              />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}