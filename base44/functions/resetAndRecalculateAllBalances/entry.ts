import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    console.log('🔄 Starting complete balance reset and recalculation...');

    // Get all users or specific user
    let usersToProcess = [];
    if (targetUserEmail) {
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
        user_email: targetUserEmail 
      });
      if (balances.length > 0) {
        usersToProcess = [balances[0]];
      }
    } else {
      usersToProcess = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    }

    const report = {
      total_users: usersToProcess.length,
      processed: [],
      errors: []
    };

    // Fetch all audit logs and transactions once
    console.log('📊 Fetching all audit logs and transactions...');
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 100000);
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 100000);

    for (const balance of usersToProcess) {
      try {
        const userEmail = balance.user_email;
        console.log(`\n🔧 Processing ${userEmail}...`);

        // Get user's audit logs
        const userLogs = allLogs.filter(log => log.user_email === userEmail);
        
        // Calculate total_earned from audit logs (all questions)
        const totalFromQuestions = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Get user's transactions
        const userTxs = allTxs.filter(tx => tx.user_email === userEmail);
        
        // Calculate total_earned from positive transactions (bounties, community rewards, etc.)
        // Exclude transactions that are just moving money around (admin_adjustment type)
        const totalFromOtherSources = userTxs
          .filter(tx => 
            tx.amount > 0 && 
            tx.type !== 'admin_adjustment' &&
            !tx.description?.includes('Comprehensive Audit') &&
            !tx.description?.includes('Daily Question')
          )
          .reduce((sum, tx) => sum + tx.amount, 0);

        // Total earned = questions + other sources
        const newTotalEarned = totalFromQuestions + totalFromOtherSources;

        // Calculate total_spent (negative transactions)
        const totalSpent = Math.abs(userTxs
          .filter(tx => tx.amount < 0)
          .reduce((sum, tx) => sum + tx.amount, 0));

        // Reset all sub-balances to 0, keep only total_earned
        const newBalance = {
          total_earned: newTotalEarned,
          total_spent: totalSpent,
          balance: newTotalEarned - totalSpent,
          available_balance: 0,
          frozen_balance: 0,
          pending_review_balance: 0,
          unpaid_amount: 0,
          paid_amount: 0
        };

        // Update balance
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, newBalance);

        // Create transaction log
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: userEmail,
          amount: 0,
          type: 'admin_adjustment',
          description: `🔄 Complete Reset & Recalculation\n` +
            `Total from Questions: ${totalFromQuestions.toLocaleString()}\n` +
            `Total from Other Sources: ${totalFromOtherSources.toLocaleString()}\n` +
            `Total Earned: ${newTotalEarned.toLocaleString()}\n` +
            `All sub-balances reset to 0\n` +
            `Ready for fresh categorization`,
          processed_by: user.email
        });

        report.processed.push({
          email: userEmail,
          before: {
            total_earned: balance.total_earned,
            available: balance.available_balance,
            frozen: balance.frozen_balance,
            pending_review: balance.pending_review_balance,
            unpaid: balance.unpaid_amount,
            paid: balance.paid_amount
          },
          after: newBalance,
          breakdown: {
            from_questions: totalFromQuestions,
            from_other_sources: totalFromOtherSources,
            total_audit_logs: userLogs.length
          }
        });

        console.log(`✅ ${userEmail}: ${balance.total_earned} → ${newTotalEarned}`);

      } catch (error) {
        console.error(`❌ Error processing ${balance.user_email}:`, error);
        report.errors.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      report: report,
      summary: {
        total_users: report.total_users,
        processed: report.processed.length,
        errors: report.errors.length
      }
    });

  } catch (error) {
    console.error('Reset error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});