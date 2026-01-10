import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app-theme');
    return saved || 'light';
  });

  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('app-accent-color');
    return saved || 'purple';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('app-accent-color', accentColor);
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const accentColors = {
    purple: { primary: '#a855f7', secondary: '#ec4899', name: 'Tím Hồng' },
    blue: { primary: '#3b82f6', secondary: '#06b6d4', name: 'Xanh Dương' },
    green: { primary: '#10b981', secondary: '#14b8a6', name: 'Xanh Lá' },
    amber: { primary: '#f59e0b', secondary: '#f97316', name: 'Vàng Cam' },
    rose: { primary: '#f43f5e', secondary: '#ec4899', name: 'Hồng Đào' },
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      accentColor, 
      setAccentColor, 
      accentColors 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}