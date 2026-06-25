import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔧 Recalculating net_valid_coins from audit logs only...\n');

    // Step 1: Get all audit logs grouped by user
    console.log('📋 Fetching all audit logs...');
    const allAuditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    const logsByUser = {};
    for (const log of allAuditLogs) {
      if (!logsByUser[log.user_email]) {
        logsByUser[log.user_email] = [];
      }
      logsByUser[log.user_email].push(log);
    }
    console.log(`✅ Loaded ${allAuditLogs.length} audit logs for ${Object.keys(logsByUser).length} users\n`);

    // Step 2: Update all balances
    console.log('📋 Recalculating net_valid_coins for all users...');
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);

    let updatedCount = 0;
    const updates = [];

    for (let i = 0; i < allBalances.length; i++) {
      const balance = allBalances[i];
      const userLogs = logsByUser[balance.user_email] || [];
      
      // net_valid_coins = sum of all coins from audit logs only
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
      }

      if ((i + 1) % 100 === 0) {
        console.log(`  ✅ Processed ${i + 1}/${allBalances.length} users`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Updated ${updatedCount}/${allBalances.length} user balances\n`);

    // Step 3: Verify
    console.log('📋 Verifying totals...');
    const verifyBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    const totalEarned = verifyBalances.reduce((sum, b) => sum + (b.total_earned || 0), 0);
    const totalPaid = verifyBalances.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
    const correctUnpaid = totalEarned - totalPaid;

    console.log(`System totals:`);
    console.log(`  Total Earned: ${totalEarned.toLocaleString()}`);
    console.log(`  Total Paid: ${totalPaid.toLocaleString()}`);
    console.log(`  Total Unpaid: ${correctUnpaid.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        balances_updated: updatedCount,
        total_users: allBalances.length,
        audit_logs_processed: allAuditLogs.length
      },
      system_totals: {
        total_earned: totalEarned,
        total_paid: totalPaid,
        total_unpaid: correctUnpaid
      },
      sample_updates: updates.slice(0, 15),
      total_updates: updates.length
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});