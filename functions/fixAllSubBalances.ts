import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔄 Starting to fix all sub-balances...');

    // Fetch all user levels
    const allLevels = await base44.asServiceRole.entities.UserLevel.list();
    console.log(`Found ${allLevels.length} user levels`);

    const report = {
      processed: 0,
      success: 0,
      errors: [],
      details: []
    };

    for (const level of allLevels) {
      try {
        const userEmail = level.user_email;
        console.log(`\n📊 Processing ${userEmail}...`);

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

        // Step 1: Set total_earned = total_points (KHÔNG THAY ĐỔI)
        const totalEarned = level.total_points || 0;
        
        // Step 2: Tính lại từng category từ audit logs
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

        // Step 3: Tính paid_amount từ transactions
        const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
          user_email: userEmail 
        });

        let paidAmount = 0;
        for (const tx of allTxs) {
          if (tx.description && tx.description.includes('đã chuyển khoản')) {
            // Extract số tiền từ description
            const match = tx.description.match(/(\d+(?:,\d+)*)/);
            if (match) {
              const amount = parseInt(match[1].replace(/,/g, ''));
              paidAmount += amount;
            }
          }
        }

        // Step 4: Tính available_balance và unpaid_amount
        // valid coins = available + paid
        // available = valid coins - paid
        const availableBalance = Math.max(0, validCoins - paidAmount);
        
        // unpaid_amount = 0 (tất cả đã được phân loại vào các category khác)
        const unpaidAmount = 0;

        // Step 5: balance = total_earned - paid_amount
        const newBalance = totalEarned - paidAmount;

        // Verification: Check if numbers add up
        const calculated = frozenBalance + pendingReviewBalance + availableBalance + paidAmount;
        const diff = totalEarned - calculated;

        console.log(`User: ${userEmail}`);
        console.log(`Total Earned: ${totalEarned}`);
        console.log(`Frozen: ${frozenBalance}`);
        console.log(`Pending Review: ${pendingReviewBalance}`);
        console.log(`Available: ${availableBalance}`);
        console.log(`Paid: ${paidAmount}`);
        console.log(`Balance: ${newBalance}`);
        console.log(`Calculated Total: ${calculated}`);
        console.log(`Difference: ${diff}`);

        // Update balance
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: totalEarned,
          balance: newBalance,
          frozen_balance: frozenBalance,
          pending_review_balance: pendingReviewBalance,
          available_balance: availableBalance,
          unpaid_amount: unpaidAmount,
          paid_amount: paidAmount
        });

        // Create transaction log
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

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing ${level.user_email}:`, error);
        report.errors.push({
          user: level.user_email,
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