import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { 
      target_user_email,
      batch_size = 40,
      auto_delete = false
    } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🤖 Smart Duplicate Detection: ${target_user_email}`);

    // Fetch all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Total logs: ${allLogs.length}`);

    // Group by transaction_id - this IS the duplicate detection logic
    const groupedByTxId = {};
    allLogs.forEach(log => {
      const txId = log.transaction_id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(log);
    });

    console.log(`🔗 Unique transactions: ${Object.keys(groupedByTxId).length}`);

    // Find duplicates
    let totalDuplicates = 0;
    const duplicateGroups = [];
    const recordsToDelete = [];

    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        // Sort to keep best: valid > others, then newest
        logs.sort((a, b) => {
          if (a.exclusion_reason === 'valid' && b.exclusion_reason !== 'valid') return -1;
          if (a.exclusion_reason !== 'valid' && b.exclusion_reason === 'valid') return 1;
          return b.created_date.localeCompare(a.created_date);
        });

        // Keep first, delete rest
        const keep = logs[0];
        const toDelete = logs.slice(1);
        
        toDelete.forEach(log => recordsToDelete.push(log.id));
        totalDuplicates += toDelete.length;

        duplicateGroups.push({
          tx_id: txId,
          count: logs.length,
          keep_id: keep.id,
          keep_reason: keep.exclusion_reason === 'valid' ? 'valid' : 'newest',
          delete_count: toDelete.length
        });
      }
    }

    console.log(`\n⚠️  Total duplicates: ${totalDuplicates}`);
    console.log(`📋 Groups: ${duplicateGroups.length}`);

    // Batch delete
    let deleted = 0;
    if (recordsToDelete.length > 0) {
      const batches = Math.ceil(recordsToDelete.length / batch_size);
      
      for (let b = 0; b < batches; b++) {
        const batchIds = recordsToDelete.slice(b * batch_size, (b + 1) * batch_size);
        console.log(`\n📦 Batch ${b + 1}/${batches}: ${batchIds.length} items`);

        for (const logId of batchIds) {
          try {
            if (auto_delete) {
              await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
              deleted++;
            }
            await new Promise(resolve => setTimeout(resolve, 60));
          } catch (err) {
            console.log(`⚠️  Failed: ${logId}`);
          }
        }

        if (b < batches - 1) {
          console.log(`⏳ Wait 5s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // Recalculate balance if auto_delete
    let newBalance = null;
    if (auto_delete && deleted > 0) {
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

      if (balances[0]) {
        const balance = balances[0];
        const paidAmount = balance.paid_amount || 0;
        const newAvailable = validCoins - paidAmount;

        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: totalEarned,
          net_valid_coins: validCoins,
          frozen_balance: frozenCoins,
          available_for_withdrawal: newAvailable
        });

        newBalance = {
          total_earned: totalEarned,
          net_valid_coins: validCoins,
          frozen_balance: frozenCoins,
          available_for_withdrawal: newAvailable
        };
      }

      console.log(`\n✨ Cleaned: ${deleted} duplicates deleted`);
      console.log(`💰 New balance: Net=${validCoins}, Frozen=${frozenCoins}`);
    }

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_logs: allLogs.length,
      unique_transactions: Object.keys(groupedByTxId).length,
      total_duplicates: totalDuplicates,
      duplicate_groups: duplicateGroups.length,
      deleted: auto_delete ? deleted : 0,
      status: auto_delete 
        ? `Deleted ${deleted}/${totalDuplicates} duplicates` 
        : `Found ${totalDuplicates} duplicates ready for deletion`,
      new_balance: newBalance,
      samples: duplicateGroups.slice(0, 5)
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});