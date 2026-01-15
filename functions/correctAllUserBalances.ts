import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 CORRECTING ALL USER BALANCES WITH EXACT FORMULA`);
    console.log(`${'='.repeat(80)}\n`);

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list('', 10000);
    
    console.log(`📊 Processing ${allUsers.length} users...`);

    const results = {
      processed: 0,
      corrected: 0,
      errors: [],
      corrected_users: []
    };

    for (const userData of allUsers) {
      try {
        const userEmail = userData.email;

        // FORMULA CHÍNH XÁC NHẤT:
        // Total = Valid Questions + Recovery (Non-Duplicate) + Manual Adds + Admin Adjustments
        // Frozen = Duplicate/Frozen Questions
        // Available = Total - Paid - Frozen

        // Step 1: Get all QuestionAuditLog (valid + frozen)
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
          user_email: userEmail
        }, '-audit_date', 10000);

        // Separate valid and frozen logs
        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason === 'duplicate' || log.coin_category === 'frozen'
        );

        const validLogTotal = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const frozenLogTotal = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        const validQuestions = new Set(
          validLogs.map(log => (log.question_text || '').trim().toLowerCase())
        );

        // Step 2: Get all CamlycoinTransaction
        const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
          user_email: userEmail
        }, '-created_date', 10000);

        // Step 3: Get recovery transactions (from deleted questions)
        const recoveryTxs = allTransactions.filter(tx => 
          tx.type === 'bounty_reward' && 
          tx.description && 
          tx.description.startsWith('Recovery:')
        );

        let validRecoveryAmount = 0;
        let duplicateRecoveryAmount = 0;

        // Check for overlap: only count recovery if NOT in valid logs
        for (const tx of recoveryTxs) {
          const recoveryQuestion = tx.description.replace('Recovery: ', '').trim().toLowerCase();
          if (validQuestions.has(recoveryQuestion)) {
            // Duplicate: already in valid logs
            duplicateRecoveryAmount += tx.amount || 0;
          } else {
            // Valid recovery: new question from deleted logs
            validRecoveryAmount += tx.amount || 0;
          }
        }

        // Step 4: Get other income sources
        const manualAdds = allTransactions.filter(tx => tx.type === 'manual_add');
        const adminAdjustments = allTransactions.filter(tx => tx.type === 'admin_adjustment');

        const manualTotal = manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const adminTotal = adminAdjustments.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        // Step 5: Get completed withdrawals
        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
          user_email: userEmail
        }, '-created_date', 1000);

        const totalWithdrawn = withdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + (w.amount || 0), 0);

        // FORMULA: Total = Valid Logs + Valid Recovery + Manual + Admin + Frozen
        const correctTotalEarned = validLogTotal + validRecoveryAmount + manualTotal + adminTotal + frozenLogTotal;
        const correctNetValid = validLogTotal + validRecoveryAmount + manualTotal + adminTotal; // Excluding frozen
        const correctFrozen = frozenLogTotal;
        const correctAvailable = correctNetValid - totalWithdrawn;

        // Get current balance
        const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
          user_email: userEmail
        });
        const currentBalance = balances[0];

        // Check if needs correction
        const needsCorrection = !currentBalance || 
          currentBalance.total_earned !== correctTotalEarned ||
          currentBalance.frozen_balance !== correctFrozen ||
          currentBalance.available_for_withdrawal !== correctAvailable;

        if (needsCorrection && currentBalance) {
          // Update balance
          await base44.asServiceRole.entities.CamlycoinBalance.update(currentBalance.id, {
            total_earned: correctTotalEarned,
            net_valid_coins: correctNetValid,
            frozen_balance: correctFrozen,
            paid_amount: totalWithdrawn,
            available_for_withdrawal: correctAvailable
          });

          results.corrected++;
          results.corrected_users.push({
            email: userEmail,
            old_balance: currentBalance.available_for_withdrawal,
            new_balance: correctAvailable,
            difference: correctAvailable - (currentBalance.available_for_withdrawal || 0),
            breakdown: {
              current_logs: currentLogTotal,
              valid_recovery: validRecoveryAmount,
              duplicate_recovery: duplicateRecoveryAmount,
              manual_adds: manualTotal,
              admin_adjustments: adminTotal,
              total_earned: correctTotalEarned,
              withdrawn: totalWithdrawn
            }
          });
        }

        results.processed++;

      } catch (error) {
        results.errors.push({
          user_email: userData.email,
          error: error.message
        });
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Processed: ${results.processed}/${allUsers.length}`);
    console.log(`Corrected: ${results.corrected}`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.corrected > 0) {
      console.log(`\n🔧 TOP 10 CORRECTED USERS:`);
      results.corrected_users.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
      results.corrected_users.slice(0, 10).forEach((u, i) => {
        console.log(`${i+1}. ${u.email}`);
        console.log(`   Old: ${(u.old_balance || 0).toLocaleString()} → New: ${u.new_balance.toLocaleString()}`);
        console.log(`   Change: ${u.difference > 0 ? '+' : ''}${u.difference.toLocaleString()}`);
      });
    }

    return Response.json({
      success: true,
      processed: results.processed,
      corrected: results.corrected,
      errors_count: results.errors.length,
      formula: {
        name: "Correct Balance Formula",
        steps: [
          "1. Get all QuestionAuditLog entries (current valid questions)",
          "2. Get all CamlycoinTransaction entries",
          "3. Get recovery transactions (bounty_reward with 'Recovery:' prefix)",
          "4. For each recovery transaction:",
          "   - Check if question exists in current QuestionAuditLog",
          "   - If YES → Duplicate (skip, don't count)",
          "   - If NO → Valid recovery (count it)",
          "5. Sum: Current Logs + Valid Recovery + Manual Adds + Admin Adjustments",
          "6. Subtract completed withdrawals to get available_for_withdrawal"
        ],
        formula: "Total = CurrentLogs + ValidRecovery + ManualAdds + AdminAdjustments - Withdrawn"
      },
      corrected_users: results.corrected_users.slice(0, 20),
      errors: results.errors.slice(0, 10)
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});