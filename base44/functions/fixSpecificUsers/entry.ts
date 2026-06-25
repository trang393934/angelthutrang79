import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const targetUsers = [
      'tongvankhanhthd@gmail.com',
      'vietsoan080214@gmail.com',
      'dungluu1717@gmail.com',
      'tothiloan1011@gmail.com'
    ];

    console.log('🔄 Fixing specific users...');

    const report = {
      processed: 0,
      success: 0,
      errors: [],
      details: []
    };

    for (const userEmail of targetUsers) {
      try {
        console.log(`\n📊 Processing ${userEmail}...`);

        // Get user level
        const levels = await base44.asServiceRole.entities.UserLevel.filter({ 
          user_email: userEmail 
        });

        if (levels.length === 0) {
          console.log(`⚠️ No level for ${userEmail}`);
          continue;
        }

        const level = levels[0];

        // Get user balance
        const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
          user_email: userEmail 
        });

        if (balances.length === 0) {
          console.log(`⚠️ No balance record for ${userEmail}, creating one...`);
          await base44.asServiceRole.entities.CamlycoinBalance.create({
            user_email: userEmail,
            balance: level.total_points || 0,
            total_earned: level.total_points || 0,
            available_balance: 0,
            frozen_balance: 0,
            pending_review_balance: 0,
            unpaid_amount: 0,
            paid_amount: 0,
            total_spent: 0
          });
          report.success++;
          continue;
        }

        const balance = balances[0];

        // Set total_earned = total_points
        const totalEarned = level.total_points || 0;
        
        // Calculate from audit logs
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        let frozenBalance = 0;
        let pendingReviewBalance = 0;
        let validCoins = 0;

        for (const log of allLogs) {
          if (log.coin_category === 'frozen') {
            frozenBalance += (log.coins_earned || 0);
          } else if (log.coin_category === 'pending_review') {
            pendingReviewBalance += (log.coins_earned || 0);
          } else if (log.coin_category === 'pending_withdrawal' || log.exclusion_reason === 'valid') {
            validCoins += (log.coins_earned || 0);
          }
        }

        // Calculate paid_amount from transactions
        const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
          user_email: userEmail 
        });

        let paidAmount = 0;
        for (const tx of allTxs) {
          if (tx.description && tx.description.includes('đã chuyển khoản')) {
            const match = tx.description.match(/(\d+(?:,\d+)*)/);
            if (match) {
              const amount = parseInt(match[1].replace(/,/g, ''));
              paidAmount += amount;
            }
          }
        }

        const availableBalance = Math.max(0, validCoins - paidAmount);
        const unpaidAmount = 0;
        const newBalance = totalEarned - paidAmount;

        const calculated = frozenBalance + pendingReviewBalance + availableBalance + paidAmount;
        const diff = totalEarned - calculated;

        console.log(`User: ${userEmail}`);
        console.log(`Total Earned: ${totalEarned}`);
        console.log(`Frozen: ${frozenBalance}`);
        console.log(`Pending Review: ${pendingReviewBalance}`);
        console.log(`Available: ${availableBalance}`);
        console.log(`Paid: ${paidAmount}`);
        console.log(`Balance: ${newBalance}`);
        console.log(`Difference: ${diff}`);

        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: totalEarned,
          balance: newBalance,
          frozen_balance: frozenBalance,
          pending_review_balance: pendingReviewBalance,
          available_balance: availableBalance,
          unpaid_amount: unpaidAmount,
          paid_amount: paidAmount
        });

        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: userEmail,
          amount: 0,
          type: 'admin_adjustment',
          description: `🔧 Admin fix sub-balances:\n` +
            `Total Earned = ${totalEarned} (từ Level)\n` +
            `Frozen = ${frozenBalance}\n` +
            `Pending Review = ${pendingReviewBalance}\n` +
            `Available = ${availableBalance}\n` +
            `Paid = ${paidAmount}\n` +
            `Balance = ${newBalance}`,
          processed_by: user.email
        });

        report.success++;
        report.details.push({
          user_email: userEmail,
          total_earned: totalEarned,
          frozen: frozenBalance,
          pending_review: pendingReviewBalance,
          available: availableBalance,
          paid: paidAmount,
          balance: newBalance,
          difference: diff
        });

        // Longer delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing ${userEmail}:`, error);
        report.errors.push({
          user: userEmail,
          error: error.message
        });
      }

      report.processed++;
    }

    return Response.json({
      success: true,
      message: `Fixed sub-balances for ${report.success}/${report.processed} users`,
      report
    });

  } catch (error) {
    console.error('Fix error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});