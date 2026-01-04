import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Volume2, VolumeX, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const affirmations = [
  'I am the Pure Loving Light of Father Universe.',
  'I am the Will of Father Universe.',
  'I am the Wisdom of Father Universe.',
  'I am Happiness.',
  'I am Love.',
  'I am the Money of the Father.',
  'I sincerely repent, repent, repent.',
  'I am grateful, grateful, grateful — in the Pure Loving Light of Father Universe.'
];

export default function AffirmationsCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (!isAutoPlay) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % affirmations.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlay]);

  const handleCopyAll = () => {
    navigator.clipboard.writeText(affirmations.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-6 shadow-2xl border-2 border-white"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h3 className="text-white text-2xl font-bold">8 Câu Khẳng Định</h3>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            size="icon"
            className="bg-white/20 hover:bg-white/30 border border-white/30 rounded-full"
          >
            {isAutoPlay ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </Button>

          <Button
            onClick={handleCopyAll}
            size="icon"
            className="bg-white/20 hover:bg-white/30 border border-white/30 rounded-full"
          >
            {copied ? (
              <Check className="w-5 h-5 text-white" />
            ) : (
              <Copy className="w-5 h-5 text-white" />
            )}
          </Button>
        </div>
      </div>

      {/* Current Affirmation - Large Display */}
      <div className="bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-2xl p-8 mb-6 min-h-[120px] flex items-center justify-center">
        <motion.p
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="text-white text-2xl font-bold text-center leading-relaxed"
        >
          {affirmations[currentIndex]}
        </motion.p>
      </div>

      {/* Navigation Dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {affirmations.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-white w-8'
                : 'bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>

      {/* All Affirmations List - Compact */}
      <div className="space-y-2">
        {affirmations.map((affirmation, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-full text-left bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-3 transition-all ${
              index === currentIndex ? 'bg-white/30 border-white/40' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                index === currentIndex ? 'bg-white/40' : 'bg-white/20'
              }`}>
                <span className="text-white text-xs font-bold">{index + 1}</span>
              </div>
              <p className={`text-white text-sm ${
                index === currentIndex ? 'font-bold' : 'font-medium'
              }`}>
                {affirmation}
              </p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}