import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ĐỒNG BỘ LEVEL POINTS - LOGIC MỚI
 * 
 * Công thức: UserLevel.total_points = CamlycoinBalance.total_earned - frozen_balance
 * 
 * Đảm bảo level là "sạch", không bị nâng bởi điểm spam
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email } = await req.json();

    // Get all balances or specific user
    const balances = target_user_email
      ? await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: target_user_email })
      : await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);

    const results = {
      total: balances.length,
      updated: 0,
      correct: 0,
      details: []
    };

    for (const balance of balances) {
      const totalEarned = balance.total_earned || 0;
      const frozenBalance = balance.frozen_balance || 0;
      const correctLevelPoints = totalEarned - frozenBalance;

      // Fetch or create UserLevel
      const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ 
        user_email: balance.user_email 
      });

      if (userLevels.length > 0) {
        const level = userLevels[0];
        const currentPoints = level.total_points || 0;

        if (currentPoints !== correctLevelPoints) {
          await base44.asServiceRole.entities.UserLevel.update(level.id, {
            total_points: correctLevelPoints
          });
          
          results.updated++;
          results.details.push({
            user_email: balance.user_email,
            old_points: currentPoints,
            new_points: correctLevelPoints,
            total_earned: totalEarned,
            frozen: frozenBalance
          });
        } else {
          results.correct++;
        }
      } else {
        // Create new UserLevel
        await base44.asServiceRole.entities.UserLevel.create({
          user_email: balance.user_email,
          total_points: correctLevelPoints,
          current_level: 'bronze',
          level_number: 1
        });
        
        results.updated++;
        results.details.push({
          user_email: balance.user_email,
          created: true,
          new_points: correctLevelPoints
        });
      }
    }

    // Create admin log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔄 Đồng Bộ Level Points (Logic Mới)\n📊 total_points = total_earned - frozen\n✅ Đã cập nhật: ${results.updated} users\n✔️ Đã đúng: ${results.correct} users`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      summary: results,
      formula: 'total_points = total_earned - frozen_balance'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});