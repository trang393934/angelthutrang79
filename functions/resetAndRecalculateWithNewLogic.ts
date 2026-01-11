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

    const { user_email } = await req.json().catch(() => ({}));

    console.log('🚨 RESET WITH NEW LOGIC: Only first 10 questions/day + tasks');

    let allBalances = [];
    if (user_email) {
      const found = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      allBalances = found;
      console.log(`📊 Processing 1 user: ${user_email}`);
    } else {
      allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50);
      console.log(`📊 Processing ${allBalances.length} users`);
    }

    const results = [];

    for (const balance of allBalances) {
      const email = balance.user_email;
      const originalPaidAmount = balance.paid_amount || 0; // ⚠️ PRESERVE THIS - KHÔNG XÓA!

      try {
        console.log(`\n🔄 ${email} - Paid Amount hiện tại: ${originalPaidAmount}`);
        
        // STEP 1: Reset NHƯNG GIỮ NGUYÊN paid_amount
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: 0,
            available_balance: 0,
            admin_review_pending: 0,
            frozen_balance: 0,
            net_valid_coins: 0,
            available_for_withdrawal: 0,
            // ⚠️ KHÔNG RESET paid_amount - giữ nguyên giá trị cũ
          });
        });
        console.log(`  ✅ Reset (giữ paid_amount = ${originalPaidAmount})`);

        // STEP 2: Recalculate from source
        let netValidCoins = 0; // Điểm hợp lệ (10 câu đầu/ngày + tasks)
        let frozenBalance = 0; // Câu 11+ + spam

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
            if (i < 10 && log.exclusion_reason === 'valid') {
              // First 10 valid -> net_valid_coins
              netValidCoins += log.coins_earned || 0;
            } else {
              // Beyond 10 OR invalid -> frozen
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

        // Count bounty_reward, build_reward
        for (const tx of transactions) {
          if (tx.amount > 0 && (tx.type === 'bounty_reward' || tx.type === 'build_reward')) {
            netValidCoins += tx.amount;
          }
        }

        // CÔNG THỨC CHÍNH XÁC:
        // total_earned = net_valid_coins + frozen_balance (TỔNG TÍCH LŨY - KHÔNG BAO GIỜ GIẢM)
        // available_for_withdrawal = net_valid_coins - paid_amount
        const totalEarned = netValidCoins + frozenBalance;
        const availableForWithdrawal = Math.max(0, netValidCoins - originalPaidAmount);

        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            net_valid_coins: netValidCoins,
            frozen_balance: frozenBalance,
            total_earned: totalEarned,
            available_for_withdrawal: availableForWithdrawal,
            paid_amount: originalPaidAmount, // ⚠️ GIỮ NGUYÊN - KHÔNG RESET
            admin_review_pending: 0,
            available_balance: 0, // Deprecated field
          });
        });

        console.log(`  ✅ Net Valid: ${netValidCoins} | Frozen: ${frozenBalance} | Total: ${totalEarned} | Paid: ${originalPaidAmount} | Available: ${availableForWithdrawal}`);

        results.push({
          email,
          success: true,
          net_valid_coins: netValidCoins,
          frozen: frozenBalance,
          total_earned: totalEarned,
          paid: originalPaidAmount,
          available_for_withdrawal: availableForWithdrawal,
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