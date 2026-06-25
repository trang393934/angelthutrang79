import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔧 Starting fix all balances from audit logs...');

    // Lấy tất cả audit logs
    const allAuditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-question_date', 100000);
    console.log(`📊 Found ${allAuditLogs.length} audit logs`);

    // Nhóm theo user
    const userAudits = {};
    allAuditLogs.forEach(log => {
      if (!userAudits[log.user_email]) {
        userAudits[log.user_email] = {
          frozen: 0,
          pending_review: 0,
          valid: 0
        };
      }

      // Tính frozen: duplicate, greeting, low_quality
      if (log.exclusion_reason === 'duplicate' || 
          log.exclusion_reason === 'greeting' || 
          log.exclusion_reason === 'low_quality') {
        userAudits[log.user_email].frozen += log.coins_earned;
      }
      // Tính pending review: exceeds_daily_limit HOẶC câu > 10
      else if (log.exclusion_reason === 'exceeds_daily_limit' || log.question_number_in_day > 10) {
        userAudits[log.user_email].pending_review += log.coins_earned;
      }
      // Valid: câu <= 10 và valid
      else if (log.exclusion_reason === 'valid' && log.question_number_in_day <= 10) {
        userAudits[log.user_email].valid += log.coins_earned;
      }
    });

    console.log(`👥 Processing ${Object.keys(userAudits).length} users`);

    // Lấy tất cả balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);

    const fixedUsers = [];
    const errors = [];

    for (const balance of allBalances) {
      try {
        const userEmail = balance.user_email;
        const audit = userAudits[userEmail];

        if (!audit) {
          console.log(`⚠️ No audit logs for ${userEmail}, skipping`);
          continue;
        }

        const currentFrozen = balance.frozen_balance || 0;
        const currentPendingReview = balance.pending_review_balance || 0;

        const calculatedFrozen = audit.frozen;
        const calculatedPendingReview = audit.pending_review;

        // Chỉ fix nếu có sai lệch
        if (currentFrozen !== calculatedFrozen || currentPendingReview !== calculatedPendingReview) {
          console.log(`🔧 Fixing ${userEmail}:`);
          console.log(`   Frozen: ${currentFrozen} → ${calculatedFrozen}`);
          console.log(`   Pending Review: ${currentPendingReview} → ${calculatedPendingReview}`);

          // Recalculate total_earned
          const newTotalEarned = 
            (balance.available_balance || 0) +
            (balance.unpaid_amount || 0) +
            calculatedPendingReview +
            (balance.paid_amount || 0) +
            calculatedFrozen;

          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            frozen_balance: calculatedFrozen,
            pending_review_balance: calculatedPendingReview,
            total_earned: newTotalEarned,
            balance: newTotalEarned - (balance.total_spent || 0)
          });

          // Log transaction
          await base44.asServiceRole.entities.CamlycoinTransaction.create({
            user_email: userEmail,
            amount: 0,
            type: 'admin_adjustment',
            description: `🔧 Fix balance từ audit logs\nFrozen: ${currentFrozen} → ${calculatedFrozen}\nPending Review: ${currentPendingReview} → ${calculatedPendingReview}\nTotal Earned: ${balance.total_earned} → ${newTotalEarned}`,
            processed_by: user.email
          });

          fixedUsers.push({
            email: userEmail,
            old_frozen: currentFrozen,
            new_frozen: calculatedFrozen,
            old_pending_review: currentPendingReview,
            new_pending_review: calculatedPendingReview,
            old_total_earned: balance.total_earned,
            new_total_earned: newTotalEarned
          });
        }
      } catch (error) {
        console.error(`❌ Error fixing ${balance.user_email}:`, error);
        errors.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    console.log(`✅ Fix completed: ${fixedUsers.length} users fixed, ${errors.length} errors`);

    return Response.json({
      success: true,
      report: {
        total_audit_logs: allAuditLogs.length,
        total_users_with_audits: Object.keys(userAudits).length,
        fixed_users: fixedUsers,
        fixed_count: fixedUsers.length,
        errors: errors,
        error_count: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Fix error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});