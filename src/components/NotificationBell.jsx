import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, MessageSquare, ThumbsUp, Award, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function NotificationBell({ currentUser }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.email],
    queryFn: () => base44.entities.Notification.filter({ user_email: currentUser.email }, '-created_date', 50),
    enabled: !!currentUser,
    refetchInterval: 10000 // Refresh every 10s
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleNotificationClick = (notification) => {
    markAsReadMutation.mutate(notification.id);
    
    if (notification.reference_type === 'forum_post') {
      navigate(createPageUrl('Forum'));
    } else if (notification.reference_type === 'community_reward') {
      navigate(createPageUrl('CommunityRewards'));
    }
    
    setShowDropdown(false);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'forum_reply': return MessageSquare;
      case 'forum_upvote': return ThumbsUp;
      case 'reward_approved':
      case 'reward_rejected': return Award;
      case 'group_invite': return Users;
      default: return Bell;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'forum_reply': return 'from-blue-400 to-indigo-400';
      case 'forum_upvote': return 'from-green-400 to-emerald-400';
      case 'reward_approved': return 'from-amber-400 to-orange-400';
      case 'reward_rejected': return 'from-red-400 to-pink-400';
      case 'group_invite': return 'from-purple-400 to-pink-400';
      default: return 'from-slate-400 to-gray-400';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-full hover:bg-purple-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-purple-600" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {showDropdown && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDropdown(false)}
              className="fixed inset-0 z-40"
            />
            
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-12 w-96 bg-white border-2 border-purple-200 rounded-2xl shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-purple-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
                <h3 className="text-slate-900 font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-500" />
                  Thông Báo
                  {unreadCount > 0 && (
                    <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs text-purple-600 hover:text-purple-900"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Đọc hết
                  </Button>
                )}
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                    <p className="text-slate-600 text-sm">Chưa có thông báo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-purple-100">
                    {notifications.map((notif) => {
                      const Icon = getIcon(notif.type);
                      const colorGradient = getColor(notif.type);
                      
                      return (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 hover:bg-purple-50 cursor-pointer transition-colors ${
                            !notif.is_read ? 'bg-purple-50/50' : ''
                          }`}
                        >
                          <div className="flex gap-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorGradient} flex items-center justify-center flex-shrink-0`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-semibold ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {notif.title}
                                </p>
                                {!notif.is_read && (
                                  <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notif.content}</p>
                              <p className="text-xs text-purple-600 mt-2">
                                {new Date(notif.created_date).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}