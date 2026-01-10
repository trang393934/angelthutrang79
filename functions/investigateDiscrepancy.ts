import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payload
    const { user_email } = await req.json().catch(() => ({}));

    // Check permissions
    let targetEmail = user.email;
    if (user_email && user_email !== user.email) {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
      }
      targetEmail = user_email;
    }

    console.log(`🔍 Investigating discrepancy for ${targetEmail}`);

    // Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetEmail });
    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];

    // Get ALL transactions (income only)
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: targetEmail },
      '-created_date',
      10000
    );

    const incomeTransactions = allTransactions.filter(tx => tx.amount > 0);

    // Calculate from transactions
    const totalFromTransactions = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Get audit logs
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: targetEmail },
      '-created_date',
      10000
    );

    // Calculate from audit logs
    const totalFromAuditLogs = auditLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    // Group transactions by type
    const txByType = {};
    incomeTransactions.forEach(tx => {
      const type = tx.type || 'unknown';
      if (!txByType[type]) {
        txByType[type] = { count: 0, total: 0 };
      }
      txByType[type].count++;
      txByType[type].total += tx.amount;
    });

    // Group audit logs by category
    const auditByCategory = {};
    auditLogs.forEach(log => {
      const category = log.coin_category || 'unknown';
      if (!auditByCategory[category]) {
        auditByCategory[category] = { count: 0, total: 0 };
      }
      auditByCategory[category].count++;
      auditByCategory[category].total += (log.coins_earned || 0);
    });

    // Current balance breakdown
    const currentTotalEarned = balance.total_earned || 0;
    const currentAvailable = balance.available_balance || 0;
    const currentPending = balance.admin_review_pending || 0;
    const currentFrozen = balance.frozen_balance || 0;
    const currentPaid = balance.paid_amount || 0;
    const sumOfSubBalances = currentAvailable + currentPending + currentFrozen + currentPaid;
    const discrepancy = currentTotalEarned - sumOfSubBalances;

    // Find missing coins
    const missingCoins = totalFromTransactions - currentTotalEarned;

    console.log(`
📊 DETAILED ANALYSIS:

=== BALANCE (DATABASE) ===
Total Earned: ${currentTotalEarned.toLocaleString()}
- Available: ${currentAvailable.toLocaleString()}
- Pending Review: ${currentPending.toLocaleString()}
- Frozen: ${currentFrozen.toLocaleString()}
- Paid: ${currentPaid.toLocaleString()}
Sum: ${sumOfSubBalances.toLocaleString()}
DISCREPANCY: ${discrepancy.toLocaleString()}

=== TRANSACTIONS ===
Total from Transactions: ${totalFromTransactions.toLocaleString()}
Transaction Count: ${incomeTransactions.length}
MISSING from total_earned: ${missingCoins.toLocaleString()}

=== AUDIT LOGS ===
Total from Audit Logs: ${totalFromAuditLogs.toLocaleString()}
Audit Log Count: ${auditLogs.length}

=== ROOT CAUSE ===
${missingCoins === discrepancy 
  ? '✅ Discrepancy matches missing transactions!' 
  : '❌ Discrepancy does NOT match missing transactions'}
    `);

    return Response.json({
      success: true,
      summary: {
        total_earned_db: currentTotalEarned,
        sum_of_sub_balances: sumOfSubBalances,
        discrepancy: discrepancy,
        total_from_transactions: totalFromTransactions,
        missing_coins: missingCoins,
        root_cause: missingCoins === discrepancy ? 'transactions_not_counted' : 'unknown'
      },
      balance_breakdown: {
        available: currentAvailable,
        pending_review: currentPending,
        frozen: currentFrozen,
        paid: currentPaid
      },
      transactions_by_type: txByType,
      audit_logs_by_category: auditByCategory,
      transactions_sample: incomeTransactions.slice(0, 10).map(tx => ({
        date: tx.created_date,
        amount: tx.amount,
        type: tx.type,
        description: tx.description
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});