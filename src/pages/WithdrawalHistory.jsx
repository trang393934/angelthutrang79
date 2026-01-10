import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, CheckCircle2, XCircle, Clock, Search, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export default function WithdrawalHistory() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: withdrawalRequests = [], isLoading } = useQuery({
    queryKey: ['withdrawalRequests', currentUser?.email, filterStatus, dateRange, customStartDate, customEndDate, searchTerm],
    queryFn: async () => {
      if (!currentUser) return [];

      let query = {};
      if (currentUser.role !== 'admin') {
        query.user_email = currentUser.email;
      }

      if (filterStatus !== 'all') {
        query.status = filterStatus;
      }

      const requests = await base44.entities.WithdrawalRequest.filter(query, '-created_date', 1000);

      return requests.filter(req => {
        if (searchTerm && !req.withdrawal_address.toLowerCase().includes(searchTerm.toLowerCase()) && (!currentUser || currentUser.role !== 'admin' || !req.user_email.toLowerCase().includes(searchTerm.toLowerCase()))) {
          return false;
        }

        const reqDate = new Date(req.created_date);
        let startDate, endDate;

        switch (dateRange) {
          case '7days':
            startDate = startOfDay(subDays(new Date(), 7));
            endDate = endOfDay(new Date());
            break;
          case '30days':
            startDate = startOfDay(subDays(new Date(), 30));
            endDate = endOfDay(new Date());
            break;
          case '90days':
            startDate = startOfDay(subDays(new Date(), 90));
            endDate = endOfDay(new Date());
            break;
          case 'custom':
            if (customStartDate) startDate = startOfDay(new Date(customStartDate));
            if (customEndDate) endDate = endOfDay(new Date(customEndDate));
            break;
          default:
            return true;
        }

        if (startDate && reqDate < startDate) return false;
        if (endDate && reqDate > endDate) return false;

        return true;
      });
    },
    enabled: !!currentUser,
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="w-3 h-3 mr-1" /> Chờ duyệt</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Đã duyệt</Badge>;
      case 'processing':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300"><Clock className="w-3 h-3 mr-1" /> Đang xử lý</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Hoàn thành</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="w-3 h-3 mr-1" /> Thất bại</Badge>;
      case 'rejected':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300"><XCircle className="w-3 h-3 mr-1" /> Từ chối</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-300/50 via-pink-400/30 to-transparent blur-3xl" />
      </div>

      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(168,85,247,0.4)',
                    '0 0 40px rgba(168,85,247,0.6)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
              >
                <Wallet className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold tracking-wide text-lg">Lịch Sử Rút Tiền</h1>
                <p className="text-purple-600 text-xs font-medium">Quản lý yêu cầu rút Camlycoin</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="pt-20 pb-32 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-bold text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-500" />
              Bộ Lọc
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="text-purple-600"
            >
              {showFilters ? <XCircle className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
            </Button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-slate-700 text-sm font-medium mb-2 block">Tìm Kiếm</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm theo địa chỉ ví hoặc email người dùng..."
                      className="pl-10 bg-white border-2 border-purple-300 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 text-sm font-medium mb-2 block">Trạng Thái</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setFilterStatus('all')}
                      size="sm"
                      variant={filterStatus === 'all' ? 'default' : 'outline'}
                      className={filterStatus === 'all' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'border-purple-300'}
                    >
                      Tất cả
                    </Button>
                    {['pending', 'approved', 'processing', 'completed', 'failed', 'rejected'].map(status => (
                      <Button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        size="sm"
                        variant={filterStatus === status ? 'default' : 'outline'}
                        className={filterStatus === status ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'border-purple-300'}
                      >
                        {status === 'pending' && 'Chờ duyệt'}
                        {status === 'approved' && 'Đã duyệt'}
                        {status === 'processing' && 'Đang xử lý'}
                        {status === 'completed' && 'Hoàn thành'}
                        {status === 'failed' && 'Thất bại'}
                        {status === 'rejected' && 'Từ chối'}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 text-sm font-medium mb-2 block flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Khoảng Thời Gian
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[ 
                      { value: 'all', label: 'Tất cả' },
                      { value: '7days', label: '7 ngày' },
                      { value: '30days', label: '30 ngày' },
                      { value: '90days', label: '90 ngày' },
                      { value: 'custom', label: 'Tùy chỉnh' }
                    ].map((range) => (
                      <Button
                        key={range.value}
                        onClick={() => setDateRange(range.value)}
                        size="sm"
                        variant={dateRange === range.value ? 'default' : 'outline'}
                        className={dateRange === range.value ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'border-purple-300'}
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>

                  {dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-600 text-xs mb-1 block">Từ ngày</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="bg-white border-2 border-purple-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-slate-600 text-xs mb-1 block">Đến ngày</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="bg-white border-2 border-purple-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setDateRange('all');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  variant="outline"
                  className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  Xóa Bộ Lọc
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 font-bold text-xl flex items-center gap-2">
              <Wallet className="w-6 h-6 text-purple-500" />
              Danh Sách Yêu Cầu Rút Tiền
            </h3>
            <Badge className="bg-purple-100 text-purple-800">
              {withdrawalRequests.length} yêu cầu
            </Badge>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full mx-auto mb-4" />
              <p className="text-slate-700 font-medium">Đang tải yêu cầu rút tiền...</p>
            </div>
          ) : withdrawalRequests.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <p className="text-slate-700 font-medium text-lg mb-2">Không Có Yêu Cầu Rút Tiền</p>
              <p className="text-slate-600 text-sm">
                Bạn chưa thực hiện yêu cầu rút tiền nào hoặc không có yêu cầu phù hợp với bộ lọc.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
              {withdrawalRequests.map((req, index) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white border-2 border-purple-100 rounded-2xl p-4 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getStatusBadge(req.status)}
                        <span className="text-xs text-slate-500">
                          {format(new Date(req.created_date), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-slate-900 font-medium mb-1 break-words">Số tiền: {req.amount.toLocaleString()} Camlycoin</p>
                      <p className="text-slate-700 text-sm break-words">Địa chỉ ví: {req.withdrawal_address}</p>
                      {currentUser?.role === 'admin' && (
                        <p className="text-slate-700 text-sm">Email người dùng: {req.user_email}</p>
                      )}
                      {req.processed_by && (
                        <p className="text-xs text-purple-600">Xử lý bởi: {req.processed_by}</p>
                      )}
                      {req.rejection_reason && (
                        <p className="text-xs text-red-500">Lý do từ chối: {req.rejection_reason}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-purple-600">{req.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-600">Camlycoin</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}