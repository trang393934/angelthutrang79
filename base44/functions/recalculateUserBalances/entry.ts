import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Retry with exponential backoff
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

    // ADMIN ONLY
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Get payload
    const { user_email } = await req.json().catch(() => ({}));

    console.log('🔄 Starting balance recalculation...');
    console.log(`📧 Target: ${user_email || 'ALL USERS'}`);

    // Get list of users to process
    let usersToProcess = [];
    if (user_email) {
      // Single user - create balance if doesn't exist
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      if (balances.length > 0) {
        usersToProcess = [{ email: user_email, balance: balances[0] }];
      } else {
        // Create new balance record for this user
        const newBalance = await base44.asServiceRole.entities.CamlycoinBalance.create({
          user_email: user_email,
          total_earned: 0,
          available_balance: 0,
          admin_review_pending: 0,
          frozen_balance: 0,
          paid_amount: 0
        });
        usersToProcess = [{ email: user_email, balance: newBalance }];
        console.log(`✨ Created new balance record for ${user_email}`);
      }
    } else {
      // All users with balances
      const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
      usersToProcess = allBalances.map(b => ({ email: b.user_email, balance: b }));
    }

    console.log(`👥 Processing ${usersToProcess.length} users...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const userData of usersToProcess) {
      const userEmail = userData.email;
      const existingBalance = userData.balance;

      try {
        console.log(`\n🔍 Processing: ${userEmail}`);

        // Initialize new balances
        let newTotalEarned = 0;
        let newAdminReviewPending = 0;
        let newFrozenBalance = 0;
        let newPaidAmount = 0;

        // 1. Calculate total_earned from BOTH CamlycoinTransaction AND QuestionAuditLog
        const transactions = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: userEmail },
            '-created_date',
            10000
          );
        });

        // Sum ALL positive transactions (any amount > 0)
        for (const tx of transactions) {
          try {
            if (tx.amount && tx.amount > 0) {
              newTotalEarned += parseFloat(tx.amount);
            }
          } catch (txParseError) {
            console.log(`  ⚠️ Failed to parse transaction amount: ${txParseError.message}`);
          }
        }

        console.log(`  💰 Total Earned from Transactions: ${newTotalEarned}`);

        // Get audit logs FIRST (before calculating sub-balances)
        const auditLogs = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: userEmail },
            '-created_date',
            10000
          );
        });

        // 1.5. Add coins from ALL audit logs to total_earned (this is the real source of question rewards)
        let totalFromAuditLogs = 0;
        for (const log of auditLogs) {
          try {
            totalFromAuditLogs += parseFloat(log.coins_earned || 0);
          } catch (logParseError) {
            console.log(`  ⚠️ Failed to parse audit log: ${logParseError.message}`);
          }
        }

        newTotalEarned += totalFromAuditLogs;
        console.log(`  💰 Total from Audit Logs: ${totalFromAuditLogs}`);
        console.log(`  💰 Total Earned (Combined): ${newTotalEarned}`);

        // 2. Calculate pending and frozen from QuestionAuditLog (already fetched above)
        for (const log of auditLogs) {
          try {
            if (log.coin_category === 'pending_review') {
              newAdminReviewPending += parseFloat(log.coins_earned || 0);
            } else if (log.coin_category === 'frozen') {
              newFrozenBalance += parseFloat(log.coins_earned || 0);
            }
          } catch (logParseError) {
            console.log(`  ⚠️ Failed to parse audit log: ${logParseError.message}`);
          }
        }

        console.log(`  ⏳ Admin Review Pending: ${newAdminReviewPending}`);
        console.log(`  ❄️ Frozen Balance: ${newFrozenBalance}`);

        // 3. Calculate paid_amount from WithdrawalRequest
        const withdrawals = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { user_email: userEmail },
            '-created_date',
            1000
          );
        });

        for (const withdrawal of withdrawals) {
          try {
            if (withdrawal.status === 'completed' && withdrawal.amount) {
              newPaidAmount += parseFloat(withdrawal.amount);
            }
          } catch (withdrawalParseError) {
            console.log(`  ⚠️ Failed to parse withdrawal: ${withdrawalParseError.message}`);
          }
        }

        console.log(`  ✅ Paid Amount: ${newPaidAmount}`);

        // 4. Calculate available_balance
        const newAvailableBalance = Math.max(0, newTotalEarned - newAdminReviewPending - newFrozenBalance - newPaidAmount);

        console.log(`  💵 Available Balance: ${newAvailableBalance}`);

        // 5. Update CamlycoinBalance
        const oldValues = {
          total_earned: existingBalance.total_earned || 0,
          available_balance: existingBalance.available_balance || 0,
          admin_review_pending: existingBalance.admin_review_pending || 0,
          frozen_balance: existingBalance.frozen_balance || 0,
          paid_amount: existingBalance.paid_amount || 0,
        };

        await base44.asServiceRole.entities.CamlycoinBalance.update(existingBalance.id, {
          total_earned: newTotalEarned,
          available_balance: newAvailableBalance,
          admin_review_pending: newAdminReviewPending,
          frozen_balance: newFrozenBalance,
          paid_amount: newPaidAmount,
        });

        const changes = {
          total_earned: newTotalEarned - oldValues.total_earned,
          available_balance: newAvailableBalance - oldValues.available_balance,
          admin_review_pending: newAdminReviewPending - oldValues.admin_review_pending,
          frozen_balance: newFrozenBalance - oldValues.frozen_balance,
          paid_amount: newPaidAmount - oldValues.paid_amount,
        };

        console.log(`  ✅ Updated successfully!`);
        console.log(`  📊 Changes:`, changes);

        results.push({
          user_email: userEmail,
          success: true,
          old: oldValues,
          new: {
            total_earned: newTotalEarned,
            available_balance: newAvailableBalance,
            admin_review_pending: newAdminReviewPending,
            frozen_balance: newFrozenBalance,
            paid_amount: newPaidAmount,
          },
          changes: changes,
        });

        successCount++;

        // Add delay between users to avoid rate limiting
        await sleep(500);

      } catch (error) {
        console.error(`  ❌ Error processing ${userEmail}:`, error.message);
        console.error(`  📋 Error stack:`, error.stack);
        results.push({
          user_email: userEmail,
          success: false,
          error: error.message,
          error_type: error.name || 'Unknown',
          error_details: error.stack?.split('\n')[0] || error.toString(),
        });
        errorCount++;
      }
    }

    console.log(`\n🎉 RECALCULATION COMPLETE!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    return Response.json({
      success: true,
      summary: {
        total_users: usersToProcess.length,
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