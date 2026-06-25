import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email } = await req.json();
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🔍 Checking duplicates for: ${target_user_email}`);

    // Fetch ALL logs for this user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    console.log(`📊 Total logs: ${userLogs.length}`);

    // Group by transaction_id
    const byTx = new Map();
    userLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTx.has(txId)) byTx.set(txId, []);
      byTx.get(txId).push(log);
    });

    console.log(`🔄 Unique transactions: ${byTx.size}`);
    console.log(`⚠️ Duplicate entries: ${userLogs.length - byTx.size}`);

    // Find duplicates
    const duplicates = [];
    byTx.forEach((logs, txId) => {
      if (logs.length > 1) {
        duplicates.push({
          transaction_id: txId,
          count: logs.length,
          coins: logs[0].coins_earned || 0,
          question: logs[0].question_text?.substring(0, 100),
          date: logs[0].question_date,
          log_ids: logs.map(l => l.id)
        });
      }
    });

    console.log(`\n🔴 Found ${duplicates.length} duplicate groups`);

    // Calculate correct totals from UNIQUE transactions
    let validCoins = 0;
    let frozenCoins = 0;
    byTx.forEach((logs) => {
      const validLog = logs.find(l => l.exclusion_reason === 'valid');
      if (validLog) {
        validCoins += validLog.coins_earned || 0;
      } else {
        const invalidLog = logs.reduce((max, log) => 
          (log.coins_earned || 0) > (max.coins_earned || 0) ? log : max
        );
        frozenCoins += invalidLog.coins_earned || 0;
      }
    });

    const correctTotal = validCoins + frozenCoins;

    console.log(`\n✅ Correct calculation (from ${byTx.size} unique tx):`);
    console.log(`  Valid: ${validCoins.toLocaleString()}`);
    console.log(`  Frozen: ${frozenCoins.toLocaleString()}`);
    console.log(`  Total: ${correctTotal.toLocaleString()}`);

    // Fetch current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length > 0) {
      const balance = balances[0];
      console.log(`\n📊 Current database balance:`);
      console.log(`  net_valid_coins: ${(balance.net_valid_coins || 0).toLocaleString()}`);
      console.log(`  frozen_balance: ${(balance.frozen_balance || 0).toLocaleString()}`);
      console.log(`  total_earned: ${(balance.total_earned || 0).toLocaleString()}`);

      const discrepancy = (balance.total_earned || 0) - correctTotal;
      console.log(`\n⚠️ Discrepancy: ${discrepancy.toLocaleString()}`);
    }

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_logs: userLogs.length,
      unique_transactions: byTx.size,
      duplicate_entries: userLogs.length - byTx.size,
      duplicate_groups: duplicates.length,
      duplicates: duplicates.slice(0, 20), // First 20
      correct_calculation: {
        valid_coins: validCoins,
        frozen_coins: frozenCoins,
        total_earned: correctTotal
      },
      current_balance: balances.length > 0 ? {
        net_valid_coins: balances[0].net_valid_coins || 0,
        frozen_balance: balances[0].frozen_balance || 0,
        total_earned: balances[0].total_earned || 0,
        discrepancy: (balances[0].total_earned || 0) - correctTotal
      } : null
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});