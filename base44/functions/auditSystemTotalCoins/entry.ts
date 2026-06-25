import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Starting system-wide audit...');

    // Lấy tất cả audit logs và balances
    const [allAuditLogs, allBalances] = await Promise.all([
      base44.asServiceRole.entities.QuestionAuditLog.list('-question_date', 100000),
      base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000)
    ]);

    console.log(`📊 Audit logs: ${allAuditLogs.length}, Balances: ${allBalances.length}`);

    // Tính toán từ audit logs
    const calculatedByUser = {};
    
    allAuditLogs.forEach(log => {
      if (!calculatedByUser[log.user_email]) {
        calculatedByUser[log.user_email] = {
          frozen: 0,
          pending_review: 0,
          valid_available: 0,
          total_from_audits: 0
        };
      }

      const coins = log.coins_earned || 0;

      // Frozen: duplicate, greeting, low_quality
      if (log.exclusion_reason === 'duplicate' || 
          log.exclusion_reason === 'greeting' || 
          log.exclusion_reason === 'low_quality') {
        calculatedByUser[log.user_email].frozen += coins;
      }
      // Pending review: exceeds_daily_limit HOẶC câu > 10
      else if (log.exclusion_reason === 'exceeds_daily_limit' || log.question_number_in_day > 10) {
        calculatedByUser[log.user_email].pending_review += coins;
      }
      // Valid: câu <= 10
      else if (log.exclusion_reason === 'valid' && log.question_number_in_day <= 10) {
        calculatedByUser[log.user_email].valid_available += coins;
      }

      calculatedByUser[log.user_email].total_from_audits += coins;
    });

    // So sánh với DB
    const systemTotals = {
      db: {
        total_earned: 0,
        frozen: 0,
        pending_review: 0,
        available: 0,
        unpaid: 0,
        paid: 0
      },
      calculated: {
        total_from_audits: 0,
        frozen: 0,
        pending_review: 0,
        valid_available: 0
      },
      discrepancies: [],
      user_details: []
    };

    allBalances.forEach(balance => {
      systemTotals.db.total_earned += balance.total_earned || 0;
      systemTotals.db.frozen += balance.frozen_balance || 0;
      systemTotals.db.pending_review += balance.pending_review_balance || 0;
      systemTotals.db.available += balance.available_balance || 0;
      systemTotals.db.unpaid += balance.unpaid_amount || 0;
      systemTotals.db.paid += balance.paid_amount || 0;

      const calc = calculatedByUser[balance.user_email];
      if (calc) {
        systemTotals.calculated.total_from_audits += calc.total_from_audits;
        systemTotals.calculated.frozen += calc.frozen;
        systemTotals.calculated.pending_review += calc.pending_review;
        systemTotals.calculated.valid_available += calc.valid_available;

        // Check user-level discrepancies
        const userDiscrepancy = {
          email: balance.user_email,
          issues: []
        };

        if (calc.frozen !== (balance.frozen_balance || 0)) {
          userDiscrepancy.issues.push({
            field: 'frozen',
            db: balance.frozen_balance || 0,
            calculated: calc.frozen,
            diff: calc.frozen - (balance.frozen_balance || 0)
          });
        }

        if (calc.pending_review !== (balance.pending_review_balance || 0)) {
          userDiscrepancy.issues.push({
            field: 'pending_review',
            db: balance.pending_review_balance || 0,
            calculated: calc.pending_review,
            diff: calc.pending_review - (balance.pending_review_balance || 0)
          });
        }

        // Check total earned formula
        const dbTotal = 
          (balance.available_balance || 0) +
          (balance.unpaid_amount || 0) +
          (balance.pending_review_balance || 0) +
          (balance.paid_amount || 0) +
          (balance.frozen_balance || 0);

        if (dbTotal !== (balance.total_earned || 0)) {
          userDiscrepancy.issues.push({
            field: 'total_earned_formula',
            db: balance.total_earned || 0,
            calculated: dbTotal,
            diff: dbTotal - (balance.total_earned || 0)
          });
        }

        if (userDiscrepancy.issues.length > 0) {
          systemTotals.discrepancies.push(userDiscrepancy);
        }

        systemTotals.user_details.push({
          email: balance.user_email,
          db: {
            total_earned: balance.total_earned || 0,
            frozen: balance.frozen_balance || 0,
            pending_review: balance.pending_review_balance || 0,
            available: balance.available_balance || 0,
            unpaid: balance.unpaid_amount || 0,
            paid: balance.paid_amount || 0
          },
          calculated: calc
        });
      }
    });

    // System-level validation
    const systemValidation = {
      formula_check: {
        db_total_earned: systemTotals.db.total_earned,
        db_breakdown: systemTotals.db.available + systemTotals.db.unpaid + systemTotals.db.pending_review + systemTotals.db.paid + systemTotals.db.frozen,
        match: systemTotals.db.total_earned === (systemTotals.db.available + systemTotals.db.unpaid + systemTotals.db.pending_review + systemTotals.db.paid + systemTotals.db.frozen)
      },
      audit_comparison: {
        frozen_diff: systemTotals.calculated.frozen - systemTotals.db.frozen,
        pending_review_diff: systemTotals.calculated.pending_review - systemTotals.db.pending_review
      }
    };

    console.log(`✅ Audit completed`);
    console.log(`   Users with discrepancies: ${systemTotals.discrepancies.length}`);
    console.log(`   System formula match: ${systemValidation.formula_check.match ? '✅' : '❌'}`);

    return Response.json({
      success: true,
      system_totals: systemTotals,
      system_validation: systemValidation,
      summary: {
        total_users: allBalances.length,
        total_audit_logs: allAuditLogs.length,
        users_with_issues: systemTotals.discrepancies.length
      }
    });

  } catch (error) {
    console.error('❌ Audit error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});