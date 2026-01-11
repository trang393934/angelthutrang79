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

    // Fetch ALL logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    // Tính valid logs (inclusion_reason === 'valid')
    const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
    const totalValidCoins = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    // Tính frozen/invalid logs (exclusion_reason !== 'valid')
    const invalidLogs = allLogs.filter(log => log.exclusion_reason !== 'valid');
    const totalFrozenCoins = invalidLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    console.log(`📊 Total logs: ${allLogs.length}`);
    console.log(`✅ Valid logs: ${validLogs.length} = ${totalValidCoins.toLocaleString()}`);
    console.log(`❌ Invalid logs: ${invalidLogs.length} = ${totalFrozenCoins.toLocaleString()}`);

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
      valid_logs_count: validLogs.length,
      duplicates_ignored: allLogs.length - validLogs.length
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});