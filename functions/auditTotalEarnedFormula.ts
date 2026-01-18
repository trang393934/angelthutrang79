import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Auditing Total Earned Formula...');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    // Group logs by user
    const logsByUser = {};
    for (const log of allLogs) {
      if (!logsByUser[log.user_email]) {
        logsByUser[log.user_email] = [];
      }
      logsByUser[log.user_email].push(log);
    }
    
    let systemTotalFromBalance = 0;
    let systemTotalFromLogs = 0;
    let discrepancyCount = 0;
    const discrepancies = [];

    // Check all users
    for (const balance of allBalances) {
      // Total from balance record
      const fromBalance = (balance.net_valid_coins || 0) + (balance.frozen_balance || 0);
      systemTotalFromBalance += fromBalance;
      
      // Total from audit logs
      const userLogs = logsByUser[balance.user_email] || [];
      const fromLogs = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      systemTotalFromLogs += fromLogs;
      
      if (Math.abs(fromBalance - fromLogs) > 0) {
        discrepancyCount++;
        if (discrepancies.length < 20) {
          discrepancies.push({
            email: balance.user_email,
            from_balance_fields: fromBalance,
            from_audit_logs: fromLogs,
            difference: fromBalance - fromLogs,
            net_valid: balance.net_valid_coins || 0,
            frozen: balance.frozen_balance || 0,
            log_count: userLogs.length
          });
        }
      }
    }

    console.log(`\n📊 FORMULA VERIFICATION:`);
    console.log(`Total from Balance Fields (net_valid + frozen): ${systemTotalFromBalance.toLocaleString()}`);
    console.log(`Total from Audit Logs: ${systemTotalFromLogs.toLocaleString()}`);
    console.log(`Discrepancy: ${(systemTotalFromBalance - systemTotalFromLogs).toLocaleString()} coins`);
    console.log(`Users with discrepancies: ${discrepancyCount}`);

    return Response.json({
      success: true,
      formula_verification: {
        total_from_balance_fields: systemTotalFromBalance,
        total_from_audit_logs: systemTotalFromLogs,
        difference: systemTotalFromBalance - systemTotalFromLogs,
        users_checked: Math.min(500, allBalances.length),
        users_with_discrepancies: discrepancyCount,
        formula_correct: systemTotalFromBalance === systemTotalFromLogs
      },
      sample_discrepancies: discrepancies
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});