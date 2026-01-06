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
      updated: 0,
      correct: 0,
      issues: []
    };

    // Create map for faster lookup
    const balanceMap = new Map(balances.map(b => [b.user_email, b]));

    for (const level of userLevels) {
      results.total++;
      const balance = balanceMap.get(level.user_email);

      if (!balance) {
        results.issues.push({
          user_email: level.user_email,
          issue: 'No CamlycoinBalance record found'
        });
        continue;
      }

      const correctTotalEarned = level.total_points || 0;
      
      // Công thức: total_earned = available + frozen + pending_review + paid_amount
      const calculatedTotalEarned = (balance.available_balance || 0) + 
                                    (balance.frozen_balance || 0) + 
                                    (balance.pending_review_balance || 0) + 
                                    (balance.paid_amount || 0);

      const needsUpdate = 
        balance.total_earned !== correctTotalEarned || 
        balance.balance !== correctTotalEarned;

      if (needsUpdate) {
        await base44.entities.CamlycoinBalance.update(balance.id, {
          total_earned: correctTotalEarned,
          balance: correctTotalEarned,
          unpaid_amount: correctTotalEarned - (balance.paid_amount || 0)
        });

        results.updated++;
      } else {
        results.correct++;
      }

      // Check if sub-balances add up correctly
      if (calculatedTotalEarned !== correctTotalEarned) {
        results.issues.push({
          user_email: level.user_email,
          total_points: correctTotalEarned,
          calculated_from_subs: calculatedTotalEarned,
          available: balance.available_balance || 0,
          frozen: balance.frozen_balance || 0,
          pending_review: balance.pending_review_balance || 0,
          paid_amount: balance.paid_amount || 0,
          diff: correctTotalEarned - calculatedTotalEarned,
          note: 'Sub-balances do not add up to total_points'
        });
      }
    }

    // Create admin transaction log
    await base44.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔄 Đồng Bộ Balance = Total_Points cho ${results.updated} users\n✅ Đã đúng: ${results.correct}\n⚠️ Có vấn đề phụ: ${results.issues.length}`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      summary: {
        total_users: results.total,
        updated: results.updated,
        already_correct: results.correct,
        issues_found: results.issues.length
      },
      issues: results.issues
    });

  } catch (error) {
    console.error('Sync balance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});