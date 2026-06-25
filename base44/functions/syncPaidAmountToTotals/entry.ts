import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SYNC PAID_AMOUNT VÀO TOTAL_EARNED VÀ TOTAL_POINTS
 * Cộng số tiền đã thanh toán vào tổng đã kiếm và điểm level
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
    
    let updatedCount = 0;
    const results = [];

    for (const balance of allBalances) {
      const paidAmount = balance.paid_amount || 0;
      
      if (paidAmount <= 0) {
        continue; // Skip if no paid amount
      }

      const oldTotalEarned = balance.total_earned || 0;
      const newTotalEarned = oldTotalEarned + paidAmount;

      // Update CamlycoinBalance
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        total_earned: newTotalEarned
      });

      // Update UserLevel
      const levels = await base44.asServiceRole.entities.UserLevel.filter({
        user_email: balance.user_email
      });

      if (levels.length > 0) {
        const level = levels[0];
        const oldTotalPoints = level.total_points || 0;
        const newTotalPoints = oldTotalPoints + paidAmount;

        await base44.asServiceRole.entities.UserLevel.update(level.id, {
          total_points: newTotalPoints
        });

        results.push({
          user_email: balance.user_email,
          paid_amount: paidAmount,
          total_earned: {
            old: oldTotalEarned,
            new: newTotalEarned,
            added: paidAmount
          },
          total_points: {
            old: oldTotalPoints,
            new: newTotalPoints,
            added: paidAmount
          }
        });
      } else {
        results.push({
          user_email: balance.user_email,
          paid_amount: paidAmount,
          total_earned: {
            old: oldTotalEarned,
            new: newTotalEarned,
            added: paidAmount
          },
          total_points: null,
          note: 'UserLevel not found'
        });
      }

      // Create transaction log
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: balance.user_email,
        amount: 0,
        type: 'admin_adjustment',
        description: `🔄 Admin sync: Cộng ${paidAmount.toLocaleString()} Camly đã thanh toán vào Tổng Đã Kiếm và Level Points`,
        processed_by: user.email
      });

      updatedCount++;
    }

    return Response.json({
      success: true,
      message: `Đã sync paid_amount cho ${updatedCount} users`,
      updated_count: updatedCount,
      results: results
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});