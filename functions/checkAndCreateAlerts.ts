import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { thresholds } = await req.json().catch(() => ({}));

    // Default thresholds
    const HIGH_BALANCE_THRESHOLD = thresholds?.high_balance || 500000;
    const WITHDRAWAL_COUNT_THRESHOLD = thresholds?.withdrawal_count || 5;
    const WITHDRAWAL_TIME_WINDOW_HOURS = thresholds?.withdrawal_time_window || 24;
    const REVIEW_SPIKE_THRESHOLD = thresholds?.review_spike || 200000;

    const alerts = [];
    const now = new Date();

    // 1. Check High Available Balance
    console.log('📊 Checking high balance alerts...');
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-available_balance', 100);
    
    for (const balance of allBalances) {
      if ((balance.available_balance || 0) >= HIGH_BALANCE_THRESHOLD) {
        // Check if alert already exists and is new
        const existingAlerts = await base44.asServiceRole.entities.AdminAlert.filter({
          alert_type: 'high_balance',
          user_email: balance.user_email,
          status: 'new'
        });

        if (existingAlerts.length === 0) {
          alerts.push({
            alert_type: 'high_balance',
            severity: (balance.available_balance || 0) >= HIGH_BALANCE_THRESHOLD * 2 ? 'critical' : 'high',
            title: `⚠️ Số dư cao: ${balance.user_email}`,
            message: `User ${balance.user_email} có ${(balance.available_balance || 0).toLocaleString()} Camlycoin Sẵn Sàng Thanh Toán (vượt ngưỡng ${HIGH_BALANCE_THRESHOLD.toLocaleString()})`,
            user_email: balance.user_email,
            data: {
              available_balance: balance.available_balance,
              threshold: HIGH_BALANCE_THRESHOLD,
              total_earned: balance.total_earned
            },
            status: 'new'
          });
        }
      }
    }

    // 2. Check Multiple Completed Withdrawals in Short Time
    console.log('📊 Checking multiple withdrawals...');
    const timeWindowStart = new Date(now.getTime() - WITHDRAWAL_TIME_WINDOW_HOURS * 60 * 60 * 1000);
    const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-processed_date', 1000);
    
    const recentCompletedWithdrawals = allWithdrawals.filter(w => 
      w.status === 'completed' && 
      w.processed_date && 
      new Date(w.processed_date) >= timeWindowStart
    );

    // Group by user
    const withdrawalsByUser = {};
    recentCompletedWithdrawals.forEach(w => {
      if (!withdrawalsByUser[w.user_email]) {
        withdrawalsByUser[w.user_email] = [];
      }
      withdrawalsByUser[w.user_email].push(w);
    });

    for (const [userEmail, withdrawals] of Object.entries(withdrawalsByUser)) {
      if (withdrawals.length >= WITHDRAWAL_COUNT_THRESHOLD) {
        const existingAlerts = await base44.asServiceRole.entities.AdminAlert.filter({
          alert_type: 'multiple_withdrawals',
          user_email: userEmail,
          status: 'new'
        });

        if (existingAlerts.length === 0) {
          const totalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
          
          alerts.push({
            alert_type: 'multiple_withdrawals',
            severity: withdrawals.length >= WITHDRAWAL_COUNT_THRESHOLD * 2 ? 'critical' : 'medium',
            title: `🚨 Nhiều yêu cầu rút tiền: ${userEmail}`,
            message: `User ${userEmail} đã hoàn thành ${withdrawals.length} yêu cầu rút tiền trong ${WITHDRAWAL_TIME_WINDOW_HOURS}h (tổng ${totalAmount.toLocaleString()} Camlycoin)`,
            user_email: userEmail,
            data: {
              withdrawal_count: withdrawals.length,
              total_amount: totalAmount,
              time_window_hours: WITHDRAWAL_TIME_WINDOW_HOURS,
              withdrawal_ids: withdrawals.map(w => w.id)
            },
            status: 'new'
          });
        }
      }
    }

    // 3. Check Admin Review Pending Spike
    console.log('📊 Checking review pending spikes...');
    const highReviewBalances = allBalances.filter(b => 
      (b.admin_review_pending || 0) >= REVIEW_SPIKE_THRESHOLD
    );

    for (const balance of highReviewBalances) {
      const existingAlerts = await base44.asServiceRole.entities.AdminAlert.filter({
        alert_type: 'review_spike',
        user_email: balance.user_email,
        status: 'new'
      });

      if (existingAlerts.length === 0) {
        alerts.push({
          alert_type: 'review_spike',
          severity: (balance.admin_review_pending || 0) >= REVIEW_SPIKE_THRESHOLD * 2 ? 'critical' : 'high',
          title: `📈 Chờ Review cao: ${balance.user_email}`,
          message: `User ${balance.user_email} có ${(balance.admin_review_pending || 0).toLocaleString()} Camlycoin Chờ Admin Review (vượt ngưỡng ${REVIEW_SPIKE_THRESHOLD.toLocaleString()})`,
          user_email: balance.user_email,
          data: {
            admin_review_pending: balance.admin_review_pending,
            threshold: REVIEW_SPIKE_THRESHOLD,
            total_earned: balance.total_earned
          },
          status: 'new'
        });
      }
    }

    // Create alerts in database
    console.log(`📝 Creating ${alerts.length} new alerts...`);
    for (const alert of alerts) {
      await base44.asServiceRole.entities.AdminAlert.create(alert);
    }

    // Send email notification if there are critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.log(`📧 Sending email for ${criticalAlerts.length} critical alerts...`);
      
      const emailBody = `🚨 CẢNH BÁO QUAN TRỌNG - Angel AI System

Có ${criticalAlerts.length} cảnh báo mức CRITICAL cần xử lý ngay:

${criticalAlerts.map((a, i) => `
${i + 1}. ${a.title}
   ${a.message}
   Mức độ: ${a.severity.toUpperCase()}
`).join('\n')}

Vui lòng kiểm tra Admin Dashboard để xem chi tiết và xử lý.

---
Angel AI Monitoring System
${new Date().toLocaleString('vi-VN')}`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'trang393934@gmail.com',
        subject: `🚨 [CRITICAL] ${criticalAlerts.length} Cảnh Báo Cần Xử Lý - Angel AI`,
        body: emailBody
      }).catch(err => console.error('Email error:', err));
    }

    return Response.json({
      success: true,
      message: 'Alert check completed',
      alerts_created: alerts.length,
      critical_alerts: criticalAlerts.length,
      alerts: alerts
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});