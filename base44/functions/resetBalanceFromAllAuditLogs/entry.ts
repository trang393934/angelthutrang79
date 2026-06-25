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

    console.log(`🔧 Reset balance from ALL audit logs (including duplicates) for: ${target_user_email}`);

    // Fetch ALL audit logs (tất cả, không bỏ qua duplicates)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    console.log(`📊 Total logs: ${userLogs.length}`);

    // Calculate từ TẤT CẢ logs (không dedup)
    let validCoins = 0;
    let frozenCoins = 0;
    let validCount = 0;
    let frozenCount = 0;

    userLogs.forEach(log => {
      if (log.exclusion_reason === 'valid') {
        validCoins += log.coins_earned || 0;
        validCount++;
      } else {
        frozenCoins += log.coins_earned || 0;
        frozenCount++;
      }
    });

    const totalEarned = validCoins + frozenCoins;

    console.log(`\n💰 CALCULATED (from ALL logs, no dedup):`);
    console.log(`  Valid logs: ${validCount} logs = ${validCoins.toLocaleString()} coins`);
    console.log(`  Frozen logs: ${frozenCount} logs = ${frozenCoins.toLocaleString()} coins`);
    console.log(`  Total: ${totalEarned.toLocaleString()} coins`);

    // Fetch current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const currentPaid = balance.paid_amount || 0;
    const newAvailable = Math.max(0, validCoins - currentPaid);

    console.log(`\n🔄 BEFORE UPDATE:`);
    console.log(`  net_valid_coins: ${(balance.net_valid_coins || 0).toLocaleString()}`);
    console.log(`  frozen_balance: ${(balance.frozen_balance || 0).toLocaleString()}`);
    console.log(`  total_earned: ${(balance.total_earned || 0).toLocaleString()}`);
    console.log(`  paid_amount: ${currentPaid.toLocaleString()}`);
    console.log(`  available_for_withdrawal: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: validCoins,
      frozen_balance: frozenCoins,
      total_earned: totalEarned,
      available_for_withdrawal: newAvailable
    });

    console.log(`\n✅ AFTER UPDATE:`);
    console.log(`  net_valid_coins: ${validCoins.toLocaleString()}`);
    console.log(`  frozen_balance: ${frozenCoins.toLocaleString()}`);
    console.log(`  total_earned: ${totalEarned.toLocaleString()}`);
    console.log(`  paid_amount: ${currentPaid.toLocaleString()}`);
    console.log(`  available_for_withdrawal: ${newAvailable.toLocaleString()}`);

    // Log the change
    const changes = {
      net_valid_change: validCoins - (balance.net_valid_coins || 0),
      frozen_change: frozenCoins - (balance.frozen_balance || 0),
      total_change: totalEarned - (balance.total_earned || 0)
    };

    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔧 Admin reset balance from ALL audit logs (including duplicates)\n  net_valid: ${(balance.net_valid_coins || 0).toLocaleString()} → ${validCoins.toLocaleString()} (${changes.net_valid_change > 0 ? '+' : ''}${changes.net_valid_change.toLocaleString()})\n  frozen: ${(balance.frozen_balance || 0).toLocaleString()} → ${frozenCoins.toLocaleString()} (${changes.frozen_change > 0 ? '+' : ''}${changes.frozen_change.toLocaleString()})`,
      processed_by: user.email
    });

    console.log(`\n📊 CHANGES:`);
    console.log(`  net_valid_change: ${changes.net_valid_change > 0 ? '+' : ''}${changes.net_valid_change.toLocaleString()}`);
    console.log(`  frozen_change: ${changes.frozen_change > 0 ? '+' : ''}${changes.frozen_change.toLocaleString()}`);
    console.log(`  total_change: ${changes.total_change > 0 ? '+' : ''}${changes.total_change.toLocaleString()}`);

    console.log(`\n✨ Done!`);

    return Response.json({
      success: true,
      previous_balance: {
        net_valid_coins: balance.net_valid_coins || 0,
        frozen_balance: balance.frozen_balance || 0,
        total_earned: balance.total_earned || 0,
        available_for_withdrawal: balance.available_for_withdrawal || 0,
        paid_amount: currentPaid
      },
      new_balance: {
        net_valid_coins: validCoins,
        frozen_balance: frozenCoins,
        total_earned: totalEarned,
        available_for_withdrawal: newAvailable,
        paid_amount: currentPaid
      },
      log_counts: {
        valid_logs: validCount,
        frozen_logs: frozenCount,
        total_logs: userLogs.length
      },
      changes: changes
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});