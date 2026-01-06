import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SỬA LẠI TOTAL_EARNED CHO TẤT CẢ USERS
 * 
 * Công thức đúng: total_earned = available_balance + admin_review_pending + frozen_balance + paid_amount
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);

    const results = [];
    let fixed = 0;
    let totalDifference = 0;

    for (const balance of allBalances) {
      const available = balance.available_balance || 0;
      const adminReview = balance.admin_review_pending || 0;
      const frozen = balance.frozen_balance || 0;
      const paid = balance.paid_amount || 0;
      const currentTotal = balance.total_earned || 0;

      // Công thức đúng
      const correctTotal = available + adminReview + frozen + paid;
      const difference = correctTotal - currentTotal;

      if (difference !== 0) {
        // Cập nhật total_earned
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: correctTotal
        });

        // Cập nhật UserLevel.total_points = total_earned - frozen
        const userLevels = await base44.asServiceRole.entities.UserLevel.filter({
          user_email: balance.user_email
        });

        if (userLevels.length > 0) {
          const newTotalPoints = correctTotal - frozen;
          await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
            total_points: newTotalPoints
          });
        }

        fixed++;
        totalDifference += difference;

        results.push({
          user_email: balance.user_email,
          old_total: currentTotal,
          new_total: correctTotal,
          difference: difference,
          breakdown: {
            available,
            admin_review: adminReview,
            frozen,
            paid
          }
        });
      }
    }

    // Create admin transaction log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: 'system',
      amount: 0,
      type: 'admin_adjustment',
      description: `🔧 Sửa total_earned cho ${fixed} users\n📊 Tổng chênh lệch: ${totalDifference.toLocaleString()}`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      total_users: allBalances.length,
      fixed_users: fixed,
      total_difference: totalDifference,
      results: results.slice(0, 50) // Show first 50 for preview
    });

  } catch (error) {
    console.error('Fix error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});