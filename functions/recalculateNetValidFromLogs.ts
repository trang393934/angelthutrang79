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

    console.log(`🔧 Recalculate net_valid_coins cho: ${target_user_email}`);

    // Fetch ALL logs từ database (không có limit query)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);

    // Filter chỉ lấy logs của target user
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    console.log(`📊 Total user logs: ${userLogs.length}`);

    // Group by transaction_id để tìm unique transactions
    const byTx = new Map();
    userLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTx.has(txId)) byTx.set(txId, []);
      byTx.get(txId).push(log);
    });

    console.log(`📊 Total logs: ${allLogs.length}`);
    console.log(`🔄 Duplicate groups: ${byTx.size} unique transactions`);

    // Tính từ UNIQUE transactions
    let totalValidCoins = 0;
    let totalFrozenCoins = 0;
    let validCount = 0;
    let frozenCount = 0;

    byTx.forEach((logs, txId) => {
      // Nếu group có valid log, cộng vào valid
      const validLog = logs.find(l => l.exclusion_reason === 'valid');

      if (validLog) {
        totalValidCoins += validLog.coins_earned || 0;
        validCount++;
      } else {
        // Nếu không có valid, chỉ cộng 1 invalid (lấy coins từ log có coins_earned cao nhất)
        const invalidLog = logs.reduce((max, log) => (log.coins_earned || 0) > (max.coins_earned || 0) ? log : max);
        totalFrozenCoins += invalidLog.coins_earned || 0;
        frozenCount++;
      }
    });

    console.log(`✅ Valid (unique): ${validCount} = ${totalValidCoins.toLocaleString()}`);
    console.log(`❌ Frozen (unique): ${frozenCount} = ${totalFrozenCoins.toLocaleString()}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const paid = balance.paid_amount || 0;
    const newTotal = totalValidCoins + totalFrozenCoins;
    const newAvailable = totalValidCoins - paid;

    console.log(`\n📊 BEFORE: net=${(balance.net_valid_coins || 0).toLocaleString()}, frozen=${(balance.frozen_balance || 0).toLocaleString()}, total=${(balance.total_earned || 0).toLocaleString()}, avail=${(balance.available_for_withdrawal || 0).toLocaleString()}`);
    console.log(`\n📊 AFTER: net=${totalValidCoins.toLocaleString()}, frozen=${totalFrozenCoins.toLocaleString()}, total=${newTotal.toLocaleString()}, avail=${newAvailable.toLocaleString()}`);

    // Update
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: totalValidCoins,
      frozen_balance: totalFrozenCoins,
      total_earned: newTotal,
      available_for_withdrawal: newAvailable
    });

    console.log(`✨ Updated!`);

    return Response.json({
      success: true,
      net_valid_coins: totalValidCoins,
      total_earned: newTotal,
      available_for_withdrawal: newAvailable,
      valid_logs_count: validCount,
      duplicates_ignored: allLogs.length - validCount
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});