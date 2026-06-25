import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TÍNH LẠI NHANH TẤT CẢ BALANCES DỰA TRÊN AUDIT LOGS ĐÃ CÓ
 * 
 * Sử dụng QuestionAuditLog hiện có để tính lại balances theo logic mới
 * KHÔNG tạo audit logs mới → tránh rate limit
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch tất cả audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 100000);
    
    // Group logs by user
    const logsByUser = new Map();
    for (const log of allLogs) {
      if (!logsByUser.has(log.user_email)) {
        logsByUser.set(log.user_email, []);
      }
      logsByUser.get(log.user_email).push(log);
    }

    const results = [];

    for (const [userEmail, userLogs] of logsByUser) {
      // Tính toán lại balance dựa trên audit logs
      let frozenCoins = 0;
      let adminReviewPendingCoins = 0;
      let availableCoins = 0;

      // Group logs by day để tính toán đúng thứ tự
      const logsByDay = {};
      userLogs.forEach(log => {
        const day = log.question_date.split('T')[0];
        if (!logsByDay[day]) logsByDay[day] = [];
        logsByDay[day].push(log);
      });

      // Sắp xếp logs theo ngày và thứ tự trong ngày
      for (const day in logsByDay) {
        logsByDay[day].sort((a, b) => (a.question_number_in_day || 0) - (b.question_number_in_day || 0));
      }

      // Áp dụng logic mới
      for (const day in logsByDay) {
        const dayLogs = logsByDay[day];
        let validCount = 0; // Đếm câu hợp lệ (không trùng/chào)

        for (let i = 0; i < dayLogs.length; i++) {
          const log = dayLogs[i];
          const coins = log.coins_earned || 0;

          // Kiểm tra trùng/chào
          if (log.exclusion_reason === 'duplicate' || log.exclusion_reason === 'greeting') {
            // ĐÓNG BĂNG (bất kể câu số mấy)
            frozenCoins += coins;
          } else {
            // Câu hợp lệ
            if (validCount < 10) {
              // 10 câu hợp lệ đầu → AVAILABLE
              availableCoins += coins;
            } else {
              // Câu 11+ hợp lệ → ADMIN REVIEW PENDING
              adminReviewPendingCoins += coins;
            }
            validCount++;
          }
        }
      }

      const totalEarned = frozenCoins + adminReviewPendingCoins + availableCoins;

      // Update balance
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
        user_email: userEmail 
      });

      let currentPaid = 0;
      
      if (balances.length > 0) {
        const balance = balances[0];
        currentPaid = balance.paid_amount || 0;

        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: totalEarned,
          frozen_balance: frozenCoins,
          admin_review_pending: adminReviewPendingCoins,
          available_balance: availableCoins,
          paid_amount: currentPaid // Giữ nguyên
        });
      } else {
        await base44.asServiceRole.entities.CamlycoinBalance.create({
          user_email: userEmail,
          total_earned: totalEarned,
          frozen_balance: frozenCoins,
          admin_review_pending: adminReviewPendingCoins,
          available_balance: availableCoins,
          paid_amount: 0
        });
      }

      // Update UserLevel.total_points
      const levelPoints = totalEarned - frozenCoins;
      const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ 
        user_email: userEmail 
      });
      
      if (userLevels.length > 0) {
        await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
          total_points: levelPoints
        });
      }

      results.push({
        user_email: userEmail,
        total_earned: totalEarned,
        frozen: frozenCoins,
        admin_review_pending: adminReviewPendingCoins,
        available: availableCoins,
        paid: currentPaid,
        level_points: levelPoints,
        total_questions: userLogs.length
      });
    }

    // Create admin log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔄 Tính Lại Nhanh Tất Cả Balances (Từ Audit Logs)\n✅ Đã cập nhật: ${results.length} users\n📊 Logic: 10 câu hợp lệ → Available, Câu 11+ → Admin Review, Trùng/Chào → Frozen`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      total_users: results.length,
      summary: {
        total_earned: results.reduce((s, r) => s + r.total_earned, 0),
        total_frozen: results.reduce((s, r) => s + r.frozen, 0),
        total_admin_review: results.reduce((s, r) => s + r.admin_review_pending, 0),
        total_available: results.reduce((s, r) => s + r.available, 0),
        total_paid: results.reduce((s, r) => s + r.paid, 0)
      },
      results: results.sort((a, b) => b.total_earned - a.total_earned)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});