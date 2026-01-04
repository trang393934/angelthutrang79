import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔄 Syncing total_earned with level total_points for all users...');

    // Fetch all UserLevel records
    const allLevels = await base44.asServiceRole.entities.UserLevel.list('-total_points', 10000);
    console.log(`📊 Found ${allLevels.length} user levels`);

    const report = [];
    let successCount = 0;
    let errorCount = 0;

    for (const level of allLevels) {
      try {
        const userEmail = level.user_email;
        const totalPoints = level.total_points || 0;

        // Find user's balance
        const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
          user_email: userEmail 
        });

        if (balances.length > 0) {
          const balance = balances[0];
          const oldTotalEarned = balance.total_earned || 0;

          // Update total_earned to match total_points
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: totalPoints
          });

          console.log(`✅ ${userEmail}: ${oldTotalEarned} → ${totalPoints}`);
          
          report.push({
            user_email: userEmail,
            old_total_earned: oldTotalEarned,
            new_total_earned: totalPoints,
            difference: totalPoints - oldTotalEarned
          });
          
          successCount++;
        } else {
          console.log(`⚠️ ${userEmail}: No balance record found`);
          errorCount++;
        }

        // Wait 100ms between updates to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error updating ${level.user_email}:`, error.message);
        errorCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${successCount} users successfully, ${errorCount} errors`,
      summary: {
        total_processed: allLevels.length,
        success_count: successCount,
        error_count: errorCount
      },
      report: report
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});