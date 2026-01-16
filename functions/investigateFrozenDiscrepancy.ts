import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all balances and logs
    const allBalances = await base44.entities.CamlycoinBalance.list('-created_date', 10000);
    const allLogs = await base44.entities.QuestionAuditLog.list('-created_date', 50000);

    // Calculate frozen from logs per user
    const frozenByUser = {};
    allLogs.forEach(log => {
      if (log.exclusion_reason && log.exclusion_reason !== 'valid' && log.coin_category === 'frozen') {
        frozenByUser[log.user_email] = (frozenByUser[log.user_email] || 0) + (log.coins_earned || 0);
      }
    });

    // Find discrepancies
    const discrepancies = [];
    let totalDiscrepancy = 0;

    allBalances.forEach(balance => {
      const frozenInDB = balance.frozen_balance || 0;
      const frozenFromLogs = frozenByUser[balance.user_email] || 0;
      const diff = frozenInDB - frozenFromLogs;

      if (Math.abs(diff) > 0) {
        discrepancies.push({
          user_email: balance.user_email,
          frozen_in_db: frozenInDB,
          frozen_from_logs: frozenFromLogs,
          difference: diff,
          logs_count: allLogs.filter(l => l.user_email === balance.user_email && l.coin_category === 'frozen').length
        });
        totalDiscrepancy += diff;
      }
    });

    // Sort by absolute difference
    discrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    // Check for logs with wrong coin_category
    const wrongCategoryLogs = allLogs.filter(log => 
      log.exclusion_reason && 
      log.exclusion_reason !== 'valid' && 
      log.coin_category !== 'frozen'
    );

    return Response.json({
      summary: {
        total_discrepancy: totalDiscrepancy,
        users_with_discrepancy: discrepancies.length,
        total_users_checked: allBalances.length,
        wrong_category_logs_count: wrongCategoryLogs.length
      },
      top_discrepancies: discrepancies.slice(0, 20),
      wrong_category_samples: wrongCategoryLogs.slice(0, 10).map(log => ({
        user_email: log.user_email,
        exclusion_reason: log.exclusion_reason,
        coin_category: log.coin_category,
        coins_earned: log.coins_earned,
        question_text: log.question_text?.substring(0, 50)
      })),
      recommendation: totalDiscrepancy > 0 
        ? '⚠️ frozen_balance trong DB cao hơn logs. Cần sync lại từ audit logs.'
        : '✅ Có thể có logs bị thiếu hoặc chưa được tạo đúng.'
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});