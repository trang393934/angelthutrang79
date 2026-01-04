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

    console.log(`🔍 Counting questions for ${targetUserEmail}...`);

    // Get audit logs
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
      user_email: targetUserEmail 
    });

    // Get all transactions to find manual_add
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      user_email: targetUserEmail 
    });

    // Count manual_add transactions (câu 11-30)
    const manualAddTxs = allTxs.filter(tx => 
      tx.type === 'manual_add' && 
      tx.amount > 0 &&
      tx.description?.match(/\(\d+\/30\)/)
    );

    // Count by question number from audit logs
    const questionsByNumber = {};
    for (const log of auditLogs) {
      const qNum = log.question_number_in_day;
      if (!questionsByNumber[qNum]) {
        questionsByNumber[qNum] = 0;
      }
      questionsByNumber[qNum]++;
    }

    // Count by question number from manual_add
    const manualAddByNumber = {};
    for (const tx of manualAddTxs) {
      const match = tx.description?.match(/\((\d+)\/30\)/);
      if (match) {
        const qNum = parseInt(match[1]);
        if (!manualAddByNumber[qNum]) {
          manualAddByNumber[qNum] = 0;
        }
        manualAddByNumber[qNum]++;
      }
    }

    // Total unique questions = audit logs (câu 1-10 + một số câu 11+) + manual_add (các câu 11+ không có trong audit)
    const totalQuestions = auditLogs.length + manualAddTxs.length;

    return Response.json({
      success: true,
      user_email: targetUserEmail,
      question_count: {
        from_audit_logs: auditLogs.length,
        from_manual_add: manualAddTxs.length,
        total_questions: totalQuestions,
        breakdown: {
          audit_logs_by_question_number: questionsByNumber,
          manual_add_by_question_number: manualAddByNumber
        }
      }
    });

  } catch (error) {
    console.error('Count error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});