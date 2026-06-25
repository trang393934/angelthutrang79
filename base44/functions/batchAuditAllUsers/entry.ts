import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { limit = 50, skip = 0 } = await req.json();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 BATCH AUDIT ALL USERS (limit: ${limit}, skip: ${skip})`);
    console.log(`${'='.repeat(80)}\n`);

    // Get all users with balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list(
      '-total_earned', 
      limit,
      skip
    );

    console.log(`📊 Auditing ${allBalances.length} users...`);

    const results = [];
    
    for (let i = 0; i < allBalances.length; i++) {
      const balance = allBalances[i];
      const userEmail = balance.user_email;
      
      console.log(`\n[${i + 1}/${allBalances.length}] Auditing: ${userEmail}`);

      try {
        // Get audit logs
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
          user_email: userEmail
        }, '-audit_date', 10000);

        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason === 'duplicate' || log.coin_category === 'frozen'
        );

        const validLogTotal = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const frozenLogTotal = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Get transactions
        const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
          user_email: userEmail
        }, '-created_date', 10000);

        const recoveryTxs = allTxs.filter(tx => 
          tx.type === 'bounty_reward' && tx.description && tx.description.startsWith('Recovery:')
        );
        const manualTxs = allTxs.filter(tx => tx.type === 'manual_add');
        const adminTxs = allTxs.filter(tx => tx.type === 'admin_adjustment');
        const deductTxs = allTxs.filter(tx => tx.type === 'manual_deduct');

        const manualTotal = manualTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const adminTotal = adminTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const deductTotal = deductTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        // Analyze recovery
        const validQuestions = new Set(
          validLogs.map(log => (log.question_text || '').trim().toLowerCase())
        );
        
        let validRecovery = 0;
        let duplicateRecovery = 0;
        
        for (const tx of recoveryTxs) {
          const question = tx.description.replace('Recovery: ', '').trim().toLowerCase();
          if (validQuestions.has(question)) {
            duplicateRecovery += tx.amount || 0;
          } else {
            validRecovery += tx.amount || 0;
          }
        }

        // Get withdrawals
        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
          user_email: userEmail,
          status: 'completed'
        }, '-created_date', 1000);

        const completedWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

        // Calculate correct balance
        const correctTotalEarned = validLogTotal + validRecovery + manualTotal + adminTotal + frozenLogTotal - deductTotal;
        const correctNetValid = validLogTotal + validRecovery + manualTotal + adminTotal - deductTotal;
        const correctFrozen = frozenLogTotal;
        const correctAvailable = correctNetValid - completedWithdrawn;

        // Calculate discrepancies
        const discrepancies = {
          total_earned: correctTotalEarned - (balance.total_earned || 0),
          net_valid: correctNetValid - (balance.net_valid_coins || 0),
          frozen: correctFrozen - (balance.frozen_balance || 0),
          paid_amount: completedWithdrawn - (balance.paid_amount || 0),
          available: correctAvailable - (balance.available_for_withdrawal || 0)
        };

        const hasDiscrepancy = Object.values(discrepancies).some(d => Math.abs(d) > 0);
        const hasDuplicateRecovery = duplicateRecovery > 0;

        results.push({
          user_email: userEmail,
          has_discrepancy: hasDiscrepancy,
          has_duplicate_recovery: hasDuplicateRecovery,
          duplicate_recovery_amount: duplicateRecovery,
          total_recovery_txs: recoveryTxs.length,
          total_logs: allLogs.length,
          valid_logs: validLogs.length,
          current_balance: balance.total_earned || 0,
          correct_balance: correctTotalEarned,
          discrepancies
        });

        if (hasDiscrepancy) {
          console.log(`   ⚠️  HAS DISCREPANCY!`);
        }
        if (hasDuplicateRecovery) {
          console.log(`   ⚠️  HAS DUPLICATE RECOVERY: ${duplicateRecovery.toLocaleString()}`);
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        results.push({
          user_email: userEmail,
          error: error.message
        });
      }
    }

    // Summary statistics
    const usersWithDiscrepancy = results.filter(r => r.has_discrepancy).length;
    const usersWithDuplicateRecovery = results.filter(r => r.has_duplicate_recovery).length;
    const totalDuplicateRecovery = results.reduce((sum, r) => sum + (r.duplicate_recovery_amount || 0), 0);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SUMMARY:`);
    console.log(`   Total users audited: ${results.length}`);
    console.log(`   Users with discrepancy: ${usersWithDiscrepancy}`);
    console.log(`   Users with duplicate recovery: ${usersWithDuplicateRecovery}`);
    console.log(`   Total duplicate recovery amount: ${totalDuplicateRecovery.toLocaleString()}`);
    console.log(`${'='.repeat(80)}\n`);

    return Response.json({
      success: true,
      summary: {
        total_audited: results.length,
        users_with_discrepancy: usersWithDiscrepancy,
        users_with_duplicate_recovery: usersWithDuplicateRecovery,
        total_duplicate_recovery: totalDuplicateRecovery
      },
      results: results.sort((a, b) => 
        Math.abs(b.discrepancies?.total_earned || 0) - Math.abs(a.discrepancies?.total_earned || 0)
      )
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});