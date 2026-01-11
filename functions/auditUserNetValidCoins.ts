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

    console.log(`🔍 Audit net_valid_coins cho: ${target_user_email}`);

    // Fetch ALL logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    // Phân tích
    const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
    const invalidLogs = allLogs.filter(log => log.exclusion_reason !== 'valid');
    
    const totalValidCoins = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    const totalInvalidCoins = invalidLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    // Group by transaction_id để detect duplicates
    const byTx = new Map();
    allLogs.forEach(log => {
      const txId = log.transaction_id || log.id;
      if (!byTx.has(txId)) byTx.set(txId, []);
      byTx.get(txId).push(log);
    });

    let duplicateGroups = 0;
    let totalDuplicates = 0;
    byTx.forEach((logs) => {
      if (logs.length > 1) {
        duplicateGroups++;
        totalDuplicates += logs.length - 1;
      }
    });

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    const balance = balances[0];
    const currentNetValid = balance?.net_valid_coins || 0;
    const correctNetValid = totalValidCoins;
    const discrepancy = currentNetValid - correctNetValid;

    console.log(`\n📊 TỔNG LOGS: ${allLogs.length}`);
    console.log(`✅ Valid logs: ${validLogs.length} = ${totalValidCoins.toLocaleString()} coins`);
    console.log(`❌ Invalid logs: ${invalidLogs.length} = ${totalInvalidCoins.toLocaleString()} coins`);
    console.log(`\n🔄 Duplicate groups: ${duplicateGroups}`);
    console.log(`🔀 Total duplicates: ${totalDuplicates}`);
    console.log(`\n💰 Current net_valid_coins: ${currentNetValid.toLocaleString()}`);
    console.log(`💰 Correct net_valid_coins: ${correctNetValid.toLocaleString()}`);
    console.log(`📊 Discrepancy: ${discrepancy.toLocaleString()} (${discrepancy > 0 ? 'THỪA' : 'THIẾU'})`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_logs: allLogs.length,
      valid_logs: validLogs.length,
      invalid_logs: invalidLogs.length,
      total_valid_coins: totalValidCoins,
      total_invalid_coins: totalInvalidCoins,
      duplicate_groups: duplicateGroups,
      total_duplicates: totalDuplicates,
      current_net_valid: currentNetValid,
      correct_net_valid: correctNetValid,
      discrepancy: discrepancy,
      needs_fix: discrepancy !== 0,
      fix_description: discrepancy > 0 
        ? `THỪA ${discrepancy.toLocaleString()} coins (cộng trùng lặp)`
        : `THIẾU ${Math.abs(discrepancy).toLocaleString()} coins`
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});