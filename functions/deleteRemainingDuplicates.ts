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

    console.log(`🗑️  Deleting REMAINING duplicates for ${target_user_email}`);

    // Fetch all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Total logs now: ${allLogs.length}`);

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

    const logsToDelete = [];

    // Find remaining duplicates
    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        // Sort: valid first, then by newest (id descending)
        logs.sort((a, b) => {
          if (a.exclusion_reason === 'valid' && b.exclusion_reason !== 'valid') return -1;
          if (a.exclusion_reason !== 'valid' && b.exclusion_reason === 'valid') return 1;
          return b.id.localeCompare(a.id);
        });

        // Keep first, delete the rest
        const toDelete = logs.slice(1);
        toDelete.forEach(log => {
          logsToDelete.push(log.id);
        });
      }
    }

    console.log(`\n🗑️  Need to delete ${logsToDelete.length} remaining duplicates`);

    let actualDeleted = 0;
    let failedCount = 0;

    // Delete with 200ms delay between each to avoid rate limit
    for (let i = 0; i < logsToDelete.length; i++) {
      const logId = logsToDelete[i];
      
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        actualDeleted++;
        console.log(`✅ ${i + 1}/${logsToDelete.length}: ${logId}`);
      } catch (err) {
        failedCount++;
        console.log(`⚠️  ${i + 1}/${logsToDelete.length}: ${logId} - ${err.message}`);
      }
      
      // Longer delay: 200ms between deletes
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📈 DELETION COMPLETE:`);
    console.log(`  ✅ Deleted: ${actualDeleted}`);
    console.log(`  ⚠️  Failed: ${failedCount}`);
    console.log(`  🎯 Final total: ${allLogs.length - actualDeleted} logs`);
    console.log(`  📌 Should be: ${Object.keys(groupedByTxId).length} logs (1 per transaction)`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      results: {
        total_logs_before: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        duplicates_deleted: actualDeleted,
        duplicates_failed: failedCount,
        total_logs_after: allLogs.length - actualDeleted,
        complete: failedCount === 0
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