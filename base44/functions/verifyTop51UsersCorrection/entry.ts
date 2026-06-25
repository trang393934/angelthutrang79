import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Verifying top 51 users after correction...');

    // Fetch all balances sorted by total_earned
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    // Get top 51 users
    const top51Users = allBalances.slice(0, 51);

    console.log(`📊 Verifying ${top51Users.length} users...`);

    const verificationResults = [];
    let allCorrect = true;

    for (const balance of top51Users) {
      try {
        const userEmail = balance.user_email;
        const rank = allBalances.findIndex(b => b.user_email === userEmail) + 1;
        
        console.log(`\n🔍 [Rank ${rank}] ${userEmail}`);

        // Fetch all audit logs
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        // Calculate expected values from audit logs
        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason !== 'valid' && log.coin_category === 'frozen'
        );

        const expectedNetValidFromLogs = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
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

        // Calculate expected net_valid
        const expectedNetValid = expectedNetValidFromLogs + manualAdds - manualDeducts + adminAdjustments;

        // Get withdrawals
        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
          user_email: userEmail,
          status: 'completed'
        });

        const expectedPaid = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

        // Expected total_earned
        const expectedTotalEarned = expectedNetValid + expectedFrozen;

        // Expected available_for_withdrawal
        const expectedAvailable = expectedNetValid - expectedPaid;

        // Current values
        const currentNetValid = balance.net_valid_coins || 0;
        const currentFrozen = balance.frozen_balance || 0;
        const currentTotalEarned = balance.total_earned || 0;
        const currentPaid = balance.paid_amount || 0;
        const currentAvailable = balance.available_for_withdrawal || 0;

        // Check discrepancies
        const netValidMatch = currentNetValid === expectedNetValid;
        const frozenMatch = currentFrozen === expectedFrozen;
        const totalEarnedMatch = currentTotalEarned === expectedTotalEarned;
        const paidMatch = currentPaid === expectedPaid;
        const availableMatch = currentAvailable === expectedAvailable;

        const isFullyCorrect = netValidMatch && frozenMatch && totalEarnedMatch && paidMatch && availableMatch;

        if (!isFullyCorrect) {
          allCorrect = false;
          console.log(`❌ Discrepancy still exists!`);
          if (!netValidMatch) console.log(`   Net Valid: ${currentNetValid} ≠ ${expectedNetValid} (Δ ${expectedNetValid - currentNetValid})`);
          if (!frozenMatch) console.log(`   Frozen: ${currentFrozen} ≠ ${expectedFrozen} (Δ ${expectedFrozen - currentFrozen})`);
          if (!totalEarnedMatch) console.log(`   Total Earned: ${currentTotalEarned} ≠ ${expectedTotalEarned} (Δ ${expectedTotalEarned - currentTotalEarned})`);
          if (!paidMatch) console.log(`   Paid: ${currentPaid} ≠ ${expectedPaid} (Δ ${expectedPaid - currentPaid})`);
          if (!availableMatch) console.log(`   Available: ${currentAvailable} ≠ ${expectedAvailable} (Δ ${expectedAvailable - currentAvailable})`);
        } else {
          console.log(`✅ All correct!`);
        }

        verificationResults.push({
          rank,
          email: userEmail,
          is_correct: isFullyCorrect,
          current: {
            net_valid_coins: currentNetValid,
            frozen_balance: currentFrozen,
            total_earned: currentTotalEarned,
            paid_amount: currentPaid,
            available_for_withdrawal: currentAvailable
          },
          expected: {
            net_valid_coins: expectedNetValid,
            frozen_balance: expectedFrozen,
            total_earned: expectedTotalEarned,
            paid_amount: expectedPaid,
            available_for_withdrawal: expectedAvailable
          },
          matches: {
            net_valid: netValidMatch,
            frozen: frozenMatch,
            total_earned: totalEarnedMatch,
            paid: paidMatch,
            available: availableMatch
          },
          data_breakdown: {
            valid_logs_count: validLogs.length,
            valid_logs_coins: expectedNetValidFromLogs,
            frozen_logs_count: frozenLogs.length,
            frozen_logs_coins: expectedFrozen,
            manual_adds: manualAdds,
            manual_deducts: manualDeducts,
            admin_adjustments: adminAdjustments,
            completed_withdrawals: expectedPaid,
            total_transactions: transactions.length
          }
        });

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error verifying ${balance.user_email}:`, error.message);
        allCorrect = false;
        verificationResults.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    const incorrectUsers = verificationResults.filter(r => !r.is_correct);

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Verification complete!`);
    console.log(`📊 Total verified: ${verificationResults.length}`);
    console.log(`${allCorrect ? '✅' : '❌'} All correct: ${allCorrect ? 'YES' : 'NO'}`);
    console.log(`❌ Incorrect users: ${incorrectUsers.length}`);

    return Response.json({
      success: true,
      all_correct: allCorrect,
      summary: {
        total_verified: verificationResults.length,
        correct_count: verificationResults.length - incorrectUsers.length,
        incorrect_count: incorrectUsers.length
      },
      incorrect_users: incorrectUsers,
      all_results: verificationResults
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});