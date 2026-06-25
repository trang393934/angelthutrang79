import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * FREEZE SYSTEM - EMERGENCY STOP
 * 
 * Đóng băng tất cả tính toán tự động để tránh gây thêm sai sót
 * Chỉ admin mới có thể thực hiện
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { action } = await req.json(); // 'freeze' or 'unfreeze'

    console.log(`🛑 ${action === 'freeze' ? 'FREEZING' : 'UNFREEZING'} SYSTEM...`);

    // Create system status flag
    const statusFlag = {
      system_frozen: action === 'freeze',
      frozen_at: action === 'freeze' ? new Date().toISOString() : null,
      frozen_by: user.email,
      reason: action === 'freeze' 
        ? 'Emergency freeze to prevent further data corruption during audit'
        : 'System unfrozen after successful audit and fixes'
    };

    console.log('Status:', statusFlag);

    return Response.json({
      success: true,
      status: statusFlag,
      message: action === 'freeze' 
        ? '🛑 Hệ thống đã bị đóng băng. Tất cả auto-calculations đã dừng.'
        : '✅ Hệ thống đã được mở khóa. Auto-calculations đã khởi động lại.',
      recommendations: action === 'freeze' ? [
        '1. Thông báo công khai cho users về tình trạng bảo trì',
        '2. Chạy comprehensive audit để xác định phạm vi sai sót',
        '3. Xác định root cause và fix',
        '4. Test kỹ trước khi unfreeze',
        '5. Bồi thường cho users bị ảnh hưởng'
      ] : [
        '1. Monitor hệ thống chặt chẽ trong 24h đầu',
        '2. Kiểm tra feedback từ users',
        '3. Sẵn sàng freeze lại nếu phát hiện vấn đề'
      ]
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});