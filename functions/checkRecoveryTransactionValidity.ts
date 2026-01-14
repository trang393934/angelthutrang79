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

    console.log(`🔍 Checking Recovery transactions validity for ${target_email}...`);

    // Get bounty_reward transactions
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_email,
      type: 'bounty_reward'
    }, '-created_date', 10000);

    console.log(`Found ${allTransactions.length} bounty_reward transactions`);

    // Get QuestionAuditLog
    const questionLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: target_email
    }, '-audit_date', 10000);

    console.log(`Found ${questionLogs.length} QuestionAuditLog entries`);

    // Check if recovery transactions reference existing QuestionAuditLog IDs
    const recoveryTxs = allTransactions.filter(tx => 
      tx.description && tx.description.startsWith('Recovery:')
    );

    console.log(`Found ${recoveryTxs.length} Recovery transactions`);

    // Try to match recovery transactions with QuestionAuditLog
    const matches = [];
    const noMatch = [];

    for (const tx of recoveryTxs) {
      const refId = tx.reference_id;
      
      // Check if reference_id exists in QuestionAuditLog
      const matchingLog = questionLogs.find(log => log.id === refId);
      
      if (matchingLog) {
        matches.push({
          tx_id: tx.id,
          tx_amount: tx.amount,
          tx_date: tx.created_date,
          log_id: matchingLog.id,
          log_amount: matchingLog.coins_earned,
          log_date: matchingLog.audit_date || matchingLog.created_date,
          match: tx.amount === matchingLog.coins_earned
        });
      } else {
        noMatch.push({
          tx_id: tx.id,
          tx_amount: tx.amount,
          tx_date: tx.created_date,
          reference_id: refId,
          description: tx.description?.substring(0, 100)
        });
      }
    }

    // Analysis
    const totalRecoveryAmount = recoveryTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalLogAmount = questionLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    console.log(`\n📊 ANALYSIS:`);
    console.log(`Recovery transactions: ${recoveryTxs.length} = ${totalRecoveryAmount.toLocaleString()}`);
    console.log(`QuestionAuditLog: ${questionLogs.length} = ${totalLogAmount.toLocaleString()}`);
    console.log(`Matched: ${matches.length}`);
    console.log(`Not matched: ${noMatch.length}`);

    // Verdict
    let verdict = '';
    let is_duplicate = false;

    if (noMatch.length === recoveryTxs.length) {
      verdict = 'DELETED_LOGS: All recovery transactions reference QuestionAuditLog entries that have been deleted';
      is_duplicate = false; // Not duplicate if original logs were deleted
    } else if (matches.length === recoveryTxs.length && matches.length === questionLogs.length) {
      verdict = 'COMPLETE_DUPLICATE: Recovery transactions are 100% duplicate of current QuestionAuditLog';
      is_duplicate = true;
    } else if (matches.length > 0) {
      verdict = 'PARTIAL_DUPLICATE: Some recovery transactions match current logs, some reference deleted logs';
      is_duplicate = true;
    } else {
      verdict = 'UNKNOWN';
    }

    console.log(`\n⚠️ VERDICT: ${verdict}`);

    return Response.json({
      success: true,
      user_email: target_email,
      summary: {
        recovery_transactions: {
          count: recoveryTxs.length,
          total: totalRecoveryAmount
        },
        question_audit_log: {
          count: questionLogs.length,
          total: totalLogAmount
        },
        matched: matches.length,
        not_matched: noMatch.length
      },
      verdict,
      is_duplicate,
      should_remove_recovery_transactions: is_duplicate,
      correct_amount: is_duplicate ? totalLogAmount : (totalRecoveryAmount + totalLogAmount),
      sample_matches: matches.slice(0, 10),
      sample_no_match: noMatch.slice(0, 20)
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});