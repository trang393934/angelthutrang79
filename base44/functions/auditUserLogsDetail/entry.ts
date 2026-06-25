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

    console.log(`🔍 Auditing logs for ${target_user_email}`);

    // Fetch all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`\n📊 TOTAL LOGS: ${allLogs.length}`);

    // Group by transaction_id
    const groupedByTxId = {};
    allLogs.forEach(log => {
      const txId = log.transaction_id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(log);
    });

    console.log(`🔗 UNIQUE TRANSACTIONS: ${Object.keys(groupedByTxId).length}`);

    // Check for duplicates
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

    console.log(`\n⚠️ DUPLICATE LOGS: ${duplicateCount}`);
    if (duplicateDetails.length > 0) {
      console.log(`  Found ${duplicateDetails.length} transactions with duplicates`);
      duplicateDetails.slice(0, 3).forEach(dup => {
        console.log(`  📌 TX ${dup.transaction_id.substring(0, 8)}: ${dup.count} logs`);
      });
    }

    // Count by status
    let valid_count = 0;
    let valid_coins = 0;
    let duplicate_count = 0;
    let duplicate_coins = 0;
    let greeting_count = 0;
    let greeting_coins = 0;
    let low_quality_count = 0;
    let low_quality_coins = 0;
    let exceeds_count = 0;
    let exceeds_coins = 0;

    allLogs.forEach(log => {
      const coins = log.coins_earned || 0;
      
      if (log.exclusion_reason === 'valid') {
        valid_count++;
        valid_coins += coins;
      } else if (log.exclusion_reason === 'duplicate') {
        duplicate_count++;
        duplicate_coins += coins;
      } else if (log.exclusion_reason === 'greeting') {
        greeting_count++;
        greeting_coins += coins;
      } else if (log.exclusion_reason === 'low_quality') {
        low_quality_count++;
        low_quality_coins += coins;
      } else if (log.exclusion_reason === 'exceeds_daily_limit') {
        exceeds_count++;
        exceeds_coins += coins;
      }
    });

    const total_coins = valid_coins + duplicate_coins + greeting_coins + low_quality_coins + exceeds_coins;

    console.log(`\n📈 BREAKDOWN BY STATUS:`);
    console.log(`  ✅ Valid: ${valid_count} = ${valid_coins.toLocaleString()} coins`);
    console.log(`  ❌ Duplicate: ${duplicate_count} = ${duplicate_coins.toLocaleString()} coins`);
    console.log(`  👋 Greeting: ${greeting_count} = ${greeting_coins.toLocaleString()} coins`);
    console.log(`  💎 Low Quality: ${low_quality_count} = ${low_quality_coins.toLocaleString()} coins`);
    console.log(`  ⚡ Exceeds Daily: ${exceeds_count} = ${exceeds_coins.toLocaleString()} coins`);
    console.log(`  ---`);
    console.log(`  📊 TOTAL: ${allLogs.length} = ${total_coins.toLocaleString()} coins`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      summary: {
        total_logs: allLogs.length,
        unique_transactions: Object.keys(groupedByTxId).length,
        duplicate_logs: duplicateCount,
        has_duplicates: duplicateCount > 0,
        total_coins
      },
      breakdown: {
        valid: { count: valid_count, coins: valid_coins },
        duplicate: { count: duplicate_count, coins: duplicate_coins },
        greeting: { count: greeting_count, coins: greeting_coins },
        low_quality: { count: low_quality_count, coins: low_quality_coins },
        exceeds_daily: { count: exceeds_count, coins: exceeds_coins }
      },
      duplicate_details: duplicateDetails.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});