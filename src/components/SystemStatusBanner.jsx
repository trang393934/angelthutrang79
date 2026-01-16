import React from 'react';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SystemStatusBanner() {
  const [status, setStatus] = React.useState('maintenance'); // 'normal', 'maintenance', 'warning'

  const statusConfig = {
    normal: {
      icon: CheckCircle2,
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
      iconColor: 'text-green-600',
      title: '✅ Hệ Thống Hoạt Động Bình Thường',
      message: 'Tất cả chức năng đang hoạt động ổn định.'
    },
    maintenance: {
      icon: AlertTriangle,
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
      iconColor: 'text-yellow-600',
      title: '⚠️ Hệ Thống Đang Bảo Trì & Kiểm Tra',
      message: 'Chúng tôi đang audit và chuẩn hóa dữ liệu để đảm bảo tính chính xác. Mọi giao dịch vẫn được ghi nhận đầy đủ. Xin lỗi vì sự bất tiện này.'
    },
    warning: {
      icon: Info,
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
      iconColor: 'text-red-600',
      title: '🚨 Cảnh Báo Quan Trọng',
      message: 'Đang phát hiện sai sót trong hệ thống. Vui lòng không thực hiện withdrawal cho đến khi có thông báo mới.'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${config.bg} border-2 ${config.border} rounded-xl p-4 mb-6 shadow-lg`}
    >
      <div className="flex items-start gap-4">
        <Icon className={`w-6 h-6 ${config.iconColor} flex-shrink-0 mt-1`} />
        <div className="flex-1">
          <h3 className={`${config.text} font-bold text-lg mb-2`}>{config.title}</h3>
          <p className={`${config.text} mb-3`}>{config.message}</p>
          
          {status === 'maintenance' && (
            <div className="space-y-2">
              <p className={`${config.text} font-semibold text-sm`}>📋 Kế Hoạch Hành Động:</p>
              <ul className={`${config.text} text-sm space-y-1 list-disc list-inside`}>
                <li>✅ Đóng băng tất cả tính toán tự động</li>
                <li>🔍 Audit từng user để xác định số liệu chính xác</li>
                <li>📊 Công khai dashboard minh bạch cho users tự check</li>
                <li>💰 Bồi thường cho users bị ảnh hưởng</li>
                <li>🛡️ Cải thiện hệ thống để tránh sai sót tương lai</li>
              </ul>
              <a 
                href="/TransparencyDashboard" 
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                🔍 Xem Dashboard Minh Bạch
              </a>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}