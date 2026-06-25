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

    console.log(`🔧 Reset balance from audit logs for: ${target_user_email}`);

    // Fetch ALL audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    // Calculate from unique transactions only
    const byTx = new Map();
    userLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTx.has(txId)) byTx.set(txId, []);
      byTx.get(txId).push(log);
    });

    console.log(`📊 Processing ${byTx.size} unique transactions from ${userLogs.length} logs`);

    // Calculate net_valid_coins (from unique transactions)
    let netValidCoins = 0;
    let frozenCoins = 0;

    byTx.forEach((logs, txId) => {
      // Prefer valid log over invalid
      const validLog = logs.find(l => l.exclusion_reason === 'valid');
      
      if (validLog) {
        netValidCoins += validLog.coins_earned || 0;
      } else {
        // Use highest coin amount from invalid logs
        const maxLog = logs.reduce((max, l) => (l.coins_earned || 0) > (max.coins_earned || 0) ? l : max);
        frozenCoins += maxLog.coins_earned || 0;
      }
    });

    const newTotal = netValidCoins + frozenCoins;

    console.log(`\n💰 CALCULATED:`);
    console.log(`  net_valid_coins: ${netValidCoins.toLocaleString()}`);
    console.log(`  frozen_balance: ${frozenCoins.toLocaleString()}`);
    console.log(`  total_earned: ${newTotal.toLocaleString()}`);

    // Fetch current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const currentPaid = balance.paid_amount || 0;
    const newAvailable = Math.max(0, netValidCoins - currentPaid);

    console.log(`\n🔄 BEFORE UPDATE:`);
    console.log(`  net_valid_coins: ${(balance.net_valid_coins || 0).toLocaleString()}`);
    console.log(`  frozen_balance: ${(balance.frozen_balance || 0).toLocaleString()}`);
    console.log(`  total_earned: ${(balance.total_earned || 0).toLocaleString()}`);
    console.log(`  paid_amount: ${currentPaid.toLocaleString()}`);
    console.log(`  available_for_withdrawal: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: netValidCoins,
      frozen_balance: frozenCoins,
      total_earned: newTotal,
      available_for_withdrawal: newAvailable
    });

    console.log(`\n✅ AFTER UPDATE:`);
    console.log(`  net_valid_coins: ${netValidCoins.toLocaleString()}`);
    console.log(`  frozen_balance: ${frozenCoins.toLocaleString()}`);
    console.log(`  total_earned: ${newTotal.toLocaleString()}`);
    console.log(`  paid_amount: ${currentPaid.toLocaleString()}`);
    console.log(`  available_for_withdrawal: ${newAvailable.toLocaleString()}`);

    // Log the change
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔧 Admin reset balance from audit logs\n  net_valid: ${(balance.net_valid_coins || 0).toLocaleString()} → ${netValidCoins.toLocaleString()}\n  frozen: ${(balance.frozen_balance || 0).toLocaleString()} → ${frozenCoins.toLocaleString()}`,
      processed_by: user.email
    });

    console.log(`\n✨ Done!`);

    return Response.json({
      success: true,
      previous_balance: {
        net_valid_coins: balance.net_valid_coins || 0,
        frozen_balance: balance.frozen_balance || 0,
        total_earned: balance.total_earned || 0,
        available_for_withdrawal: balance.available_for_withdrawal || 0
      },
      new_balance: {
        net_valid_coins: netValidCoins,
        frozen_balance: frozenCoins,
        total_earned: newTotal,
        available_for_withdrawal: newAvailable
      },
      unique_transactions: byTx.size,
      changes: {
        net_valid_change: netValidCoins - (balance.net_valid_coins || 0),
        frozen_change: frozenCoins - (balance.frozen_balance || 0),
        total_change: newTotal - (balance.total_earned || 0)
      }
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});