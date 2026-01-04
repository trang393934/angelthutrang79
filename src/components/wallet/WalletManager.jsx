import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, Trash2, Star, CheckCircle2, Copy, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function WalletManager({ wallets = [], primaryWallet, onAddWallet, onRemoveWallet, onSetPrimary }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [copied, setCopied] = useState(null);

  const validateAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleAddWallet = () => {
    if (!validateAddress(newAddress)) {
      alert('❌ Địa chỉ ví không hợp lệ! Phải là địa chỉ BEP-20 (bắt đầu 0x, 42 ký tự)');
      return;
    }

    if (wallets.some(w => w.address.toLowerCase() === newAddress.toLowerCase())) {
      alert('⚠️ Địa chỉ ví này đã tồn tại!');
      return;
    }

    onAddWallet({
      address: newAddress,
      label: newLabel || 'Ví ' + (wallets.length + 1),
      added_date: new Date().toISOString()
    });

    setNewAddress('');
    setNewLabel('');
    setShowAddForm(false);
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  return (
    <div className="space-y-4">
      {/* Primary Wallet */}
      {primaryWallet && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 border-2 border-white shadow-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-white fill-white" />
            <span className="text-white font-bold text-sm">Ví Chính</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
            <p className="text-white font-mono text-xs break-all mb-2">{primaryWallet}</p>
            <Button
              onClick={() => copyAddress(primaryWallet)}
              size="sm"
              className="bg-white text-amber-600 rounded-lg text-xs h-7 w-full hover:bg-amber-50"
            >
              {copied === primaryWallet ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Đã Copy!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Backup Wallets */}
      {wallets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-slate-900 font-bold text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-purple-600" />
            Ví Dự Phòng ({wallets.length}/5)
          </h4>
          {wallets.map((wallet, idx) => (
            <motion.div
              key={wallet.address}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white border-2 border-purple-200 rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-semibold text-xs mb-1">{wallet.label}</p>
                  <p className="text-slate-600 font-mono text-xs break-all">{formatAddress(wallet.address)}</p>
                  <p className="text-slate-500 text-[10px] mt-1">
                    {new Date(wallet.added_date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => onSetPrimary(wallet.address)}
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg h-7 px-2"
                    title="Đặt làm ví chính"
                  >
                    <Star className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm(`Xóa ví "${wallet.label}"?`)) {
                        onRemoveWallet(wallet.address);
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 rounded-lg h-7 px-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Wallet Button/Form */}
      <AnimatePresence>
        {showAddForm ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-4 space-y-3"
          >
            <div>
              <label className="text-slate-900 text-xs font-semibold mb-1 block">Địa chỉ ví (BEP-20)</label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="0x..."
                className="bg-white border-2 border-indigo-300 rounded-lg text-sm font-mono"
              />
              {newAddress && !validateAddress(newAddress) && (
                <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  <span>Địa chỉ không hợp lệ</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-slate-900 text-xs font-semibold mb-1 block">Tên ví</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ví MetaMask, Trust Wallet..."
                className="bg-white border-2 border-indigo-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setNewAddress('');
                  setNewLabel('');
                }}
                variant="outline"
                className="flex-1 border-slate-300 text-slate-700 rounded-lg"
              >
                Hủy
              </Button>
              <Button
                onClick={handleAddWallet}
                disabled={!validateAddress(newAddress)}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Thêm Ví
              </Button>
            </div>
          </motion.div>
        ) : (
          wallets.length < 5 && (
            <Button
              onClick={() => setShowAddForm(true)}
              variant="outline"
              className="w-full border-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl py-6"
            >
              <Plus className="w-5 h-5 mr-2" />
              Thêm Ví Dự Phòng (Tối đa 5)
            </Button>
          )
        )}
      </AnimatePresence>
    </div>
  );
}