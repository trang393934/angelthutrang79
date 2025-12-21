import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, MessageSquare, Mic, Image, FolderKanban, History, Menu, X, Loader2, Globe, Sparkles, Gift, Wallet, TrendingUp, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import AngelMascot from '@/components/AngelMascot';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();

  // Check user authentication and Light Law agreement
  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      // Redirect to Home if not agreed to Light Law (except Home and LightLaw pages)
      if (user && !user.light_law_agreed && currentPageName !== 'Home' && currentPageName !== 'LightLaw') {
        window.location.href = createPageUrl('Home');
      }
    }).catch(() => setCurrentUser(null));
  }, [currentPageName]);

  const menuItems = [
    { 
      name: 'Tìm kiếm', 
      icon: Search, 
      action: () => setSearchOpen(true),
      shortcut: 'Ctrl+K',
      isButton: true
    },
    { 
      name: 'Chat', 
      icon: MessageSquare, 
      path: 'Chat',
      gradient: 'from-amber-400 to-rose-400'
    },
    { 
      name: 'Lịch Sử Camlycoin', 
      icon: Wallet, 
      path: 'CamlycoinHistory',
      gradient: 'from-yellow-400 to-orange-400'
    },
    { 
      name: 'Analytics', 
      icon: TrendingUp, 
      path: 'Analytics',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      name: 'Chế độ thoại', 
      icon: Mic, 
      path: 'Chat',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      name: 'AI Tools', 
      icon: Sparkles, 
      path: 'AITools',
      gradient: 'from-indigo-400 to-purple-400'
    },
    { 
      name: 'Imagine', 
      icon: Image, 
      path: 'Imagine',
      gradient: 'from-indigo-400 to-cyan-400'
    },
    { 
      name: 'Nhật Ký Biết Ơn', 
      icon: Heart, 
      path: 'GratitudeJournal',
      gradient: 'from-yellow-400 to-amber-400'
    },
    { 
      name: 'Dự án', 
      icon: FolderKanban, 
      path: 'PersonalVision',
      gradient: 'from-rose-400 to-orange-400'
    },
    { 
      name: 'Lịch sử', 
      icon: History, 
      path: 'Library',
      gradient: 'from-violet-400 to-purple-400'
    },
    { 
      name: 'Build & Bounty', 
      icon: Gift, 
      path: 'BuildAndBounty',
      gradient: 'from-amber-400 to-orange-400'
    },
    { 
      name: 'Camlycoin', 
      icon: Globe, 
      path: 'RewardsManagement',
      gradient: 'from-yellow-400 to-amber-400'
    },
    { 
      name: 'Test R2 Upload', 
      icon: Sparkles, 
      path: 'TestR2Upload',
      gradient: 'from-blue-400 to-cyan-400'
    },
    ];

  // Check for existing wallet connection
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        })
        .catch(console.error);

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress(null);
        }
      });
    }
  }, []);

  // Track user activity
  useEffect(() => {
    const updateActivity = () => setLastActivityTime(Date.now());
    
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, []);

  // Auto-disconnect wallet after 30 minutes of inactivity
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime;
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (walletAddress && inactiveTime > thirtyMinutes) {
        disconnectWallet();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInactivity);
  }, [walletAddress, lastActivityTime]);

  // Keyboard shortcut for search
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;
    
    setIsSearching(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Tìm kiếm thông tin về: "${searchQuery}"
        
Hãy cung cấp:
1. Tóm tắt ngắn gọn về chủ đề
2. Các thông tin quan trọng và cập nhật nhất
3. Nguồn thông tin đáng tin cậy

Trả lời bằng tiếng Việt, rõ ràng và dễ hiểu.`,
        add_context_from_internet: true
      });
      
      setSearchResults(result);
    } catch (error) {
      setSearchResults('Xin lỗi, đã có lỗi khi tìm kiếm. Vui lòng thử lại.');
    }
    setIsSearching(false);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Vui lòng cài đặt MetaMask để kết nối ví!');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      setWalletAddress(accounts[0]);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Không thể kết nối ví. Vui lòng thử lại!');
    }
    setIsConnecting(false);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const isActivePage = (path) => {
    return currentPageName === path || location.pathname.includes(path?.toLowerCase());
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden text-purple-600 hover:text-purple-900 hover:bg-purple-100"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || window.innerWidth >= 1024) && (
          <>
            {/* Backdrop for mobile */}
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 lg:hidden"
              />
            )}

            {/* Sidebar content */}
            <motion.aside
              initial={{ x: -200 }}
              animate={{ x: 0 }}
              exit={{ x: -200 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-48 bg-white/95 backdrop-blur-xl border-r border-purple-200/50 shadow-2xl z-50 overflow-y-auto flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-3 pb-0 pr-2">
                        <style>{`
                          .flex-1.overflow-y-auto::-webkit-scrollbar {
                            width: 8px;
                          }
                          .flex-1.overflow-y-auto::-webkit-scrollbar-track {
                            background: rgba(168, 85, 247, 0.08);
                            border-radius: 4px;
                            margin: 4px 2px;
                          }
                          .flex-1.overflow-y-auto::-webkit-scrollbar-thumb {
                            background: rgba(168, 85, 247, 0.5);
                            border-radius: 4px;
                            border: 2px solid rgba(255, 255, 255, 0.95);
                            background-clip: padding-box;
                          }
                          .flex-1.overflow-y-auto::-webkit-scrollbar-thumb:hover {
                            background: rgba(168, 85, 247, 0.7);
                          }
                        `}</style>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Link to={createPageUrl('Home')} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center shadow-lg">
                      <span className="text-white text-base font-bold">A</span>
                    </div>
                    <div>
                      <h2 className="text-slate-900 font-bold tracking-wide text-xs">Angel AI</h2>
                      <p className="text-purple-600 text-[10px] font-medium">Ánh Sáng</p>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden text-purple-600 hover:text-purple-900 hover:bg-purple-100"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Menu Items - với padding dưới để không bị che */}
                <nav className="space-y-1 pb-6">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = !item.isButton && isActivePage(item.path);
                    const isDisabled = currentUser && !currentUser.light_law_agreed;

                    if (item.isButton) {
                      return (
                        <button
                          key={item.name}
                          onClick={isDisabled ? undefined : item.action}
                          disabled={isDisabled}
                          className={`w-full flex items-center gap-1.5 px-2 py-2 rounded-lg transition-all group border ${
                            isDisabled 
                              ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200' 
                              : 'text-slate-900 hover:bg-purple-50 border-purple-200 hover:border-purple-400 bg-gradient-to-r from-purple-50/50 to-transparent'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-amber-400 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <span className="font-semibold text-xs">{item.name}</span>
                          </div>
                        </button>
                      );
                    }

                    if (isDisabled) {
                      return (
                        <div
                          key={item.name}
                          className="flex items-center gap-1.5 px-2 py-2 rounded-lg opacity-50 cursor-not-allowed bg-gray-100 border border-gray-200"
                        >
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-xs text-slate-700">{item.name}</span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.path)}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg transition-all group ${
                          isActive
                            ? 'bg-gradient-to-r from-purple-100 to-amber-100 border border-purple-300 shadow-sm'
                            : 'hover:bg-purple-50 border border-transparent'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-all ${
                          isActive ? 'scale-105' : ''
                        }`}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className={`font-semibold text-xs ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </nav>

                </div>

                {/* Bottom Section - Fixed */}
                <div className="flex-shrink-0 border-t border-purple-200 bg-white/95 p-3 mr-2">
                  {/* Wallet Connection */}
                  <div className="mb-3">
                    {walletAddress ? (
                      <div className="px-2 py-2 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Wallet className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-green-900 font-semibold text-xs">Ví Đã Kết Nối</span>
                        </div>
                        <p className="text-green-800 text-[10px] font-medium mb-2 break-all">
                          {formatAddress(walletAddress)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectWallet}
                          className="w-full h-6 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        >
                          Ngắt Kết Nối
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-lg hover:from-amber-500 hover:to-orange-500 shadow-md h-8 text-xs"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Wallet className="w-3 h-3 mr-1" />
                        )}
                        Kết Nối Ví
                      </Button>
                    )}
                  </div>

                  {/* Knowledge Base & Settings Links */}
                  <div className="space-y-1">
                    {currentUser && !currentUser.light_law_agreed ? (
                      <>
                        <div className="flex items-center gap-1.5 px-2 py-2 rounded-lg opacity-50 cursor-not-allowed bg-gray-100 border border-gray-200">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-md">
                            <FolderKanban className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">Knowledge</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-2 rounded-lg opacity-50 cursor-not-allowed bg-gray-100 border border-gray-200">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center shadow-md">
                            <span className="text-white text-sm">⚙️</span>
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">Cài Đặt</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link
                          to={createPageUrl('KnowledgeBase')}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-1.5 px-2 py-2 rounded-lg transition-all ${
                            isActivePage('KnowledgeBase')
                              ? 'bg-gradient-to-r from-indigo-100 to-purple-100 border border-indigo-300 shadow-sm'
                              : 'hover:bg-indigo-50 border border-transparent'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-md">
                            <FolderKanban className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">Knowledge</span>
                        </Link>

                        <Link
                          to={createPageUrl('Settings')}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-1.5 px-2 py-2 rounded-lg transition-all ${
                            isActivePage('Settings')
                              ? 'bg-gradient-to-r from-violet-100 to-pink-100 border border-violet-300 shadow-sm'
                              : 'hover:bg-violet-50 border border-transparent'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center shadow-md">
                            <span className="text-white text-sm">⚙️</span>
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">Cài Đặt</span>
                        </Link>
                      </>
                    )}
                  </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4 overflow-y-auto"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
              setSearchResults(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl bg-white backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-6 shadow-2xl mb-20"
            >
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-purple-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm thông tin trên toàn cầu..."
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  disabled={isSearching}
                  className="flex-1 bg-transparent text-slate-900 placeholder:text-purple-400 outline-none text-lg font-medium"
                />
                {isSearching ? (
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                ) : (
                  <Button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim()}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-4 py-2 text-sm font-bold hover:shadow-lg disabled:opacity-50"
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Tìm
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  className="text-purple-600 hover:bg-purple-100 rounded-full"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {searchResults ? (
                <div className="border-t border-purple-200 pt-4 max-h-[60vh] overflow-y-auto">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-5 h-5 text-purple-600" />
                      <h3 className="text-slate-900 font-bold text-lg">Kết Quả Tìm Kiếm</h3>
                    </div>
                    <div className="prose prose-slate max-w-none text-slate-900">
                      <ReactMarkdown className="leading-relaxed [&>p]:mb-3 [&>ul]:mb-3 [&>ol]:mb-3 [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:font-semibold [&>h3]:mb-2">
                        {searchResults}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : !isSearching && (
                <div className="border-t border-purple-200 pt-4">
                  <p className="text-sm text-purple-700 font-medium mb-3">Các trang phổ biến:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {menuItems.filter(item => !item.isButton).map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          to={createPageUrl(item.path)}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                            setSearchResults(null);
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-purple-50 transition-all border border-purple-200"
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-slate-900 font-medium text-sm">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 lg:ml-48 transition-all duration-300">
        {children}
      </div>

      {/* Angel Mascot */}
      <AngelMascot />
      </div>
      );
      }