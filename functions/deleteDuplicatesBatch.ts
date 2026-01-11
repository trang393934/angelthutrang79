import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 200 } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🗑️  Deleting duplicates batch (size: ${batch_size}) for ${target_user_email}`);

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

    // Find duplicates
    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        logs.sort((a, b) => {
          if (a.exclusion_reason === 'valid' && b.exclusion_reason !== 'valid') return -1;
          if (a.exclusion_reason !== 'valid' && b.exclusion_reason === 'valid') return 1;
          return b.id.localeCompare(a.id);
        });

        const toDelete = logs.slice(1);
        toDelete.forEach(log => {
          logsToDelete.push(log.id);
        });
      }
    }

    console.log(`\n🗑️  Total to delete: ${logsToDelete.length}`);

    // Delete first batch only (batch_size items)
    const batch = logsToDelete.slice(0, batch_size);
    console.log(`⏳ Deleting first batch: ${batch.length} items`);

    let actualDeleted = 0;
    let failedCount = 0;

    for (let i = 0; i < batch.length; i++) {
      const logId = batch[i];
      
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        actualDeleted++;
      } catch (err) {
        failedCount++;
        console.log(`⚠️  Failed: ${logId}`);
      }
      
      // Small delay: 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Deleted: ${actualDeleted}`);
    console.log(`⚠️  Failed: ${failedCount}`);
    console.log(`📌 Remaining to delete: ${logsToDelete.length - batch.length}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      results: {
        total_logs_before: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        total_duplicates: logsToDelete.length,
        batch_size,
        deleted_in_batch: actualDeleted,
        failed_in_batch: failedCount,
        remaining_to_delete: logsToDelete.length - batch.length
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