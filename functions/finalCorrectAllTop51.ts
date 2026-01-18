import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Final correction for ALL top 51 users...');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    const top51Users = allBalances.slice(0, 51);

    console.log(`📊 Processing ${top51Users.length} users with 300ms delay...`);

    const updateResults = [];
    let updatedCount = 0;

    for (const balance of top51Users) {
      try {
        const userEmail = balance.user_email;
        const rank = allBalances.findIndex(b => b.user_email === userEmail) + 1;
        
        console.log(`\n🔍 [Rank ${rank}] ${userEmail}`);

        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason !== 'valid' && log.coin_category === 'frozen'
        );

        const expectedNetValidFromLogs = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const expectedFrozen = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

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

        const totalExpectedNetValid = expectedNetValidFromLogs + manualAdds - manualDeducts + adminAdjustments;

        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
          user_email: userEmail,
          status: 'completed'
        });

        const totalPaid = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
        const expectedTotalEarned = totalExpectedNetValid + expectedFrozen;

        const currentNetValid = balance.net_valid_coins || 0;
        const currentFrozen = balance.frozen_balance || 0;
        const currentTotalEarned = balance.total_earned || 0;
        const currentPaid = balance.paid_amount || 0;

        const netValidDiscrepancy = totalExpectedNetValid - currentNetValid;
        const frozenDiscrepancy = expectedFrozen - currentFrozen;
        const totalEarnedDiscrepancy = expectedTotalEarned - currentTotalEarned;
        const paidDiscrepancy = totalPaid - currentPaid;

        const hasDiscrepancy = Math.abs(netValidDiscrepancy) > 0 || 
                              Math.abs(frozenDiscrepancy) > 0 || 
                              Math.abs(totalEarnedDiscrepancy) > 0 ||
                              Math.abs(paidDiscrepancy) > 0;

        if (hasDiscrepancy) {
          console.log(`⚠️ Discrepancy found!`);
          console.log(`   Net Valid: ${currentNetValid} → ${totalExpectedNetValid} (${netValidDiscrepancy > 0 ? '+' : ''}${netValidDiscrepancy})`);
          console.log(`   Frozen: ${currentFrozen} → ${expectedFrozen} (${frozenDiscrepancy > 0 ? '+' : ''}${frozenDiscrepancy})`);
          console.log(`   Total: ${currentTotalEarned} → ${expectedTotalEarned} (${totalEarnedDiscrepancy > 0 ? '+' : ''}${totalEarnedDiscrepancy})`);
          console.log(`   Paid: ${currentPaid} → ${totalPaid} (${paidDiscrepancy > 0 ? '+' : ''}${paidDiscrepancy})`);

          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            net_valid_coins: totalExpectedNetValid,
            frozen_balance: expectedFrozen,
            total_earned: expectedTotalEarned,
            paid_amount: totalPaid,
            available_for_withdrawal: totalExpectedNetValid - totalPaid
          });

          let description = `✅ Final Correction (Rank ${rank})\n`;
          if (netValidDiscrepancy !== 0) {
            description += `• Net Valid: ${netValidDiscrepancy > 0 ? '+' : ''}${netValidDiscrepancy}\n`;
          }
          if (frozenDiscrepancy !== 0) {
            description += `• Frozen: ${frozenDiscrepancy > 0 ? '+' : ''}${frozenDiscrepancy}\n`;
          }
          if (paidDiscrepancy !== 0) {
            description += `• Paid: ${paidDiscrepancy > 0 ? '+' : ''}${paidDiscrepancy}\n`;
          }
          description += `→ Total: ${expectedTotalEarned.toLocaleString()}`;

          await base44.asServiceRole.entities.CamlycoinTransaction.create({
            user_email: userEmail,
            amount: 0,
            type: 'admin_adjustment',
            description: description.trim(),
            processed_by: user.email
          });

          console.log(`✅ Updated!`);
          updatedCount++;

          updateResults.push({
            rank,
            email: userEmail,
            updated: true,
            discrepancies: {
              net_valid_coins: netValidDiscrepancy,
              frozen_balance: frozenDiscrepancy,
              total_earned: totalEarnedDiscrepancy,
              paid_amount: paidDiscrepancy
            }
          });
        } else {
          console.log(`✅ Correct`);
        }

        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`❌ Error: ${balance.user_email}:`, error.message);
        updateResults.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    console.log(`\n✅ Complete! Updated ${updatedCount}/${top51Users.length} users`);

    return Response.json({
      success: true,
      summary: {
        total_processed: top51Users.length,
        updated_count: updatedCount
      },
      updates: updateResults
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});