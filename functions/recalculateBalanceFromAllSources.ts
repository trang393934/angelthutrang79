import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'Missing target_email' }, { status: 400 });
    }

    console.log(`\n🔄 RECALCULATE BALANCE: ${target_email}`);

    // Lấy tất cả transactions
    const allTx = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_email },
      '-created_date',
      5000
    );

    console.log(`\n💳 Tìm thấy ${allTx.length} transactions`);

    // Tính tổng net_valid_coins từ transactions
    let calculatedNetValid = 0;
    const txBreakdown = {
      bounty_reward: 0,
      build_reward: 0,
      admin_adjustment: 0,
      manual_add: 0
    };

    allTx.forEach(tx => {
      const amount = tx.amount || 0;
      calculatedNetValid += amount;
      
      if (tx.type in txBreakdown) {
        txBreakdown[tx.type] += amount;
      }
    });

    console.log(`\n📊 BREAKDOWN TRANSACTIONS:`);
    console.log(`  bounty_reward: ${txBreakdown.bounty_reward}`);
    console.log(`  build_reward: ${txBreakdown.build_reward}`);
    console.log(`  admin_adjustment: ${txBreakdown.admin_adjustment}`);
    console.log(`  manual_add: ${txBreakdown.manual_add}`);
    console.log(`  TỔNG NET_VALID: ${calculatedNetValid}`);

    // Lấy audit logs để tính frozen
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-created_date',
      5000
    );

    let calculatedFrozen = 0;
    allLogs.forEach(log => {
      if (log.coin_category === 'frozen') {
        calculatedFrozen += log.coins_earned || 0;
      }
    });

    console.log(`\n❄️ FROZEN từ logs: ${calculatedFrozen}`);

    // Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    if (!balance) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const paid = balance.paid_amount || 0;
    const newAvailable = calculatedNetValid - paid;
    const newTotalEarned = calculatedNetValid + calculatedFrozen;

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: calculatedNetValid,
      frozen_balance: calculatedFrozen,
      total_earned: newTotalEarned,
      available_for_withdrawal: newAvailable
    });

    console.log(`\n✅ BALANCE MỚI:`);
    console.log(`  net_valid_coins: ${balance.net_valid_coins} → ${calculatedNetValid}`);
    console.log(`  frozen_balance: ${balance.frozen_balance} → ${calculatedFrozen}`);
    console.log(`  total_earned: ${balance.total_earned} → ${newTotalEarned}`);
    console.log(`  paid_amount: ${paid} (không đổi)`);
    console.log(`  available_for_withdrawal: ${balance.available_for_withdrawal} → ${newAvailable}`);

    return Response.json({
      success: true,
      user_email: target_email,
      transactions_count: allTx.length,
      old_balance: {
        net_valid_coins: balance.net_valid_coins,
        frozen_balance: balance.frozen_balance,
        total_earned: balance.total_earned,
        paid_amount: paid,
        available_for_withdrawal: balance.available_for_withdrawal
      },
      new_balance: {
        net_valid_coins: calculatedNetValid,
        frozen_balance: calculatedFrozen,
        total_earned: newTotalEarned,
        paid_amount: paid,
        available_for_withdrawal: newAvailable
      },
      tx_breakdown: txBreakdown
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});