import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email required' }, { status: 400 });
    }

    console.log(`🔍 Deep audit for ${target_email}...`);

    // 1. Get ALL QuestionAuditLog entries
    const questionLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: target_email
    }, '-audit_date', 10000);

    // 2. Get ALL CamlycoinTransaction entries
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_email
    }, '-created_date', 10000);

    // 3. Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_email
    });

    // 4. Get withdrawals
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      user_email: target_email
    }, '-created_date', 1000);

    console.log(`\n📊 DATA FOUND:`);
    console.log(`QuestionAuditLog: ${questionLogs.length} entries`);
    console.log(`CamlycoinTransaction: ${transactions.length} entries`);
    console.log(`Withdrawals: ${withdrawals.length} entries`);

    // Analyze QuestionAuditLog
    const logStats = {
      total: questionLogs.length,
      by_category: {},
      by_exclusion: {},
      total_coins: 0,
      valid_coins: 0,
      frozen_coins: 0
    };

    for (const log of questionLogs) {
      const coins = log.coins_earned || 0;
      logStats.total_coins += coins;

      const category = log.coin_category || 'unknown';
      if (!logStats.by_category[category]) {
        logStats.by_category[category] = { count: 0, coins: 0 };
      }
      logStats.by_category[category].count++;
      logStats.by_category[category].coins += coins;

      if (category === 'frozen') {
        logStats.frozen_coins += coins;
      } else {
        logStats.valid_coins += coins;
      }

      const exclusion = log.exclusion_reason || 'unknown';
      if (!logStats.by_exclusion[exclusion]) {
        logStats.by_exclusion[exclusion] = { count: 0, coins: 0 };
      }
      logStats.by_exclusion[exclusion].count++;
      logStats.by_exclusion[exclusion].coins += coins;
    }

    // Analyze CamlycoinTransaction
    const txStats = {
      total: transactions.length,
      by_type: {},
      total_earned: 0,
      total_spent: 0
    };

    for (const tx of transactions) {
      const amount = tx.amount || 0;
      const type = tx.type || 'unknown';

      if (!txStats.by_type[type]) {
        txStats.by_type[type] = { count: 0, amount: 0 };
      }
      txStats.by_type[type].count++;
      txStats.by_type[type].amount += amount;

      if (amount > 0) {
        txStats.total_earned += amount;
      } else {
        txStats.total_spent += Math.abs(amount);
      }
    }

    // Analyze withdrawals
    const withdrawalStats = {
      total: withdrawals.length,
      by_status: {},
      total_completed: 0
    };

    for (const w of withdrawals) {
      const status = w.status || 'unknown';
      if (!withdrawalStats.by_status[status]) {
        withdrawalStats.by_status[status] = { count: 0, amount: 0 };
      }
      withdrawalStats.by_status[status].count++;
      withdrawalStats.by_status[status].amount += w.amount || 0;

      if (status === 'completed') {
        withdrawalStats.total_completed += w.amount || 0;
      }
    }

    // Detect discrepancies
    const discrepancies = [];

    // 1. Compare QuestionAuditLog total vs CamlycoinTransaction
    const logVsTxDiff = logStats.total_coins - txStats.total_earned;
    if (Math.abs(logVsTxDiff) > 1) {
      discrepancies.push({
        type: 'LOG_VS_TRANSACTION_MISMATCH',
        severity: 'HIGH',
        details: `QuestionAuditLog shows ${logStats.total_coins.toLocaleString()} but CamlycoinTransaction shows ${txStats.total_earned.toLocaleString()}`,
        difference: logVsTxDiff
      });
    }

    // 2. Compare balance.total_earned vs logs
    if (balances.length > 0) {
      const balance = balances[0];
      const balanceVsLogDiff = (balance.total_earned || 0) - logStats.total_coins;
      if (Math.abs(balanceVsLogDiff) > 1) {
        discrepancies.push({
          type: 'BALANCE_VS_LOG_MISMATCH',
          severity: 'HIGH',
          details: `Balance.total_earned is ${balance.total_earned?.toLocaleString()} but logs show ${logStats.total_coins.toLocaleString()}`,
          difference: balanceVsLogDiff
        });
      }

      // 3. Check if withdrawn > earned
      if (withdrawalStats.total_completed > logStats.valid_coins) {
        discrepancies.push({
          type: 'OVER_WITHDRAWAL',
          severity: 'CRITICAL',
          details: `User withdrew ${withdrawalStats.total_completed.toLocaleString()} but only earned ${logStats.valid_coins.toLocaleString()} valid coins`,
          deficit: withdrawalStats.total_completed - logStats.valid_coins
        });
      }
    }

    console.log(`\n⚠️ DISCREPANCIES FOUND: ${discrepancies.length}`);

    return Response.json({
      success: true,
      user_email: target_email,
      question_audit_log: logStats,
      camlycoin_transaction: txStats,
      withdrawals: withdrawalStats,
      current_balance: balances.length > 0 ? balances[0] : null,
      discrepancies,
      raw_samples: {
        first_5_logs: questionLogs.slice(0, 5).map(l => ({
          date: l.audit_date || l.created_date,
          question: l.question_text?.substring(0, 50),
          coins: l.coins_earned,
          category: l.coin_category,
          exclusion: l.exclusion_reason
        })),
        first_5_transactions: transactions.slice(0, 5).map(t => ({
          date: t.created_date,
          type: t.type,
          amount: t.amount,
          description: t.description
        }))
      }
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});