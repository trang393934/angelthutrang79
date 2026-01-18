import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, MessageSquare, Mic, Image, FolderKanban, History, Menu, X, Loader2, Globe, Sparkles, Gift, Wallet, TrendingUp, Heart, Award, Activity, Shield, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

import SupportChatWidget from '@/components/SupportChatWidget';
import ThemeToggle from '@/components/ThemeToggle';
import ThemeProvider from '@/components/ThemeProvider';
import SystemStatusBanner from '@/components/SystemStatusBanner';
import { toast } from 'sonner';

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
  const [NotificationBell, setNotificationBell] = useState(null);
  const location = useLocation();

  // Lazy load NotificationBell
  useEffect(() => {
    if (currentUser) {
      import('@/components/NotificationBell').then(module => {
        setNotificationBell(() => module.default);
      });
    }
  }, [currentUser]);

  // Check user authentication and Light Law agreement
  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);

      // Track page visit - only once per page load
      if (user && user.light_law_agreed && currentPageName !== 'Home') {
        base44.entities.UserActivity.create({
          user_email: user.email,
          activity_type: 'page_view',
          activity_details: {
            page: currentPageName,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }).catch(err => console.log('Activity tracking failed:', err));
      }
      
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
      name: 'Báo Cáo Thu Nhập', 
      icon: TrendingUp, 
      path: 'IncomeReport',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      name: 'Rút Camlycoin', 
      icon: Wallet, 
      path: 'WithdrawCamlycoin',
      gradient: 'from-green-400 to-emerald-400'
    },
    { 
      name: 'Lịch Sử Rút Tiền', 
      icon: Wallet, 
      path: 'WithdrawalHistory',
      gradient: 'from-teal-400 to-cyan-400'
    },
    { 
      name: 'Analytics', 
      icon: TrendingUp, 
      path: 'Analytics',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      name: '🛡️ Dashboard Minh Bạch', 
      icon: Shield, 
      path: 'TransparencyDashboard',
      gradient: 'from-blue-400 to-cyan-400'
    },
    { 
      name: 'Bảng Xếp Hạng', 
      icon: Award, 
      path: 'Leaderboard',
      gradient: 'from-yellow-400 to-amber-500'
    },
    { 
      name: 'Nhiệm Vụ', 
      icon: Target, 
      path: 'Quests',
      gradient: 'from-indigo-400 to-purple-500'
    },
    { 
      name: 'Tâm Điểm Thưởng', 
      icon: Award, 
      path: 'PuritySpotlight',
      gradient: 'from-amber-400 to-rose-400'
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
      gradient: 'from-pink-400 to-rose-400'
    },
    { 
      name: 'Dự án', 
      icon: FolderKanban, 
      path: 'PersonalVision',
      gradient: 'from-rose-400 to-orange-400'
    },
    { 
      name: 'Vision Board', 
      icon: Target, 
      path: 'VisionBoard',
      gradient: 'from-purple-500 to-pink-500'
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
      name: 'Community Rewards', 
      icon: Gift, 
      path: 'CommunityRewards',
      gradient: 'from-purple-400 to-pink-400'
    },
    { 
      name: 'Diễn Đàn', 
      icon: MessageSquare, 
      path: 'Forum',
      gradient: 'from-indigo-400 to-purple-400'
    },
    { 
      name: 'Whitepaper', 
      icon: Sparkles, 
      path: 'Whitepaper',
      gradient: 'from-amber-400 to-orange-400'
    },
    { 
      name: 'Camlycoin', 
      icon: Globe, 
      path: 'RewardsManagement',
      gradient: 'from-yellow-400 to-amber-400'
    },
    ...(currentUser?.role === 'admin' ? [
      { 
        name: 'Admin Dashboard', 
        icon: Activity, 
        path: 'AdminDashboard',
        gradient: 'from-indigo-400 to-purple-500'
      },
      { 
        name: 'User Management', 
        icon: Users, 
        path: 'UserManagement',
        gradient: 'from-purple-400 to-pink-500'
      },
      { 
        name: 'Monitoring', 
        icon: Activity, 
        path: 'MonitoringDashboard',
        gradient: 'from-blue-400 to-indigo-500'
      },
      { 
        name: 'Audit Dashboard', 
        icon: Shield, 
        path: 'AuditDashboard',
        gradient: 'from-purple-500 to-pink-600'
      },
      { 
        name: 'Comprehensive Audit', 
        icon: Activity, 
        path: 'AdminAuditControl',
        gradient: 'from-indigo-500 to-purple-600'
      },
      { 
        name: 'Data Integrity', 
        icon: Shield, 
        path: 'DataIntegrityCheck',
        gradient: 'from-purple-500 to-pink-600'
      },
      { 
        name: 'Review Pending', 
        icon: Shield, 
        path: 'ReviewPendingActions',
        gradient: 'from-purple-400 to-indigo-500'
      },
      { 
        name: 'Community Rewards Admin', 
        icon: Gift, 
        path: 'AdminCommunityRewards',
        gradient: 'from-pink-400 to-rose-500'
      },
      { 
        name: 'Withdrawals', 
        icon: Wallet, 
        path: 'WithdrawalManagement',
        gradient: 'from-amber-400 to-orange-500'
      },
      { 
        name: 'Audit Số Dư User', 
        icon: Shield, 
        path: 'UserBalanceAudit',
        gradient: 'from-orange-400 to-red-500'
      },
      { 
        name: 'Test R2 Upload', 
        icon: Sparkles, 
        path: 'TestR2Upload',
        gradient: 'from-blue-400 to-cyan-400'
      }
    ] : []),
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
        .catch(error => {
          // Silently ignore wallet check errors - not critical
          if (error.code !== 4001 && error.code !== -32002) {
            console.debug('Wallet check skipped');
          }
        });

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
      toast.error('Vui lòng cài đặt MetaMask để kết nối ví');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        toast.success('Đã kết nối ví thành công!');
      }
    } catch (error) {
      // Handle specific error codes
      if (error.code === 4001) {
        toast.info('Bạn đã từ chối kết nối ví');
      } else if (error.code === -32002) {
        toast.warning('Đang có yêu cầu kết nối ví đang chờ xử lý');
      } else {
        toast.error('Không thể kết nối MetaMask. Vui lòng thử lại.');
        console.error('Wallet connection error:', error.code, error.message);
      }
    } finally {
      setIsConnecting(false);
    }
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
          <ThemeProvider>
          <div className="flex min-h-screen" style={{background: 'var(--bg-primary)'}}>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden hover-lift"
        style={{color: 'var(--accent-secondary)'}}
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
                  className="fixed inset-0 bg-black/20 backdrop-blur-md z-40 lg:hidden"
                />
            )}

            {/* Sidebar content */}
            <motion.aside
              initial={{ x: -200 }}
              animate={{ x: 0 }}
              exit={{ x: -200 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-48 backdrop-blur-xl shadow-lg z-50 overflow-y-auto flex flex-col"
              style={{backgroundColor: 'var(--bg-primary)', borderRightColor: 'var(--border-light)'}}
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
                <div className="flex items-center justify-between mb-6 px-2 py-4 border-b" style={{borderBottomColor: 'var(--border-light)'}}>
                  <Link to={createPageUrl('Home')} className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}>
                      <span className="text-white text-sm font-semibold">Á</span>
                    </div>
                    <div>
                      <h2 className="font-semibold tracking-tight text-sm" style={{color: 'var(--text-primary)'}}>Angel AI</h2>
                      <p className="text-[10px] font-medium" style={{color: 'var(--accent-secondary)'}}>Trí Tuệ</p>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden hover-lift"
                    style={{color: 'var(--accent-secondary)'}}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Menu Items */}
                <nav className="space-y-0.5 pb-6">
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
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md transition-all group hover-lift"
                          style={{
                            opacity: isDisabled ? 0.5 : 1,
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            backgroundColor: isDisabled ? 'var(--bg-secondary)' : 'transparent',
                            color: isDisabled ? 'var(--text-tertiary)' : 'var(--text-primary)'
                          }}
                        >
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 group-hover:shadow-md transition-all" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}>
                            <Icon className="w-3 h-3 text-white" />
                          </div>
                          <span className="font-medium text-xs flex-1 text-left">{item.name}</span>
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
                        className="flex items-center gap-2 px-3 py-2.5 rounded-md transition-all group hover-lift"
                        style={{
                          backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                          color: isActive ? 'var(--accent-secondary)' : 'var(--text-secondary)'
                        }}
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 group-hover:shadow-md transition-all" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)', opacity: isActive ? 1 : 0.8}}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-medium text-xs flex-1 text-left" style={{color: isActive ? 'var(--accent-secondary)' : 'var(--text-secondary)'}}>
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </nav>

                </div>

                {/* Bottom Section - Fixed */}
                <div className="flex-shrink-0 border-t p-3 mr-2" style={{borderTopColor: 'var(--border-light)', backgroundColor: 'var(--bg-primary)'}}>
                  {/* Wallet Connection */}
                  <div className="mb-3">
                    {walletAddress ? (
                      <div className="px-3 py-2.5 rounded-md border" style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--accent-secondary)'}}>
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="w-3.5 h-3.5" style={{color: 'var(--accent-secondary)'}} />
                          <span className="font-semibold text-xs" style={{color: 'var(--accent-secondary)'}}>Ví Đã Kết Nối</span>
                        </div>
                        <p className="text-[10px] font-medium mb-2 break-all" style={{color: 'var(--text-secondary)'}}>
                          {formatAddress(walletAddress)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectWallet}
                          className="w-full h-6 text-xs hover-lift"
                          style={{borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)'}}
                        >
                          Ngắt Kết Nối
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="w-full h-8 text-xs font-medium rounded-md hover-lift"
                        style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)', color: 'white'}}
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3 h-3 mr-1 spinner-subtle" />
                        ) : (
                          <Wallet className="w-3 h-3 mr-1" />
                        )}
                        Kết Nối Ví
                      </Button>
                    )}
                  </div>

                  {/* Theme Toggle */}
                  <div className="mb-3 flex justify-center">
                    <ThemeToggle />
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
                          className="flex items-center gap-2 px-3 py-2.5 rounded-md transition-all group hover-lift"
                          style={{backgroundColor: isActivePage('KnowledgeBase') ? 'var(--bg-secondary)' : 'transparent'}}
                        >
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 group-hover:shadow-md transition-all" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}>
                            <FolderKanban className="w-3 h-3 text-white" />
                          </div>
                          <span className="font-medium text-xs" style={{color: 'var(--text-secondary)'}}>Knowledge</span>
                        </Link>

                        <Link
                          to={createPageUrl('AutoClaimSettings')}
                          onClick={() => setSidebarOpen(false)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-md transition-all group hover-lift"
                          style={{backgroundColor: isActivePage('AutoClaimSettings') ? 'var(--bg-secondary)' : 'transparent'}}
                        >
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 group-hover:shadow-md transition-all" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}>
                            <span className="text-white text-xs">⚡</span>
                          </div>
                          <span className="font-medium text-xs" style={{color: 'var(--text-secondary)'}}>Auto-Claim</span>
                        </Link>

                        <Link
                          to={createPageUrl('Settings')}
                          onClick={() => setSidebarOpen(false)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-md transition-all group hover-lift"
                          style={{backgroundColor: isActivePage('Settings') ? 'var(--bg-secondary)' : 'transparent'}}
                        >
                          <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm flex-shrink-0 group-hover:shadow-md transition-all" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}>
                            <span className="text-white text-xs">⚙️</span>
                          </div>
                          <span className="font-medium text-xs" style={{color: 'var(--text-secondary)'}}>Cài Đặt</span>
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
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-start justify-center pt-20 px-4 overflow-y-auto"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
              setSearchResults(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl backdrop-blur-xl rounded-2xl p-6 shadow-lg mb-20"
              style={{backgroundColor: 'var(--bg-primary)', border: `1px solid var(--border-medium)`}}
            >
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5" style={{color: 'var(--accent-secondary)'}} />
                <input
                  type="text"
                  placeholder="Tìm kiếm thông tin trên toàn cầu..."
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  disabled={isSearching}
                  className="flex-1 bg-transparent outline-none text-base font-medium"
                  style={{color: 'var(--text-primary)', backgroundColor: 'transparent'}}
                />
                {isSearching ? (
                  <Loader2 className="w-5 h-5 spinner-subtle" style={{color: 'var(--accent-secondary)'}} />
                ) : (
                  <Button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim()}
                    className="text-white rounded-lg px-4 py-2 text-sm font-medium hover-lift disabled:opacity-50"
                    style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}
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
                  className="rounded-lg hover-lift"
                  style={{color: 'var(--accent-secondary)'}}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {searchResults ? (
                <div className="pt-4 max-h-[60vh] overflow-y-auto" style={{borderTopColor: 'var(--border-light)', borderTopWidth: '1px'}}>
                  <div className="rounded-xl p-6" style={{backgroundColor: 'var(--bg-secondary)'}}>
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-5 h-5" style={{color: 'var(--accent-secondary)'}} />
                      <h3 className="font-semibold text-lg" style={{color: 'var(--text-primary)'}}>Kết Quả Tìm Kiếm</h3>
                    </div>
                    <div className="max-w-none" style={{color: 'var(--text-secondary)'}}>
                      <ReactMarkdown className="leading-relaxed [&>p]:mb-3 [&>ul]:mb-3 [&>ol]:mb-3 [&>h1]:text-xl [&>h1]:font-semibold [&>h1]:mb-3 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:font-semibold [&>h3]:mb-2">
                        {searchResults}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : !isSearching && (
                <div className="pt-4" style={{borderTopColor: 'var(--border-light)', borderTopWidth: '1px'}}>
                  <p className="text-sm font-medium mb-3" style={{color: 'var(--text-secondary)'}}>Các trang phổ biến:</p>
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
                          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover-lift"
                          style={{backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)', borderWidth: '1px'}}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'}}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-medium text-sm" style={{color: 'var(--text-primary)'}}>{item.name}</span>
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
        <div className="p-6">
          {currentUser && currentUser.light_law_agreed && currentPageName !== 'TransparencyDashboard' && (
            <SystemStatusBanner />
          )}
        </div>
        {children}
      </div>



      {/* Support Chat Widget */}
      {currentUser && currentUser.light_law_agreed && <SupportChatWidget />}
      </div>
      </ThemeProvider>
      );
      }