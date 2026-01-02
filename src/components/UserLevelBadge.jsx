import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Crown, Star, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UserLevelBadge({ userLevel, size = 'normal' }) {
  if (!userLevel) return null;

  const levelConfig = {
    bronze: {
      name: 'Đồng',
      icon: Award,
      gradient: 'from-amber-600 to-orange-700',
      borderColor: 'border-amber-500',
      textColor: 'text-amber-900',
      bgColor: 'bg-amber-100'
    },
    silver: {
      name: 'Bạc',
      icon: Star,
      gradient: 'from-gray-300 to-gray-500',
      borderColor: 'border-gray-400',
      textColor: 'text-gray-900',
      bgColor: 'bg-gray-100'
    },
    gold: {
      name: 'Vàng',
      icon: Trophy,
      gradient: 'from-yellow-400 to-amber-500',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-900',
      bgColor: 'bg-yellow-100'
    },
    platinum: {
      name: 'Bạch Kim',
      icon: Crown,
      gradient: 'from-cyan-300 to-blue-500',
      borderColor: 'border-cyan-400',
      textColor: 'text-cyan-900',
      bgColor: 'bg-cyan-100'
    },
    diamond: {
      name: 'Kim Cương',
      icon: Sparkles,
      gradient: 'from-purple-400 to-pink-500',
      borderColor: 'border-purple-400',
      textColor: 'text-purple-900',
      bgColor: 'bg-purple-100'
    },
    master: {
      name: 'Đại Minh Sư',
      icon: Zap,
      gradient: 'from-rose-400 via-amber-300 to-purple-500',
      borderColor: 'border-amber-400',
      textColor: 'text-amber-900',
      bgColor: 'bg-gradient-to-r from-rose-100 to-purple-100'
    }
  };

  const config = levelConfig[userLevel.current_level] || levelConfig.bronze;
  const Icon = config.icon;

  const sizeClasses = {
    small: { icon: 'w-3 h-3', text: 'text-xs', padding: 'px-2 py-1' },
    normal: { icon: 'w-4 h-4', text: 'text-sm', padding: 'px-3 py-1' },
    large: { icon: 'w-6 h-6', text: 'text-base', padding: 'px-4 py-2' }
  };

  const classes = sizeClasses[size] || sizeClasses.normal;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center gap-2 ${config.bgColor} border-2 ${config.borderColor} rounded-full ${classes.padding} shadow-md`}
    >
      <div className={`rounded-full bg-gradient-to-br ${config.gradient} p-1`}>
        <Icon className={`${classes.icon} text-white`} />
      </div>
      <span className={`${config.textColor} font-bold ${classes.text}`}>
        {config.name} • Lv.{userLevel.level_number}
      </span>
    </motion.div>
  );
}