import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, reason, estimated_time, message } = await req.json();

    // Get or create system config
    const configs = await base44.asServiceRole.entities.SystemConfig.filter({ config_key: 'system_status' });
    
    if (action === 'freeze') {
      const freezeData = {
        config_key: 'system_status',
        is_frozen: true,
        freeze_reason: reason || 'Hệ thống đang bảo trì sửa chữa lỗi tính điểm nghiêm trọng',
        estimated_restore_time: estimated_time || 'Sẽ thông báo sau khi hoàn tất kiểm tra và khôi phục',
        maintenance_message: message || '🚨 HỆ THỐNG TẠM DỪNG BẢO TRÌ\n\nHệ thống phát hiện lỗi nghiêm trọng về tính điểm và đang tiến hành khắc phục khẩn cấp.\n\nĐội ngũ kỹ thuật đang:\n✅ Kiểm tra toàn bộ giao dịch\n✅ Xác định và xóa dữ liệu sai\n✅ Khôi phục số điểm chính xác cho tất cả users\n\nVui lòng quay lại sau. Chúng tôi sẽ thông báo ngay khi hoàn tất.'
      };

      if (configs.length > 0) {
        await base44.asServiceRole.entities.SystemConfig.update(configs[0].id, freezeData);
      } else {
        await base44.asServiceRole.entities.SystemConfig.create(freezeData);
      }

      // Send admin alert
      await base44.asServiceRole.entities.AdminAlert.create({
        title: '🚨 Hệ Thống Đã Bị Đóng Băng',
        alert_type: 'system_frozen',
        severity: 'critical',
        message: 'Hệ thống đã được đóng băng khẩn cấp do lỗi tính điểm nghiêm trọng.',
        status: 'new'
      });

      return Response.json({
        success: true,
        message: 'Hệ thống đã được đóng băng. Tất cả users sẽ thấy thông báo bảo trì.'
      });
    } else if (action === 'unfreeze') {
      if (configs.length > 0) {
        await base44.asServiceRole.entities.SystemConfig.update(configs[0].id, {
          is_frozen: false,
          freeze_reason: null,
          estimated_restore_time: null,
          maintenance_message: null
        });
      }

      // Send admin alert
      await base44.asServiceRole.entities.AdminAlert.create({
        title: '✅ Hệ Thống Đã Được Mở Lại',
        alert_type: 'system_unfrozen',
        severity: 'info',
        message: 'Hệ thống đã được khôi phục và mở lại cho users.',
        status: 'new'
      });

      return Response.json({
        success: true,
        message: 'Hệ thống đã được mở lại. Users có thể truy cập bình thường.'
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});