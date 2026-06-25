import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log(`📊 Calculate real system stats from audit logs...`);

    // Fetch ALL audit logs (tất cả, không bỏ qua)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    // Group by user_email
    const byUser = new Map();
    allLogs.forEach(log => {
      if (!byUser.has(log.user_email)) {
        byUser.set(log.user_email, []);
      }
      byUser.get(log.user_email).push(log);
    });

    console.log(`\n📝 Total users with logs: ${byUser.size}`);
    console.log(`📊 Total logs: ${allLogs.length}`);

    // Calculate totals
    let totalValidCoins = 0;
    let totalFrozenCoins = 0;
    let usersWithEarnings = 0;

    byUser.forEach((userLogs, userEmail) => {
      let userValid = 0;
      let userFrozen = 0;

      userLogs.forEach(log => {
        if (log.exclusion_reason === 'valid') {
          userValid += log.coins_earned || 0;
        } else {
          userFrozen += log.coins_earned || 0;
        }
      });

      const userTotal = userValid + userFrozen;
      if (userTotal > 0) {
        usersWithEarnings++;
      }

      totalValidCoins += userValid;
      totalFrozenCoins += userFrozen;
    });

    const totalCoins = totalValidCoins + totalFrozenCoins;
    const avgPerUser = usersWithEarnings > 0 ? Math.floor(totalCoins / usersWithEarnings) : 0;

    console.log(`\n💰 REAL SYSTEM STATS (from audit logs):`);
    console.log(`  Total Valid Coins: ${totalValidCoins.toLocaleString()}`);
    console.log(`  Total Frozen Coins: ${totalFrozenCoins.toLocaleString()}`);
    console.log(`  Total Coins: ${totalCoins.toLocaleString()}`);
    console.log(`  Users with Earnings: ${usersWithEarnings}`);
    console.log(`  Average per User: ${avgPerUser.toLocaleString()}`);

    return Response.json({
      success: true,
      total_valid_coins: totalValidCoins,
      total_frozen_coins: totalFrozenCoins,
      total_coins: totalCoins,
      users_with_earnings: usersWithEarnings,
      average_per_user: avgPerUser,
      total_logs: allLogs.length,
      unique_users: byUser.size
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});