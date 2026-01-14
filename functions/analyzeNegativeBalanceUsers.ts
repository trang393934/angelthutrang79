import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔍 Analyzing users with negative available_for_withdrawal...');

    // Fetch all users with negative available
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    const negativeUsers = allBalances.filter(b => (b.available_for_withdrawal || 0) < 0);

    console.log(`Found ${negativeUsers.length} users with negative balances`);

    const analysis = [];

    for (const balance of negativeUsers) {
      // Get their withdrawal history
      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
        user_email: balance.user_email,
        status: 'completed'
      }, '-created_date', 1000);

      // Get their question logs
      const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
        user_email: balance.user_email
      }, '-audit_date', 1000);

      // Calculate totals from logs
      let totalFromLogs = 0;
      let validCoins = 0;
      let frozenCoins = 0;

      for (const log of logs) {
        const coins = log.coins_earned || 0;
        totalFromLogs += coins;
        
        if (log.coin_category === 'frozen') {
          frozenCoins += coins;
        } else {
          validCoins += coins;
        }
      }

      // Calculate total withdrawn
      const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      analysis.push({
        email: balance.user_email,
        current_balance: {
          total_earned: balance.total_earned || 0,
          net_valid: balance.net_valid_coins || 0,
          frozen: balance.frozen_balance || 0,
          paid: balance.paid_amount || 0,
          available: balance.available_for_withdrawal || 0
        },
        calculated_from_logs: {
          total: totalFromLogs,
          valid: validCoins,
          frozen: frozenCoins
        },
        withdrawals: {
          count: withdrawals.length,
          total: totalWithdrawn
        },
        discrepancy: {
          balance_vs_logs: (balance.total_earned || 0) - totalFromLogs,
          paid_vs_withdrawals: (balance.paid_amount || 0) - totalWithdrawn,
          shortage: totalWithdrawn - validCoins
        },
        logs_count: logs.length
      });
    }

    // Sort by shortage (most negative first)
    analysis.sort((a, b) => a.discrepancy.shortage - b.discrepancy.shortage);

    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log(`Total negative users: ${negativeUsers.length}`);
    console.log(`Total shortage: ${analysis.reduce((sum, a) => sum + Math.abs(a.discrepancy.shortage), 0).toLocaleString()}`);

    return Response.json({
      success: true,
      total_negative_users: negativeUsers.length,
      total_system_shortage: analysis.reduce((sum, a) => sum + Math.abs(a.discrepancy.shortage), 0),
      users: analysis
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});