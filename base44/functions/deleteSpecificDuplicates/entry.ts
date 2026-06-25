import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 50 } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🗑️  Deleting specific duplicates with longer delay (${batch_size}ms) for ${target_user_email}`);

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

    let actualDeleted = 0;
    let failedCount = 0;

    // Delete all with longer delay
    for (let i = 0; i < logsToDelete.length; i++) {
      const logId = logsToDelete[i];
      
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        actualDeleted++;
        if ((i + 1) % 50 === 0) {
          console.log(`✅ Progress: ${i + 1}/${logsToDelete.length}`);
        }
      } catch (err) {
        failedCount++;
      }
      
      // Longer delay between deletes
      await new Promise(resolve => setTimeout(resolve, batch_size));
    }

    console.log(`\n✅ Deleted: ${actualDeleted}`);
    console.log(`⚠️  Failed: ${failedCount}`);
    console.log(`📌 Final logs: ${allLogs.length - actualDeleted}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      results: {
        total_logs_before: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        total_duplicates: logsToDelete.length,
        deleted: actualDeleted,
        failed: failedCount,
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