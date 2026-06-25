import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail is required' }, { status: 400 });
    }

    console.log(`🔍 Detecting duplicate transactions for ${targetUserEmail}...`);

    // Fetch all audit logs for this user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 10000);
    const userLogs = allLogs.filter(log => log.user_email === targetUserEmail);

    // Fetch all transactions for this user
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 10000);
    const userTxs = allTxs.filter(tx => tx.user_email === targetUserEmail);

    // Analysis results
    const analysis = {
      total_audit_logs: userLogs.length,
      total_transactions: userTxs.length,
      duplicate_transaction_ids: [],
      logs_without_transaction: [],
      transactions_without_log: [],
      duplicate_questions: [],
      summary: {}
    };

    // 1. Check for duplicate transaction_id in audit logs
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

    // Find duplicates
    transactionIdMap.forEach((logs, txId) => {
      if (logs.length > 1) {
        analysis.duplicate_transaction_ids.push({
          transaction_id: txId,
          count: logs.length,
          logs: logs.map(l => ({
            id: l.id,
            question_text: l.question_text.substring(0, 50) + '...',
            coins_earned: l.coins_earned,
            exclusion_reason: l.exclusion_reason,
            coin_category: l.coin_category,
            created_date: l.created_date
          }))
        });
      }
    });

    // 2. Check for logs without corresponding transaction
    const txIds = new Set(userTxs.map(tx => tx.id));
    userLogs.forEach(log => {
      if (log.transaction_id && !txIds.has(log.transaction_id)) {
        analysis.logs_without_transaction.push({
          log_id: log.id,
          transaction_id: log.transaction_id,
          question: log.question_text.substring(0, 50) + '...',
          coins: log.coins_earned
        });
      }
    });

    // 3. Check for duplicate question texts
    const questionMap = new Map();
    userLogs.forEach(log => {
      const qText = log.question_text.toLowerCase().trim();
      if (questionMap.has(qText)) {
        questionMap.get(qText).push(log);
      } else {
        questionMap.set(qText, [log]);
      }
    });

    questionMap.forEach((logs, qText) => {
      if (logs.length > 1) {
        const totalCoins = logs.reduce((sum, l) => sum + (l.coins_earned || 0), 0);
        analysis.duplicate_questions.push({
          question: qText.substring(0, 80) + '...',
          count: logs.length,
          total_coins_duplicated: totalCoins,
          logs: logs.map(l => ({
            id: l.id,
            coins_earned: l.coins_earned,
            exclusion_reason: l.exclusion_reason,
            coin_category: l.coin_category,
            question_date: l.question_date
          }))
        });
      }
    });

    // 4. Calculate totals
    const totalEarnedFromLogs = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    const frozenFromLogs = userLogs.filter(l => l.coin_category === 'frozen')
      .reduce((sum, l) => sum + (l.coins_earned || 0), 0);
    const pendingFromLogs = userLogs.filter(l => l.coin_category === 'pending_review')
      .reduce((sum, l) => sum + (l.coins_earned || 0), 0);

    analysis.summary = {
      total_earned_from_logs: totalEarnedFromLogs,
      frozen_from_logs: frozenFromLogs,
      pending_review_from_logs: pendingFromLogs,
      duplicate_transaction_ids_count: analysis.duplicate_transaction_ids.length,
      duplicate_questions_count: analysis.duplicate_questions.length,
      logs_without_transaction_count: analysis.logs_without_transaction.length
    };

    // 5. Get current balance for comparison
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetUserEmail });
    if (balances.length > 0) {
      const balance = balances[0];
      analysis.current_balance = {
        total_earned: balance.total_earned,
        frozen_balance: balance.frozen_balance,
        pending_review_balance: balance.pending_review_balance,
        available_balance: balance.available_balance,
        unpaid_amount: balance.unpaid_amount
      };

      analysis.discrepancies = {
        total_earned_diff: totalEarnedFromLogs - (balance.total_earned || 0),
        frozen_diff: frozenFromLogs - (balance.frozen_balance || 0),
        pending_diff: pendingFromLogs - (balance.pending_review_balance || 0)
      };
    }

    return Response.json({
      success: true,
      user_email: targetUserEmail,
      analysis: analysis
    });

  } catch (error) {
    console.error('Detection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});