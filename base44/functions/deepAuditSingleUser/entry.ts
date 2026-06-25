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
    console.log(`🔍 DEEP AUDIT FOR: ${user_email}`);
    console.log(`${'='.repeat(80)}\n`);

    // 1. Get ALL QuestionAuditLog entries
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: user_email
    }, '-audit_date', 10000);

    console.log(`📊 QUESTION AUDIT LOGS: ${allLogs.length} total`);
    
    const logsByStatus = {
      valid: allLogs.filter(log => log.exclusion_reason === 'valid'),
      duplicate: allLogs.filter(log => log.exclusion_reason === 'duplicate'),
      frozen_category: allLogs.filter(log => log.coin_category === 'frozen'),
      greeting: allLogs.filter(log => log.exclusion_reason === 'greeting'),
      low_quality: allLogs.filter(log => log.exclusion_reason === 'low_quality'),
      exceeds_daily_limit: allLogs.filter(log => log.exclusion_reason === 'exceeds_daily_limit')
    };

    for (const [status, logs] of Object.entries(logsByStatus)) {
      const total = logs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      console.log(`   ${status}: ${logs.length} logs = ${total.toLocaleString()} coins`);
    }

    // 2. Get ALL CamlycoinTransaction entries
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: user_email
    }, '-created_date', 10000);

    console.log(`\n💰 CAMLYCOIN TRANSACTIONS: ${allTxs.length} total`);
    
    const txsByType = {
      bounty_reward: allTxs.filter(tx => tx.type === 'bounty_reward'),
      manual_add: allTxs.filter(tx => tx.type === 'manual_add'),
      admin_adjustment: allTxs.filter(tx => tx.type === 'admin_adjustment'),
      build_reward: allTxs.filter(tx => tx.type === 'build_reward'),
      manual_deduct: allTxs.filter(tx => tx.type === 'manual_deduct'),
      purchase: allTxs.filter(tx => tx.type === 'purchase')
    };

    for (const [type, txs] of Object.entries(txsByType)) {
      const total = txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      console.log(`   ${type}: ${txs.length} txs = ${total.toLocaleString()} coins`);
    }

    // Analyze Recovery transactions
    const recoveryTxs = txsByType.bounty_reward.filter(tx => 
      tx.description && tx.description.startsWith('Recovery:')
    );
    const recoveryTotal = recoveryTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    console.log(`\n🔄 RECOVERY TRANSACTIONS: ${recoveryTxs.length} txs = ${recoveryTotal.toLocaleString()} coins`);

    // Check overlap between recovery and current logs
    const validQuestions = new Set(
      logsByStatus.valid.map(log => (log.question_text || '').trim().toLowerCase())
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
    
    console.log(`   Valid Recovery (not in logs): ${validRecovery.toLocaleString()}`);
    console.log(`   Duplicate Recovery (in logs): ${duplicateRecovery.toLocaleString()}`);

    // 3. Get ALL WithdrawalRequest entries
    const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      user_email: user_email
    }, '-created_date', 1000);

    console.log(`\n🏦 WITHDRAWAL REQUESTS: ${allWithdrawals.length} total`);
    
    const withdrawalsByStatus = {
      pending: allWithdrawals.filter(w => w.status === 'pending'),
      approved: allWithdrawals.filter(w => w.status === 'approved'),
      processing: allWithdrawals.filter(w => w.status === 'processing'),
      completed: allWithdrawals.filter(w => w.status === 'completed'),
      failed: allWithdrawals.filter(w => w.status === 'failed'),
      rejected: allWithdrawals.filter(w => w.status === 'rejected')
    };

    for (const [status, withdrawals] of Object.entries(withdrawalsByStatus)) {
      const total = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
      console.log(`   ${status}: ${withdrawals.length} requests = ${total.toLocaleString()} coins`);
    }

    // 4. Calculate CORRECT balance using formula
    const validLogTotal = logsByStatus.valid.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    const frozenLogTotal = logsByStatus.duplicate.reduce((sum, log) => sum + (log.coins_earned || 0), 0) +
                          logsByStatus.frozen_category.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    
    const manualTotal = txsByType.manual_add.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const adminTotal = txsByType.admin_adjustment.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const deductTotal = txsByType.manual_deduct.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    
    const completedWithdrawn = withdrawalsByStatus.completed.reduce((sum, w) => sum + (w.amount || 0), 0);

    // FORMULA
    const correctTotalEarned = validLogTotal + validRecovery + manualTotal + adminTotal + frozenLogTotal - deductTotal;
    const correctNetValid = validLogTotal + validRecovery + manualTotal + adminTotal - deductTotal;
    const correctFrozen = frozenLogTotal;
    const correctAvailable = correctNetValid - completedWithdrawn;

    console.log(`\n✅ CORRECT BALANCE (FORMULA):`);
    console.log(`   Total Earned = Valid(${validLogTotal.toLocaleString()}) + Recovery(${validRecovery.toLocaleString()}) + Manual(${manualTotal.toLocaleString()}) + Admin(${adminTotal.toLocaleString()}) + Frozen(${frozenLogTotal.toLocaleString()}) - Deduct(${deductTotal.toLocaleString()})`);
    console.log(`   Total Earned = ${correctTotalEarned.toLocaleString()}`);
    console.log(`   Net Valid = ${correctNetValid.toLocaleString()}`);
    console.log(`   Frozen = ${correctFrozen.toLocaleString()}`);
    console.log(`   Available = Net Valid(${correctNetValid.toLocaleString()}) - Withdrawn(${completedWithdrawn.toLocaleString()}) = ${correctAvailable.toLocaleString()}`);

    // 5. Get current balance from database
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: user_email
    });
    const currentBalance = balances[0];

    if (!currentBalance) {
      return Response.json({ 
        error: 'No balance record found',
        audit_data: {
          logs: logsByStatus,
          transactions: txsByType,
          withdrawals: withdrawalsByStatus,
          correct_balance: {
            total_earned: correctTotalEarned,
            net_valid: correctNetValid,
            frozen: correctFrozen,
            available: correctAvailable
          }
        }
      }, { status: 404 });
    }

    console.log(`\n📋 CURRENT BALANCE (DATABASE):`);
    console.log(`   Total Earned: ${(currentBalance.total_earned || 0).toLocaleString()}`);
    console.log(`   Net Valid: ${(currentBalance.net_valid_coins || 0).toLocaleString()}`);
    console.log(`   Frozen: ${(currentBalance.frozen_balance || 0).toLocaleString()}`);
    console.log(`   Paid Amount: ${(currentBalance.paid_amount || 0).toLocaleString()}`);
    console.log(`   Available: ${(currentBalance.available_for_withdrawal || 0).toLocaleString()}`);

    // 6. Compare and show discrepancies
    const discrepancies = {
      total_earned: correctTotalEarned - (currentBalance.total_earned || 0),
      net_valid: correctNetValid - (currentBalance.net_valid_coins || 0),
      frozen: correctFrozen - (currentBalance.frozen_balance || 0),
      paid_amount: completedWithdrawn - (currentBalance.paid_amount || 0),
      available: correctAvailable - (currentBalance.available_for_withdrawal || 0)
    };

    console.log(`\n⚠️  DISCREPANCIES:`);
    for (const [field, diff] of Object.entries(discrepancies)) {
      if (diff !== 0) {
        console.log(`   ${field}: ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`);
      }
    }

    const hasDiscrepancy = Object.values(discrepancies).some(d => d !== 0);

    return Response.json({
      success: true,
      user_email,
      has_discrepancy: hasDiscrepancy,
      audit_summary: {
        total_logs: allLogs.length,
        total_transactions: allTxs.length,
        total_withdrawals: allWithdrawals.length
      },
      logs_breakdown: Object.fromEntries(
        Object.entries(logsByStatus).map(([k, v]) => [k, {
          count: v.length,
          total: v.reduce((sum, log) => sum + (log.coins_earned || 0), 0)
        }])
      ),
      transactions_breakdown: Object.fromEntries(
        Object.entries(txsByType).map(([k, v]) => [k, {
          count: v.length,
          total: v.reduce((sum, tx) => sum + (tx.amount || 0), 0)
        }])
      ),
      recovery_analysis: {
        total_recovery_txs: recoveryTxs.length,
        valid_recovery: validRecovery,
        duplicate_recovery: duplicateRecovery
      },
      withdrawals_breakdown: Object.fromEntries(
        Object.entries(withdrawalsByStatus).map(([k, v]) => [k, {
          count: v.length,
          total: v.reduce((sum, w) => sum + (w.amount || 0), 0)
        }])
      ),
      correct_balance: {
        total_earned: correctTotalEarned,
        net_valid: correctNetValid,
        frozen: correctFrozen,
        paid_amount: completedWithdrawn,
        available: correctAvailable
      },
      current_balance: {
        total_earned: currentBalance.total_earned || 0,
        net_valid: currentBalance.net_valid_coins || 0,
        frozen: currentBalance.frozen_balance || 0,
        paid_amount: currentBalance.paid_amount || 0,
        available: currentBalance.available_for_withdrawal || 0
      },
      discrepancies
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});