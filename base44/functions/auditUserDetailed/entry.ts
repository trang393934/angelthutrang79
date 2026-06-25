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

    console.log(`\n📊 KIỂM TRA CHI TIẾT: ${target_user_email}`);

    // Fetch all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`\n📋 TỔNG SỐ LOG: ${allLogs.length}`);

    // Group by transaction_id to find duplicates
    const groupedByTxId = {};
    allLogs.forEach(log => {
      const txId = log.transaction_id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(log);
    });

    console.log(`\n🔗 UNIQUE TRANSACTIONS: ${Object.keys(groupedByTxId).length}`);

    // Find duplicates
    let totalDuplicates = 0;
    const duplicateGroups = [];

    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        totalDuplicates += logs.length - 1;
        duplicateGroups.push({
          tx_id: txId,
          count: logs.length,
          logs: logs.map(l => ({
            id: l.id,
            question: l.question_text?.substring(0, 50),
            coins: l.coins_earned,
            status: l.exclusion_reason,
            category: l.coin_category
          }))
        });
      }
    }

    console.log(`\n❌ DUPLICATE ENTRIES: ${totalDuplicates}`);
    console.log(`📊 Groups: ${duplicateGroups.length}`);

    // Categorize logs
    const validLogs = allLogs.filter(l => l.exclusion_reason === 'valid');
    const frozenLogs = allLogs.filter(l => l.coin_category === 'frozen' && l.exclusion_reason !== 'valid');
    const reviewLogs = allLogs.filter(l => l.coin_category === 'pending_review' && l.exclusion_reason !== 'valid');
    const otherLogs = allLogs.filter(l => 
      l.exclusion_reason !== 'valid' && 
      l.coin_category !== 'frozen' && 
      l.coin_category !== 'pending_review'
    );

    const validCoins = validLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const frozenCoins = frozenLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const reviewCoins = reviewLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const otherCoins = otherLogs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);

    console.log(`\n✅ Valid: ${validLogs.length} câu = ${validCoins.toLocaleString()} coins`);
    console.log(`❌ Frozen: ${frozenLogs.length} câu = ${frozenCoins.toLocaleString()} coins`);
    console.log(`⏳ Review: ${reviewLogs.length} câu = ${reviewCoins.toLocaleString()} coins`);
    console.log(`🔸 Other: ${otherLogs.length} câu = ${otherCoins.toLocaleString()} coins`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    const balance = balances[0];
    if (balance) {
      console.log(`\n💰 BALANCE:`);
      console.log(`  Total Earned: ${(balance.total_earned || 0).toLocaleString()}`);
      console.log(`  Net Valid: ${(balance.net_valid_coins || 0).toLocaleString()}`);
      console.log(`  Frozen: ${(balance.frozen_balance || 0).toLocaleString()}`);
      console.log(`  Paid: ${(balance.paid_amount || 0).toLocaleString()}`);
      console.log(`  Available: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);
    }

    return Response.json({
      success: true,
      user_email: target_user_email,
      summary: {
        total_logs: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        total_duplicates: totalDuplicates,
        duplicate_groups: duplicateGroups.length
      },
      by_status: {
        valid: { count: validLogs.length, coins: validCoins },
        frozen: { count: frozenLogs.length, coins: frozenCoins },
        review: { count: reviewLogs.length, coins: reviewCoins },
        other: { count: otherLogs.length, coins: otherCoins }
      },
      balance: balance ? {
        total_earned: balance.total_earned,
        net_valid_coins: balance.net_valid_coins,
        frozen_balance: balance.frozen_balance,
        paid_amount: balance.paid_amount,
        available_for_withdrawal: balance.available_for_withdrawal
      } : null,
      duplicate_samples: duplicateGroups.slice(0, 5)
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});