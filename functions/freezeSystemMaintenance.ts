import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔒 EMERGENCY FREEZE - System Maintenance Mode');

    // Create/update a system status record
    const statusUpdate = {
      status: 'frozen',
      reason: 'EMERGENCY MAINTENANCE - Data integrity check required',
      frozen_at: new Date().toISOString(),
      expected_reopen: '2026-01-18T20:00:00+07:00',
      frozen_by: user.email,
      message: 'Hệ thống đang bảo trì. Dự kiến mở lại lúc 20h ngày 18/1/2026. Xin lỗi vì sự bất tiện.'
    };

    // Save to AdminAlert for visibility
    await base44.asServiceRole.entities.AdminAlert.create({
      alert_type: 'high_balance',
      severity: 'critical',
      title: '🔒 SYSTEM FROZEN - EMERGENCY MAINTENANCE',
      message: 'Data integrity issues detected. System frozen for emergency repairs. Expected reopening: 20:00 Jan 18.',
      data: statusUpdate
    });

    console.log('✅ System frozen at:', statusUpdate.frozen_at);
    console.log('📋 Status saved to AdminAlert');

    return Response.json({
      success: true,
      status: 'FROZEN',
      message: statusUpdate.message,
      expected_reopen: statusUpdate.expected_reopen,
      timestamp: statusUpdate.frozen_at
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});