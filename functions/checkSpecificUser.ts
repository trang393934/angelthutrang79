import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_user_email } = await req.json();
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🔍 Checking user: ${target_user_email}`);

    // 1. Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: target_user_email });
    const balance = balances[0] || null;

    // 2. Get all transactions
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ user_email: target_user_email }, '-created_date', 1000);

    // 3. Get audit logs
    const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ user_email: target_user_email });

    // 4. Analyze transactions
    const txByType = {};
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
      if (!txByType[tx.type]) txByType[tx.type] = { count: 0, total: 0 };
      txByType[tx.type].count++;
      txByType[tx.type].total += tx.amount;

      if (tx.amount > 0) totalIncome += tx.amount;
      else totalExpense += Math.abs(tx.amount);
    });

    // 5. Analyze logs
    const logsByStatus = {
      valid: logs.filter(l => l.exclusion_reason === 'valid'),
      frozen: logs.filter(l => l.exclusion_reason !== 'valid')
    };

    const calculatedValid = logsByStatus.valid.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const calculatedFrozen = logsByStatus.frozen.reduce((sum, l) => sum + (l.coins_earned || 0), 0);

    // 6. Check for duplicates
    const txById = {};
    logs.forEach(log => {
      if (log.transaction_id) {
        if (!txById[log.transaction_id]) txById[log.transaction_id] = [];
        txById[log.transaction_id].push(log);
      }
    });
    const duplicates = Object.entries(txById).filter(([id, logs]) => logs.length > 1);

    // 7. Find suspicious transactions
    const suspiciousManualAdds = transactions.filter(tx => 
      tx.type === 'manual_add' && 
      tx.created_by === target_user_email &&
      (!tx.processed_by || tx.processed_by === target_user_email)
    );

    console.log(`Balance: ${balance?.balance || 0}`);
    console.log(`Transactions: ${transactions.length}`);
    console.log(`Logs: ${logs.length}`);
    console.log(`Duplicates: ${duplicates.length}`);
    console.log(`Suspicious manual_add: ${suspiciousManualAdds.length}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      balance: balance,
      transactions_summary: {
        total: transactions.length,
        by_type: txByType,
        total_income: totalIncome,
        total_expense: totalExpense,
        net: totalIncome - totalExpense
      },
      logs_summary: {
        total: logs.length,
        valid: logsByStatus.valid.length,
        frozen: logsByStatus.frozen.length,
        calculated_valid_coins: calculatedValid,
        calculated_frozen_coins: calculatedFrozen,
        calculated_total: calculatedValid + calculatedFrozen
      },
      issues: {
        duplicates: duplicates.length,
        duplicate_details: duplicates.map(([id, logs]) => ({
          transaction_id: id,
          count: logs.length,
          logs: logs
        })),
        suspicious_manual_adds: suspiciousManualAdds.length,
        suspicious_details: suspiciousManualAdds
      },
      verification: {
        balance_matches_logs: balance?.total_earned === (calculatedValid + calculatedFrozen),
        balance_difference: (balance?.total_earned || 0) - (calculatedValid + calculatedFrozen)
      },
      recent_transactions: transactions.slice(0, 10)
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});