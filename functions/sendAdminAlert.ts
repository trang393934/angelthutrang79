import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ADMIN ALERT SYSTEM
 * Gửi email/notification khi phát hiện hoạt động nghi ngờ
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { alert_type, user_email, details, severity = 'medium' } = await req.json();
    
    // Get all admin users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const adminUsers = allUsers.filter(u => u.role === 'admin');

    const alertMessages = {
      high_volume: `🚨 CẢNH BÁO: User ${user_email} có hoạt động bất thường!\n\n${details}`,
      anomaly_spike: `⚠️ PHÁT HIỆN SPIKE: ${user_email}\n\n${details}`,
      high_spam_score: `🛡️ TÀI KHOẢN NGHI NGỜ: ${user_email}\n\nSpam Score cao - cần xem xét ngay.\n\n${details}`,
      appeal_submitted: `📝 KHÁNG CÁO MỚI: ${user_email}\n\n${details}`,
      frozen_coins: `❄️ ĐÓNG BĂNG COINS: ${user_email}\n\n${details}`
    };

    const subject = severity === 'high' ? '🚨 URGENT - Angel AI Alert' : 
                    severity === 'medium' ? '⚠️ Angel AI Security Alert' : 
                    '📊 Angel AI Notification';

    const message = alertMessages[alert_type] || details;

    // Send email to all admins
    for (const admin of adminUsers) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'Angel AI Security',
        to: admin.email,
        subject: subject,
        body: `${message}\n\n---\n\nThời gian: ${new Date().toLocaleString('vi-VN')}\n\nVào dashboard để xem chi tiết: ${Deno.env.get('BASE44_APP_URL') || 'Angel AI'}`
      });
    }

    return Response.json({ 
      success: true, 
      admins_notified: adminUsers.length 
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});