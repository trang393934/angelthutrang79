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

    console.log(`🔍 Cleaning up duplicate audit logs for ${target_user_email}`);

    // Fetch all audit logs for this user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Total logs found: ${allLogs.length}`);

    // Group by transaction_id
    const groupedByTxId = {};
    allLogs.forEach(log => {
      const txId = log.transaction_id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(log);
    });

    console.log(`🔗 Unique transaction_ids: ${Object.keys(groupedByTxId).length}`);

    // Find duplicates and decide which to keep
    const toDelete = [];
    const kept = [];
    
    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        console.log(`\n📌 Transaction ${txId}: ${logs.length} logs`);
        
        // Try to find valid one
        const validLog = logs.find(l => l.exclusion_reason === 'valid');
        if (validLog) {
          console.log(`  ✅ Keeping VALID log (id: ${validLog.id})`);
          kept.push(validLog.id);
          
          // Delete all others
          logs.forEach(log => {
            if (log.id !== validLog.id) {
              console.log(`  🗑️  Deleting duplicate: ${log.id} (${log.exclusion_reason})`);
              toDelete.push(log.id);
            }
          });
        } else {
          // No valid log, keep the newest one
          const newestLog = logs.sort((a, b) => 
            new Date(b.created_date) - new Date(a.created_date)
          )[0];
          
          console.log(`  📅 Keeping NEWEST log (id: ${newestLog.id}, ${newestLog.exclusion_reason})`);
          kept.push(newestLog.id);
          
          logs.forEach(log => {
            if (log.id !== newestLog.id) {
              console.log(`  🗑️  Deleting old duplicate: ${log.id}`);
              toDelete.push(log.id);
            }
          });
        }
      } else {
        // Only one log for this tx_id, keep it
        kept.push(logs[0].id);
      }
    }

    console.log(`\n📊 DELETION SUMMARY:`);
    console.log(`  📌 Keeping: ${kept.length} logs`);
    console.log(`  🗑️  Deleting: ${toDelete.length} logs`);

    // Delete duplicates
    for (const logId of toDelete) {
      await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
    }

    console.log(`✅ Deletion complete!`);

    // Recalculate balance
    console.log(`\n💰 Recalculating balance...`);
    
    const finalLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    let totalEarned = 0;
    let netValid = 0;
    let frozenBalance = 0;

    finalLogs.forEach(log => {
      totalEarned += log.coins_earned || 0;
      
      if (log.exclusion_reason === 'valid') {
        netValid += log.coins_earned || 0;
      } else {
        frozenBalance += log.coins_earned || 0;
      }
    });

    console.log(`📈 New totals:`);
    console.log(`  Total Earned: ${totalEarned}`);
    console.log(`  Net Valid: ${netValid}`);
    console.log(`  Frozen: ${frozenBalance}`);
    console.log(`  Unique Questions: ${Object.keys(groupedByTxId).length}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      logs_deleted: toDelete.length,
      logs_kept: kept.length,
      total_unique_questions: Object.keys(groupedByTxId).length,
      recalculated: {
        total_earned: totalEarned,
        net_valid_coins: netValid,
        frozen_balance: frozenBalance,
        available_for_withdrawal: netValid - 829000 // Assuming paid_amount = 829000
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});