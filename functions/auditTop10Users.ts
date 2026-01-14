import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔍 Auditing TOP 10 users...');

    // Get all balances, sorted by total_earned
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    const top10 = allBalances.slice(0, 10);

    const results = [];

    for (const balance of top10) {
      console.log(`\n📊 Checking ${balance.user_email}...`);

      // Get ALL logs for this user
      const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
        user_email: balance.user_email
      }, '-audit_date', 10000);

      // Calculate from logs
      let totalFromLogs = 0;
      let validFromLogs = 0;
      let frozenFromLogs = 0;

      for (const log of logs) {
        const coins = log.coins_earned || 0;
        totalFromLogs += coins;
        
        if (log.coin_category === 'frozen') {
          frozenFromLogs += coins;
        } else {
          validFromLogs += coins;
        }
      }

      // Get withdrawals
      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
        user_email: balance.user_email,
        status: 'completed'
      }, '-created_date', 1000);

      const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      // Calculate expected values
      const expectedTotalEarned = validFromLogs + frozenFromLogs;
      const expectedAvailable = validFromLogs - totalWithdrawn;

      // Check for discrepancies
      const totalEarnedMatch = Math.abs((balance.total_earned || 0) - expectedTotalEarned) < 1;
      const netValidMatch = Math.abs((balance.net_valid_coins || 0) - validFromLogs) < 1;
      const frozenMatch = Math.abs((balance.frozen_balance || 0) - frozenFromLogs) < 1;
      const paidMatch = Math.abs((balance.paid_amount || 0) - totalWithdrawn) < 1;
      const availableMatch = Math.abs((balance.available_for_withdrawal || 0) - expectedAvailable) < 1;

      const allMatch = totalEarnedMatch && netValidMatch && frozenMatch && paidMatch && availableMatch;

      results.push({
        email: balance.user_email,
        status: allMatch ? '✅ CORRECT' : '❌ MISMATCH',
        current_balance: {
          total_earned: balance.total_earned || 0,
          net_valid: balance.net_valid_coins || 0,
          frozen: balance.frozen_balance || 0,
          paid: balance.paid_amount || 0,
          available: balance.available_for_withdrawal || 0
        },
        calculated_from_logs: {
          total_earned: expectedTotalEarned,
          net_valid: validFromLogs,
          frozen: frozenFromLogs,
          paid: totalWithdrawn,
          available: expectedAvailable
        },
        difference: {
          total_earned: (balance.total_earned || 0) - expectedTotalEarned,
          net_valid: (balance.net_valid_coins || 0) - validFromLogs,
          frozen: (balance.frozen_balance || 0) - frozenFromLogs,
          paid: (balance.paid_amount || 0) - totalWithdrawn,
          available: (balance.available_for_withdrawal || 0) - expectedAvailable
        },
        logs_count: logs.length,
        withdrawals_count: withdrawals.length
      });

      console.log(`${allMatch ? '✅' : '❌'} ${balance.user_email}`);
    }

    const correctCount = results.filter(r => r.status === '✅ CORRECT').length;
    const incorrectCount = results.filter(r => r.status === '❌ MISMATCH').length;

    console.log(`\n📈 SUMMARY:`);
    console.log(`✅ Correct: ${correctCount}`);
    console.log(`❌ Incorrect: ${incorrectCount}`);

    return Response.json({
      success: true,
      summary: {
        total: results.length,
        correct: correctCount,
        incorrect: incorrectCount
      },
      users: results
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});