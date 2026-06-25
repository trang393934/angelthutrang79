import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'Missing target_email' }, { status: 400 });
    }

    console.log(`\n🔍 ĐIỀU TRA 80,000 COINS MẤT Tích: ${target_email}`);

    // Lấy balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    const storedTotalEarned = balance?.total_earned || 0;

    // Lấy TẤT CẢ logs (không lọc)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-question_date',
      2000
    );

    console.log(`\n📊 PHÂN TÍCH TẤT CẢ LOGS:`);
    let byExclusionReason = {};
    let byCoinCategory = {};
    let totalFromAllLogs = 0;

    allLogs.forEach(log => {
      // Group by exclusion_reason
      if (!byExclusionReason[log.exclusion_reason]) {
        byExclusionReason[log.exclusion_reason] = { count: 0, total: 0 };
      }
      byExclusionReason[log.exclusion_reason].count++;
      byExclusionReason[log.exclusion_reason].total += log.coins_earned || 0;

      // Group by coin_category
      if (!byCoinCategory[log.coin_category]) {
        byCoinCategory[log.coin_category] = { count: 0, total: 0 };
      }
      byCoinCategory[log.coin_category].count++;
      byCoinCategory[log.coin_category].total += log.coins_earned || 0;

      totalFromAllLogs += log.coins_earned || 0;
    });

    console.log(`  Tổng logs: ${allLogs.length}`);
    console.log(`\n  📋 By exclusion_reason:`);
    Object.entries(byExclusionReason).forEach(([reason, data]) => {
      console.log(`    ${reason}: ${data.count} logs = ${data.total} coins`);
    });

    console.log(`\n  📂 By coin_category:`);
    Object.entries(byCoinCategory).forEach(([category, data]) => {
      console.log(`    ${category}: ${data.count} logs = ${data.total} coins`);
    });

    console.log(`\n  ➕ Tổng cộng TẤT CẢ logs: ${totalFromAllLogs}`);
    console.log(`  📌 Stored total_earned: ${storedTotalEarned}`);
    console.log(`  ⚠️ Chênh lệch: ${storedTotalEarned - totalFromAllLogs}`);

    // Tìm logs bị "mất" (không phải valid, không phải frozen, không phải pending)
    const suspiciousLogs = allLogs.filter(log => 
      log.exclusion_reason !== 'valid' && 
      log.coin_category !== 'frozen' && 
      log.coin_category !== 'pending_review'
    );

    console.log(`\n🚨 LOGS CÓ DẤU HIỆU BỊ "MẤT":`);
    console.log(`  ${suspiciousLogs.length} logs`);
    let suspiciousTotal = 0;
    suspiciousLogs.forEach(log => {
      console.log(`    ${log.question_text?.substring(0, 50)}: ${log.coins_earned} coins (reason: ${log.exclusion_reason}, category: ${log.coin_category})`);
      suspiciousTotal += log.coins_earned || 0;
    });
    console.log(`  Tổng: ${suspiciousTotal} coins`);

    // Kiểm tra transactions
    const allTx = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_email },
      '-created_date',
      1000
    );

    console.log(`\n💳 TRANSACTIONS:`);
    let txTotal = 0;
    allTx.forEach(tx => {
      txTotal += tx.amount || 0;
    });
    console.log(`  ${allTx.length} transactions, tổng: ${txTotal} coins`);

    return Response.json({
      success: true,
      user_email: target_email,
      analysis: {
        stored_total_earned: storedTotalEarned,
        total_from_all_logs: totalFromAllLogs,
        missing_coins: storedTotalEarned - totalFromAllLogs,
        by_exclusion_reason: byExclusionReason,
        by_coin_category: byCoinCategory,
        suspicious_logs: {
          count: suspiciousLogs.length,
          total: suspiciousTotal,
          samples: suspiciousLogs.slice(0, 5).map(log => ({
            coins: log.coins_earned,
            exclusion_reason: log.exclusion_reason,
            coin_category: log.coin_category,
            question: log.question_text?.substring(0, 100)
          }))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});