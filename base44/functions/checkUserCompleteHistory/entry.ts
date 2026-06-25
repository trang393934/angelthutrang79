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
    console.log(`📜 COMPLETE HISTORY FOR: ${user_email}`);
    console.log(`${'='.repeat(80)}\n`);

    // 1. Get ALL audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: user_email
    }, '-question_date', 10000);

    console.log(`📊 Total audit logs: ${allLogs.length}`);

    // 2. Get ALL transactions
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: user_email
    }, '-created_date', 10000);

    console.log(`💰 Total transactions: ${allTxs.length}`);

    // 3. Get current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: user_email
    });
    const currentBalance = balances[0] || null;

    // 4. Analyze logs by status
    const logsByStatus = {
      valid: allLogs.filter(log => log.exclusion_reason === 'valid'),
      duplicate: allLogs.filter(log => log.exclusion_reason === 'duplicate'),
      greeting: allLogs.filter(log => log.exclusion_reason === 'greeting'),
      low_quality: allLogs.filter(log => log.exclusion_reason === 'low_quality'),
      exceeds_daily_limit: allLogs.filter(log => log.exclusion_reason === 'exceeds_daily_limit')
    };

    const validLogTotal = logsByStatus.valid.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    const duplicateLogTotal = logsByStatus.duplicate.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    const greetingLogTotal = logsByStatus.greeting.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    // 5. Analyze transactions
    const txsByType = {
      bounty_reward: allTxs.filter(tx => tx.type === 'bounty_reward'),
      manual_add: allTxs.filter(tx => tx.type === 'manual_add'),
      admin_adjustment: allTxs.filter(tx => tx.type === 'admin_adjustment'),
      manual_deduct: allTxs.filter(tx => tx.type === 'manual_deduct')
    };

    const bountyTotal = txsByType.bounty_reward.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const manualTotal = txsByType.manual_add.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const adminTotal = txsByType.admin_adjustment.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const deductTotal = txsByType.manual_deduct.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // 6. Recovery analysis
    const recoveryTxs = txsByType.bounty_reward.filter(tx => 
      tx.description && tx.description.startsWith('Recovery:')
    );

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

    // 7. Calculate expected balance
    const expectedTotalEarned = validLogTotal + validRecovery + manualTotal + adminTotal + duplicateLogTotal + greetingLogTotal - deductTotal;
    const expectedNetValid = validLogTotal + validRecovery + manualTotal + adminTotal - deductTotal;
    const expectedFrozen = duplicateLogTotal + greetingLogTotal;

    // 8. Get withdrawals
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      user_email: user_email,
      status: 'completed'
    }, '-created_date', 1000);

    const withdrawnAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const expectedAvailable = expectedNetValid - withdrawnAmount;

    console.log(`\n📋 SUMMARY:`);
    console.log(`   Audit Logs: ${allLogs.length} (Valid: ${logsByStatus.valid.length}, Duplicate: ${logsByStatus.duplicate.length}, Greeting: ${logsByStatus.greeting.length})`);
    console.log(`   Transactions: ${allTxs.length} (Recovery: ${recoveryTxs.length}, Manual: ${txsByType.manual_add.length}, Admin: ${txsByType.admin_adjustment.length})`);
    console.log(`   Valid Coins from Logs: ${validLogTotal.toLocaleString()}`);
    console.log(`   Valid Recovery: ${validRecovery.toLocaleString()}`);
    console.log(`   Duplicate Recovery: ${duplicateRecovery.toLocaleString()}`);
    console.log(`   Manual Add: ${manualTotal.toLocaleString()}`);
    console.log(`   Admin Adjustment: ${adminTotal.toLocaleString()}`);
    console.log(`   Expected Balance: ${expectedNetValid.toLocaleString()}`);
    console.log(`   Current Balance: ${currentBalance?.net_valid_coins?.toLocaleString() || 'N/A'}`);
    console.log(`   Available for Withdrawal: ${expectedAvailable.toLocaleString()}`);
    console.log(`${'='.repeat(80)}\n`);

    return Response.json({
      success: true,
      user_email,
      summary: {
        total_logs: allLogs.length,
        total_transactions: allTxs.length,
        total_withdrawals: withdrawals.length
      },
      logs_breakdown: {
        valid: { count: logsByStatus.valid.length, total: validLogTotal },
        duplicate: { count: logsByStatus.duplicate.length, total: duplicateLogTotal },
        greeting: { count: logsByStatus.greeting.length, total: greetingLogTotal },
        low_quality: { count: logsByStatus.low_quality.length, total: 0 },
        exceeds_daily_limit: { count: logsByStatus.exceeds_daily_limit.length, total: 0 }
      },
      transactions_breakdown: {
        bounty_reward: { count: txsByType.bounty_reward.length, total: bountyTotal },
        manual_add: { count: txsByType.manual_add.length, total: manualTotal },
        admin_adjustment: { count: txsByType.admin_adjustment.length, total: adminTotal },
        manual_deduct: { count: txsByType.manual_deduct.length, total: deductTotal }
      },
      recovery_analysis: {
        total_recovery: recoveryTxs.length,
        valid_recovery: validRecovery,
        duplicate_recovery: duplicateRecovery
      },
      withdrawals: {
        count: withdrawals.length,
        total_withdrawn: withdrawnAmount
      },
      expected_balance: {
        total_earned: expectedTotalEarned,
        net_valid: expectedNetValid,
        frozen: expectedFrozen,
        available: expectedAvailable
      },
      current_balance: currentBalance ? {
        total_earned: currentBalance.total_earned || 0,
        net_valid: currentBalance.net_valid_coins || 0,
        frozen: currentBalance.frozen_balance || 0,
        available: currentBalance.available_for_withdrawal || 0
      } : null,
      all_valid_questions: logsByStatus.valid.map(log => ({
        date: log.question_date,
        question: log.question_text,
        coins: log.coins_earned,
        number_in_day: log.question_number_in_day
      })).sort((a, b) => new Date(a.date) - new Date(b.date))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});