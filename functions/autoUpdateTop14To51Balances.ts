import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { dry_run = false } = await req.json().catch(() => ({}));

    console.log(`🔍 Starting ${dry_run ? 'DRY RUN' : 'LIVE UPDATE'} for users rank 14-51...`);

    // Fetch all balances sorted by total_earned
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    // Get users ranked 14-51
    const targetUsers = allBalances.slice(13, 51); // Index 13-50 = rank 14-51

    console.log(`📊 Processing ${targetUsers.length} users (rank 14-51)`);

    const updateResults = [];
    let updatedCount = 0;

    for (const balance of targetUsers) {
      try {
        const userEmail = balance.user_email;
        const rank = allBalances.findIndex(b => b.user_email === userEmail) + 1;
        
        console.log(`\n🔍 [Rank ${rank}] ${userEmail}`);

        // Fetch all audit logs
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        // Calculate expected values
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

        // Calculate total expected net_valid
        const totalExpectedNetValid = expectedNetValidFromLogs + manualAdds - manualDeducts + adminAdjustments;

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

        if (hasDiscrepancy) {
          console.log(`⚠️ Discrepancy found!`);
          console.log(`   Net Valid: ${currentNetValid} → ${totalExpectedNetValid} (${netValidDiscrepancy > 0 ? '+' : ''}${netValidDiscrepancy})`);
          console.log(`   Frozen: ${currentFrozen} → ${expectedFrozen} (${frozenDiscrepancy > 0 ? '+' : ''}${frozenDiscrepancy})`);
          console.log(`   Total Earned: ${currentTotalEarned} → ${expectedTotalEarned} (${totalEarnedDiscrepancy > 0 ? '+' : ''}${totalEarnedDiscrepancy})`);
          console.log(`   Paid: ${currentPaid} → ${totalPaid} (${paidDiscrepancy > 0 ? '+' : ''}${paidDiscrepancy})`);

          if (!dry_run) {
            // Update balance
            await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
              net_valid_coins: totalExpectedNetValid,
              frozen_balance: expectedFrozen,
              total_earned: expectedTotalEarned,
              paid_amount: totalPaid,
              available_for_withdrawal: totalExpectedNetValid - totalPaid
            });

            // Create transaction log
            let description = `✅ Auto-correction (Rank ${rank} Audit)\n`;
            if (netValidDiscrepancy !== 0) {
              description += `• Net Valid: ${netValidDiscrepancy > 0 ? '+' : ''}${netValidDiscrepancy}\n`;
            }
            if (frozenDiscrepancy !== 0) {
              description += `• Frozen: ${frozenDiscrepancy > 0 ? '+' : ''}${frozenDiscrepancy}\n`;
            }
            if (paidDiscrepancy !== 0) {
              description += `• Paid: ${paidDiscrepancy > 0 ? '+' : ''}${paidDiscrepancy}\n`;
            }
            description += `→ Total Earned: ${currentTotalEarned} → ${expectedTotalEarned}`;

            await base44.asServiceRole.entities.CamlycoinTransaction.create({
              user_email: userEmail,
              amount: 0,
              type: 'admin_adjustment',
              description: description.trim(),
              processed_by: user.email
            });

            console.log(`✅ Updated successfully!`);
            updatedCount++;
          } else {
            console.log(`🔍 [DRY RUN] Would update`);
          }

          updateResults.push({
            rank,
            email: userEmail,
            updated: !dry_run,
            discrepancies: {
              net_valid_coins: netValidDiscrepancy,
              frozen_balance: frozenDiscrepancy,
              total_earned: totalEarnedDiscrepancy,
              paid_amount: paidDiscrepancy
            },
            before: {
              net_valid_coins: currentNetValid,
              frozen_balance: currentFrozen,
              total_earned: currentTotalEarned,
              paid_amount: currentPaid
            },
            after: {
              net_valid_coins: totalExpectedNetValid,
              frozen_balance: expectedFrozen,
              total_earned: expectedTotalEarned,
              paid_amount: totalPaid
            }
          });
        } else {
          console.log(`✅ No discrepancy - balance is correct`);
        }

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        console.error(`❌ Error processing ${balance.user_email}:`, error.message);
        updateResults.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    console.log(`\n✅ ${dry_run ? 'DRY RUN' : 'UPDATE'} complete!`);
    console.log(`📊 Found ${updateResults.length} users with discrepancies`);
    if (!dry_run) {
      console.log(`✅ Updated ${updatedCount} user balances`);
    }

    return Response.json({
      success: true,
      dry_run,
      summary: {
        total_processed: targetUsers.length,
        users_with_discrepancy: updateResults.length,
        updated_count: dry_run ? 0 : updatedCount
      },
      updates: updateResults
    });

  } catch (error) {
    console.error('❌ Update error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});