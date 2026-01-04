import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetAdminEmail, dryRun } = await req.json();

    if (!targetAdminEmail) {
      return Response.json({ error: 'targetAdminEmail is required' }, { status: 400 });
    }

    console.log(`🧹 Cleaning up data for admin: ${targetAdminEmail} (dryRun: ${dryRun})`);

    const report = {
      audit_logs_deleted: 0,
      transactions_deleted: 0,
      balance_reset: false
    };

    // 1. Delete all QuestionAuditLog
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
      user_email: targetAdminEmail 
    });
    
    console.log(`📊 Found ${auditLogs.length} audit logs to delete`);
    report.audit_logs_deleted = auditLogs.length;

    if (!dryRun) {
      for (const log of auditLogs) {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(log.id);
      }
      console.log(`✅ Deleted ${auditLogs.length} audit logs`);
    }

    // 2. Delete all CamlycoinTransaction
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      user_email: targetAdminEmail 
    });
    
    console.log(`📊 Found ${transactions.length} transactions to delete`);
    report.transactions_deleted = transactions.length;

    if (!dryRun) {
      for (const tx of transactions) {
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
      }
      console.log(`✅ Deleted ${transactions.length} transactions`);
    }

    // 3. Reset CamlycoinBalance to zero
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email: targetAdminEmail 
    });

    if (balances.length > 0) {
      const balance = balances[0];
      console.log(`📊 Current balance:`, balance);
      
      if (!dryRun) {
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          balance: 0,
          available_balance: 0,
          frozen_balance: 0,
          pending_review_balance: 0,
          total_earned: 0,
          total_spent: 0,
          paid_amount: 0,
          unpaid_amount: 0,
          spam_score: 0,
          spam_ratio: 0,
          audit_status: 'clean'
        });
        console.log(`✅ Reset balance to zero`);
        report.balance_reset = true;
      }
    } else {
      console.log(`⚠️ No balance record found`);
    }

    return Response.json({
      success: true,
      message: dryRun ? 'Dry run completed - no changes made' : 'Cleanup completed',
      report: report
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});