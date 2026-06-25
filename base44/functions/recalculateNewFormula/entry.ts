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

    const { user_email } = await req.json().catch(() => ({}));

    console.log('🔄 RECALCULATE WITH NEW FORMULA');
    console.log(`📧 Target: ${user_email || 'ALL USERS'}`);

    // Get all balances
    let balances = [];
    if (user_email) {
      const found = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      balances = found;
    } else {
      balances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    }

    console.log(`👥 Processing ${balances.length} users...`);

    const results = [];

    for (const balance of balances) {
      const email = balance.user_email;

      try {
        console.log(`\n🔍 ${email}`);

        let netValidCoins = 0;
        let frozenBalance = 0;
        let paidAmount = 0;

        // 1. Get audit logs and calculate valid/frozen coins
        const auditLogs = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: email },
            '-question_date',
            10000
          );
        });

        // Group by day
        const logsByDay = {};
        for (const log of auditLogs) {
          const day = new Date(log.question_date).toISOString().split('T')[0];
          if (!logsByDay[day]) logsByDay[day] = [];
          logsByDay[day].push(log);
        }

        // Process: first 10 per day are valid, rest are frozen
        for (const [day, logs] of Object.entries(logsByDay)) {
          const sorted = logs.sort((a, b) => new Date(a.question_date) - new Date(b.question_date));
          
          for (let i = 0; i < sorted.length; i++) {
            const log = sorted[i];
            const coins = log.coins_earned || 0;
            
            if (i < 10) {
              // First 10 questions count as valid
              netValidCoins += coins;
            } else {
              // Beyond 10 go to frozen
              frozenBalance += coins;
            }
          }
        }

        console.log(`  📋 Audit logs: ${auditLogs.length} questions`);
        console.log(`  ✅ Valid (first 10/day): ${netValidCoins}`);
        console.log(`  ❄️ Frozen (exceeds limit): ${frozenBalance}`);

        // 2. Get transactions (bounty/build rewards) and add to valid coins
        const transactions = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: email },
            '-created_date',
            10000
          );
        });

        let bonusFromTransactions = 0;
        for (const tx of transactions) {
          if (tx.amount > 0 && (tx.type === 'bounty_reward' || tx.type === 'build_reward')) {
            bonusFromTransactions += tx.amount;
            netValidCoins += tx.amount;
          }
        }

        if (bonusFromTransactions > 0) {
          console.log(`  🎁 Bonus from transactions: ${bonusFromTransactions}`);
        }

        // 3. Get completed withdrawals to calculate paid amount
        const withdrawals = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { user_email: email },
            '-created_date',
            10000
          );
        });

        for (const withdrawal of withdrawals) {
          if (withdrawal.status === 'completed' && withdrawal.amount) {
            paidAmount += withdrawal.amount;
          }
        }

        console.log(`  💰 Paid amount: ${paidAmount}`);

        // 4. Calculate totals
        const totalEarned = netValidCoins + frozenBalance;
        const availableForWithdrawal = Math.max(0, netValidCoins - paidAmount);

        console.log(`  📊 Total earned: ${totalEarned}`);
        console.log(`  💵 Available for withdrawal: ${availableForWithdrawal}`);

        // 5. Update balance
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: totalEarned,
            net_valid_coins: netValidCoins,
            frozen_balance: frozenBalance,
            paid_amount: paidAmount,
            available_for_withdrawal: availableForWithdrawal,
          });
        });

        console.log(`  ✅ Updated successfully!`);

        results.push({
          user_email: email,
          success: true,
          total_earned: totalEarned,
          net_valid_coins: netValidCoins,
          frozen_balance: frozenBalance,
          paid_amount: paidAmount,
          available_for_withdrawal: availableForWithdrawal,
        });

        await sleep(300);
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          user_email: email,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ Success: ${successCount}/${balances.length}`);

    return Response.json({
      success: true,
      summary: {
        total: balances.length,
        success: successCount,
        failed: balances.length - successCount,
      },
      results,
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});