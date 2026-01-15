import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 AUTO BALANCE CORRECTION STARTED`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list('', 10000);
    console.log(`📊 Found ${allUsers.length} total users`);

    const results = {
      scanned: 0,
      discrepancies_found: 0,
      corrected: 0,
      errors: [],
      corrections: []
    };

    // Phase 1: Scan all users to find discrepancies
    console.log(`\n🔍 PHASE 1: Scanning all users...`);
    const discrepancyList = [];

    for (const userData of allUsers) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300)); // Rate limit

        const userEmail = userData.email;

        // Get all data sources
        const [allLogs, allTransactions, withdrawals, balances] = await Promise.all([
          base44.asServiceRole.entities.QuestionAuditLog.filter({ user_email: userEmail }, '-audit_date', 10000),
          base44.asServiceRole.entities.CamlycoinTransaction.filter({ user_email: userEmail }, '-created_date', 10000),
          base44.asServiceRole.entities.WithdrawalRequest.filter({ user_email: userEmail }, '-created_date', 1000),
          base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail })
        ]);

        const currentBalance = balances[0];
        if (!currentBalance) continue;

        // Calculate correct balance
        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason === 'duplicate' || log.coin_category === 'frozen'
        );

        const validLogTotal = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const frozenLogTotal = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        const validQuestions = new Set(
          validLogs.map(log => (log.question_text || '').trim().toLowerCase())
        );

        // Recovery analysis
        const recoveryTxs = allTransactions.filter(tx => 
          tx.type === 'bounty_reward' && 
          tx.description && 
          tx.description.startsWith('Recovery:')
        );

        let validRecoveryAmount = 0;
        for (const tx of recoveryTxs) {
          const recoveryQuestion = tx.description.replace('Recovery: ', '').trim().toLowerCase();
          if (!validQuestions.has(recoveryQuestion)) {
            validRecoveryAmount += tx.amount || 0;
          }
        }

        // Other income
        const manualTotal = allTransactions
          .filter(tx => tx.type === 'manual_add')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        const adminTotal = allTransactions
          .filter(tx => tx.type === 'admin_adjustment')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const buildRewardTotal = allTransactions
          .filter(tx => tx.type === 'build_reward')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const deductTotal = allTransactions
          .filter(tx => tx.type === 'manual_deduct')
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        const totalWithdrawn = withdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + (w.amount || 0), 0);

        // Calculate correct values
        const correctTotalEarned = validLogTotal + validRecoveryAmount + manualTotal + adminTotal + buildRewardTotal + frozenLogTotal - deductTotal;
        const correctNetValid = validLogTotal + validRecoveryAmount + manualTotal + adminTotal + buildRewardTotal - deductTotal;
        const correctFrozen = frozenLogTotal;
        const correctAvailable = correctNetValid - totalWithdrawn;

        // Check for discrepancies
        const totalEarnedDiff = Math.abs(correctTotalEarned - (currentBalance.total_earned || 0));
        const frozenDiff = Math.abs(correctFrozen - (currentBalance.frozen_balance || 0));
        const availableDiff = Math.abs(correctAvailable - (currentBalance.available_for_withdrawal || 0));

        const maxDiscrepancy = Math.max(totalEarnedDiff, frozenDiff, availableDiff);

        if (maxDiscrepancy > 0) {
          discrepancyList.push({
            email: userEmail,
            balance_id: currentBalance.id,
            maxDiscrepancy,
            current: {
              total_earned: currentBalance.total_earned || 0,
              frozen: currentBalance.frozen_balance || 0,
              available: currentBalance.available_for_withdrawal || 0
            },
            correct: {
              total_earned: correctTotalEarned,
              net_valid: correctNetValid,
              frozen: correctFrozen,
              paid_amount: totalWithdrawn,
              available: correctAvailable
            },
            diffs: {
              total_earned: correctTotalEarned - (currentBalance.total_earned || 0),
              frozen: correctFrozen - (currentBalance.frozen_balance || 0),
              available: correctAvailable - (currentBalance.available_for_withdrawal || 0)
            }
          });
          results.discrepancies_found++;
        }

        results.scanned++;
      } catch (error) {
        results.errors.push({
          user_email: userData.email,
          phase: 'scan',
          error: error.message
        });
      }
    }

    console.log(`✅ Scan complete: ${results.scanned} users, ${results.discrepancies_found} discrepancies found`);

    // Phase 2: Sort by priority (largest discrepancy first) and correct
    console.log(`\n🔧 PHASE 2: Correcting discrepancies (largest first)...`);
    discrepancyList.sort((a, b) => b.maxDiscrepancy - a.maxDiscrepancy);

    for (const item of discrepancyList) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit

        // Update balance
        await base44.asServiceRole.entities.CamlycoinBalance.update(item.balance_id, {
          total_earned: item.correct.total_earned,
          net_valid_coins: item.correct.net_valid,
          frozen_balance: item.correct.frozen,
          paid_amount: item.correct.paid_amount,
          available_for_withdrawal: item.correct.available
        });

        results.corrections.push({
          email: item.email,
          max_discrepancy: item.maxDiscrepancy,
          changes: item.diffs
        });

        results.corrected++;

        console.log(`✅ Corrected ${item.email} (max diff: ${item.maxDiscrepancy.toLocaleString()})`);
      } catch (error) {
        results.errors.push({
          user_email: item.email,
          phase: 'correction',
          error: error.message
        });
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ AUTO CORRECTION COMPLETE`);
    console.log(`Duration: ${duration}s`);
    console.log(`Scanned: ${results.scanned}`);
    console.log(`Discrepancies Found: ${results.discrepancies_found}`);
    console.log(`Corrected: ${results.corrected}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log(`${'='.repeat(80)}\n`);

    // Create admin alert if corrections were made
    if (results.corrected > 0) {
      try {
        await base44.asServiceRole.entities.AdminAlert.create({
          alert_type: 'high_balance',
          severity: results.corrected > 10 ? 'high' : 'medium',
          title: `Auto Balance Correction: ${results.corrected} users corrected`,
          message: `Automatic balance correction completed.\n\n` +
            `Scanned: ${results.scanned} users\n` +
            `Discrepancies Found: ${results.discrepancies_found}\n` +
            `Corrected: ${results.corrected}\n` +
            `Errors: ${results.errors.length}\n` +
            `Duration: ${duration}s\n\n` +
            `Top 5 corrections:\n` +
            results.corrections.slice(0, 5).map((c, i) => 
              `${i+1}. ${c.email}: ${c.max_discrepancy.toLocaleString()} max diff`
            ).join('\n'),
          data: {
            scanned: results.scanned,
            discrepancies_found: results.discrepancies_found,
            corrected: results.corrected,
            errors_count: results.errors.length,
            duration_seconds: parseFloat(duration),
            top_corrections: results.corrections.slice(0, 10)
          },
          status: 'new'
        });
      } catch (error) {
        console.error('Failed to create admin alert:', error.message);
      }
    }

    return Response.json({
      success: true,
      summary: {
        scanned: results.scanned,
        discrepancies_found: results.discrepancies_found,
        corrected: results.corrected,
        errors_count: results.errors.length,
        duration_seconds: parseFloat(duration)
      },
      top_corrections: results.corrections.slice(0, 20),
      errors: results.errors.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});