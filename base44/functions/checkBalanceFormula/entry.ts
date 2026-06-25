import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all balances
    const balances = await base44.entities.CamlycoinBalance.list('-created_date', 10000);

    const results = {
      total_users: balances.length,
      formula_violations: [],
      correct: 0,
      violated: 0
    };

    for (const balance of balances) {
      const totalEarned = balance.total_earned || 0;
      const pendingReview = balance.pending_review_balance || 0;
      const frozen = balance.frozen_balance || 0;
      const paid = balance.paid_amount || 0;

      // Check if: pending_review + frozen > total_earned
      const sum = pendingReview + frozen;
      
      if (sum > totalEarned) {
        results.violated++;
        results.formula_violations.push({
          user_email: balance.user_email,
          total_earned: totalEarned,
          pending_review: pendingReview,
          frozen: frozen,
          paid_amount: paid,
          sum_pending_frozen: sum,
          difference: sum - totalEarned,
          correct_pending_review: Math.max(0, totalEarned - paid - frozen)
        });
      } else {
        results.correct++;
      }

      // Also check formula: total_earned = pending_review + paid + frozen
      const calculatedTotal = pendingReview + paid + frozen;
      if (Math.abs(calculatedTotal - totalEarned) > 0.01) {
        if (!results.formula_violations.find(v => v.user_email === balance.user_email)) {
          results.violated++;
          results.formula_violations.push({
            user_email: balance.user_email,
            total_earned: totalEarned,
            pending_review: pendingReview,
            frozen: frozen,
            paid_amount: paid,
            calculated_total: calculatedTotal,
            difference: totalEarned - calculatedTotal,
            issue: 'total_earned ≠ pending + paid + frozen'
          });
        }
      }
    }

    return Response.json({
      success: true,
      summary: results,
      violations: results.formula_violations.slice(0, 50) // Top 50 violations
    });

  } catch (error) {
    console.error('Check balance formula error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});