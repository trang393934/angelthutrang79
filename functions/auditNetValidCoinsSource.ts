import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Auditing net_valid_coins sources...');

    // Sample user: tothiloan1011@gmail.com
    const sampleEmail = 'tothiloan1011@gmail.com';
    
    // Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email: sampleEmail 
    });
    const balance = balances[0];
    
    // Get audit logs (valid questions)
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
      user_email: sampleEmail 
    });
    const validCoinsFromLogs = auditLogs
      .filter(log => log.exclusion_reason === 'valid')
      .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    
    // Get transactions (để xem có những gì khác ngoài logs)
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      user_email: sampleEmail 
    }, '-created_date', 500);
    
    // Sum by type
    const byType = {};
    let totalFromTransactions = 0;
    for (const tx of transactions) {
      if (!byType[tx.type]) byType[tx.type] = 0;
      byType[tx.type] += tx.amount;
      if (tx.amount > 0) totalFromTransactions += tx.amount;
    }
    
    console.log(`\n📊 Analysis for: ${sampleEmail}`);
    console.log(`Balance.net_valid_coins: ${balance.net_valid_coins.toLocaleString()}`);
    console.log(`\nFrom Audit Logs (valid questions): ${validCoinsFromLogs.toLocaleString()}`);
    console.log(`From Transactions (all positive): ${totalFromTransactions.toLocaleString()}`);
    console.log(`\nTransactions by type:`);
    for (const [type, amount] of Object.entries(byType)) {
      console.log(`  ${type}: ${amount.toLocaleString()}`);
    }
    
    return Response.json({
      success: true,
      sample_email: sampleEmail,
      balance_net_valid_coins: balance.net_valid_coins,
      balance_frozen_balance: balance.frozen_balance,
      sources: {
        valid_questions_from_logs: validCoinsFromLogs,
        total_from_transactions: totalFromTransactions,
        transactions_by_type: byType
      },
      audit_logs_count: auditLogs.length,
      valid_logs_count: auditLogs.filter(l => l.exclusion_reason === 'valid').length,
      transactions_count: transactions.length,
      discrepancy: balance.net_valid_coins - validCoinsFromLogs,
      hypothesis: 'net_valid_coins = valid questions + bounty_reward + build_reward + admin_adjustment + manual_add'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});