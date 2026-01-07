import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrowserProvider } from 'ethers';

export default function MultiWalletConnect({ 
  isOpen, 
  onClose, 
  onConnect,
  selectedNetwork = 'Binance Smart Chain' 
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(null);

  const networkConfigs = {
    'Ethereum': { 
      chainId: '0x1', 
      name: 'Ethereum Mainnet', 
      symbol: 'ETH',
      rpcUrls: ['https://eth.llamarpc.com'],
      blockExplorerUrls: ['https://etherscan.io']
    },
    'Binance Smart Chain': { 
      chainId: '0x38', 
      name: 'BSC Mainnet', 
      symbol: 'BNB',
      rpcUrls: ['https://bsc-dataseed.binance.org'],
      blockExplorerUrls: ['https://bscscan.com']
    },
    'Polygon': { 
      chainId: '0x89', 
      name: 'Polygon Mainnet', 
      symbol: 'MATIC',
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com']
    },
    'Arbitrum': { 
      chainId: '0xa4b1', 
      name: 'Arbitrum One', 
      symbol: 'ETH',
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      blockExplorerUrls: ['https://arbiscan.io']
    },
    'Optimism': { 
      chainId: '0xa', 
      name: 'Optimism', 
      symbol: 'ETH',
      rpcUrls: ['https://mainnet.optimism.io'],
      blockExplorerUrls: ['https://optimistic.etherscan.io']
    },
    'Base': { 
      chainId: '0x2105', 
      name: 'Base', 
      symbol: 'ETH',
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org']
    }
  };

  const walletProviders = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      description: 'Ví Web3 phổ biến nhất',
      checkInstalled: () => typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask,
      downloadUrl: 'https://metamask.io/download/'
    },
    {
      id: 'trustwallet',
      name: 'Trust Wallet',
      icon: '🛡️',
      description: 'Ví di động an toàn',
      checkInstalled: () => typeof window.ethereum !== 'undefined' && window.ethereum.isTrust,
      downloadUrl: 'https://trustwallet.com/download'
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: '💼',
      description: 'Ví từ Coinbase',
      checkInstalled: () => typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet,
      downloadUrl: 'https://www.coinbase.com/wallet/downloads'
    },
    {
      id: 'binance',
      name: 'Binance Wallet',
      icon: '🟡',
      description: 'Ví Binance Chain',
      checkInstalled: () => typeof window.BinanceChain !== 'undefined',
      downloadUrl: 'https://www.binance.org/en/download'
    },
    {
      id: 'injected',
      name: 'Ví Khác',
      icon: '🔌',
      description: 'Bất kỳ ví Web3 nào',
      checkInstalled: () => typeof window.ethereum !== 'undefined',
      downloadUrl: null
    }
  ];

  const connectToWallet = async (walletProvider) => {
    setIsConnecting(true);
    setConnectingWallet(walletProvider.id);

    try {
      let provider;
      
      // Check if on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Special handling for different wallets
      if (walletProvider.id === 'binance' && typeof window.BinanceChain !== 'undefined') {
        provider = window.BinanceChain;
      } else if (walletProvider.id === 'metamask' && !window.ethereum?.isMetaMask && isMobile) {
        // Mobile MetaMask deeplink
        const currentUrl = window.location.href;
        const metamaskDeepLink = `https://metamask.app.link/dapp/${currentUrl.replace('https://', '')}`;
        window.location.href = metamaskDeepLink;
        setIsConnecting(false);
        setConnectingWallet(null);
        return;
      } else if (walletProvider.id === 'trustwallet' && !window.ethereum?.isTrust && isMobile) {
        // Mobile Trust Wallet deeplink
        const currentUrl = window.location.href;
        const trustDeepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`;
        window.location.href = trustDeepLink;
        setIsConnecting(false);
        setConnectingWallet(null);
        return;
      } else if (walletProvider.id === 'coinbase' && !window.ethereum?.isCoinbaseWallet && isMobile) {
        // Mobile Coinbase Wallet deeplink
        const currentUrl = window.location.href;
        const coinbaseDeepLink = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`;
        window.location.href = coinbaseDeepLink;
        setIsConnecting(false);
        setConnectingWallet(null);
        return;
      } else {
        provider = window.ethereum;
      }

      if (!provider) {
        // Not installed - show download link
        if (walletProvider.downloadUrl) {
          if (isMobile) {
            window.location.href = walletProvider.downloadUrl;
          } else {
            window.open(walletProvider.downloadUrl, '_blank');
          }
        }
        setIsConnecting(false);
        setConnectingWallet(null);
        return;
      }

      // Request accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        setIsConnecting(false);
        setConnectingWallet(null);
        return;
      }

      const address = accounts[0];
      const config = networkConfigs[selectedNetwork];

      // Switch to correct network
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chainId }],
        });
      } catch (switchError) {
        // Chain not added, try adding it
        if (switchError.code === 4902) {
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: config.chainId,
                chainName: config.name,
                nativeCurrency: {
                  name: config.symbol,
                  symbol: config.symbol,
                  decimals: 18
                },
                rpcUrls: config.rpcUrls,
                blockExplorerUrls: config.blockExplorerUrls
              }],
            });
          } catch (addError) {
            console.error('Add network error:', addError);
            setIsConnecting(false);
            setConnectingWallet(null);
            return;
          }
        } else if (switchError.code === 4001) {
          // User rejected - silently handle
          setIsConnecting(false);
          setConnectingWallet(null);
          return;
        } else {
          console.error('Switch network error:', switchError);
          setIsConnecting(false);
          setConnectingWallet(null);
          return;
        }
      }

      // Get balance
      const ethersProvider = new BrowserProvider(provider);
      const balance = await ethersProvider.getBalance(address);
      const balanceInEther = parseFloat(balance.toString()) / Math.pow(10, 18);

      // Success - call parent callback
      onConnect({
        address,
        network: selectedNetwork,
        balance: balanceInEther.toFixed(4),
        symbol: config.symbol,
        walletType: walletProvider.id
      });

      onClose();
    } catch (error) {
      console.error('Connection error:', error);
      // Silently handle errors
    }
    
    setIsConnecting(false);
    setConnectingWallet(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-slate-900 text-xl font-semibold">Kết Nối Ví</h3>
                  <p className="text-purple-700 text-sm">Chọn ví của bạn</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-purple-600 hover:bg-purple-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Network Badge */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-3 mb-6">
              <p className="text-center text-slate-900">
                <span className="text-sm text-purple-700 font-medium">Mạng đã chọn: </span>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  {selectedNetwork}
                </Badge>
              </p>
            </div>

            {/* Wallet Options */}
            <div className="space-y-3">
              {walletProviders.map((wallet) => {
                const isInstalled = wallet.checkInstalled();
                const isConnectingThis = connectingWallet === wallet.id;
                
                return (
                  <Button
                    key={wallet.id}
                    onClick={() => connectToWallet(wallet)}
                    disabled={isConnecting}
                    className={`w-full bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 ${
                      isInstalled ? 'border-purple-200 hover:border-purple-400' : 'border-gray-200'
                    } text-slate-900 rounded-2xl py-6 font-semibold shadow-md hover:shadow-lg transition-all group relative`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {isConnectingThis ? (
                          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        ) : (
                          <span className="text-2xl">{wallet.icon}</span>
                        )}
                        <div className="text-left">
                          <p className="font-bold">{wallet.name}</p>
                          <p className="text-xs text-purple-600 font-medium">{wallet.description}</p>
                        </div>
                      </div>
                      {isInstalled ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Badge variant="outline" className="text-xs border-purple-300 text-purple-700">
                          Cài đặt
                        </Badge>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>

            {/* Mobile Instructions */}
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mt-6">
              <p className="text-purple-900 text-xs font-semibold mb-2">📱 Dùng trên điện thoại:</p>
              <p className="text-purple-800 text-xs leading-relaxed">
                Mở trang này trong <strong>Browser của ví</strong> (MetaMask Browser, Trust Wallet Browser, v.v.) để kết nối dễ dàng.
              </p>
            </div>

            {/* Security Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4">
              <p className="text-amber-900 text-xs font-semibold mb-1">🔒 Bảo Mật:</p>
              <p className="text-amber-800 text-xs leading-relaxed">
                Chúng tôi không bao giờ yêu cầu private key hoặc seed phrase của bạn.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}