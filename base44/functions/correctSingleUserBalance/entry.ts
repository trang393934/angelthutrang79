import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json();
    
    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔧 CORRECTING BALANCE FOR: ${user_email}`);
    console.log(`${'='.repeat(80)}\n`);

    // Step 1: Get all QuestionAuditLog (valid + frozen)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: user_email
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

    console.log(`📊 Valid Questions: ${validLogs.length} (${validLogTotal.toLocaleString()} coins)`);
    console.log(`❄️  Frozen Questions: ${frozenLogs.length} (${frozenLogTotal.toLocaleString()} coins)`);

    // Step 2: Get all CamlycoinTransaction
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: user_email
    }, '-created_date', 10000);

    // Step 3: Get recovery transactions
    const recoveryTxs = allTransactions.filter(tx => 
      tx.type === 'bounty_reward' && 
      tx.description && 
      tx.description.startsWith('Recovery:')
    );

    let validRecoveryAmount = 0;
    let duplicateRecoveryAmount = 0;

    for (const tx of recoveryTxs) {
      const recoveryQuestion = tx.description.replace('Recovery: ', '').trim().toLowerCase();
      if (validQuestions.has(recoveryQuestion)) {
        duplicateRecoveryAmount += tx.amount || 0;
      } else {
        validRecoveryAmount += tx.amount || 0;
      }
    }

    console.log(`🔄 Recovery Txs: Valid=${validRecoveryAmount.toLocaleString()}, Duplicate=${duplicateRecoveryAmount.toLocaleString()}`);

    // Step 4: Get other income sources
    const manualAdds = allTransactions.filter(tx => tx.type === 'manual_add');
    const adminAdjustments = allTransactions.filter(tx => tx.type === 'admin_adjustment');

    const manualTotal = manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const adminTotal = adminAdjustments.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    console.log(`💰 Manual Adds: ${manualTotal.toLocaleString()}`);
    console.log(`⚙️  Admin Adjustments: ${adminTotal.toLocaleString()}`);

    // Step 5: Get completed withdrawals
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      user_email: user_email
    }, '-created_date', 1000);

    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    console.log(`🏦 Total Withdrawn: ${totalWithdrawn.toLocaleString()}`);

    // FORMULA: Total = Valid Logs + Valid Recovery + Manual + Admin + Frozen
    const correctTotalEarned = validLogTotal + validRecoveryAmount + manualTotal + adminTotal + frozenLogTotal;
    const correctNetValid = validLogTotal + validRecoveryAmount + manualTotal + adminTotal;
    const correctFrozen = frozenLogTotal;
    const correctAvailable = correctNetValid - totalWithdrawn;

    console.log(`\n✅ CORRECT BALANCE:`);
    console.log(`   Total Earned: ${correctTotalEarned.toLocaleString()}`);
    console.log(`   Net Valid: ${correctNetValid.toLocaleString()}`);
    console.log(`   Frozen: ${correctFrozen.toLocaleString()}`);
    console.log(`   Available: ${correctAvailable.toLocaleString()}`);

    // Get current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: user_email
    });
    const currentBalance = balances[0];

    if (!currentBalance) {
      return Response.json({ 
        error: 'No balance record found',
        user_email 
      }, { status: 404 });
    }

    console.log(`\n📋 CURRENT BALANCE:`);
    console.log(`   Total Earned: ${(currentBalance.total_earned || 0).toLocaleString()}`);
    console.log(`   Net Valid: ${(currentBalance.net_valid_coins || 0).toLocaleString()}`);
    console.log(`   Frozen: ${(currentBalance.frozen_balance || 0).toLocaleString()}`);
    console.log(`   Available: ${(currentBalance.available_for_withdrawal || 0).toLocaleString()}`);

    // Check if needs correction
    const needsCorrection = 
      currentBalance.total_earned !== correctTotalEarned ||
      currentBalance.net_valid_coins !== correctNetValid ||
      currentBalance.frozen_balance !== correctFrozen ||
      currentBalance.available_for_withdrawal !== correctAvailable;

    if (!needsCorrection) {
      console.log(`\n✅ Balance is already correct!`);
      return Response.json({
        success: true,
        message: 'Balance is already correct',
        user_email,
        balance: {
          total_earned: correctTotalEarned,
          net_valid: correctNetValid,
          frozen: correctFrozen,
          available: correctAvailable
        }
      });
    }

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(currentBalance.id, {
      total_earned: correctTotalEarned,
      net_valid_coins: correctNetValid,
      frozen_balance: correctFrozen,
      paid_amount: totalWithdrawn,
      available_for_withdrawal: correctAvailable
    });

    console.log(`\n🎉 BALANCE UPDATED!`);

    return Response.json({
      success: true,
      message: 'Balance corrected successfully',
      user_email,
      old_balance: {
        total_earned: currentBalance.total_earned,
        net_valid: currentBalance.net_valid_coins,
        frozen: currentBalance.frozen_balance,
        available: currentBalance.available_for_withdrawal
      },
      new_balance: {
        total_earned: correctTotalEarned,
        net_valid: correctNetValid,
        frozen: correctFrozen,
        available: correctAvailable
      },
      changes: {
        total_earned: correctTotalEarned - (currentBalance.total_earned || 0),
        net_valid: correctNetValid - (currentBalance.net_valid_coins || 0),
        frozen: correctFrozen - (currentBalance.frozen_balance || 0),
        available: correctAvailable - (currentBalance.available_for_withdrawal || 0)
      }
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});