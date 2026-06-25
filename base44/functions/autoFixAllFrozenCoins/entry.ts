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
    let errorCount = 0;

    for (let i = 0; i < allBalances.length; i++) {
      const balance = allBalances[i];
      
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
          console.log(`[${i + 1}/${allBalances.length}] 🔧 Fixing ${userEmail}: ${actualFrozen} → ${expectedFrozen}`);

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

        // Adaptive delay - 600ms cho bình thường, 1.2s khi có lỗi
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (error) {
        errorCount++;
        console.error(`❌ Error fixing ${balance.user_email} (${errorCount} errors):`, error.message);
        // Tăng delay khi có lỗi để cho hệ thống phục hồi
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    console.log(`\n✅ Complete! Fixed ${fixedCount} users, ${errorCount} errors, total coins adjusted: ${totalCoinsFixed.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        total_users_fixed: fixedCount,
        total_coins_adjusted: totalCoinsFixed,
        errors_encountered: errorCount
      },
      fixed_users: fixedUsers
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});