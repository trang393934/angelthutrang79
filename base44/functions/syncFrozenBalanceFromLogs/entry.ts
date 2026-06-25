import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('🔄 Starting frozen balance sync from audit logs...');

    // Get all audit logs
    const allLogs = await base44.entities.QuestionAuditLog.list('-created_date', 50000);
    console.log(`📊 Total logs: ${allLogs.length}`);

    // Calculate correct frozen balance per user from logs (using INTEGER)
    const correctFrozenByUser = {};
    allLogs.forEach(log => {
      if (log.exclusion_reason && log.exclusion_reason !== 'valid' && log.coin_category === 'frozen') {
        correctFrozenByUser[log.user_email] = (correctFrozenByUser[log.user_email] || 0) + Math.floor(log.coins_earned || 0);
      }
    });

    console.log(`👥 Users with frozen coins from logs: ${Object.keys(correctFrozenByUser).length}`);

    // Get all balances
    const allBalances = await base44.entities.CamlycoinBalance.list('-created_date', 10000);
    
    let updated = 0;
    let errors = 0;
    const updates = [];

    for (const balance of allBalances) {
      const correctFrozen = Math.floor(correctFrozenByUser[balance.user_email] || 0);
      const currentFrozen = Math.floor(balance.frozen_balance || 0);

      if (correctFrozen !== currentFrozen) {
        try {
          const newTotalEarned = Math.floor(balance.net_valid_coins || 0) + correctFrozen;
          
          await base44.entities.CamlycoinBalance.update(balance.id, {
            frozen_balance: correctFrozen,
            total_earned: newTotalEarned
          });

          updates.push({
            user_email: balance.user_email,
            old_frozen: currentFrozen,
            new_frozen: correctFrozen,
            difference: correctFrozen - currentFrozen
          });
          updated++;
          
          if (updated % 10 === 0) {
            console.log(`✅ Updated ${updated} users...`);
          }
        } catch (error) {
          console.error(`❌ Error updating ${balance.user_email}:`, error.message);
          errors++;
        }
      }
    }

    console.log(`✅ Sync completed: ${updated} updated, ${errors} errors`);

    return Response.json({
      success: true,
      summary: {
        total_checked: allBalances.length,
        updated: updated,
        errors: errors,
        total_logs_processed: allLogs.length
      },
      sample_updates: updates.slice(0, 20),
      message: `✅ Đã sync ${updated} users, frozen_balance hiện chính xác từ audit logs`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});