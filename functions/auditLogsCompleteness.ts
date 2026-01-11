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

    console.log(`🔍 Audit logs completeness for: ${target_user_email}`);

    // Fetch ALL audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    console.log(`\n📊 AUDIT LOGS ANALYSIS:`);
    console.log(`  Total logs: ${userLogs.length}`);

    // Group by exclusion_reason
    const byReason = {};
    userLogs.forEach(log => {
      const reason = log.exclusion_reason || 'unknown';
      if (!byReason[reason]) byReason[reason] = [];
      byReason[reason].push(log);
    });

    console.log(`\n  By exclusion_reason:`);
    Object.entries(byReason).forEach(([reason, logs]) => {
      const totalCoins = logs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
      console.log(`    ${reason}: ${logs.length} logs = ${totalCoins.toLocaleString()} coins`);
    });

    // Calculate what net_valid SHOULD be
    const validLogs = userLogs.filter(l => l.exclusion_reason === 'valid');
    const validCoins = validLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);

    console.log(`\n💰 VALID LOGS CALCULATION:`);
    console.log(`  Valid logs: ${validLogs.length}`);
    console.log(`  Total coins from valid logs: ${validCoins.toLocaleString()}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    const balance = balances[0];
    const dbNetValid = balance.net_valid_coins || 0;

    console.log(`\n🗄️ DATABASE vs CALCULATED:`);
    console.log(`  DB net_valid_coins: ${dbNetValid.toLocaleString()}`);
    console.log(`  Calculated from valid logs: ${validCoins.toLocaleString()}`);
    console.log(`  Difference: ${(dbNetValid - validCoins).toLocaleString()} ${dbNetValid === validCoins ? '✅ MATCH' : '❌ MISMATCH'}`);

    // Check frozen
    const frozenLogs = userLogs.filter(l => l.exclusion_reason !== 'valid');
    const frozenCoins = frozenLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const dbFrozen = balance.frozen_balance || 0;

    console.log(`\n❄️ FROZEN LOGS CALCULATION:`);
    console.log(`  Frozen logs: ${frozenLogs.length}`);
    console.log(`  Total coins from frozen logs: ${frozenCoins.toLocaleString()}`);
    console.log(`  DB frozen_balance: ${dbFrozen.toLocaleString()}`);
    console.log(`  Difference: ${(dbFrozen - frozenCoins).toLocaleString()} ${dbFrozen === frozenCoins ? '✅ MATCH' : '❌ MISMATCH'}`);

    // Check total
    const calculatedTotal = validCoins + frozenCoins;
    const dbTotal = balance.total_earned || 0;

    console.log(`\n📈 TOTAL EARNED:`);
    console.log(`  Calculated (valid + frozen): ${calculatedTotal.toLocaleString()}`);
    console.log(`  DB total_earned: ${dbTotal.toLocaleString()}`);
    console.log(`  Difference: ${(dbTotal - calculatedTotal).toLocaleString()} ${dbTotal === calculatedTotal ? '✅ MATCH' : '❌ MISMATCH'}`);

    // Estimate missing coins
    if (dbNetValid > validCoins) {
      const missing = dbNetValid - validCoins;
      console.log(`\n⚠️ MISSING COINS: ${missing.toLocaleString()} coins not accounted in audit logs`);
      console.log(`  Possibility: logs were deleted or not created`);
    }

    return Response.json({
      success: true,
      total_logs: userLogs.length,
      by_reason: byReason,
      valid_logs_count: validLogs.length,
      valid_coins_calculated: validCoins,
      frozen_logs_count: frozenLogs.length,
      frozen_coins_calculated: frozenCoins,
      db_net_valid: dbNetValid,
      db_frozen: dbFrozen,
      db_total: dbTotal,
      discrepancies: {
        net_valid_mismatch: dbNetValid - validCoins,
        frozen_mismatch: dbFrozen - frozenCoins,
        total_mismatch: dbTotal - (validCoins + frozenCoins)
      }
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});