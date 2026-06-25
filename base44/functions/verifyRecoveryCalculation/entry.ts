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

    console.log(`🔍 Verifying recovery calculation for ${target_email}...`);

    // 1. Get current QuestionAuditLog
    const currentLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: target_email
    }, '-audit_date', 10000);

    // 2. Get recovery transactions
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_email
    }, '-created_date', 10000);

    const recoveryTxs = allTransactions.filter(tx => 
      tx.type === 'bounty_reward' && 
      tx.description && 
      tx.description.startsWith('Recovery:')
    );

    // Extract questions from recovery descriptions
    const recoveryQuestions = recoveryTxs.map(tx => ({
      question: tx.description.replace('Recovery: ', '').trim().toLowerCase(),
      amount: tx.amount
    }));

    // Extract questions from current logs
    const currentQuestions = currentLogs.map(log => ({
      question: (log.question_text || '').trim().toLowerCase(),
      amount: log.coins_earned
    }));

    console.log(`\n📊 COMPARISON:`);
    console.log(`Current logs: ${currentLogs.length} questions`);
    console.log(`Recovery transactions: ${recoveryTxs.length}`);

    // Check for overlaps
    const recoveryQuestionSet = new Set(recoveryQuestions.map(q => q.question));
    const currentQuestionSet = new Set(currentQuestions.map(q => q.question));

    const overlaps = [];
    const uniqueRecovery = [];

    for (const rq of recoveryQuestions) {
      if (currentQuestionSet.has(rq.question)) {
        overlaps.push(rq);
      } else {
        uniqueRecovery.push(rq);
      }
    }

    const overlapAmount = overlaps.reduce((s, q) => s + q.amount, 0);
    const uniqueRecoveryAmount = uniqueRecovery.reduce((s, q) => s + q.amount, 0);
    const currentAmount = currentQuestions.reduce((s, q) => s + q.amount, 0);

    console.log(`\n🔄 OVERLAP ANALYSIS:`);
    console.log(`Current logs total: ${currentAmount.toLocaleString()}`);
    console.log(`Recovery overlaps (duplicate): ${overlaps.length} = ${overlapAmount.toLocaleString()}`);
    console.log(`Recovery unique (new): ${uniqueRecovery.length} = ${uniqueRecoveryAmount.toLocaleString()}`);

    console.log(`\n❌ CALCULATION ERROR:`);
    console.log(`User calculation: 1,367,000 + 1,335,000 = 2,702,000`);
    console.log(`Correct calculation: ${currentAmount.toLocaleString()} + ${uniqueRecoveryAmount.toLocaleString()} = ${(currentAmount + uniqueRecoveryAmount).toLocaleString()}`);

    const isCorrect = overlaps.length === 0;

    return Response.json({
      success: true,
      user_email: target_email,
      current_logs: {
        count: currentLogs.length,
        total: currentAmount
      },
      recovery_analysis: {
        total_recovery: recoveryTxs.length,
        total_amount: recoveryTxs.reduce((s, t) => s + t.amount, 0)
      },
      overlap: {
        count: overlaps.length,
        amount: overlapAmount,
        is_duplicate: overlaps.length > 0
      },
      unique_recovery: {
        count: uniqueRecovery.length,
        amount: uniqueRecoveryAmount
      },
      correct_calculation: {
        method: 'Only add unique recovery questions that are NOT in current logs',
        current_logs_amount: currentAmount,
        add_unique_recovery: uniqueRecoveryAmount,
        total_from_questions: currentAmount + uniqueRecoveryAmount
      },
      user_calculation: {
        method: 'Added all recovery without checking overlaps',
        current_logs_amount: 1367000,
        added_recovery: 1335000,
        total: 2702000,
        is_correct: isCorrect
      },
      verdict: isCorrect ? 
        'CORRECT - No overlaps between current logs and recovery' : 
        'WRONG - Some recovery questions are duplicates of current logs. Do NOT add them twice',
      sample_overlaps: overlaps.slice(0, 10).map(o => ({
        question: o.question.substring(0, 80),
        amount: o.amount
      }))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});