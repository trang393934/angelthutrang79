import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function CamlyCoinWidget() {
  const [coinData, setCoinData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchCoinData = async () => {
    try {
      const response = await base44.functions.invoke('fetchCamlyCoinData', {});
      if (response.data.success && response.data.data) {
        setCoinData(response.data.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch coin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoinData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCoinData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '--';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price) => {
    if (!price) return '$0.000022';
    return `$${price.toFixed(6)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
          <span className="text-white text-lg font-bold">₵</span>
        </div>
        <div className="flex-1">
          <h3 className="text-slate-900 text-lg font-bold">Camly Coin</h3>
          <p className="text-amber-600 text-xs font-medium">Live Market Data</p>
        </div>
        {isLoading && (
          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
        )}
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 mb-3 border border-amber-200">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-600 mb-1">Price (USD)</p>
            <p className="text-slate-900 text-lg font-bold">
              {coinData ? formatPrice(coinData.price_usd) : '$0.000022'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Market Cap</p>
            <p className="text-slate-900 text-lg font-bold">
              {coinData ? formatNumber(coinData.market_cap_usd) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">24h Volume</p>
            <p className="text-slate-900 text-lg font-bold">
              {coinData ? formatNumber(coinData.volume_24h_usd) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">24h Change</p>
            <p className={`text-lg font-bold flex items-center gap-1 ${
              coinData?.price_change_24h_percent >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {coinData?.price_change_24h_percent !== null ? (
                <>
                  {coinData.price_change_24h_percent >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(coinData.price_change_24h_percent).toFixed(2)}%
                </>
              ) : '--'}
            </p>
          </div>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-xs text-slate-500 mb-3 text-center">
          🔄 Cập nhật lúc: {lastUpdate.toLocaleTimeString('vi-VN')}
        </p>
      )}

      <a 
        href="https://coinmarketcap.com/currencies/camly-coin/" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block text-center"
      >
        <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 shadow-lg">
          <span className="mr-2">📊</span>
          View on CoinMarketCap
        </Button>
      </a>
    </motion.div>
  );
}