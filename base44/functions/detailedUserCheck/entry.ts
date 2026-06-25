import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * KIỂM TRA CHI TIẾT USER - CÔNG THỨC TỪNG BƯỚC
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'Missing user_email' }, { status: 400 });
    }

    // Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email 
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];

    // Get level
    const levels = await base44.asServiceRole.entities.UserLevel.filter({ 
      user_email 
    });

    const level = levels.length > 0 ? levels[0] : null;

    // Calculate formulas
    const totalEarned = balance.total_earned || 0;
    const frozen = balance.frozen_balance || 0;
    const adminReview = balance.admin_review_pending || 0;
    const available = balance.available_balance || 0;
    const paid = balance.paid_amount || 0;

    const calculatedTotal = frozen + adminReview + available + paid;
    const pendingPayment = available + adminReview;
    const cleanLevel = totalEarned - frozen;

    return Response.json({
      user_email,
      balance_data: {
        total_earned: totalEarned,
        frozen_balance: frozen,
        admin_review_pending: adminReview,
        available_balance: available,
        paid_amount: paid
      },
      calculations: {
        formula_check: {
          total_earned_stored: totalEarned,
          calculated_total: calculatedTotal,
          formula: `${frozen} + ${adminReview} + ${available} + ${paid} = ${calculatedTotal}`,
          matches: Math.abs(totalEarned - calculatedTotal) < 1,
          difference: totalEarned - calculatedTotal
        },
        pending_payment: {
          value: pendingPayment,
          formula: `${available} + ${adminReview} = ${pendingPayment}`
        },
        clean_level: {
          value: cleanLevel,
          formula: `${totalEarned} - ${frozen} = ${cleanLevel}`,
          level_stored: level?.total_points || 0,
          matches: level ? Math.abs(level.total_points - cleanLevel) < 1 : false
        }
      },
      level_data: level ? {
        current_level: level.current_level,
        level_number: level.level_number,
        total_points: level.total_points
      } : null,
      all_formulas_correct: 
        Math.abs(totalEarned - calculatedTotal) < 1 && 
        (!level || Math.abs(level.total_points - cleanLevel) < 1)
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});