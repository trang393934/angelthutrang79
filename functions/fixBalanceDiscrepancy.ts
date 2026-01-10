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

    console.log(`🔍 Checking balance discrepancy for ${targetEmail}`);

    // Get user balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetEmail });
    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];

    // Get all transactions for this user
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: targetEmail },
      '-created_date',
      10000
    );

    // Calculate total earned from transactions
    const totalEarnedFromTransactions = transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Current balance breakdown
    const currentTotalEarned = balance.total_earned || 0;
    const currentAvailable = balance.available_balance || 0;
    const currentPending = balance.admin_review_pending || 0;
    const currentFrozen = balance.frozen_balance || 0;
    const currentPaid = balance.paid_amount || 0;

    // Sum of sub-balances
    const sumOfSubBalances = currentAvailable + currentPending + currentFrozen + currentPaid;

    // Discrepancy
    const discrepancy = currentTotalEarned - sumOfSubBalances;

    console.log(`
📊 BALANCE ANALYSIS:
- Total Earned (DB): ${currentTotalEarned}
- Total Earned (Txs): ${totalEarnedFromTransactions}
- Available: ${currentAvailable}
- Pending Review: ${currentPending}
- Frozen: ${currentFrozen}
- Paid: ${currentPaid}
- Sum of Sub-Balances: ${sumOfSubBalances}
- DISCREPANCY: ${discrepancy}
    `);

    if (Math.abs(discrepancy) < 1) {
      return Response.json({
        success: true,
        message: 'No significant discrepancy found',
        details: {
          total_earned: currentTotalEarned,
          sum_of_sub_balances: sumOfSubBalances,
          discrepancy: 0
        }
      });
    }

    // Fix strategy: Add discrepancy to available_balance
    // This assumes the discrepancy is legitimate earnings that weren't properly allocated
    console.log(`🔧 Fixing discrepancy by adding ${discrepancy} to available_balance`);

    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      available_balance: currentAvailable + discrepancy
    });

    // Verify fix
    const updatedBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetEmail });
    const updatedBalance = updatedBalances[0];
    const newSumOfSubBalances = 
      (updatedBalance.available_balance || 0) +
      (updatedBalance.admin_review_pending || 0) +
      (updatedBalance.frozen_balance || 0) +
      (updatedBalance.paid_amount || 0);

    console.log(`✅ Fixed! New sum of sub-balances: ${newSumOfSubBalances}`);

    return Response.json({
      success: true,
      message: 'Balance discrepancy fixed',
      before: {
        total_earned: currentTotalEarned,
        available: currentAvailable,
        pending: currentPending,
        frozen: currentFrozen,
        paid: currentPaid,
        sum: sumOfSubBalances,
        discrepancy: discrepancy
      },
      after: {
        total_earned: updatedBalance.total_earned,
        available: updatedBalance.available_balance,
        pending: updatedBalance.admin_review_pending,
        frozen: updatedBalance.frozen_balance,
        paid: updatedBalance.paid_amount,
        sum: newSumOfSubBalances,
        discrepancy: updatedBalance.total_earned - newSumOfSubBalances
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});