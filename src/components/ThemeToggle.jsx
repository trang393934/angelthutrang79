import React from 'react';
import { Moon, Sun, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export default function ThemeToggle() {
  const { theme, toggleTheme, accentColor, setAccentColor, accentColors } = useTheme();
  const [showColorPicker, setShowColorPicker] = React.useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Button
          onClick={toggleTheme}
          variant="ghost"
          size="icon"
          className="relative overflow-hidden rounded-full"
        >
          <AnimatePresence mode="wait">
            {theme === 'light' ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Sun className="w-5 h-5 text-amber-500" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Moon className="w-5 h-5 text-indigo-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>

        <Button
          onClick={() => setShowColorPicker(!showColorPicker)}
          variant="ghost"
          size="icon"
          className="rounded-full"
        >
          <Palette className="w-5 h-5" style={{ color: accentColors[accentColor].primary }} />
        </Button>
      </div>

      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-12 right-0 bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-slate-600 rounded-2xl p-4 shadow-2xl z-50 min-w-[200px]"
          >
            <p className="text-slate-900 dark:text-white font-bold text-sm mb-3">Chọn màu chủ đạo</p>
            <div className="space-y-2">
              {Object.entries(accentColors).map(([key, color]) => (
                <button
                  key={key}
                  onClick={() => {
                    setAccentColor(key);
                    setShowColorPicker(false);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${
                    accentColor === key 
                      ? 'bg-gradient-to-r shadow-md scale-105' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  style={accentColor === key ? {
                    backgroundImage: `linear-gradient(to right, ${color.primary}, ${color.secondary})`
                  } : {}}
                >
                  <div 
                    className="w-6 h-6 rounded-full shadow-md"
                    style={{ background: `linear-gradient(to bottom right, ${color.primary}, ${color.secondary})` }}
                  />
                  <span className={`font-semibold text-sm ${
                    accentColor === key ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}>
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}