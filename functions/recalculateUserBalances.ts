import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // 1. Calculate total_earned from CamlycoinTransaction
        let transactions = [];
        try {
          transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: userEmail },
            '-created_date',
            10000
          );
        } catch (txError) {
          console.log(`  ⚠️ Failed to fetch transactions: ${txError.message}`);
          transactions = [];
        }

        // Sum all positive transactions (income types)
        const incomeTypes = ['bounty_reward', 'build_reward', 'admin_adjustment', 'manual_add', 'purchase'];
        for (const tx of transactions) {
          try {
            if (tx.amount && tx.amount > 0 && incomeTypes.includes(tx.type)) {
              newTotalEarned += parseFloat(tx.amount);
            }
          } catch (txParseError) {
            console.log(`  ⚠️ Failed to parse transaction amount: ${txParseError.message}`);
          }
        }

        console.log(`  💰 Total Earned from Transactions: ${newTotalEarned}`);

        // 2. Calculate pending and frozen from QuestionAuditLog
        let auditLogs = [];
        try {
          auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: userEmail },
            '-created_date',
            10000
          );
        } catch (auditError) {
          console.log(`  ⚠️ Failed to fetch audit logs: ${auditError.message}`);
          auditLogs = [];
        }

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
        let withdrawals = [];
        try {
          withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { user_email: userEmail },
            '-created_date',
            1000
          );
        } catch (withdrawalError) {
          console.log(`  ⚠️ Failed to fetch withdrawals: ${withdrawalError.message}`);
          withdrawals = [];
        }

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

      } catch (error) {
        console.error(`  ❌ Error processing ${userEmail}:`, error.message);
        results.push({
          user_email: userEmail,
          success: false,
          error: error.message,
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