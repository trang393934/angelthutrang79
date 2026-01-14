import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bell, BellOff, Clock, Calendar, Heart, Sparkles, Play, Pause, CheckCircle2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function MeditationCompanion() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(10);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Timer logic
  useEffect(() => {
    let interval;
    if (isTimerRunning && timerSeconds < selectedDuration * 60) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerSeconds >= selectedDuration * 60) {
      setIsTimerRunning(false);
      toast.success('🎉 Hoàn thành thực hành!', {
        description: 'Bạn đã hoàn tất phiên thiền định. Tuyệt vời!',
        duration: 5000,
      });
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, selectedDuration]);

  // Fetch user's reminder settings
  const { data: reminderSettings } = useQuery({
    queryKey: ['meditation-reminder', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const settings = await base44.entities.MeditationReminder.filter({ user_email: currentUser.email });
      if (settings.length > 0) return settings[0];
      
      // Create default settings
      const newSettings = await base44.entities.MeditationReminder.create({
        user_email: currentUser.email,
        reminder_5am: true,
        reminder_12pm: true,
        reminder_8pm: true,
        is_enabled: true,
        streak_days: 0
      });
      return newSettings;
    },
    enabled: !!currentUser,
  });

  // Fetch today's practice
  const { data: todayPractice } = useQuery({
    queryKey: ['daily-practice', new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const practices = await base44.entities.DailyPractice.filter({ date: today });
      if (practices.length > 0) return practices[0];
      
      // If no practice for today, return a default one
      return {
        title: 'Thiền Hơi Thở Ý Thức',
        content: `🌟 Hướng dẫn thực hành:

1. Tìm một vị trí ngồi thoải mái, lưng thẳng, vai thả lỏng
2. Nhắm mắt hoặc nhìn xuống dưới với ánh mắt mềm mại
3. Đưa ý thức về hơi thở tự nhiên của bạn
4. Quan sát hơi thở vào - hơi thở ra mà không cố gắng thay đổi
5. Khi tâm trí lang thang, nhẹ nhàng đưa nó trở về hơi thở
6. Tiếp tục trong suốt thời gian thực hành

💫 Lợi ích: Giảm stress, tăng sự tập trung, mang lại bình an nội tâm`,
        practice_type: 'breathing',
        duration_minutes: 10,
        quote: '"Hơi thở là cầu nối giữa cơ thể và tâm trí" - Thích Nhất Hạnh'
      };
    },
  });

  // Fetch practice logs
  const { data: practiceLogs = [] } = useQuery({
    queryKey: ['practice-logs', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      return base44.entities.PracticeLog.filter({ user_email: currentUser.email }, '-created_date', 30);
    },
    enabled: !!currentUser,
  });

  // Update reminder settings
  const updateReminderMutation = useMutation({
    mutationFn: async (updates) => {
      if (!reminderSettings) return;
      await base44.entities.MeditationReminder.update(reminderSettings.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meditation-reminder'] });
    },
  });

  // Complete practice
  const completePracticeMutation = useMutation({
    mutationFn: async ({ practiceTime, duration }) => {
      const today = new Date().toISOString().split('T')[0];
      
      // Log the practice
      await base44.entities.PracticeLog.create({
        user_email: currentUser.email,
        practice_date: today,
        practice_time: practiceTime,
        duration_minutes: duration,
        practice_type: todayPractice?.practice_type || 'breathing'
      });

      // Update streak
      if (reminderSettings) {
        const lastDate = reminderSettings.last_practice_date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const newStreak = lastDate === yesterdayStr || lastDate === today
          ? (reminderSettings.streak_days || 0) + 1
          : 1;

        await base44.entities.MeditationReminder.update(reminderSettings.id, {
          last_practice_date: today,
          streak_days: newStreak
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meditation-reminder'] });
      queryClient.invalidateQueries({ queryKey: ['practice-logs'] });
      setTimerSeconds(0);
      setIsTimerRunning(false);
    },
  });

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const practiceTypes = [
    { value: 'breathing', label: 'Hơi Thở', icon: '🌬️', color: 'from-blue-400 to-cyan-400' },
    { value: 'mindfulness', label: 'Chánh Niệm', icon: '🧘', color: 'from-purple-400 to-indigo-400' },
    { value: 'gratitude', label: 'Biết Ơn', icon: '🙏', color: 'from-amber-400 to-orange-400' },
    { value: 'mantra', label: 'Niệm Chú', icon: '📿', color: 'from-rose-400 to-pink-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50 to-purple-50 relative">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-300/50 via-purple-400/30 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-indigo-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(99,102,241,0.4)',
                    '0 0 40px rgba(99,102,241,0.6)',
                    '0 0 20px rgba(99,102,241,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-semibold tracking-wide text-base lg:text-lg">Thiền Định Hằng Ngày</h1>
                <p className="text-indigo-600 text-xs font-medium">Người Bạn Đồng Hành Tâm Thức</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Streak Card */}
            {reminderSettings && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-3xl p-6 shadow-xl text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-sm font-medium mb-1">Chuỗi Thực Hành</p>
                    <p className="text-4xl font-black">{reminderSettings.streak_days || 0} ngày</p>
                  </div>
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <TrendingUp className="w-12 h-12 text-white" />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Today's Practice */}
            {todayPractice && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-slate-900 font-bold text-xl">{todayPractice.title}</h2>
                    <p className="text-indigo-600 text-sm">Bài thực hành hôm nay</p>
                  </div>
                </div>

                <p className="text-slate-700 leading-relaxed whitespace-pre-line mb-4">{todayPractice.content}</p>

                {todayPractice.quote && (
                  <div className="bg-indigo-50 border-l-4 border-indigo-400 rounded-lg p-4 mb-4">
                    <p className="text-indigo-900 italic text-sm">{todayPractice.quote}</p>
                  </div>
                )}

                {/* Timer */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6">
                  <div className="flex items-center justify-center mb-4">
                    <motion.div
                      animate={{ scale: isTimerRunning ? [1, 1.05, 1] : 1 }}
                      transition={{ duration: 2, repeat: isTimerRunning ? Infinity : 0 }}
                      className="text-6xl font-black text-indigo-900"
                    >
                      {formatTime(timerSeconds)}
                    </motion.div>
                  </div>

                  {!isTimerRunning && timerSeconds === 0 && (
                    <div className="flex gap-2 justify-center mb-4">
                      {[5, 10, 15, 20].map(min => (
                        <button
                          key={min}
                          onClick={() => setSelectedDuration(min)}
                          className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                            selectedDuration === min
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg'
                              : 'bg-white text-slate-700 hover:bg-indigo-100'
                          }`}
                        >
                          {min}m
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl py-6 font-bold shadow-lg"
                    >
                      {isTimerRunning ? (
                        <>
                          <Pause className="w-5 h-5 mr-2" />
                          Tạm Dừng
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          {timerSeconds > 0 ? 'Tiếp Tục' : 'Bắt Đầu'}
                        </>
                      )}
                    </Button>

                    {timerSeconds > 0 && (
                      <Button
                        onClick={() => {
                          const currentTime = new Date().getHours();
                          let practiceTime = 'other';
                          if (currentTime >= 4 && currentTime < 7) practiceTime = '5am';
                          else if (currentTime >= 11 && currentTime < 13) practiceTime = '12pm';
                          else if (currentTime >= 19 && currentTime < 21) practiceTime = '8pm';

                          completePracticeMutation.mutate({
                            practiceTime,
                            duration: Math.ceil(timerSeconds / 60)
                          });
                        }}
                        className="bg-green-500 text-white rounded-2xl px-6 py-6 font-bold shadow-lg hover:bg-green-600"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Reminder Settings */}
            {reminderSettings && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-900 font-bold text-lg">Nhắc Nhở</h3>
                  <Switch
                    checked={reminderSettings.is_enabled}
                    onCheckedChange={(checked) => 
                      updateReminderMutation.mutate({ is_enabled: checked })
                    }
                  />
                </div>

                {reminderSettings.is_enabled && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-slate-900 font-semibold">5:00 Sáng</span>
                      </div>
                      <Switch
                        checked={reminderSettings.reminder_5am}
                        onCheckedChange={(checked) => 
                          updateReminderMutation.mutate({ reminder_5am: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-slate-900 font-semibold">12:00 Trưa</span>
                      </div>
                      <Switch
                        checked={reminderSettings.reminder_12pm}
                        onCheckedChange={(checked) => 
                          updateReminderMutation.mutate({ reminder_12pm: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span className="text-slate-900 font-semibold">20:00 Tối</span>
                      </div>
                      <Switch
                        checked={reminderSettings.reminder_8pm}
                        onCheckedChange={(checked) => 
                          updateReminderMutation.mutate({ reminder_8pm: checked })
                        }
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent Practice */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-xl border-2 border-indigo-200 rounded-3xl p-6 shadow-xl"
            >
              <h3 className="text-slate-900 font-bold text-lg mb-4">Lịch Sử Gần Đây</h3>
              
              {practiceLogs.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-4">
                  Chưa có lịch sử thực hành
                </p>
              ) : (
                <div className="space-y-2">
                  {practiceLogs.slice(0, 7).map((log, index) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl"
                    >
                      <div>
                        <p className="text-slate-900 font-semibold text-sm">
                          {new Date(log.practice_date).toLocaleDateString('vi-VN', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-indigo-600 text-xs">
                          {log.duration_minutes || 10} phút
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Hoàn thành
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}