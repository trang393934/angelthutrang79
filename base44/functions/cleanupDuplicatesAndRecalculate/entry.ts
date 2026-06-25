import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail, dryRun = true } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail is required' }, { status: 400 });
    }

    console.log(`🧹 Cleaning up duplicates for ${targetUserEmail} (dryRun: ${dryRun})...`);

    // Fetch all audit logs for this user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(log => log.user_email === targetUserEmail);

    const report = {
      user_email: targetUserEmail,
      total_logs_before: userLogs.length,
      duplicates_found: [],
      logs_to_delete: [],
      logs_to_keep: [],
      deleted_count: 0,
      balance_before: null,
      balance_after: null
    };

    // Get current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetUserEmail });
    if (balances.length > 0) {
      const balance = balances[0];
      report.balance_before = {
        total_earned: balance.total_earned,
        frozen_balance: balance.frozen_balance,
        pending_review_balance: balance.pending_review_balance,
        available_balance: balance.available_balance,
        unpaid_amount: balance.unpaid_amount,
        paid_amount: balance.paid_amount
      };
    }

    // 1. Find duplicates by transaction_id
    const transactionIdMap = new Map();
    userLogs.forEach(log => {
      if (log.transaction_id) {
        if (transactionIdMap.has(log.transaction_id)) {
          transactionIdMap.get(log.transaction_id).push(log);
        } else {
          transactionIdMap.set(log.transaction_id, [log]);
        }
      }
    });

    // Process duplicates - keep oldest, delete newer ones
    transactionIdMap.forEach((logs, txId) => {
      if (logs.length > 1) {
        // Sort by created_date (oldest first)
        logs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        
        const keepLog = logs[0];
        const deleteLogs = logs.slice(1);

        report.duplicates_found.push({
          transaction_id: txId,
          total_duplicates: logs.length,
          kept_log_id: keepLog.id,
          deleted_log_ids: deleteLogs.map(l => l.id),
          question: keepLog.question_text.substring(0, 60) + '...',
          coins: keepLog.coins_earned
        });

        report.logs_to_keep.push(keepLog.id);
        report.logs_to_delete.push(...deleteLogs.map(l => l.id));
      }
    });

    // 2. Delete duplicates if not dry run
    if (!dryRun && report.logs_to_delete.length > 0) {
      console.log(`🗑️ Deleting ${report.logs_to_delete.length} duplicate logs...`);
      
      for (const logId of report.logs_to_delete) {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(logId);
        report.deleted_count++;
      }

      // 3. Recalculate balance from remaining logs
      console.log('🔄 Recalculating balance from clean logs...');
      
      const remainingLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
        user_email: targetUserEmail 
      });

      const calculatedTotalEarned = remainingLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      const frozenAmount = remainingLogs
        .filter(log => log.coin_category === 'frozen')
        .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      const pendingReviewAmount = remainingLogs
        .filter(log => log.coin_category === 'pending_review')
        .reduce((sum, log) => sum + (log.coins_earned || 0), 0);

      // Get user's transactions to calculate spent
      const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 100000);
      const userTxs = allTxs.filter(tx => tx.user_email === targetUserEmail);
      
      const calculatedTotalSpent = Math.abs(userTxs
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0));

      const currentPaid = report.balance_before.paid_amount || 0;
      const currentAvailable = report.balance_before.available_balance || 0;

      const newBalance = calculatedTotalEarned - currentPaid;
      const newUnpaid = Math.max(0, newBalance - currentAvailable - frozenAmount - pendingReviewAmount);

      // Update balance
      await base44.asServiceRole.entities.CamlycoinBalance.update(balances[0].id, {
        total_earned: calculatedTotalEarned,
        total_spent: calculatedTotalSpent,
        frozen_balance: frozenAmount,
        pending_review_balance: pendingReviewAmount,
        balance: newBalance,
        unpaid_amount: newUnpaid
      });

      // Create transaction log
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: targetUserEmail,
        amount: 0,
        type: 'admin_adjustment',
        description: `🧹 Cleanup Duplicates\n` +
          `Deleted ${report.deleted_count} duplicate audit logs\n` +
          `Total Earned: ${report.balance_before.total_earned} → ${calculatedTotalEarned}\n` +
          `Frozen: ${report.balance_before.frozen_balance} → ${frozenAmount}\n` +
          `Pending Review: ${report.balance_before.pending_review_balance} → ${pendingReviewAmount}`,
        processed_by: user.email
      });

      report.balance_after = {
        total_earned: calculatedTotalEarned,
        frozen_balance: frozenAmount,
        pending_review_balance: pendingReviewAmount,
        available_balance: currentAvailable,
        unpaid_amount: newUnpaid,
        paid_amount: currentPaid,
        balance: newBalance
      };

      report.total_logs_after = remainingLogs.length;
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      report: report,
      message: dryRun 
        ? `DRY RUN: Found ${report.logs_to_delete.length} duplicates. Set dryRun=false to delete.`
        : `Cleaned up ${report.deleted_count} duplicates and recalculated balance.`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});