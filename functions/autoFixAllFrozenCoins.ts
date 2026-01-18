import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔧 Auto-fixing frozen coins for all users...');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    const fixedUsers = [];
    let fixedCount = 0;
    let totalCoinsFixed = 0;

    for (const balance of allBalances) {
      try {
        const userEmail = balance.user_email;
        
        // Tính expected frozen từ audit logs
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        const frozenLogs = allLogs.filter(log => log.exclusion_reason !== 'valid');
        const expectedFrozen = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        const actualFrozen = balance.frozen_balance || 0;
        const difference = expectedFrozen - actualFrozen;

        if (Math.abs(difference) > 0) {
          console.log(`\n🔧 Fixing ${userEmail}: ${actualFrozen} → ${expectedFrozen}`);

          // Update frozen balance
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            frozen_balance: expectedFrozen,
            total_earned: balance.net_valid_coins + expectedFrozen,
            available_for_withdrawal: balance.net_valid_coins - (balance.paid_amount || 0)
          });

          // Log the fix
          await base44.asServiceRole.entities.CamlycoinTransaction.create({
            user_email: userEmail,
            amount: 0,
            type: 'admin_adjustment',
            description: `✅ Auto-fix frozen balance: ${actualFrozen} → ${expectedFrozen} (${difference > 0 ? '+' : ''}${difference})`,
            processed_by: user.email
          });

          fixedUsers.push({
            email: userEmail,
            previous_frozen: actualFrozen,
            new_frozen: expectedFrozen,
            difference: difference
          });

          fixedCount++;
          totalCoinsFixed += Math.abs(difference);
        }

        // Delay 800ms để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (error) {
        console.error(`Error fixing ${balance.user_email}:`, error.message);
      }
    }

    console.log(`\n✅ Complete! Fixed ${fixedCount} users, total coins adjusted: ${totalCoinsFixed.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        total_users_fixed: fixedCount,
        total_coins_adjusted: totalCoinsFixed
      },
      fixed_users: fixedUsers
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});