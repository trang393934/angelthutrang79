import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DUYỆT CÂU HỎI TỪ CHỜ ADMIN REVIEW HOẶC FROZEN
 * 
 * Công thức:
 * Khi admin duyệt câu từ frozen → điểm được cộng ngay lập tức vào available_for_withdrawal
 * 
 * - Nếu từ admin_review_pending: Trừ admin_review_pending → Cộng available_balance
 * - Nếu từ frozen: Trừ frozen_balance → Cộng net_valid_coins
 * - Cập nhật exclusion_reason thành 'valid'
 * - Cập nhật coin_category thành 'pending_withdrawal'
 * 
 * Kết quả: available_for_withdrawal = net_valid_coins - paid_amount (tính ngay lập tức)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { log_ids, reason = 'Admin duyệt' } = await req.json();

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return Response.json({ error: 'Missing log_ids array' }, { status: 400 });
    }

    const results = [];

    for (const logId of log_ids) {
      // Fetch audit log
      const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ id: logId });
      if (logs.length === 0) continue;
      
      const log = logs[0];

      // Fetch user balance
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
        user_email: log.user_email 
      });
      
      if (balances.length === 0) continue;
      const balance = balances[0];

      const coinsToMove = log.coins_earned || 0;
      const currentAdminReview = balance.admin_review_pending || 0;
      const currentAvailable = balance.available_balance || 0;

      // Chuyển điểm: admin_review_pending → available_balance
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        admin_review_pending: Math.max(0, currentAdminReview - coinsToMove),
        available_balance: currentAvailable + coinsToMove
      });

      // Update audit log
      await base44.asServiceRole.entities.QuestionAuditLog.update(logId, {
        coin_category: 'pending_withdrawal',
        exclusion_reason: 'valid'
      });

      // Log transaction
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: log.user_email,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt câu #${log.question_number_in_day}: "${log.question_text.substring(0, 50)}..."\n💰 +${coinsToMove.toLocaleString()} → Sẵn Sàng Thanh Toán\n📝 ${reason}`,
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
      approved_count: results.length,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});