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

    console.log(`🔍 Auditing cleaned logs for ${target_user_email}`);

    // Fetch all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`\n📊 TOTAL LOGS: ${allLogs.length}`);

    // Group by transaction_id to detect duplicates
    const groupedByTxId = {};
    allLogs.forEach(log => {
      const txId = log.transaction_id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(log);
    });

    console.log(`🔗 Unique transaction_ids: ${Object.keys(groupedByTxId).length}`);

    // Find any duplicates still existing
    let duplicateCount = 0;
    const duplicateDetails = [];

    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      if (logs.length > 1) {
        duplicateCount += (logs.length - 1);
        duplicateDetails.push({
          transaction_id: txId,
          count: logs.length,
          logs: logs.map(l => ({
            id: l.id,
            question: l.question_text.substring(0, 50),
            status: l.exclusion_reason,
            coins: l.coins_earned
          }))
        });
      }
    }

    console.log(`\n⚠️ DUPLICATE LOGS REMAINING: ${duplicateCount}`);
    if (duplicateDetails.length > 0) {
      duplicateDetails.slice(0, 5).forEach(dup => {
        console.log(`  📌 TX ${dup.transaction_id}: ${dup.count} logs`);
      });
    }

    // Calculate totals
    let totalEarned = 0;
    let validCount = 0;
    let validCoins = 0;
    let frozenCount = 0;
    let frozenCoins = 0;

    // Count per unique transaction to avoid double counting
    for (const [txId, logs] of Object.entries(groupedByTxId)) {
      // Use the first (or best) log for this transaction
      const log = logs[0];
      const coins = log.coins_earned || 0;
      
      totalEarned += coins;
      
      if (log.exclusion_reason === 'valid') {
        validCount += 1;
        validCoins += coins;
      } else {
        frozenCount += 1;
        frozenCoins += coins;
      }
    }

    console.log(`\n💰 ACTUAL TOTALS (based on unique transactions):`);
    console.log(`  Total Unique Questions: ${Object.keys(groupedByTxId).length}`);
    console.log(`  ✅ Valid: ${validCount} questions = ${validCoins.toLocaleString()} coins`);
    console.log(`  ❌ Frozen: ${frozenCount} questions = ${frozenCoins.toLocaleString()} coins`);
    console.log(`  📊 Total Earned: ${totalEarned.toLocaleString()} coins`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      audit_results: {
        total_logs_in_db: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        duplicate_logs: duplicateCount,
        has_duplicates: duplicateCount > 0,
        duplicate_details: duplicateDetails.slice(0, 10)
      },
      actual_totals: {
        total_earned: totalEarned,
        net_valid_coins: validCoins,
        frozen_balance: frozenCoins,
        valid_questions_count: validCount,
        frozen_questions_count: frozenCount
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});