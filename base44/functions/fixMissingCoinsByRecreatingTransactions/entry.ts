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

    console.log(`\n🔧 FIX MISSING COINS: ${target_email}`);

    // Lấy tất cả audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-created_date',
      2000
    );

    // Lấy tất cả transactions
    const allTx = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_email },
      '-created_date',
      1000
    );

    const txIds = new Set(allTx.map(tx => tx.reference_id).filter(Boolean));

    // Tìm orphaned logs
    const orphanedLogs = allLogs.filter(log => 
      log.transaction_id && !txIds.has(log.transaction_id)
    );

    console.log(`\n📊 Tìm thấy ${orphanedLogs.length} orphaned logs`);

    // Tạo transactions cho orphaned logs
    const txToCreate = orphanedLogs.map(log => ({
      user_email: target_email,
      amount: log.coins_earned || 0,
      type: 'bounty_reward',
      description: `Recovery: ${log.question_text?.substring(0, 100) || 'Q&A'}`,
      reference_id: log.transaction_id
    }));

    console.log(`\n📝 Tạo ${txToCreate.length} transactions...`);

    // Tạo transactions trong batches
    const batchSize = 50;
    let createdCount = 0;

    for (let i = 0; i < txToCreate.length; i += batchSize) {
      const batch = txToCreate.slice(i, i + batchSize);
      await base44.asServiceRole.entities.CamlycoinTransaction.bulkCreate(batch);
      createdCount += batch.length;
      console.log(`  ✅ Batch ${Math.ceil((i + batchSize) / batchSize)}: ${batch.length} transactions created`);
    }

    // Recalculate balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    // Tính lại từ logs và transactions
    const allLogsAfter = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-created_date',
      2000
    );

    const validCoins = allLogsAfter
      .filter(log => log.exclusion_reason === 'valid')
      .reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    const frozenCoins = allLogsAfter
      .filter(log => log.coin_category === 'frozen')
      .reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    const calculatedTotalEarned = validCoins + frozenCoins;

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      total_earned: calculatedTotalEarned,
      net_valid_coins: validCoins,
      frozen_balance: frozenCoins,
      available_for_withdrawal: validCoins - (balance?.paid_amount || 0)
    });

    console.log(`\n✅ HOÀN THÀNH:`);
    console.log(`  Orphaned logs: ${orphanedLogs.length}`);
    console.log(`  Transactions created: ${createdCount}`);
    console.log(`  Old total_earned: ${balance?.total_earned}`);
    console.log(`  New total_earned: ${calculatedTotalEarned}`);
    console.log(`  Correction: ${calculatedTotalEarned - (balance?.total_earned || 0)}`);

    return Response.json({
      success: true,
      orphaned_logs_fixed: orphanedLogs.length,
      transactions_created: createdCount,
      old_balance: {
        total_earned: balance?.total_earned,
        net_valid_coins: balance?.net_valid_coins,
        frozen_balance: balance?.frozen_balance,
        available_for_withdrawal: balance?.available_for_withdrawal
      },
      new_balance: {
        total_earned: calculatedTotalEarned,
        net_valid_coins: validCoins,
        frozen_balance: frozenCoins,
        available_for_withdrawal: validCoins - (balance?.paid_amount || 0)
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});