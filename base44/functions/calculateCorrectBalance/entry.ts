import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email required' }, { status: 400 });
    }

    console.log(`🔍 Calculating correct balance for ${target_email}...`);

    // 1. Get current QuestionAuditLog (147 câu)
    const currentLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: target_email
    }, '-audit_date', 10000);

    const currentLogTotal = currentLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    // 2. Get recovery transactions (359 câu đã bị xóa)
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_email
    }, '-created_date', 10000);

    const recoveryTxs = allTransactions.filter(tx => 
      tx.type === 'bounty_reward' && 
      tx.description && 
      tx.description.startsWith('Recovery:')
    );

    const recoveryTotal = recoveryTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // 3. Get other legitimate transactions (manual_add, admin_adjustment)
    const manualAdds = allTransactions.filter(tx => tx.type === 'manual_add');
    const adminAdjustments = allTransactions.filter(tx => tx.type === 'admin_adjustment');

    const manualTotal = manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const adminTotal = adminAdjustments.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // 4. Get withdrawals
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      user_email: target_email
    }, '-created_date', 1000);

    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    // 5. Calculate correct balance
    const correctTotalEarned = currentLogTotal + recoveryTotal + manualTotal + adminTotal;
    const correctNetValid = currentLogTotal + recoveryTotal + manualTotal + adminTotal;
    const correctAvailable = correctNetValid - totalWithdrawn;

    // 6. Get current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_email
    });
    const currentBalance = balances[0];

    console.log(`\n📊 BREAKDOWN:`);
    console.log(`Current logs (147 câu): ${currentLogTotal.toLocaleString()}`);
    console.log(`Recovery (359 câu đã xóa): ${recoveryTotal.toLocaleString()}`);
    console.log(`Manual adds: ${manualTotal.toLocaleString()}`);
    console.log(`Admin adjustments: ${adminTotal.toLocaleString()}`);
    console.log(`TOTAL EARNED: ${correctTotalEarned.toLocaleString()}`);
    console.log(`Withdrawn: ${totalWithdrawn.toLocaleString()}`);
    console.log(`AVAILABLE: ${correctAvailable.toLocaleString()}`);

    const needsCorrection = Math.abs((currentBalance?.available_for_withdrawal || 0) - correctAvailable) > 1;

    return Response.json({
      success: true,
      user_email: target_email,
      breakdown: {
        current_logs: {
          count: currentLogs.length,
          amount: currentLogTotal,
          description: '147 câu hỏi hiện tại trong QuestionAuditLog'
        },
        deleted_logs_recovery: {
          count: recoveryTxs.length,
          amount: recoveryTotal,
          description: '359 câu hỏi đã bị xóa nhưng còn bằng chứng trong CamlycoinTransaction'
        },
        manual_adds: {
          count: manualAdds.length,
          amount: manualTotal
        },
        admin_adjustments: {
          count: adminAdjustments.length,
          amount: adminTotal
        },
        total_questions: currentLogs.length + recoveryTxs.length
      },
      correct_balance: {
        total_earned: correctTotalEarned,
        net_valid_coins: correctNetValid,
        frozen_balance: 0,
        paid_amount: totalWithdrawn,
        available_for_withdrawal: correctAvailable
      },
      current_balance: currentBalance ? {
        total_earned: currentBalance.total_earned,
        net_valid_coins: currentBalance.net_valid_coins,
        frozen_balance: currentBalance.frozen_balance,
        paid_amount: currentBalance.paid_amount,
        available_for_withdrawal: currentBalance.available_for_withdrawal
      } : null,
      difference: {
        total_earned: correctTotalEarned - (currentBalance?.total_earned || 0),
        available: correctAvailable - (currentBalance?.available_for_withdrawal || 0)
      },
      needs_correction: needsCorrection,
      recommendation: needsCorrection ? 
        `Update balance to reflect ${correctTotalEarned.toLocaleString()} total earned and ${correctAvailable.toLocaleString()} available` :
        'Balance is correct'
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});