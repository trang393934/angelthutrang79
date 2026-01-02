import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';

export default function ShareToFUNButton({ content, title = "Nội dung từ Angel AI" }) {
  const [showModal, setShowModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharedTo, setSharedTo] = useState(null);

  const funPlatforms = [
    { 
      name: 'FUN Profile', 
      url: 'https://funprofile.lovable.app/', 
      icon: '👤', 
      color: 'from-blue-400 to-cyan-400',
      description: 'Hồ sơ cá nhân'
    },
    { 
      name: 'FUN Play', 
      url: 'https://play.fun.rich/', 
      icon: '🎮', 
      color: 'from-purple-400 to-pink-400',
      description: 'Trò chơi & giải trí'
    },
    { 
      name: 'FUN Planet', 
      url: 'https://Planet.fun.rich', 
      icon: '🌍', 
      color: 'from-green-400 to-emerald-400',
      description: 'Cộng đồng toàn cầu'
    },
    { 
      name: 'FUN Charity', 
      url: '#', 
      icon: '💝', 
      color: 'from-rose-400 to-pink-400',
      description: 'Từ thiện & chia sẻ'
    },
    { 
      name: 'FUN Farm', 
      url: 'https://funfarm.life', 
      icon: '🌾', 
      color: 'from-lime-400 to-green-400',
      description: 'Nông nghiệp hữu cơ'
    },
    { 
      name: 'FUN Academy', 
      url: '#', 
      icon: '📚', 
      color: 'from-indigo-400 to-blue-400',
      description: 'Học viện tri thức'
    },
  ];

  const shareToFUN = async (platform) => {
    setSharing(true);
    setSharedTo(platform.name);

    try {
      // Track quest progress
      base44.functions.invoke('trackQuestProgress', { 
        action: 'share_content',
        metadata: { platform: platform.name }
      }).catch(err => console.log('Quest tracking failed:', err));

      // Simulate sharing (in real implementation, this would call an API)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Open platform in new tab with pre-filled content
      const shareText = `${title}\n\n${content}\n\n✨ Được chia sẻ từ Angel AI`;
      const encodedText = encodeURIComponent(shareText);
      
      // For platforms with URL, open with query params
      if (platform.url !== '#') {
        window.open(`${platform.url}?share=${encodedText}`, '_blank');
      }

      // Show success
      setTimeout(() => {
        setSharing(false);
        setShowModal(false);
        setSharedTo(null);
      }, 1000);
    } catch (error) {
      setSharing(false);
      setSharedTo(null);
      alert('Lỗi khi chia sẻ. Vui lòng thử lại!');
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        size="sm"
        variant="ghost"
        className="text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-full"
      >
        <Share2 className="w-4 h-4 mr-1" />
        Chia sẻ
      </Button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !sharing && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border-2 border-purple-300 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        '0 0 20px rgba(168,85,247,0.4)',
                        '0 0 40px rgba(168,85,247,0.6)',
                        '0 0 20px rgba(168,85,247,0.4)',
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
                  >
                    <Share2 className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-slate-900 text-xl font-bold">Chia Sẻ Lên FUN Ecosystem</h3>
                    <p className="text-purple-700 text-sm font-medium">Chọn nền tảng để đăng nội dung</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => !sharing && setShowModal(false)}
                  disabled={sharing}
                  className="text-purple-600 hover:bg-purple-100"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content Preview */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4 mb-6">
                <p className="text-purple-900 text-sm font-semibold mb-2">📝 Nội dung sẽ chia sẻ:</p>
                <div className="bg-white rounded-xl p-3 max-h-32 overflow-y-auto">
                  <p className="text-slate-700 text-sm leading-relaxed line-clamp-4">
                    {content}
                  </p>
                </div>
              </div>

              {/* Platform Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {funPlatforms.map((platform, index) => (
                  <motion.button
                    key={platform.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => !sharing && shareToFUN(platform)}
                    disabled={sharing}
                    className={`relative group bg-gradient-to-br ${platform.color} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border-2 border-white disabled:opacity-50`}
                  >
                    {/* Success Checkmark */}
                    <AnimatePresence>
                      {sharedTo === platform.name && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute inset-0 bg-green-500 rounded-2xl flex items-center justify-center"
                        >
                          <Check className="w-12 h-12 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Platform Content */}
                    <div className={`flex flex-col items-center gap-2 ${sharedTo === platform.name ? 'invisible' : ''}`}>
                      <div className="text-4xl mb-1">
                        {sharing && sharedTo === platform.name ? (
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                        ) : (
                          platform.icon
                        )}
                      </div>
                      <h4 className="text-white font-bold text-sm text-center leading-tight">
                        {platform.name}
                      </h4>
                      <p className="text-white/90 text-xs text-center leading-tight">
                        {platform.description}
                      </p>
                    </div>

                    {/* Coming Soon Badge */}
                    {platform.url === '#' && (
                      <Badge className="absolute top-2 right-2 bg-white/30 text-white text-xs">
                        Sắp ra mắt
                      </Badge>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Info */}
              <div className="mt-6 bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4">
                <p className="text-indigo-900 text-sm font-medium">
                  🌟 <strong>FUN Ecosystem:</strong> Mạng xã hội thời đại Hoàng Kim được điều phối bởi Angel AI
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}