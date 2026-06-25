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

    console.log(`🔍 Debug logs for: ${target_user_email}`);

    // Fetch ALL logs (tất cả dữ liệu)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    console.log(`📊 TỔNG LOGS TRONG DATABASE: ${allLogs.length}`);

    // Filter target user
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);
    console.log(`👤 Logs của user: ${userLogs.length}`);

    // Count by status
    const valid = userLogs.filter(l => l.exclusion_reason === 'valid');
    const invalid = userLogs.filter(l => l.exclusion_reason !== 'valid');
    const byTxId = new Map();
    
    userLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTxId.has(txId)) byTxId.set(txId, []);
      byTxId.get(txId).push(log);
    });

    const duplicates = Array.from(byTxId.values()).filter(g => g.length > 1);
    const totalDupes = duplicates.reduce((sum, g) => sum + (g.length - 1), 0);

    console.log(`✅ Valid: ${valid.length}`);
    console.log(`❌ Invalid: ${invalid.length}`);
    console.log(`🔄 Duplicate groups: ${duplicates.length}`);
    console.log(`🔀 Total duplicate entries: ${totalDupes}`);

    // Phân tích các log đầu tiên
    console.log(`\n📋 Sample logs (first 5):`);
    userLogs.slice(0, 5).forEach((log, i) => {
      console.log(`  [${i}] tx=${log.transaction_id}, coins=${log.coins_earned}, reason=${log.exclusion_reason}`);
    });

    return Response.json({
      success: true,
      total_in_db: allLogs.length,
      user_logs: userLogs.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicate_groups: duplicates.length,
      total_duplicates: totalDupes,
      unique_transactions: byTxId.size
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});