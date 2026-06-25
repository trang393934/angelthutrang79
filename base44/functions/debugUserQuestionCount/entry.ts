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

    console.log(`\n🔍 DEBUG: ${target_email}`);

    // Lấy TẤT CẢ audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-created_date',
      5000
    );

    console.log(`\n📊 TỔNG LOGS: ${allLogs.length}`);

    // Kiểm tra trùng lặp theo question_text
    const questionTextMap = new Map();
    allLogs.forEach((log, idx) => {
      const key = log.question_text;
      if (!questionTextMap.has(key)) {
        questionTextMap.set(key, []);
      }
      questionTextMap.get(key).push({
        idx,
        coins: log.coins_earned,
        reason: log.exclusion_reason,
        date: log.question_date,
        tx_id: log.transaction_id
      });
    });

    // Tìm những câu trùng lặp (same question_text)
    const duplicateQuestions = [];
    questionTextMap.forEach((occurrences, questionText) => {
      if (occurrences.length > 1) {
        duplicateQuestions.push({
          question_text: questionText.substring(0, 100),
          count: occurrences.length,
          total_coins: occurrences.reduce((sum, o) => sum + o.coins, 0),
          occurrences: occurrences.map(o => ({
            coins: o.coins,
            reason: o.reason,
            date: o.date,
            tx_id: o.tx_id
          }))
        });
      }
    });

    console.log(`\n🔄 SỐ CÂU HỎI TRÙNG LẶP: ${duplicateQuestions.length}`);
    duplicateQuestions.forEach(dup => {
      console.log(`  - "${dup.question_text}": ${dup.count} lần = ${dup.total_coins} coins`);
    });

    // Kiểm tra trùng lặp theo transaction_id
    const txIdMap = new Map();
    allLogs.forEach((log, idx) => {
      if (log.transaction_id) {
        const key = log.transaction_id;
        if (!txIdMap.has(key)) {
          txIdMap.set(key, []);
        }
        txIdMap.get(key).push({
          idx,
          coins: log.coins_earned,
          question: log.question_text?.substring(0, 50),
          reason: log.exclusion_reason
        });
      }
    });

    const duplicateTransactions = [];
    txIdMap.forEach((occurrences, txId) => {
      if (occurrences.length > 1) {
        duplicateTransactions.push({
          transaction_id: txId,
          count: occurrences.length,
          total_coins: occurrences.reduce((sum, o) => sum + o.coins, 0),
          occurrences
        });
      }
    });

    console.log(`\n💳 SỐ TRANSACTION_ID BỊ TRÙNG: ${duplicateTransactions.length}`);
    duplicateTransactions.forEach(dup => {
      console.log(`  - tx_id ${dup.transaction_id}: ${dup.count} lần = ${dup.total_coins} coins`);
    });

    // Phân tích chi tiết
    let totalCoinsFromLogs = 0;
    let validCount = 0;
    let invalidCount = 0;
    let frozenCount = 0;

    allLogs.forEach(log => {
      totalCoinsFromLogs += log.coins_earned || 0;
      if (log.exclusion_reason === 'valid') validCount++;
      else invalidCount++;
      if (log.coin_category === 'frozen') frozenCount++;
    });

    console.log(`\n📈 THỐNG KÊ:`);
    console.log(`  Tổng logs: ${allLogs.length}`);
    console.log(`  Valid: ${validCount}`);
    console.log(`  Invalid: ${invalidCount}`);
    console.log(`  Frozen: ${frozenCount}`);
    console.log(`  Tổng coins từ logs: ${totalCoinsFromLogs}`);

    // So sánh với balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    console.log(`\n💾 BALANCE:`);
    console.log(`  Stored total_earned: ${balance?.total_earned || 0}`);
    console.log(`  Chênh lệch: ${(balance?.total_earned || 0) - totalCoinsFromLogs}`);

    return Response.json({
      success: true,
      user_email: target_email,
      summary: {
        total_logs: allLogs.length,
        valid_count: validCount,
        invalid_count: invalidCount,
        frozen_count: frozenCount,
        total_coins_from_logs: totalCoinsFromLogs,
        stored_total_earned: balance?.total_earned || 0,
        discrepancy: (balance?.total_earned || 0) - totalCoinsFromLogs
      },
      duplicate_questions_count: duplicateQuestions.length,
      duplicate_transaction_ids_count: duplicateTransactions.length,
      duplicate_questions_samples: duplicateQuestions.slice(0, 5),
      duplicate_transaction_ids_samples: duplicateTransactions.slice(0, 5),
      warning: duplicateQuestions.length > 0 ? "⚠️ CÓ CÂU HỎI TRÙNG LẶP - Có thể bị cộng coins nhiều lần!" : "✅ Không phát hiện câu hỏi trùng lặp"
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});