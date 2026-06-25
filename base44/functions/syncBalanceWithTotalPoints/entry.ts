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
      
      // Công thức MỚI: total_earned = pending_review + paid_amount + frozen
      // pending_review_balance = Chờ Duyệt Thanh Toán (bao gồm available)
      // frozen_balance = Đóng Băng Vĩnh Viễn (không bao giờ thanh toán)
      // paid_amount = Đã Thanh Toán
      
      const paidAmount = balance.paid_amount || 0;
      const frozenBalance = balance.frozen_balance || 0;
      const correctPendingReview = correctTotalEarned - paidAmount - frozenBalance;

      const needsUpdate = 
        balance.total_earned !== correctTotalEarned || 
        balance.balance !== correctTotalEarned ||
        balance.pending_review_balance !== correctPendingReview;

      if (needsUpdate) {
        await base44.entities.CamlycoinBalance.update(balance.id, {
          total_earned: correctTotalEarned,
          balance: correctTotalEarned,
          pending_review_balance: Math.max(0, correctPendingReview),
          available_balance: Math.max(0, correctPendingReview), // Available = Pending Review
          unpaid_amount: correctTotalEarned - paidAmount
        });

        results.updated++;
      } else {
        results.correct++;
      }

      // Check if formula is correct
      const calculatedTotal = (balance.pending_review_balance || 0) + paidAmount + frozenBalance;
      if (Math.abs(calculatedTotal - correctTotalEarned) > 0.01) {
        results.issues.push({
          user_email: level.user_email,
          total_points: correctTotalEarned,
          calculated_from_formula: calculatedTotal,
          pending_review: balance.pending_review_balance || 0,
          frozen: frozenBalance,
          paid_amount: paidAmount,
          diff: correctTotalEarned - calculatedTotal,
          note: 'Formula: total_earned ≠ pending_review + paid + frozen'
        });
      }
    }

    // Create admin transaction log
    await base44.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔄 Đồng Bộ Balance Công Thức Mới
📊 Total = Pending Review + Paid + Frozen
✅ Đã cập nhật: ${results.updated} users
✔️ Đã đúng: ${results.correct} users
⚠️ Vấn đề: ${results.issues.length} cases`,
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