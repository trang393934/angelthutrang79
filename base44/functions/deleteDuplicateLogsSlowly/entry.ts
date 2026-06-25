import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_user_email, delay_ms = 2000 } = await req.json();
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🗑️ Bắt đầu xóa duplicate logs cho: ${target_user_email}`);
    console.log(`⏸️ Delay giữa các lần xóa: ${delay_ms}ms`);

    // Lấy tất cả audit logs của user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Tổng số logs: ${allLogs.length}`);

    // Nhóm logs theo transaction_id
    const logsByTransaction = {};
    allLogs.forEach(log => {
      if (!logsByTransaction[log.transaction_id]) {
        logsByTransaction[log.transaction_id] = [];
      }
      logsByTransaction[log.transaction_id].push(log);
    });

    // Tìm các transaction_id có duplicate
    const transactionsWithDuplicates = [];
    Object.entries(logsByTransaction).forEach(([txId, logs]) => {
      if (logs.length > 1) {
        transactionsWithDuplicates.push({
          transaction_id: txId,
          count: logs.length,
          logs: logs
        });
      }
    });

    console.log(`📍 Tìm thấy ${transactionsWithDuplicates.length} transaction có duplicate`);

    let totalDeleted = 0;
    let successCount = 0;
    let failCount = 0;

    // Xóa từng duplicate từ từ
    for (const txData of transactionsWithDuplicates) {
      // Giữ lại 1 log, xóa phần còn lại
      const logsToDelete = txData.logs.slice(1);

      for (const log of logsToDelete) {
        try {
          await base44.asServiceRole.entities.QuestionAuditLog.delete(log.id);
          console.log(`  ✅ Xóa log ${log.id}`);
          totalDeleted++;
          successCount++;
        } catch (error) {
          console.error(`  ❌ Lỗi xóa log ${log.id}: ${error.message}`);
          failCount++;
        }

        // Delay giữa các lần xóa để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, delay_ms));
      }
    }

    console.log(`\n✅ HOÀN THÀNH`);
    console.log(`📊 Tổng xóa: ${totalDeleted} logs`);
    console.log(`✅ Thành công: ${successCount}`);
    console.log(`❌ Thất bại: ${failCount}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_deleted: totalDeleted,
      transactions_with_duplicates: transactionsWithDuplicates.length,
      success_count: successCount,
      fail_count: failCount
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});