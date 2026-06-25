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

    console.log(`🔍 Audit duplicates cho: ${target_user_email}`);

    // Fetch all logs của user này
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(l => l.user_email === target_user_email);

    console.log(`\n📊 TỔNG HỢP:`);
    console.log(`  Total logs: ${userLogs.length}`);

    // Group by transaction_id để tìm duplicates
    const byTx = new Map();
    userLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTx.has(txId)) byTx.set(txId, []);
      byTx.get(txId).push(log);
    });

    console.log(`  Unique transactions: ${byTx.size}`);
    console.log(`  Potential duplicates: ${userLogs.length - byTx.size}`);

    // Phân tích loại logs
    let validCount = 0;
    let validCoins = 0;
    let frozenCount = 0;
    let frozenCoins = 0;
    let duplicateDetails = [];

    byTx.forEach((logs, txId) => {
      if (logs.length > 1) {
        // Có duplicate
        const coinsArray = logs.map(l => l.coins_earned || 0);
        const total = coinsArray.reduce((a, b) => a + b, 0);
        duplicateDetails.push({
          tx_id: txId,
          count: logs.length,
          coins_per_log: coinsArray,
          total_coins_if_counted_all: total,
          question: logs[0].question_text?.substring(0, 50)
        });
      }

      // Tính valid vs frozen
      const validLog = logs.find(l => l.exclusion_reason === 'valid');
      if (validLog) {
        validCount++;
        validCoins += validLog.coins_earned || 0;
      } else {
        frozenCount++;
        const maxLog = logs.reduce((max, l) => (l.coins_earned || 0) > (max.coins_earned || 0) ? l : max);
        frozenCoins += maxLog.coins_earned || 0;
      }
    });

    console.log(`\n✅ Valid (unique tx): ${validCount} = ${validCoins.toLocaleString()} coins`);
    console.log(`❌ Frozen (unique tx): ${frozenCount} = ${frozenCoins.toLocaleString()} coins`);
    console.log(`📈 TỔNG (nếu tính đúng): ${(validCoins + frozenCoins).toLocaleString()} coins`);

    // Fetch balance của user
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    let balance = null;
    if (balances.length > 0) {
      balance = balances[0];
      console.log(`\n💾 BALANCE TRONG HỆ THỐNG:`);
      console.log(`  net_valid_coins: ${(balance.net_valid_coins || 0).toLocaleString()}`);
      console.log(`  frozen_balance: ${(balance.frozen_balance || 0).toLocaleString()}`);
      console.log(`  total_earned: ${(balance.total_earned || 0).toLocaleString()}`);
    }

    // Check discrepancy
    const systemTotal = balance ? (balance.total_earned || 0) : 0;
    const calculatedTotal = validCoins + frozenCoins;
    const discrepancy = systemTotal - calculatedTotal;

    console.log(`\n⚠️  KIỂM TRA:`);
    console.log(`  Tính từ logs: ${calculatedTotal.toLocaleString()}`);
    console.log(`  Lưu trong DB: ${systemTotal.toLocaleString()}`);
    console.log(`  Chênh lệch: ${discrepancy > 0 ? '+' : ''}${discrepancy.toLocaleString()}`);

    if (duplicateDetails.length > 0) {
      console.log(`\n🔴 DUPLICATE DETAILS (${duplicateDetails.length} tx bị lặp):`);
      duplicateDetails.slice(0, 10).forEach((dup, i) => {
        console.log(`  ${i + 1}. TX ${dup.tx_id}: ${dup.count} logs, coins=[${dup.coins_per_log.join(',')}], total=${dup.total_coins_if_counted_all}`);
      });
    }

    return Response.json({
      success: true,
      target_user: target_user_email,
      total_logs: userLogs.length,
      unique_transactions: byTx.size,
      potential_duplicates: userLogs.length - byTx.size,
      
      valid_transactions: validCount,
      valid_coins: validCoins,
      frozen_transactions: frozenCount,
      frozen_coins: frozenCoins,
      calculated_total: calculatedTotal,

      system_total_earned: systemTotal,
      discrepancy: discrepancy,
      has_discrepancy: Math.abs(discrepancy) > 0,
      
      duplicate_count: duplicateDetails.length,
      duplicate_sample: duplicateDetails.slice(0, 5)
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});