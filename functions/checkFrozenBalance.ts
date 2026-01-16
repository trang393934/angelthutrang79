import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all balances
    const allBalances = await base44.entities.CamlycoinBalance.list('-created_date', 10000);
    
    // Calculate total frozen from database
    const totalFrozenFromDB = allBalances.reduce((sum, b) => sum + (b.frozen_balance || 0), 0);
    
    // Calculate from QuestionAuditLog
    const allLogs = await base44.entities.QuestionAuditLog.list('-created_date', 50000);
    const frozenLogs = allLogs.filter(log => 
      log.exclusion_reason && 
      log.exclusion_reason !== 'valid' && 
      log.coin_category === 'frozen'
    );
    const totalFrozenFromLogs = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    
    // Top users with frozen
    const topFrozen = allBalances
      .filter(b => (b.frozen_balance || 0) > 0)
      .sort((a, b) => (b.frozen_balance || 0) - (a.frozen_balance || 0))
      .slice(0, 10)
      .map(b => ({
        user_email: b.user_email,
        frozen_balance: b.frozen_balance || 0,
        net_valid_coins: b.net_valid_coins || 0,
        total_earned: b.total_earned || 0
      }));

    return Response.json({
      summary: {
        total_frozen_from_balances: totalFrozenFromDB,
        total_frozen_from_logs: totalFrozenFromLogs,
        difference: Math.abs(totalFrozenFromDB - totalFrozenFromLogs),
        is_accurate: Math.abs(totalFrozenFromDB - totalFrozenFromLogs) < 100,
        total_users_with_frozen: allBalances.filter(b => (b.frozen_balance || 0) > 0).length
      },
      top_frozen_users: topFrozen,
      logs_summary: {
        total_logs: allLogs.length,
        frozen_logs_count: frozenLogs.length
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});