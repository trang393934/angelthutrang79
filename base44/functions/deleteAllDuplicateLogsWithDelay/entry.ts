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

    console.log(`🗑️  Deleting ALL duplicates for ${target_user_email}`);

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

    const logsToDelete = [];

    // For each transaction, keep only 1, delete the rest
    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        // Sort: valid first, then by newest (id descending)
        logs.sort((a, b) => {
          if (a.exclusion_reason === 'valid' && b.exclusion_reason !== 'valid') return -1;
          if (a.exclusion_reason !== 'valid' && b.exclusion_reason === 'valid') return 1;
          return b.id.localeCompare(a.id); // newest first
        });

        // Keep first, delete the rest
        const toDelete = logs.slice(1);
        toDelete.forEach(log => {
          logsToDelete.push(log.id);
        });
      }
    }

    console.log(`\n🗑️  Need to delete ${logsToDelete.length} duplicate logs`);

    let actualDeleted = 0;
    let failedCount = 0;

    // Delete with 50ms delay between each
    for (let i = 0; i < logsToDelete.length; i++) {
      const logId = logsToDelete[i];
      
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        actualDeleted++;
        
        // Log progress every 50 deletes
        if ((i + 1) % 50 === 0) {
          console.log(`✅ Deleted ${i + 1}/${logsToDelete.length}`);
        }
      } catch (err) {
        failedCount++;
        console.log(`⚠️  Skip ${logId}: ${err.message}`);
      }
      
      // Small delay to avoid rate limit (50ms)
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n📈 DELETION COMPLETE:`);
    console.log(`  ✅ Deleted: ${actualDeleted}`);
    console.log(`  ⚠️  Failed: ${failedCount}`);
    console.log(`  📊 Final total: ${allLogs.length - actualDeleted} logs`);
    console.log(`  🎯 Target: ${Object.keys(groupedByTxId).length} logs`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      results: {
        total_logs_before: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        duplicates_deleted: actualDeleted,
        duplicates_failed: failedCount,
        total_logs_after: allLogs.length - actualDeleted
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