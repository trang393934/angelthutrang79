import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔧 Starting: Remove all manual_add + Recalculate net_valid_coins...\n');

    // Step 1: Get all manual_add transactions to delete
    console.log('📋 Step 1: Fetching all manual_add transactions...');
    const allManualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    }, '-created_date', 10000);
    
    console.log(`Found ${allManualAdds.length} manual_add transactions totaling ${allManualAdds.reduce((sum, t) => sum + t.amount, 0).toLocaleString()} coins`);

    // Delete all manual_add transactions with delays
    let deletedCount = 0;
    for (const tx of allManualAdds) {
      await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
      deletedCount++;
      if (deletedCount % 100 === 0) {
        console.log(`  ✅ Deleted ${deletedCount}/${allManualAdds.length} transactions`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.log(`✅ Deleted all ${deletedCount} manual_add transactions\n`);

    // Step 2: Get all audit logs grouped by user
    console.log('📋 Step 2: Fetching all audit logs...');
    const allAuditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    const logsByUser = {};
    for (const log of allAuditLogs) {
      if (!logsByUser[log.user_email]) {
        logsByUser[log.user_email] = [];
      }
      logsByUser[log.user_email].push(log);
    }
    console.log(`✅ Loaded ${allAuditLogs.length} audit logs for ${Object.keys(logsByUser).length} users\n`);

    // Step 3: Get all balances and recalculate
    console.log('📋 Step 3: Recalculating net_valid_coins for all users...');
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);

    let updatedCount = 0;
    const updates = [];

    for (const balance of allBalances) {
      const userLogs = logsByUser[balance.user_email] || [];
      
      // net_valid_coins = sum of all coins from audit logs (all exclusion reasons combined)
      // This represents total questions attempted (both valid and frozen)
      const correctNetValid = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      const correctTotalEarned = correctNetValid + (balance.frozen_balance || 0);
      const correctAvailable = correctNetValid - (balance.paid_amount || 0);

      // Only update if different
      if (balance.net_valid_coins !== correctNetValid || balance.total_earned !== correctTotalEarned) {
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          net_valid_coins: correctNetValid,
          total_earned: correctTotalEarned,
          available_for_withdrawal: correctAvailable
        });

        updates.push({
          email: balance.user_email,
          previous_net_valid: balance.net_valid_coins,
          new_net_valid: correctNetValid,
          difference: correctNetValid - balance.net_valid_coins,
          log_count: userLogs.length
        });

        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`  ✅ Updated ${updatedCount}/${allBalances.length} balances`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    console.log(`✅ Updated ${updatedCount} user balances\n`);

    // Step 4: Verify the fix
    console.log('📋 Step 4: Verifying the fix...');
    const remainingManualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    });
    
    console.log(`✅ Remaining manual_add transactions: ${remainingManualAdds.length} (should be 0)\n`);

    return Response.json({
      success: true,
      summary: {
        manual_add_deleted: deletedCount,
        coins_removed: allManualAdds.reduce((sum, t) => sum + t.amount, 0),
        user_balances_updated: updatedCount,
        total_users_in_system: allBalances.length,
        audit_logs_processed: allAuditLogs.length
      },
      sample_updates: updates.slice(0, 10),
      total_updates: updates.length,
      verification: {
        remaining_manual_adds: remainingManualAdds.length,
        status: remainingManualAdds.length === 0 ? '✅ PASS' : '❌ FAIL'
      }
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});