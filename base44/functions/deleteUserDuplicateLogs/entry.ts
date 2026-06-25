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

    console.log(`🗑️  Delete duplicate logs cho: ${target_user_email}`);

    // Fetch all logs của user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    console.log(`\n📊 Total user logs: ${userLogs.length}`);

    // Group by transaction_id để tìm duplicates
    const byTx = new Map();
    userLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTx.has(txId)) byTx.set(txId, []);
      byTx.get(txId).push(log);
    });

    console.log(`  Unique transactions: ${byTx.size}`);
    console.log(`  Logs to delete: ${userLogs.length - byTx.size}`);

    let deleteCount = 0;
    const logsToDelete = [];

    // Để lại 1 log, xoá các log lặp
    byTx.forEach((logs, txId) => {
      if (logs.length > 1) {
        // Ưu tiên giữ log valid, nếu không có thì giữ log có coins cao nhất
        const validLog = logs.find(l => l.exclusion_reason === 'valid');
        const logToKeep = validLog || logs.reduce((max, l) => (l.coins_earned || 0) > (max.coins_earned || 0) ? l : max);
        
        // Xoá các logs không phải log cần giữ
        logs.forEach(log => {
          if (log.id !== logToKeep.id) {
            logsToDelete.push(log.id);
            deleteCount++;
          }
        });
      }
    });

    console.log(`\n🗑️  Deleting ${deleteCount} duplicate logs...`);

    // Delete all duplicates
    for (const logId of logsToDelete) {
      await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
    }

    console.log(`✅ Deleted ${deleteCount} logs`);

    // Verify after deletion
    const remainingLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const remainingUserLogs = remainingLogs.filter(l => l.user_email === target_user_email);
    
    console.log(`\n✅ AFTER DELETE:`);
    console.log(`  Total user logs: ${remainingUserLogs.length}`);

    return Response.json({
      success: true,
      target_user: target_user_email,
      deleted_count: deleteCount,
      remaining_logs: remainingUserLogs.length,
      message: `Đã xoá ${deleteCount} logs lặp, còn lại ${remainingUserLogs.length} logs sạch`
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});