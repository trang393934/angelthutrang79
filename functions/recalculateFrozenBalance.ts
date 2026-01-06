import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all audit logs and balances
    const [auditLogs, balances] = await Promise.all([
      base44.entities.QuestionAuditLog.list('-created_date', 10000),
      base44.entities.CamlycoinBalance.list('-created_date', 10000)
    ]);

    const results = {
      total: 0,
      updated: 0,
      correct: 0,
      details: []
    };

    // Group audit logs by user email
    const frozenCoinsMap = new Map();
    
    for (const log of auditLogs) {
      // Chỉ tính các câu hỏi bị đóng băng:
      // - coin_category = 'frozen'
      // - exclusion_reason là: duplicate, greeting, exceeds_daily_limit
      if (
        log.coin_category === 'frozen' && 
        ['duplicate', 'greeting', 'exceeds_daily_limit'].includes(log.exclusion_reason)
      ) {
        const currentTotal = frozenCoinsMap.get(log.user_email) || 0;
        frozenCoinsMap.set(log.user_email, currentTotal + (log.coins_earned || 0));
      }
    }

    // Update each user's balance
    for (const balance of balances) {
      results.total++;
      
      const correctFrozenBalance = frozenCoinsMap.get(balance.user_email) || 0;
      const currentFrozenBalance = balance.frozen_balance || 0;

      // Check if frozen_balance needs update
      if (correctFrozenBalance !== currentFrozenBalance) {
        const totalEarned = balance.total_earned || 0;
        const paidAmount = balance.paid_amount || 0;
        const pendingReview = balance.pending_review_balance || 0;
        
        // Calculate available = unpaid - frozen - pending_review
        const unpaidAmount = totalEarned - paidAmount;
        const newAvailableBalance = unpaidAmount - correctFrozenBalance - pendingReview;

        await base44.entities.CamlycoinBalance.update(balance.id, {
          frozen_balance: correctFrozenBalance,
          available_balance: Math.max(0, newAvailableBalance) // Đảm bảo không âm
        });

        results.updated++;
        results.details.push({
          user_email: balance.user_email,
          old_frozen: currentFrozenBalance,
          new_frozen: correctFrozenBalance,
          old_available: balance.available_balance || 0,
          new_available: Math.max(0, newAvailableBalance),
          total_earned: totalEarned,
          paid_amount: paidAmount,
          pending_review: pendingReview
        });
      } else {
        results.correct++;
      }
    }

    // Create admin transaction log
    await base44.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔒 Tính Lại Số Liệu Đóng Băng
✅ Đã cập nhật: ${results.updated} users
🎯 Đã đúng: ${results.correct} users
📊 Tổng: ${results.total} users

Nguồn: QuestionAuditLog (duplicate, greeting, exceeds_daily_limit)`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      summary: {
        total_users: results.total,
        updated: results.updated,
        already_correct: results.correct,
        total_audit_logs_checked: auditLogs.length,
        total_frozen_coins_found: Array.from(frozenCoinsMap.values()).reduce((a, b) => a + b, 0)
      },
      details: results.details
    });

  } catch (error) {
    console.error('Recalculate frozen balance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});