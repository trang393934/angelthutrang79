import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all UserLevel and CamlycoinBalance
    const [userLevels, balances] = await Promise.all([
      base44.entities.UserLevel.list('-created_date', 10000),
      base44.entities.CamlycoinBalance.list('-created_date', 10000)
    ]);

    const results = {
      total: 0,
      fixed: 0,
      correct: 0,
      details: []
    };

    // Create map for faster lookup
    const balanceMap = new Map(balances.map(b => [b.user_email, b]));

    for (const level of userLevels) {
      results.total++;
      const balance = balanceMap.get(level.user_email);

      if (!balance) {
        results.details.push({
          user_email: level.user_email,
          status: 'no_balance_record'
        });
        continue;
      }

      const correctTotalEarned = level.total_points || 0;
      const paidAmount = balance.paid_amount || 0;
      const unpaidAmount = correctTotalEarned - paidAmount;

      // Calculate current sub-balances total
      const currentSubTotal = (balance.available_balance || 0) + 
                              (balance.frozen_balance || 0) + 
                              (balance.pending_review_balance || 0);

      // Check if sub-balances match unpaid_amount
      if (currentSubTotal !== unpaidAmount) {
        // Fix: Set all unpaid to available_balance, clear others
        await base44.entities.CamlycoinBalance.update(balance.id, {
          total_earned: correctTotalEarned,
          balance: correctTotalEarned,
          unpaid_amount: unpaidAmount,
          available_balance: unpaidAmount,
          frozen_balance: 0,
          pending_review_balance: 0
        });

        results.fixed++;
        results.details.push({
          user_email: level.user_email,
          status: 'fixed',
          old_available: balance.available_balance || 0,
          old_frozen: balance.frozen_balance || 0,
          old_pending: balance.pending_review_balance || 0,
          new_available: unpaidAmount,
          new_frozen: 0,
          new_pending: 0,
          total_points: correctTotalEarned,
          paid_amount: paidAmount
        });
      } else {
        results.correct++;
      }
    }

    // Create admin transaction log
    await base44.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔧 Fix Sub-Balances\n✅ Fixed: ${results.fixed} users\n🎯 Correct: ${results.correct} users\n📊 Total: ${results.total} users`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      summary: {
        total_users: results.total,
        fixed: results.fixed,
        already_correct: results.correct
      },
      details: results.details.filter(d => d.status === 'fixed')
    });

  } catch (error) {
    console.error('Fix sub-balances error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});