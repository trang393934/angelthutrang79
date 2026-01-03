import React, { useState } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const SUGGESTED_TAGS = {
  spiritual: ['thiền định', 'năng lượng', 'luật hấp dẫn', 'tâm linh', 'giác ngộ', 'yêu thương', 'biết ơn'],
  wellbeing: ['sức khỏe', 'thể chất', 'tinh thần', 'dinh dưỡng', 'yoga', 'thư giãn', 'chữa lành'],
  technology: ['AI', 'công nghệ', 'blockchain', 'web3', 'camlycoin', 'angel-ai', 'automation'],
  lifestyle: ['cuộc sống', 'gia đình', 'công việc', 'du lịch', 'sở thích', 'mối quan hệ'],
  learning: ['học tập', 'kiến thức', 'kỹ năng', 'phát triển bản thân', 'đọc sách', 'khóa học']
};

export default function TagSelector({ selectedTags = [], onChange, category = 'spiritual' }) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAddTag = (tag) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      onChange([...selectedTags, trimmedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange(selectedTags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  const suggestedTags = SUGGESTED_TAGS[category] || SUGGESTED_TAGS.spiritual;
  const availableSuggestions = suggestedTags.filter(t => !selectedTags.includes(t));

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {selectedTags.map((tag, idx) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white pl-3 pr-2 py-1.5 flex items-center gap-2">
                  <span>#{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Thêm tag... (Enter để thêm)"
          className="bg-white border-2 border-purple-300 rounded-xl pr-12"
        />
        <button
          onClick={() => handleAddTag(inputValue)}
          disabled={!inputValue.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-900 disabled:opacity-30"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && availableSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-3"
          >
            <p className="text-xs text-purple-700 font-semibold mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Gợi ý tags phổ biến:
            </p>
            <div className="flex flex-wrap gap-2">
              {availableSuggestions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  className="text-xs bg-white hover:bg-purple-100 border border-purple-300 rounded-full px-3 py-1 transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}