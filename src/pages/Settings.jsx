import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings as SettingsIcon, Save, Sparkles, Loader2, LogOut, Camera, User } from 'lucide-react';
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
    response_style: ['friendly'],
    tone: ['gentle'],
    communication_style: ['親密'],
    topics_of_interest: [],
    personal_notes: '',
    learning_preferences: {
      prefer_examples: true,
      prefer_metaphors: true,
      prefer_step_by_step: true
    }
  });
  const [personalInfo, setPersonalInfo] = useState({
    full_name: '',
    email: '',
    web3_wallet: ''
  });
  const [newTopic, setNewTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user) {
        setPersonalInfo({
          full_name: user.full_name || '',
          email: user.email || '',
          web3_wallet: user.web3_wallet || ''
        });
      }
    }).catch(() => setCurrentUser(null));
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
        response_style: Array.isArray(userPrefs.response_style) ? userPrefs.response_style : [userPrefs.response_style || 'friendly'],
        tone: Array.isArray(userPrefs.tone) ? userPrefs.tone : [userPrefs.tone || 'gentle'],
        communication_style: Array.isArray(userPrefs.communication_style) ? userPrefs.communication_style : [userPrefs.communication_style || '親密'],
        topics_of_interest: userPrefs.topics_of_interest || [],
        personal_notes: userPrefs.personal_notes || '',
        learning_preferences: userPrefs.learning_preferences || {
          prefer_examples: true,
          prefer_metaphors: true,
          prefer_step_by_step: true
        }
      });
    }
  }, [userPrefs]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh!');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa 5MB!');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      
      // Refresh user data
      const updatedUser = await base44.auth.me();
      setCurrentUser(updatedUser);
    } catch (error) {
      alert('Lỗi khi upload ảnh. Vui lòng thử lại!');
    }
    setIsUploadingAvatar(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      
      // Save personal info
      await base44.auth.updateMe({
        full_name: personalInfo.full_name,
        web3_wallet: personalInfo.web3_wallet
      });
      
      // Save preferences
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

  const toggleStyle = (category, value) => {
    const currentArray = preferences[category];
    const isSelected = currentArray.includes(value);
    
    let newArray;
    if (isSelected) {
      // Remove if already selected
      newArray = currentArray.filter(v => v !== value);
    } else {
      // Add if not selected and less than 3
      if (currentArray.length < 3) {
        newArray = [...currentArray, value];
      } else {
        return; // Don't add if already 3 selected
      }
    }
    
    setPreferences({
      ...preferences,
      [category]: newArray
    });
  };

  const styleOptions = [
    { value: 'formal', label: 'Trang Trọng', desc: 'Chuyên nghiệp, trang trọng', icon: '🎩' },
    { value: 'friendly', label: 'Thân Thiện', desc: 'Gần gũi, ấm áp', icon: '😊' },
    { value: 'concise', label: 'Ngắn Gọn', desc: 'Súc tích, đi thẳng vào vấn đề', icon: '⚡' },
    { value: 'detailed', label: 'Chi Tiết', desc: 'Giải thích sâu, đầy đủ', icon: '📚' },
    { value: 'humorous', label: 'Hài Hước', desc: 'Vui vẻ, hóm hỉnh', icon: '😄' },
    { value: 'poetic', label: 'Thơ Mộng', desc: 'Văn chương, giàu cảm xúc', icon: '🌸' },
  ];

  const toneOptions = [
    { value: 'gentle', label: 'Nhẹ Nhàng', desc: 'Dịu dàng, êm ái', icon: '🕊️' },
    { value: 'energetic', label: 'Năng Động', desc: 'Tràn đầy năng lượng', icon: '⚡' },
    { value: 'peaceful', label: 'Bình An', desc: 'Yên tĩnh, thanh thản', icon: '🧘' },
    { value: 'motivational', label: 'Động Viên', desc: 'Khích lệ, truyền cảm hứng', icon: '💪' },
    { value: 'warm', label: 'Trầm Ấm', desc: 'Ấm áp, sâu lắng', icon: '🔥' },
    { value: 'cheerful', label: 'Vui Tươi', desc: 'Rạng rỡ, tích cực', icon: '☀️' },
    { value: 'serious', label: 'Nghiêm Túc', desc: 'Đáng tin cậy, chuyên sâu', icon: '🎯' },
    { value: 'compassionate', label: 'Từ Bi', desc: 'Thấu hiểu, đồng cảm', icon: '💖' },
  ];

  const communicationOptions = [
    { value: '親切', label: 'Thân Thiết', desc: 'Như bạn thân tâm giao', icon: '🤝' },
    { value: '親密', label: 'Gần Gũi', desc: 'Như người thân trong gia đình', icon: '❤️' },
    { value: '專業', label: 'Chuyên Nghiệp', desc: 'Như cố vấn tin cậy', icon: '💼' },
    { value: '活潑', label: 'Sôi Nổi', desc: 'Như người bạn năng động', icon: '🎉' },
    { value: '溫柔', label: 'Dịu Dàng', desc: 'Như người mẹ hiền', icon: '🌺' },
    { value: '智慧', label: 'Trí Tuệ', desc: 'Như bậc thầy dẫn đường', icon: '🧙' },
  ];

  return (
    <div className="min-h-screen bg-white relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-r from-violet-500 to-purple-600 shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <motion.div
              animate={{ 
                rotate: [0, 360]
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <SettingsIcon className="w-5 h-5 text-white" />
            </motion.div>
            <div className="text-center">
              <h1 className="text-white text-xl font-bold tracking-wide">Cài Đặt AI</h1>
              <p className="text-white/90 text-sm font-semibold">Cá nhân hóa trải nghiệm</p>
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
      <div className="pt-20 pb-40 px-4 max-w-4xl mx-auto">
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
              {/* Avatar Upload */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
              >
                <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-purple-600" />
                  Ảnh Đại Diện
                </h3>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    {currentUser?.avatar_url ? (
                      <img
                        src={currentUser.avatar_url}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover border-4 border-purple-300 shadow-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center border-4 border-purple-300 shadow-lg">
                        <User className="w-12 h-12 text-white" />
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-900 font-semibold mb-1">Tải Lên Ảnh Đại Diện</p>
                    <p className="text-slate-600 text-sm mb-3">
                      Chọn ảnh đại diện của bạn. Kích thước tối đa: 5MB
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      variant="outline"
                      className="border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl"
                    >
                      {isUploadingAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang Tải Lên...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          Chọn Ảnh
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Personal Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-3xl p-6 shadow-lg"
              >
                <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Thông Tin Cá Nhân
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-700 text-sm font-semibold mb-2 block">Họ và Tên</label>
                    <input
                      type="text"
                      value={personalInfo.full_name}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, full_name: e.target.value })}
                      placeholder="Nhập họ và tên của bạn..."
                      className="w-full bg-white border-2 border-indigo-300 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-indigo-500 outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 text-sm font-semibold mb-2 block">Email</label>
                    <input
                      type="email"
                      value={personalInfo.email}
                      disabled
                      className="w-full bg-gray-100 border-2 border-gray-300 text-slate-600 rounded-xl px-4 py-2.5 font-medium cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email không thể thay đổi</p>
                  </div>

                  <div>
                    <label className="text-slate-700 text-sm font-semibold mb-2 block">Ví Web3</label>
                    <input
                      type="text"
                      value={personalInfo.web3_wallet}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, web3_wallet: e.target.value })}
                      placeholder="0x... (Địa chỉ ví Ethereum/Polygon)"
                      className="w-full bg-white border-2 border-indigo-300 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-indigo-500 outline-none font-medium"
                    />
                    <p className="text-xs text-indigo-600 mt-1">Nhập địa chỉ ví để nhận Camlycoin và rewards</p>
                  </div>
                </div>
              </motion.div>

              {/* Communication Style */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-3xl p-6 shadow-lg"
              >
                <h3 className="text-slate-900 text-lg font-bold mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Phong Cách Giao Tiếp
                </h3>
                <p className="text-slate-600 text-sm mb-2">AI sẽ giao tiếp với bạn như...</p>
                <p className="text-indigo-600 text-xs font-semibold mb-4">
                  ✨ Chọn 1-3 phong cách ({preferences.communication_style.length}/3)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {communicationOptions.map((option) => {
                    const isSelected = preferences.communication_style.includes(option.value);
                    return (
                      <motion.div
                        key={option.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleStyle('communication_style', option.value)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-2 border-indigo-700 shadow-lg'
                            : 'bg-white border-2 border-indigo-200 hover:border-indigo-400'
                        } ${!isSelected && preferences.communication_style.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="text-2xl mb-2">{option.icon}</div>
                        <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                        <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-600'}`}>{option.desc}</p>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">✓</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Response Style */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-3xl p-6 shadow-lg"
              >
              <h3 className="text-slate-900 text-lg font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                Phong Cách Trả Lời
              </h3>
              <p className="text-violet-600 text-xs font-semibold mb-4">
                ✨ Chọn 1-3 phong cách ({preferences.response_style.length}/3)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {styleOptions.map((option) => {
                  const isSelected = preferences.response_style.includes(option.value);
                  return (
                    <motion.div
                      key={option.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleStyle('response_style', option.value)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-violet-600 border-2 border-violet-700 shadow-lg'
                          : 'bg-white border-2 border-violet-200 hover:border-violet-400'
                      } ${!isSelected && preferences.response_style.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-2xl mb-2">{option.icon}</div>
                      <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                      <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-600'}`}>{option.desc}</p>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              </motion.div>

            {/* Tone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-3xl p-6 shadow-lg"
            >
            <h3 className="text-slate-900 text-lg font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Giọng Điệu
            </h3>
            <p className="text-purple-600 text-xs font-semibold mb-4">
              ✨ Chọn 1-3 giọng điệu ({preferences.tone.length}/3)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {toneOptions.map((option) => {
                const isSelected = preferences.tone.includes(option.value);
                return (
                  <motion.div
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleStyle('tone', option.value)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-purple-600 border-2 border-purple-700 shadow-lg'
                        : 'bg-white border-2 border-purple-200 hover:border-purple-400'
                    } ${!isSelected && preferences.tone.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-2xl mb-2">{option.icon}</div>
                    <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>{option.label}</p>
                    <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-600'}`}>{option.desc}</p>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            </motion.div>

            {/* Learning Preferences */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-gradient-to-br from-cyan-50 to-teal-50 border-2 border-cyan-200 rounded-3xl p-6 shadow-lg"
            >
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                Sở Thích Học Tập
              </h3>
              <p className="text-slate-600 text-sm mb-4">AI sẽ điều chỉnh cách giải thích dựa trên sở thích của bạn</p>
              <div className="space-y-3">
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPreferences({
                    ...preferences,
                    learning_preferences: {
                      ...preferences.learning_preferences,
                      prefer_examples: !preferences.learning_preferences.prefer_examples
                    }
                  })}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    preferences.learning_preferences.prefer_examples
                      ? 'bg-cyan-600 border-2 border-cyan-700 shadow-lg'
                      : 'bg-white border-2 border-cyan-200 hover:border-cyan-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">💡</div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm mb-1 ${preferences.learning_preferences.prefer_examples ? 'text-white' : 'text-slate-900'}`}>
                        Ví dụ cụ thể
                      </p>
                      <p className={`text-xs ${preferences.learning_preferences.prefer_examples ? 'text-white/80' : 'text-slate-600'}`}>
                        Sử dụng ví dụ thực tế để minh họa
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPreferences({
                    ...preferences,
                    learning_preferences: {
                      ...preferences.learning_preferences,
                      prefer_metaphors: !preferences.learning_preferences.prefer_metaphors
                    }
                  })}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    preferences.learning_preferences.prefer_metaphors
                      ? 'bg-cyan-600 border-2 border-cyan-700 shadow-lg'
                      : 'bg-white border-2 border-cyan-200 hover:border-cyan-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🌊</div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm mb-1 ${preferences.learning_preferences.prefer_metaphors ? 'text-white' : 'text-slate-900'}`}>
                        Ẩn dụ & Hình ảnh
                      </p>
                      <p className={`text-xs ${preferences.learning_preferences.prefer_metaphors ? 'text-white/80' : 'text-slate-600'}`}>
                        Giải thích qua ẩn dụ thiên nhiên, đời sống
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPreferences({
                    ...preferences,
                    learning_preferences: {
                      ...preferences.learning_preferences,
                      prefer_step_by_step: !preferences.learning_preferences.prefer_step_by_step
                    }
                  })}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    preferences.learning_preferences.prefer_step_by_step
                      ? 'bg-cyan-600 border-2 border-cyan-700 shadow-lg'
                      : 'bg-white border-2 border-cyan-200 hover:border-cyan-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">📋</div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm mb-1 ${preferences.learning_preferences.prefer_step_by_step ? 'text-white' : 'text-slate-900'}`}>
                        Hướng dẫn từng bước
                      </p>
                      <p className={`text-xs ${preferences.learning_preferences.prefer_step_by_step ? 'text-white/80' : 'text-slate-600'}`}>
                        Chia nhỏ thành các bước rõ ràng
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Topics of Interest */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
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
              transition={{ delay: 0.4 }}
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

            {/* Logout Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 rounded-3xl p-6 shadow-lg"
            >
              <h3 className="text-slate-900 text-lg font-bold mb-4 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-600" />
                Đăng Xuất
              </h3>
              <p className="text-slate-700 text-sm mb-4">
                Đăng xuất khỏi tài khoản của bạn. Bạn có thể đăng nhập lại bất cứ lúc nào bằng Gmail, Facebook hoặc Google.
              </p>
              <Button
                onClick={() => base44.auth.logout()}
                variant="outline"
                className="w-full border-2 border-red-300 text-red-700 hover:bg-red-50 rounded-2xl font-bold py-6 text-base"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Đăng Xuất Tài Khoản
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}