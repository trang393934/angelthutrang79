import React from 'react';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SystemStatusBanner() {
  const [status, setStatus] = React.useState('frozen'); // 'normal', 'maintenance', 'warning', 'frozen'
  const [timeLeft, setTimeLeft] = React.useState('');

  React.useEffect(() => {
    const targetDate = new Date('2026-01-18T12:00:00+07:00'); // 12h trưa 18/01/2026 (GMT+7)
    
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate - now;
      
      if (diff <= 0) {
        setTimeLeft('Hệ thống đã sẵn sàng mở lại');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${days} ngày ${hours} giờ ${minutes} phút`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update mỗi phút
    
    return () => clearInterval(interval);
  }, []);

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
    frozen: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-400',
      text: 'text-red-900',
      iconColor: 'text-red-600',
      title: '🛑 HỆ THỐNG ĐÓNG BĂNG - BẢO TRÌ KHẨN CẤP',
      message: 'Hệ thống đã NGỪNG HOẠT ĐỘNG để kiểm tra và sửa lỗi dữ liệu. Tất cả tính toán tự động, withdrawal, và transactions đã bị đóng băng. Dự kiến mở lại: 12h TRƯA ngày 18/01/2026.',
      frozen: true
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
          
          {config.frozen && (
            <div className="space-y-3">
              <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                <p className="text-red-900 font-bold text-lg mb-2">⏰ Thời Gian Mở Lại:</p>
                <p className="text-red-800 text-2xl font-bold">12:00 TRƯA - 18/01/2026</p>
                {timeLeft && (
                  <p className="text-red-700 text-sm mt-2">Còn lại: {timeLeft}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <p className={`${config.text} font-semibold text-sm`}>🚫 Chức Năng Bị Đóng Băng:</p>
                <ul className={`${config.text} text-sm space-y-1 list-disc list-inside`}>
                  <li>❌ Withdrawal requests</li>
                  <li>❌ Auto-calculations</li>
                  <li>❌ Balance updates</li>
                  <li>❌ Point rewards</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className={`${config.text} font-semibold text-sm`}>📋 Lý Do & Kế Hoạch:</p>
                <ul className={`${config.text} text-sm space-y-1 list-disc list-inside`}>
                  <li>🔍 Phát hiện sai sót nghiêm trọng trong tính toán</li>
                  <li>🛠️ Đang audit và sửa lỗi từng user</li>
                  <li>💰 Sẽ bồi thường 100% sai số + bonus xin lỗi</li>
                  <li>🛡️ Nâng cấp hệ thống để tránh sai sót tương lai</li>
                </ul>
              </div>

              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <p className="text-blue-900 font-bold mb-2">💬 Thông Điệp Xin Lỗi:</p>
                <p className="text-blue-800 text-sm">
                  Chúng tôi chân thành xin lỗi vì sự bất tiện này. Chúng tôi cam kết sẽ kiểm tra kỹ lưỡng và bồi thường đầy đủ cho mọi users bị ảnh hưởng. Cảm ơn sự kiên nhẫn và tin tưởng của bạn.
                </p>
              </div>
              
              <a 
                href="/TransparencyDashboard" 
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                🔍 Xem Dashboard Minh Bạch (Vẫn Hoạt Động)
              </a>
            </div>
          )}
          
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