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

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🚨 RESET WITH NEW LOGIC: Only first 10 questions/day + tasks');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50);
    console.log(`📊 Processing ${allBalances.length} users`);

    const results = [];

    for (const balance of allBalances) {
      const email = balance.user_email;
      const originalPaidAmount = balance.paid_amount || 0; // KEEP this

      try {
        console.log(`\n🔄 ${email} (keeping paid: ${originalPaidAmount})`);

        let totalEarned = 0;
        let frozenBalance = 0;

        // Get audit logs
        const auditLogs = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: email },
            '-created_date',
            2000
          );
        });

        // Group by day
        const logsByDay = {};
        for (const log of auditLogs) {
          const day = new Date(log.question_date).toISOString().split('T')[0];
          if (!logsByDay[day]) logsByDay[day] = [];
          logsByDay[day].push(log);
        }

        console.log(`  📅 ${Object.keys(logsByDay).length} days of questions`);

        // Process: only first 10 per day count, rest -> frozen
        for (const [day, logs] of Object.entries(logsByDay)) {
          const sortedLogs = logs.sort((a, b) => new Date(a.question_date) - new Date(b.question_date));
          
          for (let i = 0; i < sortedLogs.length; i++) {
            const log = sortedLogs[i];
            if (i < 10) {
              // First 10 -> count
              totalEarned += log.coins_earned || 0;
            } else {
              // Beyond 10 -> frozen
              frozenBalance += log.coins_earned || 0;
            }
          }
        }

        // Get transactions (for non-question rewards like bounties, builds)
        const transactions = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: email },
            '-created_date',
            1000
          );
        });

        // Count bounty_reward, build_reward (not manual or question-related)
        for (const tx of transactions) {
          if (tx.amount > 0 && (tx.type === 'bounty_reward' || tx.type === 'build_reward')) {
            totalEarned += tx.amount;
          }
        }

        // Update balance: only reset, keep paid_amount
        const newAvailableBalance = Math.max(0, totalEarned - frozenBalance - originalPaidAmount);

        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: totalEarned,
            available_balance: newAvailableBalance,
            admin_review_pending: 0,
            frozen_balance: frozenBalance,
            paid_amount: originalPaidAmount, // PRESERVE
          });
        });

        console.log(`  ✅ Earned: ${totalEarned} | Frozen: ${frozenBalance} | Paid: ${originalPaidAmount}`);

        results.push({
          email,
          success: true,
          earned: totalEarned,
          frozen: frozenBalance,
          available: newAvailableBalance,
          paid: originalPaidAmount,
        });

        await sleep(300);
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          email,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ Success: ${successCount}/${allBalances.length}`);

    return Response.json({
      success: true,
      summary: {
        total: allBalances.length,
        success: successCount,
        failed: allBalances.length - successCount,
      },
      results,
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});