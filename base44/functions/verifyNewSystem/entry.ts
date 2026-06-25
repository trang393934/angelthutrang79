import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * KIỂM TRA TỔNG THỂ HỆ THỐNG - LOGIC MỚI
 * 
 * Công thức:
 * 1. total_earned = KHÔNG giảm khi rút tiền
 * 2. available_balance = 10 câu hợp lệ đầu tiên/ngày
 * 3. admin_review_pending = Câu 11+ mỗi ngày
 * 4. frozen_balance = Câu trùng/chào/spam
 * 5. UserLevel.total_points = total_earned - frozen_balance
 * 6. Chờ Duyệt Thanh Toán (hiển thị) = available_balance + admin_review_pending
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all data
    const [balances, levels] = await Promise.all([
      base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000),
      base44.asServiceRole.entities.UserLevel.list('-created_date', 10000)
    ]);

    const levelMap = new Map(levels.map(l => [l.user_email, l]));
    
    const report = {
      timestamp: new Date().toISOString(),
      total_users: balances.length,
      system_totals: {
        total_earned: 0,
        frozen_balance: 0,
        admin_review_pending: 0,
        available_balance: 0,
        paid_amount: 0,
        pending_payment_display: 0, // available + admin_review
        clean_level_points: 0 // total_earned - frozen
      },
      users: [],
      issues: []
    };

    for (const balance of balances) {
      const level = levelMap.get(balance.user_email);
      
      const totalEarned = balance.total_earned || 0;
      const frozen = balance.frozen_balance || 0;
      const adminReview = balance.admin_review_pending || 0;
      const available = balance.available_balance || 0;
      const paid = balance.paid_amount || 0;
      
      const correctLevelPoints = totalEarned - frozen;
      const currentLevelPoints = level?.total_points || 0;
      const pendingPaymentDisplay = available + adminReview;

      // Accumulate system totals
      report.system_totals.total_earned += totalEarned;
      report.system_totals.frozen_balance += frozen;
      report.system_totals.admin_review_pending += adminReview;
      report.system_totals.available_balance += available;
      report.system_totals.paid_amount += paid;
      report.system_totals.pending_payment_display += pendingPaymentDisplay;
      report.system_totals.clean_level_points += correctLevelPoints;

      const userReport = {
        email: balance.user_email,
        balance: {
          total_earned: totalEarned,
          frozen_balance: frozen,
          admin_review_pending: adminReview,
          available_balance: available,
          paid_amount: paid,
          pending_payment_display: pendingPaymentDisplay
        },
        level: {
          current_points: currentLevelPoints,
          correct_points: correctLevelPoints,
          needs_update: currentLevelPoints !== correctLevelPoints,
          current_level: level?.current_level || 'N/A'
        },
        formulas: {
          clean_level: `${totalEarned} - ${frozen} = ${correctLevelPoints}`,
          pending_display: `${available} + ${adminReview} = ${pendingPaymentDisplay}`
        }
      };

      report.users.push(userReport);

      // Check for issues
      if (currentLevelPoints !== correctLevelPoints) {
        report.issues.push({
          user: balance.user_email,
          issue: 'Level points mismatch',
          current: currentLevelPoints,
          should_be: correctLevelPoints
        });
      }
    }

    return Response.json(report);

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});