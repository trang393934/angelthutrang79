import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔄 Starting sync: total_earned = total_points from UserLevel');

    // Fetch all user levels and balances
    const [allLevels, allBalances] = await Promise.all([
      base44.asServiceRole.entities.UserLevel.list('-total_points', 10000),
      base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 10000)
    ]);

    console.log(`📊 Found ${allLevels.length} user levels`);
    console.log(`💰 Found ${allBalances.length} user balances`);

    const results = [];

    for (const level of allLevels) {
      const userEmail = level.user_email;
      const correctTotalEarned = level.total_points || 0;

      // Find corresponding balance
      const balance = allBalances.find(b => b.user_email === userEmail);

      if (!balance) {
        console.warn(`⚠️ No balance found for ${userEmail}`);
        results.push({
          userEmail,
          status: 'no_balance',
          correctTotalEarned
        });
        continue;
      }

      const currentTotalEarned = balance.total_earned || 0;

      if (currentTotalEarned === correctTotalEarned) {
        results.push({
          userEmail,
          status: 'already_correct',
          totalEarned: correctTotalEarned
        });
        continue;
      }

      // Calculate the difference
      const difference = correctTotalEarned - currentTotalEarned;

      try {
        // Update total_earned to match total_points
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: correctTotalEarned,
          balance: (balance.balance || 0) + difference
        });

        // Create transaction log
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: userEmail,
          amount: 0,
          type: 'admin_adjustment',
          description: `🔄 Sync: total_earned từ ${currentTotalEarned.toLocaleString()} → ${correctTotalEarned.toLocaleString()} (match với UserLevel total_points)`,
          processed_by: user.email
        });

        results.push({
          userEmail,
          status: 'updated',
          oldTotalEarned: currentTotalEarned,
          newTotalEarned: correctTotalEarned,
          difference
        });

        console.log(`✅ ${userEmail}: ${currentTotalEarned.toLocaleString()} → ${correctTotalEarned.toLocaleString()}`);

      } catch (error) {
        console.error(`❌ Error updating ${userEmail}:`, error);
        results.push({
          userEmail,
          status: 'error',
          error: error.message
        });
      }
    }

    const updated = results.filter(r => r.status === 'updated');
    const alreadyCorrect = results.filter(r => r.status === 'already_correct');
    const errors = results.filter(r => r.status === 'error');

    return Response.json({
      success: true,
      message: '✅ Đã sync total_earned = total_points cho tất cả users',
      summary: {
        totalProcessed: results.length,
        updated: updated.length,
        alreadyCorrect: alreadyCorrect.length,
        errors: errors.length,
        noBalance: results.filter(r => r.status === 'no_balance').length
      },
      updated: updated.slice(0, 20),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing total_earned:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});