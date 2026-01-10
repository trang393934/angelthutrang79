import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message?.includes('Rate limit') && i < maxRetries - 1) {
        await sleep(3000 * Math.pow(2, i));
      } else {
        throw error;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔍 AUDIT FROZEN QUESTIONS FOR DUPLICATES');

    // Get all audit logs
    const allLogs = await retryWithBackoff(async () => {
      return await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    });

    console.log(`📋 Total logs: ${allLogs.length}`);

    // Find frozen questions
    const frozenLogs = allLogs.filter(log => log.coin_category === 'frozen');
    console.log(`❄️  Total frozen: ${frozenLogs.length}`);

    // Check for duplicates by user + question_text + question_date
    const duplicateMap = {};
    const duplicates = [];

    for (const log of frozenLogs) {
      const key = `${log.user_email}||${log.question_text}||${log.question_date}`;
      
      if (duplicateMap[key]) {
        duplicateMap[key].push(log);
        duplicates.push({
          user_email: log.user_email,
          question_text: log.question_text,
          question_date: log.question_date,
          count: duplicateMap[key].length,
          ids: duplicateMap[key].map(l => l.id),
          coins_per_entry: duplicateMap[key].map(l => l.coins_earned),
          total_coins_duplicated: duplicateMap[key].reduce((sum, l) => sum + (l.coins_earned || 0), 0)
        });
      } else {
        duplicateMap[key] = [log];
      }
    }

    console.log(`\n🔄 Found ${duplicates.length} duplicate sets`);

    // For each user, check if frozen_balance matches actual frozen coins
    const userEmails = [...new Set(allLogs.map(log => log.user_email))];
    const userAudit = [];

    for (const email of userEmails) {
      const userFrozenLogs = frozenLogs.filter(log => log.user_email === email);
      const actualFrozenCoins = userFrozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      const balances = await retryWithBackoff(async () => {
        return await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: email });
      });

      if (balances.length > 0) {
        const balance = balances[0];
        const recordedFrozen = balance.frozen_balance || 0;
        
        const match = actualFrozenCoins === recordedFrozen;
        
        if (!match) {
          console.log(`\n⚠️  ${email}`);
          console.log(`   Expected frozen: ${actualFrozenCoins}`);
          console.log(`   Recorded frozen: ${recordedFrozen}`);
          console.log(`   Difference: ${recordedFrozen - actualFrozenCoins}`);
          
          userAudit.push({
            user_email: email,
            expected_frozen: actualFrozenCoins,
            recorded_frozen: recordedFrozen,
            difference: recordedFrozen - actualFrozenCoins,
            frozen_log_count: userFrozenLogs.length,
            has_discrepancy: true
          });
        }
      }

      await sleep(100);
    }

    console.log(`\n✅ Audit complete`);
    console.log(`📊 Users with discrepancies: ${userAudit.filter(a => a.has_discrepancy).length}`);

    return Response.json({
      success: true,
      summary: {
        total_frozen_logs: frozenLogs.length,
        duplicate_sets: duplicates.length,
        users_with_discrepancy: userAudit.filter(a => a.has_discrepancy).length,
        total_users_checked: userEmails.length,
      },
      details: {
        duplicates: duplicates.slice(0, 100), // Top 100 duplicates
        user_frozen_discrepancies: userAudit.filter(a => a.has_discrepancy).slice(0, 50), // Top 50 users
      }
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});