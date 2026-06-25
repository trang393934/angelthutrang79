import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Starting audit for top 31-51 users...');

    // Fetch all balances sorted by total_earned
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    // Get users ranked 31-51
    const targetUsers = allBalances.slice(30, 51); // Index 30-50 = rank 31-51

    console.log(`📊 Auditing ${targetUsers.length} users (rank 31-51)`);

    const auditResults = [];

    for (const balance of targetUsers) {
      try {
        const userEmail = balance.user_email;
        console.log(`\n🔍 Auditing: ${userEmail}`);

        // Fetch all audit logs for this user
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        // Calculate expected values
        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason !== 'valid' && log.coin_category === 'frozen'
        );

        const expectedNetValid = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const expectedFrozen = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Fetch transactions
        const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
          user_email: userEmail 
        });

        const manualAdds = transactions
          .filter(tx => tx.type === 'manual_add')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const manualDeducts = transactions
          .filter(tx => tx.type === 'manual_deduct')
          .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

        const adminAdjustments = transactions
          .filter(tx => tx.type === 'admin_adjustment')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        // Calculate total expected net_valid
        const totalExpectedNetValid = expectedNetValid + manualAdds - manualDeducts + adminAdjustments;

        // Get withdrawals
        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
          user_email: userEmail,
          status: 'completed'
        });

        const totalPaid = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

        // Calculate expected total_earned
        const expectedTotalEarned = totalExpectedNetValid + expectedFrozen;

        // Current values
        const currentNetValid = balance.net_valid_coins || 0;
        const currentFrozen = balance.frozen_balance || 0;
        const currentTotalEarned = balance.total_earned || 0;
        const currentPaid = balance.paid_amount || 0;

        // Calculate discrepancies
        const netValidDiscrepancy = totalExpectedNetValid - currentNetValid;
        const frozenDiscrepancy = expectedFrozen - currentFrozen;
        const totalEarnedDiscrepancy = expectedTotalEarned - currentTotalEarned;
        const paidDiscrepancy = totalPaid - currentPaid;

        const hasDiscrepancy = Math.abs(netValidDiscrepancy) > 0 || 
                              Math.abs(frozenDiscrepancy) > 0 || 
                              Math.abs(totalEarnedDiscrepancy) > 0 ||
                              Math.abs(paidDiscrepancy) > 0;

        auditResults.push({
          rank: allBalances.findIndex(b => b.user_email === userEmail) + 1,
          email: userEmail,
          has_discrepancy: hasDiscrepancy,
          current: {
            net_valid_coins: currentNetValid,
            frozen_balance: currentFrozen,
            total_earned: currentTotalEarned,
            paid_amount: currentPaid,
            available_for_withdrawal: balance.available_for_withdrawal || 0
          },
          expected: {
            net_valid_coins: totalExpectedNetValid,
            frozen_balance: expectedFrozen,
            total_earned: expectedTotalEarned,
            paid_amount: totalPaid
          },
          discrepancies: {
            net_valid_coins: netValidDiscrepancy,
            frozen_balance: frozenDiscrepancy,
            total_earned: totalEarnedDiscrepancy,
            paid_amount: paidDiscrepancy
          },
          breakdown: {
            valid_logs_count: validLogs.length,
            valid_logs_coins: expectedNetValid,
            frozen_logs_count: frozenLogs.length,
            frozen_logs_coins: expectedFrozen,
            manual_adds: manualAdds,
            manual_deducts: manualDeducts,
            admin_adjustments: adminAdjustments,
            completed_withdrawals: totalPaid
          }
        });

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error auditing ${balance.user_email}:`, error.message);
        auditResults.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    // Summary
    const usersWithDiscrepancy = auditResults.filter(r => r.has_discrepancy);
    const totalNetValidDiscrepancy = auditResults.reduce((sum, r) => 
      sum + Math.abs(r.discrepancies?.net_valid_coins || 0), 0
    );

    console.log(`\n✅ Audit complete!`);
    console.log(`📊 Users with discrepancies: ${usersWithDiscrepancy.length}/${auditResults.length}`);
    console.log(`💰 Total net_valid discrepancy: ${totalNetValidDiscrepancy.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        total_audited: auditResults.length,
        users_with_discrepancy: usersWithDiscrepancy.length,
        total_net_valid_discrepancy: totalNetValidDiscrepancy
      },
      users_with_discrepancy: usersWithDiscrepancy,
      all_results: auditResults
    });

  } catch (error) {
    console.error('❌ Audit error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});