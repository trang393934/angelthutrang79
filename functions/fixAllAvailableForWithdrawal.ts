import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔧 Fixing available_for_withdrawal for ALL users...');

    // Fetch all balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    console.log(`📊 Found ${allBalances.length} users`);

    let fixedCount = 0;
    let errorCount = 0;
    const fixed = [];

    for (const balance of allBalances) {
      try {
        const netValid = balance.net_valid_coins || 0;
        const paid = balance.paid_amount || 0;
        const currentAvailable = balance.available_for_withdrawal || 0;
        
        // Calculate correct available (allow negative)
        const correctAvailable = netValid - paid;
        
        // Only update if different
        if (Math.abs(currentAvailable - correctAvailable) > 0.01) {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            available_for_withdrawal: correctAvailable
          });
          
          fixedCount++;
          fixed.push({
            email: balance.user_email,
            old: currentAvailable,
            new: correctAvailable,
            formula: `${netValid} - ${paid} = ${correctAvailable}`
          });
          
          if (fixedCount % 10 === 0) {
            console.log(`Fixed ${fixedCount}/${allBalances.length}...`);
          }
        }
      } catch (error) {
        console.error(`Error fixing ${balance.user_email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ DONE: Fixed ${fixedCount} users, ${errorCount} errors`);

    return Response.json({
      success: true,
      total_users: allBalances.length,
      fixed_count: fixedCount,
      error_count: errorCount,
      fixed_users: fixed
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});