import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TỪ CHỐI CÂU HỎI TỪ CHỜ ADMIN REVIEW
 * 
 * Khi admin từ chối:
 * - Trừ điểm từ admin_review_pending
 * - Cộng điểm vào frozen_balance
 * - Cập nhật QuestionAuditLog
 * - Cập nhật UserLevel.total_points (trừ đi frozen)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { log_ids, reason = 'Admin từ chối' } = await req.json();

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return Response.json({ error: 'Missing log_ids array' }, { status: 400 });
    }

    const results = [];

    for (const logId of log_ids) {
      const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ id: logId });
      if (logs.length === 0) continue;
      
      const log = logs[0];

      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
        user_email: log.user_email 
      });
      
      if (balances.length === 0) continue;
      const balance = balances[0];

      const coinsToMove = log.coins_earned || 0;
      const currentAdminReview = balance.admin_review_pending || 0;
      const currentFrozen = balance.frozen_balance || 0;

      // Chuyển điểm: admin_review_pending → frozen_balance
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        admin_review_pending: Math.max(0, currentAdminReview - coinsToMove),
        frozen_balance: currentFrozen + coinsToMove
      });

      // Update audit log
      await base44.asServiceRole.entities.QuestionAuditLog.update(logId, {
        coin_category: 'frozen',
        exclusion_reason: 'low_quality'
      });

      // Update UserLevel.total_points (trừ đi frozen mới)
      const totalEarned = balance.total_earned || 0;
      const newFrozenTotal = currentFrozen + coinsToMove;
      const newLevelPoints = totalEarned - newFrozenTotal;

      const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ 
        user_email: log.user_email 
      });
      
      if (userLevels.length > 0) {
        await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
          total_points: Math.max(0, newLevelPoints)
        });
      }

      // Log transaction
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: log.user_email,
        amount: 0,
        type: 'admin_adjustment',
        description: `❌ Admin từ chối câu #${log.question_number_in_day}: "${log.question_text.substring(0, 50)}..."\n💰 ${coinsToMove.toLocaleString()} → Đóng Băng Vĩnh Viễn\n📝 ${reason}`,
        processed_by: user.email
      });

      results.push({ 
        log_id: logId, 
        user_email: log.user_email,
        coins_moved: coinsToMove,
        success: true 
      });
    }

    return Response.json({
      success: true,
      rejected_count: results.length,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});