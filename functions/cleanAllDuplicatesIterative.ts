import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 40, max_batches = 100 } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🔄 Clean ALL duplicates (batch ${batch_size}, max ${max_batches}): ${target_user_email}`);

    let totalDeleted = 0;
    let batchCount = 0;

    while (batchCount < max_batches) {
      batchCount++;
      console.log(`\n📦 Batch ${batchCount}...`);

      // Fetch current logs
      const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
        { user_email: target_user_email },
        '-created_date',
        10000
      );

      // Group by transaction_id
      const groupedByTxId = {};
      allLogs.forEach(log => {
        const txId = log.transaction_id;
        if (!groupedByTxId[txId]) {
          groupedByTxId[txId] = [];
        }
        groupedByTxId[txId].push(log);
      });

      // Find duplicates
      const idsToDelete = [];
      for (const [txId, logs] of Object.entries(groupedByTxId)) {
        if (logs.length > 1) {
          logs.sort((a, b) => {
            if (a.exclusion_reason === 'valid' && b.exclusion_reason !== 'valid') return -1;
            if (a.exclusion_reason !== 'valid' && b.exclusion_reason === 'valid') return 1;
            return b.created_date.localeCompare(a.created_date);
          });

          const toDelete = logs.slice(1);
          toDelete.forEach(log => {
            idsToDelete.push(log.id);
          });
        }
      }

      if (idsToDelete.length === 0) {
        console.log(`✅ No more duplicates!`);
        break;
      }

      console.log(`  Found: ${idsToDelete.length} duplicates`);

      // Delete batch_size items
      const batch = idsToDelete.slice(0, batch_size);
      let deleted = 0;

      for (let i = 0; i < batch.length; i++) {
        const logId = batch[i];
        try {
          await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
          deleted++;
        } catch (err) {
          console.log(`    ⚠️  Failed: ${logId}`);
        }
        await new Promise(resolve => setTimeout(resolve, 60));
      }

      totalDeleted += deleted;
      console.log(`  ✅ Deleted: ${deleted}/${batch.length}`);
      console.log(`  📌 Remaining: ${idsToDelete.length - batch.length}`);

      // Wait before next batch
      if (idsToDelete.length > batch.length) {
        console.log(`  ⏳ Wait 5s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Recalculate balance
    const cleanedLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    const validLogs = cleanedLogs.filter(l => l.exclusion_reason === 'valid');
    const totalEarned = cleanedLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const validCoins = validLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const frozenCoins = cleanedLogs
      .filter(l => l.coin_category === 'frozen')
      .reduce((sum, l) => sum + (l.coins_earned || 0), 0);

    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    const balance = balances[0];
    if (balance) {
      const paidAmount = balance.paid_amount || 0;
      const newAvailable = validCoins - paidAmount;

      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        total_earned: totalEarned,
        net_valid_coins: validCoins,
        frozen_balance: frozenCoins,
        available_for_withdrawal: newAvailable
      });
    }

    console.log(`\n✨ COMPLETE:`);
    console.log(`  Total deleted: ${totalDeleted}`);
    console.log(`  Final logs: ${cleanedLogs.length}`);
    console.log(`  Net Valid: ${validCoins.toLocaleString()}`);
    console.log(`  Frozen: ${frozenCoins.toLocaleString()}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_deleted: totalDeleted,
      batches_executed: batchCount,
      final_logs: cleanedLogs.length,
      balance: {
        total_earned: totalEarned,
        net_valid_coins: validCoins,
        frozen_balance: frozenCoins,
        available_for_withdrawal: validCoins - (balance?.paid_amount || 0)
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});