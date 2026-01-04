import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Starting comprehensive balance validation...');

    // Get all balances and transactions
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 100000);
    const allAuditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 100000);

    const report = {
      total_users: allBalances.length,
      inconsistent_users: [],
      fixed_users: [],
      errors: []
    };

    for (const balance of allBalances) {
      try {
        const userEmail = balance.user_email;
        
        // Get user's audit logs
        const userLogs = allAuditLogs.filter(log => log.user_email === userEmail);
        
        // CRITICAL: Total earned = TẤT CẢ coins từ audit logs
        const calculatedTotalEarned = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        // Phân loại coins theo category
        const frozenAmount = userLogs
          .filter(log => log.coin_category === 'frozen')
          .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        const pendingReviewAmount = userLogs
          .filter(log => log.coin_category === 'pending_review')
          .reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Get user's transactions để tính spent
        const userTxs = allTransactions.filter(tx => tx.user_email === userEmail);
        
        const calculatedTotalSpent = Math.abs(userTxs
          .filter(tx => tx.amount < 0)
          .reduce((sum, tx) => sum + tx.amount, 0));

        // Current balance từ database
        const currentData = {
          total_earned: balance.total_earned || 0,
          total_spent: balance.total_spent || 0,
          frozen_balance: balance.frozen_balance || 0,
          pending_review_balance: balance.pending_review_balance || 0,
          paid_amount: balance.paid_amount || 0,
          available_balance: balance.available_balance || 0,
          unpaid_amount: balance.unpaid_amount || 0,
          balance: balance.balance || 0
        };

        // Expected values
        const expectedData = {
          total_earned: calculatedTotalEarned,
          total_spent: calculatedTotalSpent,
          frozen_balance: frozenAmount,
          pending_review_balance: pendingReviewAmount,
          // paid_amount giữ nguyên vì được track riêng
          paid_amount: currentData.paid_amount,
          // unpaid_amount = total_earned - paid_amount - frozen - pending_review - available
          // available_balance giữ nguyên (admin đã approve)
          available_balance: currentData.available_balance,
          // balance = total_earned - paid_amount (tổng còn lại trong hệ thống)
          balance: calculatedTotalEarned - currentData.paid_amount,
          // unpaid = balance - available - frozen - pending_review
          unpaid_amount: Math.max(0, 
            (calculatedTotalEarned - currentData.paid_amount) 
            - currentData.available_balance 
            - frozenAmount 
            - pendingReviewAmount
          )
        };

        // Check for inconsistencies
        const issues = [];
        let needsFix = false;

        if (Math.abs(currentData.total_earned - expectedData.total_earned) > 1) {
          issues.push(`total_earned: ${currentData.total_earned} → ${expectedData.total_earned}`);
          needsFix = true;
        }

        if (Math.abs(currentData.frozen_balance - expectedData.frozen_balance) > 1) {
          issues.push(`frozen_balance: ${currentData.frozen_balance} → ${expectedData.frozen_balance}`);
          needsFix = true;
        }

        if (Math.abs(currentData.pending_review_balance - expectedData.pending_review_balance) > 1) {
          issues.push(`pending_review: ${currentData.pending_review_balance} → ${expectedData.pending_review_balance}`);
          needsFix = true;
        }

        if (Math.abs(currentData.unpaid_amount - expectedData.unpaid_amount) > 1) {
          issues.push(`unpaid_amount: ${currentData.unpaid_amount} → ${expectedData.unpaid_amount}`);
          needsFix = true;
        }

        if (Math.abs(currentData.balance - expectedData.balance) > 1) {
          issues.push(`balance: ${currentData.balance} → ${expectedData.balance}`);
          needsFix = true;
        }

        // CRITICAL CHECK: unpaid_amount KHÔNG BAO GIỜ được > total_earned
        if (currentData.unpaid_amount > calculatedTotalEarned) {
          issues.push(`⚠️ CRITICAL: unpaid (${currentData.unpaid_amount}) > total_earned (${calculatedTotalEarned})`);
          needsFix = true;
        }

        if (needsFix) {
          report.inconsistent_users.push({
            email: userEmail,
            current: currentData,
            expected: expectedData,
            issues: issues,
            transaction_count: userTxs.length,
            audit_log_count: userLogs.length
          });

          // AUTO-FIX
          console.log(`🔧 Fixing ${userEmail}...`);
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, expectedData);
          
          // Create transaction log
          await base44.asServiceRole.entities.CamlycoinTransaction.create({
            user_email: userEmail,
            amount: 0,
            type: 'admin_adjustment',
            description: `🔧 System Auto-Fix Balance\n${issues.join('\n')}`,
            processed_by: 'system_validation'
          });

          report.fixed_users.push(userEmail);
        }

      } catch (error) {
        report.errors.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    console.log(`✅ Validation completed: ${report.inconsistent_users.length} users fixed`);

    return Response.json({
      success: true,
      report: report,
      summary: {
        total_users: report.total_users,
        inconsistent_count: report.inconsistent_users.length,
        fixed_count: report.fixed_users.length,
        error_count: report.errors.length
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});