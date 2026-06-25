import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 30 } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🗑️  Clean batch (${batch_size}) cho: ${target_user_email}`);

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

    console.log(`\n🗑️  Tổng duplicate: ${idsToDelete.length}`);

    // Delete only first batch_size
    const batch = idsToDelete.slice(0, batch_size);
    console.log(`⏳ Xóa batch: ${batch.length}`);

    let deleted = 0;
    for (let i = 0; i < batch.length; i++) {
      const logId = batch[i];
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        deleted++;
      } catch (err) {
        console.log(`⚠️  Failed: ${logId}`);
      }
      // 60ms delay
      await new Promise(resolve => setTimeout(resolve, 60));
    }

    console.log(`\n✅ Xóa: ${deleted}/${batch.length}`);
    console.log(`📌 Còn lại: ${idsToDelete.length - batch.length}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      deleted: deleted,
      remaining: idsToDelete.length - batch.length,
      total_duplicates: idsToDelete.length
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});