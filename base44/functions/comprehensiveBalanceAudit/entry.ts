import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * COMPREHENSIVE BALANCE AUDIT & FIX
 * 
 * Công thức chuẩn (sử dụng INTEGER để tránh lỗi làm tròn):
 * 
 * 1. frozen_balance = SUM(QuestionAuditLog WHERE exclusion_reason != 'valid' AND coin_category = 'frozen')
 * 2. net_valid_coins = SUM(QuestionAuditLog WHERE exclusion_reason = 'valid' AND question_number_in_day <= 10)
 *                    + SUM(CamlycoinTransaction WHERE type IN ['bounty_reward', 'build_reward', 'manual_add', 'admin_adjustment'])
 *                    - SUM(CamlycoinTransaction WHERE type = 'manual_deduct')
 * 3. total_earned = net_valid_coins + frozen_balance
 * 4. paid_amount = SUM(WithdrawalRequest WHERE status = 'completed')
 * 5. available_for_withdrawal = net_valid_coins - paid_amount
 * 
 * Tất cả tính toán dùng INTEGER (không có float) để tránh precision errors
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🔍 COMPREHENSIVE BALANCE AUDIT & FIX');
    console.log('='.repeat(80) + '\n');

    const { user_email, auto_fix } = await req.json().catch(() => ({}));

    // Fetch all data needed
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 10000);

    console.log(`📊 Data loaded: ${allBalances.length} balances, ${allLogs.length} logs, ${allTransactions.length} txs, ${allWithdrawals.length} withdrawals`);

    const results = {
      scanned: 0,
      issues_found: 0,
      fixed: 0,
      errors: [],
      details: []
    };

    // Build lookup maps for efficiency (using INTEGER arithmetic)
    const logsByUser = {};
    const txsByUser = {};
    const withdrawalsByUser = {};

    allLogs.forEach(log => {
      if (!logsByUser[log.user_email]) logsByUser[log.user_email] = [];
      logsByUser[log.user_email].push(log);
    });

    allTransactions.forEach(tx => {
      if (!txsByUser[tx.user_email]) txsByUser[tx.user_email] = [];
      txsByUser[tx.user_email].push(tx);
    });

    allWithdrawals.forEach(w => {
      if (!withdrawalsByUser[w.user_email]) withdrawalsByUser[w.user_email] = [];
      withdrawalsByUser[w.user_email].push(w);
    });

    // Process each balance
    const balancesToCheck = user_email 
      ? allBalances.filter(b => b.user_email === user_email)
      : allBalances;

    for (const balance of balancesToCheck) {
      try {
        const email = balance.user_email;
        const userLogs = logsByUser[email] || [];
        const userTxs = txsByUser[email] || [];
        const userWithdrawals = withdrawalsByUser[email] || [];

        // STEP 1: Calculate frozen_balance (INTEGER)
        // frozen = logs where exclusion_reason != 'valid' AND coin_category = 'frozen'
        const correctFrozen = userLogs
          .filter(log => log.exclusion_reason !== 'valid' && log.coin_category === 'frozen')
          .reduce((sum, log) => sum + Math.floor(log.coins_earned || 0), 0);

        // STEP 2: Calculate net_valid_coins (INTEGER)
        // Valid questions (first 10 per day only)
        const logsByDay = {};
        userLogs.forEach(log => {
          const day = new Date(log.question_date).toISOString().split('T')[0];
          if (!logsByDay[day]) logsByDay[day] = [];
          logsByDay[day].push(log);
        });

        let validFromQuestions = 0;
        Object.values(logsByDay).forEach(dayLogs => {
          const sortedLogs = dayLogs
            .filter(log => log.exclusion_reason === 'valid')
            .sort((a, b) => new Date(a.question_date) - new Date(b.question_date))
            .slice(0, 10); // Only first 10 questions per day
          
          validFromQuestions += sortedLogs.reduce((sum, log) => sum + Math.floor(log.coins_earned || 0), 0);
        });

        // Add rewards from transactions
        const rewardsFromTx = userTxs
          .filter(tx => ['bounty_reward', 'build_reward', 'manual_add', 'admin_adjustment'].includes(tx.type))
          .reduce((sum, tx) => sum + Math.floor(tx.amount || 0), 0);

        // Subtract deductions
        const deductions = userTxs
          .filter(tx => tx.type === 'manual_deduct')
          .reduce((sum, tx) => sum + Math.floor(Math.abs(tx.amount || 0)), 0);

        const correctNetValid = validFromQuestions + rewardsFromTx - deductions;

        // STEP 3: Calculate total_earned (INTEGER)
        const correctTotalEarned = correctNetValid + correctFrozen;

        // STEP 4: Calculate paid_amount (INTEGER)
        const correctPaidAmount = userWithdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + Math.floor(w.amount || 0), 0);

        // STEP 5: Calculate available_for_withdrawal (INTEGER)
        const correctAvailable = Math.max(0, correctNetValid - correctPaidAmount);

        // Compare with current balance
        const currentFrozen = Math.floor(balance.frozen_balance || 0);
        const currentNetValid = Math.floor(balance.net_valid_coins || 0);
        const currentTotalEarned = Math.floor(balance.total_earned || 0);
        const currentPaidAmount = Math.floor(balance.paid_amount || 0);
        const currentAvailable = Math.floor(balance.available_for_withdrawal || 0);

        const hasDifference = 
          correctFrozen !== currentFrozen ||
          correctNetValid !== currentNetValid ||
          correctTotalEarned !== currentTotalEarned ||
          correctPaidAmount !== currentPaidAmount ||
          correctAvailable !== currentAvailable;

        results.scanned++;

        if (hasDifference) {
          results.issues_found++;

          const discrepancy = {
            user_email: email,
            current: {
              frozen_balance: currentFrozen,
              net_valid_coins: currentNetValid,
              total_earned: currentTotalEarned,
              paid_amount: currentPaidAmount,
              available_for_withdrawal: currentAvailable
            },
            correct: {
              frozen_balance: correctFrozen,
              net_valid_coins: correctNetValid,
              total_earned: correctTotalEarned,
              paid_amount: correctPaidAmount,
              available_for_withdrawal: correctAvailable
            },
            differences: {
              frozen_balance: correctFrozen - currentFrozen,
              net_valid_coins: correctNetValid - currentNetValid,
              total_earned: correctTotalEarned - currentTotalEarned,
              paid_amount: correctPaidAmount - currentPaidAmount,
              available_for_withdrawal: correctAvailable - currentAvailable
            }
          };

          results.details.push(discrepancy);

          // Auto-fix if requested
          if (auto_fix) {
            await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
              frozen_balance: correctFrozen,
              net_valid_coins: correctNetValid,
              total_earned: correctTotalEarned,
              paid_amount: correctPaidAmount,
              available_for_withdrawal: correctAvailable
            });
            results.fixed++;
            console.log(`✅ Fixed ${email}`);
          } else {
            console.log(`⚠️  Issue found for ${email} (not fixed)`);
          }
        }

      } catch (error) {
        results.errors.push({
          user_email: balance.user_email,
          error: error.message
        });
        console.error(`❌ Error processing ${balance.user_email}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ AUDIT COMPLETE');
    console.log('='.repeat(80));
    console.log(`Scanned: ${results.scanned}`);
    console.log(`Issues found: ${results.issues_found}`);
    console.log(`Fixed: ${results.fixed}`);
    console.log(`Errors: ${results.errors.length}`);

    return Response.json({
      success: true,
      summary: {
        scanned: results.scanned,
        issues_found: results.issues_found,
        fixed: results.fixed,
        errors_count: results.errors.length
      },
      formula: {
        description: 'All calculations use INTEGER arithmetic to avoid precision errors',
        steps: [
          '1. frozen_balance = SUM(logs WHERE exclusion_reason != "valid" AND coin_category = "frozen")',
          '2. net_valid_coins = SUM(logs WHERE exclusion_reason = "valid" AND question_number_in_day <= 10) + rewards - deductions',
          '3. total_earned = net_valid_coins + frozen_balance',
          '4. paid_amount = SUM(withdrawals WHERE status = "completed")',
          '5. available_for_withdrawal = MAX(0, net_valid_coins - paid_amount)'
        ]
      },
      issues: results.details.slice(0, 50),
      errors: results.errors.slice(0, 10)
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});