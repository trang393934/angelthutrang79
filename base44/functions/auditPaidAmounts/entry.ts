import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Starting audit of paid amounts...');

    // Fetch all balances and withdrawals
    const [allBalances, allWithdrawals] = await Promise.all([
      base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 10000),
      base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 10000)
    ]);

    const completedWithdrawals = allWithdrawals.filter(w => w.status === 'completed');
    
    console.log(`📊 Found ${allBalances.length} users with balances`);
    console.log(`💸 Found ${completedWithdrawals.length} completed withdrawals`);

    // Calculate actual withdrawn amount per user
    const actualWithdrawn = {};
    for (const withdrawal of completedWithdrawals) {
      if (!actualWithdrawn[withdrawal.user_email]) {
        actualWithdrawn[withdrawal.user_email] = 0;
      }
      actualWithdrawn[withdrawal.user_email] += withdrawal.amount;
    }

    // Audit results
    const discrepancies = [];
    const correct = [];
    const needsUpdate = [];

    for (const balance of allBalances) {
      const userEmail = balance.user_email;
      const recordedPaid = balance.paid_amount || 0;
      const actualPaid = actualWithdrawn[userEmail] || 0;
      const difference = actualPaid - recordedPaid;

      const userData = {
        userEmail,
        recordedPaid,
        actualPaid,
        difference,
        total_earned: balance.total_earned || 0,
        balance: balance.balance || 0,
        available_balance: balance.available_balance || 0,
        unpaid_amount: balance.unpaid_amount || 0
      };

      if (difference !== 0) {
        discrepancies.push(userData);
        if (actualPaid > 0) {
          needsUpdate.push({
            userEmail,
            oldPaid: recordedPaid,
            newPaid: actualPaid,
            difference
          });
        }
      } else if (actualPaid > 0) {
        correct.push(userData);
      }
    }

    // Sort by biggest discrepancy
    discrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    console.log(`✅ Correct: ${correct.length} users`);
    console.log(`❌ Discrepancies: ${discrepancies.length} users`);

    return Response.json({
      success: true,
      summary: {
        totalUsers: allBalances.length,
        usersWithWithdrawals: Object.keys(actualWithdrawn).length,
        correctRecords: correct.length,
        discrepanciesFound: discrepancies.length,
        needsUpdate: needsUpdate.length
      },
      discrepancies: discrepancies.slice(0, 50), // Top 50 worst cases
      needsUpdate,
      recommendation: discrepancies.length > 0 
        ? '⚠️ Có sai lệch! Chạy syncPaidAmountFromWithdrawals để fix tất cả'
        : '✅ Hệ thống paid_amount đang chính xác',
      totalDiscrepancyAmount: discrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0)
    });

  } catch (error) {
    console.error('Error auditing paid amounts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});