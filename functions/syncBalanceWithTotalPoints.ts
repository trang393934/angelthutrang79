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

      const correctBalance = level.total_points || 0;
      const correctUnpaidAmount = correctBalance - (balance.paid_amount || 0);

      const needsUpdate = 
        balance.balance !== correctBalance || 
        balance.unpaid_amount !== correctUnpaidAmount;

      if (needsUpdate) {
        await base44.entities.CamlycoinBalance.update(balance.id, {
          balance: correctBalance,
          unpaid_amount: correctUnpaidAmount
        });

        // Check if sub-balances add up correctly
        const subTotal = (balance.available_balance || 0) + 
                        (balance.frozen_balance || 0) + 
                        (balance.pending_review_balance || 0);

        if (subTotal !== correctUnpaidAmount) {
          results.issues.push({
            user_email: level.user_email,
            balance: correctBalance,
            unpaid_amount: correctUnpaidAmount,
            paid_amount: balance.paid_amount || 0,
            available: balance.available_balance || 0,
            frozen: balance.frozen_balance || 0,
            pending_review: balance.pending_review_balance || 0,
            sub_total: subTotal,
            diff: correctUnpaidAmount - subTotal,
            note: 'Sub-balances do not add up to unpaid_amount'
          });
        }

        results.updated++;
      } else {
        results.correct++;
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