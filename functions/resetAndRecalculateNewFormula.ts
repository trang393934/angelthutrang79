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

    console.log('🔄 RESET & RECALCULATE WITH NEW FORMULA');
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

        // STEP 1: Initialize all to 0
        console.log('  📋 Resetting to 0...');

        let netValidCoins = 0;
        let frozenBalance = 0;
        let paidAmount = 0;

        // STEP 2: Get audit logs and split by day - first 10 valid, rest frozen
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

        // Process: first 10 per day valid, rest frozen
        for (const [day, logs] of Object.entries(logsByDay)) {
          const sorted = logs.sort((a, b) => new Date(a.question_date) - new Date(b.question_date));
          
          for (let i = 0; i < sorted.length; i++) {
            const log = sorted[i];
            const coins = log.coins_earned || 0;
            
            if (i < 10) {
              netValidCoins += coins;
            } else {
              frozenBalance += coins;
            }
          }
        }

        console.log(`  📋 ${auditLogs.length} questions: ${netValidCoins} valid, ${frozenBalance} frozen`);

        // STEP 3: Get transactions (bounty/build) and add to valid coins
        const transactions = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: email },
            '-created_date',
            10000
          );
        });

        for (const tx of transactions) {
          if (tx.amount > 0 && (tx.type === 'bounty_reward' || tx.type === 'build_reward')) {
            netValidCoins += tx.amount;
          }
        }

        // STEP 4: Get completed withdrawals
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

        // STEP 5: Calculate derived fields
        const totalEarned = netValidCoins + frozenBalance;
        const availableForWithdrawal = Math.max(0, netValidCoins - paidAmount);

        console.log(`  💰 net_valid: ${netValidCoins}`);
        console.log(`  ❄️  frozen: ${frozenBalance}`);
        console.log(`  📊 total: ${totalEarned}`);
        console.log(`  💵 paid: ${paidAmount}`);
        console.log(`  🎯 available: ${availableForWithdrawal}`);

        // STEP 6: Update balance
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: totalEarned,
            net_valid_coins: netValidCoins,
            frozen_balance: frozenBalance,
            paid_amount: paidAmount,
            available_for_withdrawal: availableForWithdrawal,
          });
        });

        console.log(`  ✅ Updated!`);

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
        console.error(`  ❌ ${error.message}`);
        results.push({
          user_email: email,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✅ Complete: ${successCount}/${balances.length}`);

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