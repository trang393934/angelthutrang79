import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userEmail } = await req.json();

    if (!userEmail) {
      return Response.json({ error: 'userEmail is required' }, { status: 400 });
    }

    console.log(`🔍 Auditing question history for ${userEmail}...`);

    // Lấy tất cả transactions của user
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: userEmail },
      '-created_date',
      10000
    );

    // Lấy tất cả audit logs
    const allAuditLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: userEmail },
      '-question_date',
      10000
    );

    // Lấy balance hiện tại
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
    const currentBalance = balances[0];

    // Phân loại từng transaction
    const breakdown = {
      total_transactions: allTransactions.length,
      total_audit_logs: allAuditLogs.length,
      
      // Transactions theo loại
      by_type: {},
      
      // Theo audit log
      frozen_questions: [],
      pending_review_questions: [],
      valid_questions: [],
      
      // Tổng tính theo audit logs
      calculated_frozen: 0,
      calculated_pending_review: 0,
      calculated_available: 0,
      calculated_paid: 0,
      calculated_unpaid: 0,
      calculated_total: 0,
      
      // Balance hiện tại từ DB
      current_balance: {
        total_earned: currentBalance?.total_earned || 0,
        available_balance: currentBalance?.available_balance || 0,
        unpaid_amount: currentBalance?.unpaid_amount || 0,
        paid_amount: currentBalance?.paid_amount || 0,
        frozen_balance: currentBalance?.frozen_balance || 0,
        pending_review_balance: currentBalance?.pending_review_balance || 0
      },
      
      // Discrepancies
      discrepancies: []
    };

    // Phân tích transactions theo type
    allTransactions.forEach(tx => {
      const type = tx.type || 'unknown';
      if (!breakdown.by_type[type]) {
        breakdown.by_type[type] = { count: 0, total_amount: 0, transactions: [] };
      }
      breakdown.by_type[type].count++;
      breakdown.by_type[type].total_amount += tx.amount;
      breakdown.by_type[type].transactions.push({
        date: tx.created_date,
        amount: tx.amount,
        description: tx.description
      });
    });

    // Phân tích audit logs
    allAuditLogs.forEach(log => {
      const logData = {
        date: log.question_date,
        question: log.question_text?.substring(0, 100),
        coins: log.coins_earned,
        reason: log.exclusion_reason,
        category: log.coin_category,
        question_number: log.question_number_in_day
      };

      if (log.exclusion_reason === 'duplicate' || log.exclusion_reason === 'greeting' || log.exclusion_reason === 'low_quality') {
        breakdown.frozen_questions.push(logData);
        breakdown.calculated_frozen += log.coins_earned;
      } else if (log.exclusion_reason === 'exceeds_daily_limit' || log.question_number_in_day > 10) {
        breakdown.pending_review_questions.push(logData);
        breakdown.calculated_pending_review += log.coins_earned;
      } else if (log.exclusion_reason === 'valid') {
        breakdown.valid_questions.push(logData);
        if (log.question_number_in_day <= 10) {
          breakdown.calculated_available += log.coins_earned;
        }
      }
    });

    // Tính tổng
    breakdown.calculated_total = 
      breakdown.calculated_available + 
      breakdown.calculated_pending_review + 
      breakdown.calculated_paid + 
      breakdown.calculated_frozen;

    // Tìm discrepancies
    if (breakdown.calculated_frozen !== breakdown.current_balance.frozen_balance) {
      breakdown.discrepancies.push({
        field: 'frozen_balance',
        calculated: breakdown.calculated_frozen,
        current: breakdown.current_balance.frozen_balance,
        difference: breakdown.calculated_frozen - breakdown.current_balance.frozen_balance
      });
    }

    if (breakdown.calculated_pending_review !== breakdown.current_balance.pending_review_balance) {
      breakdown.discrepancies.push({
        field: 'pending_review_balance',
        calculated: breakdown.calculated_pending_review,
        current: breakdown.current_balance.pending_review_balance,
        difference: breakdown.calculated_pending_review - breakdown.current_balance.pending_review_balance
      });
    }

    const calculatedTotalEarned = 
      breakdown.current_balance.available_balance +
      breakdown.current_balance.unpaid_amount +
      breakdown.current_balance.pending_review_balance +
      breakdown.current_balance.paid_amount +
      breakdown.calculated_frozen; // Use calculated frozen instead

    if (calculatedTotalEarned !== breakdown.current_balance.total_earned) {
      breakdown.discrepancies.push({
        field: 'total_earned',
        calculated: calculatedTotalEarned,
        current: breakdown.current_balance.total_earned,
        difference: calculatedTotalEarned - breakdown.current_balance.total_earned
      });
    }

    // Đề xuất fix
    breakdown.suggested_fix = {
      frozen_balance: breakdown.calculated_frozen,
      pending_review_balance: breakdown.calculated_pending_review,
      total_earned: calculatedTotalEarned
    };

    console.log(`✅ Audit completed for ${userEmail}`);
    console.log(`   Frozen: ${breakdown.calculated_frozen} (current: ${breakdown.current_balance.frozen_balance})`);
    console.log(`   Pending Review: ${breakdown.calculated_pending_review} (current: ${breakdown.current_balance.pending_review_balance})`);
    console.log(`   Discrepancies: ${breakdown.discrepancies.length}`);

    return Response.json({
      success: true,
      user_email: userEmail,
      breakdown: breakdown
    });

  } catch (error) {
    console.error('❌ Audit error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});