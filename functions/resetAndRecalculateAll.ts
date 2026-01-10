import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message?.includes('Rate limit') && i < maxRetries - 1) {
        const delay = 3000 * Math.pow(2, i);
        console.log(`  ⏸️ Rate limit hit (attempt ${i + 1}/${maxRetries}), retry in ${delay}ms...`);
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

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    console.log('🚨 RESET & RECALCULATE ALL BALANCES');
    console.log('⚠️ This will RESET all balances to 0 then recalculate from scratch');

    // Step 1: Get all balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    console.log(`📊 Found ${allBalances.length} balance records`);

    // Step 2: Reset all to 0
    console.log('\n🔄 STEP 1: Resetting all balances to 0...');
    let resetCount = 0;
    for (const balance of allBalances) {
      try {
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: 0,
            available_balance: 0,
            admin_review_pending: 0,
            frozen_balance: 0,
            paid_amount: 0
          });
        });
        resetCount++;
        console.log(`  ✅ Reset ${resetCount}/${allBalances.length}: ${balance.user_email}`);
        await sleep(200); // Throttle
      } catch (error) {
        console.error(`  ❌ Failed to reset ${balance.user_email}:`, error.message);
      }
    }

    console.log(`\n✅ Reset complete: ${resetCount} balances reset to 0`);

    // Step 3: Recalculate from source data
    console.log('\n🔄 STEP 2: Recalculating from source data...');
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const balance of allBalances) {
      const userEmail = balance.user_email;
      
      try {
        console.log(`\n🔍 Recalculating: ${userEmail}`);

        let newTotalEarned = 0;
        let newAdminReviewPending = 0;
        let newFrozenBalance = 0;
        let newPaidAmount = 0;

        // 1. Get all positive transactions
        const transactions = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: userEmail },
            '-created_date',
            10000
          );
        });

        for (const tx of transactions) {
          if (tx.amount && tx.amount > 0) {
            newTotalEarned += parseFloat(tx.amount);
          }
        }

        console.log(`  💰 From Transactions: ${newTotalEarned}`);

        // 2. Get all audit logs
        const auditLogs = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: userEmail },
            '-created_date',
            10000
          );
        });

        let totalFromAuditLogs = 0;
        for (const log of auditLogs) {
          totalFromAuditLogs += parseFloat(log.coins_earned || 0);
          
          // Categorize
          if (log.coin_category === 'pending_review') {
            newAdminReviewPending += parseFloat(log.coins_earned || 0);
          } else if (log.coin_category === 'frozen') {
            newFrozenBalance += parseFloat(log.coins_earned || 0);
          }
        }

        newTotalEarned += totalFromAuditLogs;
        console.log(`  💰 From Audit Logs: ${totalFromAuditLogs}`);
        console.log(`  💰 Total Earned: ${newTotalEarned}`);

        // 3. Get completed withdrawals
        const withdrawals = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { user_email: userEmail },
            '-created_date',
            1000
          );
        });

        for (const withdrawal of withdrawals) {
          if (withdrawal.status === 'completed' && withdrawal.amount) {
            newPaidAmount += parseFloat(withdrawal.amount);
          }
        }

        console.log(`  ✅ Paid: ${newPaidAmount}`);
        console.log(`  ⏳ Pending Review: ${newAdminReviewPending}`);
        console.log(`  ❄️ Frozen: ${newFrozenBalance}`);

        // 4. Calculate available
        const newAvailableBalance = Math.max(0, newTotalEarned - newAdminReviewPending - newFrozenBalance - newPaidAmount);
        console.log(`  💵 Available: ${newAvailableBalance}`);

        // 5. Update
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: newTotalEarned,
            available_balance: newAvailableBalance,
            admin_review_pending: newAdminReviewPending,
            frozen_balance: newFrozenBalance,
            paid_amount: newPaidAmount,
          });
        });

        console.log(`  ✅ Updated!`);

        results.push({
          user_email: userEmail,
          success: true,
          recalculated: {
            total_earned: newTotalEarned,
            available_balance: newAvailableBalance,
            admin_review_pending: newAdminReviewPending,
            frozen_balance: newFrozenBalance,
            paid_amount: newPaidAmount,
          }
        });

        successCount++;
        await sleep(500);

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          user_email: userEmail,
          success: false,
          error: error.message,
        });
        errorCount++;
      }
    }

    console.log(`\n🎉 COMPLETE!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    return Response.json({
      success: true,
      message: 'Reset and recalculation complete',
      summary: {
        total_users: allBalances.length,
        reset_count: resetCount,
        success_count: successCount,
        error_count: errorCount,
      },
      results: results,
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});