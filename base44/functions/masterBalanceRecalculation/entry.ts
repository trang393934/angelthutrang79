import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * MASTER BALANCE RECALCULATION - FINAL VERSION
 * 
 * Chuẩn hóa toàn bộ công thức tính toán với INTEGER arithmetic
 * Đây là công thức MASTER - tất cả các function khác phải tuân theo
 */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message?.includes('Rate limit') && i < maxRetries - 1) {
        const delay = 2000 * Math.pow(2, i); // 2s, 4s, 8s, 16s, 32s
        console.log(`⏳ Rate limit hit, waiting ${delay}ms...`);
        await sleep(delay);
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

    console.log('\n' + '='.repeat(80));
    console.log('🔧 MASTER BALANCE RECALCULATION');
    console.log('Using INTEGER arithmetic for all calculations');
    console.log('='.repeat(80) + '\n');

    const { user_email } = await req.json().catch(() => ({}));

    // Fetch all users to process
    let usersToProcess = [];
    if (user_email) {
      const balances = await retryWithBackoff(() => 
        base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email })
      );
      usersToProcess = balances;
      console.log(`📊 Processing 1 user: ${user_email}`);
    } else {
      usersToProcess = await retryWithBackoff(() => 
        base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000)
      );
      console.log(`📊 Processing ${usersToProcess.length} users`);
    }

    const results = {
      processed: 0,
      updated: 0,
      errors: 0,
      details: []
    };

    for (const balance of usersToProcess) {
      try {
        const email = balance.user_email;
        
        // Fetch user's data with retry
        const [userLogs, userTxs, userWithdrawals] = await Promise.all([
          retryWithBackoff(() => base44.asServiceRole.entities.QuestionAuditLog.filter({ user_email: email }, '-created_date', 10000)),
          retryWithBackoff(() => base44.asServiceRole.entities.CamlycoinTransaction.filter({ user_email: email }, '-created_date', 10000)),
          retryWithBackoff(() => base44.asServiceRole.entities.WithdrawalRequest.filter({ user_email: email }, '-created_date', 1000))
        ]);

        // ═══════════════════════════════════════════════════════════════
        // CÔNG THỨC CHUẨN - SỬ DỤNG INTEGER ARITHMETIC
        // ═══════════════════════════════════════════════════════════════

        // 1. FROZEN BALANCE (INTEGER)
        // = SUM(logs WHERE exclusion_reason != 'valid' AND coin_category = 'frozen')
        const correctFrozen = userLogs
          .filter(log => log.exclusion_reason !== 'valid' && log.coin_category === 'frozen')
          .reduce((sum, log) => sum + Math.floor(log.coins_earned || 0), 0);

        // 2. NET VALID COINS (INTEGER)
        // = Valid questions (first 10/day) + Rewards - Deductions
        
        // 2a. Valid questions - only first 10 per day
        const logsByDay = {};
        userLogs.forEach(log => {
          const day = new Date(log.question_date).toISOString().split('T')[0];
          if (!logsByDay[day]) logsByDay[day] = [];
          logsByDay[day].push(log);
        });

        let validQuestionCoins = 0;
        Object.values(logsByDay).forEach(dayLogs => {
          const validLogs = dayLogs
            .filter(log => log.exclusion_reason === 'valid')
            .sort((a, b) => new Date(a.question_date) - new Date(b.question_date));
          
          // Only count first 10 valid questions per day
          const first10 = validLogs.slice(0, 10);
          validQuestionCoins += first10.reduce((sum, log) => sum + Math.floor(log.coins_earned || 0), 0);
        });

        // 2b. Rewards from transactions
        const rewardCoins = userTxs
          .filter(tx => ['bounty_reward', 'build_reward', 'manual_add', 'admin_adjustment'].includes(tx.type))
          .reduce((sum, tx) => sum + Math.floor(tx.amount || 0), 0);

        // 2c. Deductions
        const deductionCoins = userTxs
          .filter(tx => tx.type === 'manual_deduct')
          .reduce((sum, tx) => sum + Math.floor(Math.abs(tx.amount || 0)), 0);

        const correctNetValid = validQuestionCoins + rewardCoins - deductionCoins;

        // 3. TOTAL EARNED (INTEGER)
        // = net_valid_coins + frozen_balance
        const correctTotalEarned = correctNetValid + correctFrozen;

        // 4. PAID AMOUNT (INTEGER)
        // = SUM(withdrawals WHERE status = 'completed')
        const correctPaidAmount = userWithdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + Math.floor(w.amount || 0), 0);

        // 5. AVAILABLE FOR WITHDRAWAL (INTEGER)
        // = MAX(0, net_valid_coins - paid_amount)
        const correctAvailable = Math.max(0, correctNetValid - correctPaidAmount);

        // ═══════════════════════════════════════════════════════════════

        // Check if update needed
        const currentValues = {
          frozen_balance: Math.floor(balance.frozen_balance || 0),
          net_valid_coins: Math.floor(balance.net_valid_coins || 0),
          total_earned: Math.floor(balance.total_earned || 0),
          paid_amount: Math.floor(balance.paid_amount || 0),
          available_for_withdrawal: Math.floor(balance.available_for_withdrawal || 0)
        };

        const needsUpdate = 
          correctFrozen !== currentValues.frozen_balance ||
          correctNetValid !== currentValues.net_valid_coins ||
          correctTotalEarned !== currentValues.total_earned ||
          correctPaidAmount !== currentValues.paid_amount ||
          correctAvailable !== currentValues.available_for_withdrawal;

        if (needsUpdate) {
          await retryWithBackoff(() => 
            base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
              frozen_balance: correctFrozen,
              net_valid_coins: correctNetValid,
              total_earned: correctTotalEarned,
              paid_amount: correctPaidAmount,
              available_for_withdrawal: correctAvailable
            })
          );

          results.updated++;
          results.details.push({
            user_email: email,
            old: currentValues,
            new: {
              frozen_balance: correctFrozen,
              net_valid_coins: correctNetValid,
              total_earned: correctTotalEarned,
              paid_amount: correctPaidAmount,
              available_for_withdrawal: correctAvailable
            },
            changes: {
              frozen_balance: correctFrozen - currentValues.frozen_balance,
              net_valid_coins: correctNetValid - currentValues.net_valid_coins,
              total_earned: correctTotalEarned - currentValues.total_earned,
              paid_amount: correctPaidAmount - currentValues.paid_amount,
              available_for_withdrawal: correctAvailable - currentValues.available_for_withdrawal
            }
          });

          console.log(`✅ Updated ${email}: NetValid=${correctNetValid}, Frozen=${correctFrozen}, Total=${correctTotalEarned}, Paid=${correctPaidAmount}, Available=${correctAvailable}`);
        }

        results.processed++;
        
        // Longer delay to avoid rate limits
        if (results.processed % 10 === 0) {
          await sleep(3000);
          console.log(`📊 Progress: ${results.processed}/${usersToProcess.length}`);
        } else {
          await sleep(500);
        }

      } catch (error) {
        results.errors++;
        console.error(`❌ Error for ${balance.user_email}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ MASTER RECALCULATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Processed: ${results.processed}/${usersToProcess.length}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Errors: ${results.errors}`);

    return Response.json({
      success: true,
      summary: {
        total: usersToProcess.length,
        processed: results.processed,
        updated: results.updated,
        errors: results.errors
      },
      formula: {
        type: 'INTEGER arithmetic only - no float precision errors',
        rules: [
          '1. frozen_balance = SUM(QuestionAuditLog WHERE exclusion_reason != "valid" AND coin_category = "frozen") using Math.floor()',
          '2. net_valid_coins = Valid Questions (first 10/day) + Rewards - Deductions using Math.floor()',
          '3. total_earned = net_valid_coins + frozen_balance',
          '4. paid_amount = SUM(WithdrawalRequest WHERE status = "completed") using Math.floor()',
          '5. available_for_withdrawal = MAX(0, net_valid_coins - paid_amount)',
          '6. Daily limit: Only first 10 valid questions per day count toward net_valid_coins',
          '7. Questions 11+ are automatically categorized as frozen (exceeds_daily_limit)'
        ]
      },
      sample_updates: results.details.slice(0, 20)
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});