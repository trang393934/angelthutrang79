import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔧 Starting forced recalculation of total_earned...');

    // Fetch all balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    
    const fixedUsers = [];
    const errors = [];

    for (const balance of allBalances) {
      try {
        // Tính tổng thực tế từ các category
        const actualTotal = 
          (balance.available_balance || 0) +
          (balance.unpaid_amount || 0) +
          (balance.pending_review_balance || 0) +
          (balance.paid_amount || 0) +
          (balance.frozen_balance || 0);

        const currentTotalEarned = balance.total_earned || 0;

        // Nếu khác nhau, fix
        if (actualTotal !== currentTotalEarned) {
          console.log(`🔧 Fixing ${balance.user_email}: ${currentTotalEarned} → ${actualTotal}`);
          
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: actualTotal,
            balance: actualTotal - (balance.total_spent || 0)
          });

          fixedUsers.push({
            email: balance.user_email,
            old_total_earned: currentTotalEarned,
            new_total_earned: actualTotal,
            difference: actualTotal - currentTotalEarned
          });
        }
      } catch (error) {
        console.error(`❌ Error fixing ${balance.user_email}:`, error);
        errors.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    console.log(`✅ Forced recalculation completed: ${fixedUsers.length} users fixed`);

    return Response.json({
      success: true,
      report: {
        total_users: allBalances.length,
        fixed_users: fixedUsers,
        fixed_count: fixedUsers.length,
        errors: errors,
        error_count: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Forced recalculation error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});