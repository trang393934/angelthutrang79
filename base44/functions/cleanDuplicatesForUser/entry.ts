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

    console.log(`🗑️  Xóa duplicate cho: ${target_user_email}`);

    // Fetch all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Total logs: ${allLogs.length}`);

    // Group by transaction_id
    const groupedByTxId = {};
    allLogs.forEach(log => {
      const txId = log.transaction_id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(log);
    });

    console.log(`🔗 Unique transactions: ${Object.keys(groupedByTxId).length}`);

    // Find duplicates to delete
    const idsToDelete = [];
    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        // Sort: keep valid first, then newest by date
        logs.sort((a, b) => {
          if (a.exclusion_reason === 'valid' && b.exclusion_reason !== 'valid') return -1;
          if (a.exclusion_reason !== 'valid' && b.exclusion_reason === 'valid') return 1;
          return b.created_date.localeCompare(a.created_date);
        });

        // Mark all except first for deletion
        const toDelete = logs.slice(1);
        toDelete.forEach(log => {
          idsToDelete.push(log.id);
        });
      }
    }

    console.log(`\n🗑️  Sẽ xóa: ${idsToDelete.length} câu`);

    // Delete with delay to avoid rate limit
    let deleted = 0;
    for (let i = 0; i < idsToDelete.length; i++) {
      const logId = idsToDelete[i];
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        deleted++;
        if ((i + 1) % 100 === 0) {
          console.log(`  ✅ ${i + 1}/${idsToDelete.length}`);
        }
      } catch (err) {
        console.log(`⚠️  Failed: ${logId}`);
      }
      // 50ms delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n✅ Xóa xong: ${deleted}/${idsToDelete.length}`);

    // Recalculate balance from cleaned logs
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

    console.log(`\n💰 Recalculate:`);
    console.log(`  Total: ${totalEarned.toLocaleString()}`);
    console.log(`  Valid: ${validCoins.toLocaleString()}`);
    console.log(`  Frozen: ${frozenCoins.toLocaleString()}`);

    // Fetch balance
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

      console.log(`\n✨ Balance updated:`);
      console.log(`  Total Earned: ${totalEarned.toLocaleString()}`);
      console.log(`  Net Valid: ${validCoins.toLocaleString()}`);
      console.log(`  Frozen: ${frozenCoins.toLocaleString()}`);
      console.log(`  Available: ${newAvailable.toLocaleString()}`);
    }

    return Response.json({
      success: true,
      user_email: target_user_email,
      before: {
        total_logs: allLogs.length,
        unique_tx: Object.keys(groupedByTxId).length
      },
      after: {
        total_logs: cleanedLogs.length,
        deleted_count: deleted
      },
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