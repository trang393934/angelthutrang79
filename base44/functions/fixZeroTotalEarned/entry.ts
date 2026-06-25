import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Auth check - admin only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { batchSize = 50, skipCount = 0 } = await req.json();

    console.log(`🔧 Fixing users with total_earned = 0 (batch size: ${batchSize}, skip: ${skipCount})`);

    // Fetch all balances with total_earned = 0
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-updated_date', 10000);
    
    // Filter users with total_earned = 0 but have net_valid_coins or frozen_balance
    const usersToFix = allBalances.filter(b => 
      (b.total_earned === 0 || !b.total_earned) && 
      ((b.net_valid_coins > 0) || (b.frozen_balance > 0))
    );

    console.log(`📊 Found ${usersToFix.length} users to fix`);

    // Process batch
    const batch = usersToFix.slice(skipCount, skipCount + batchSize);
    console.log(`🔄 Processing batch: ${skipCount} to ${skipCount + batch.length}`);

    const results = [];
    
    for (const balance of batch) {
      const netValid = balance.net_valid_coins || 0;
      const frozen = balance.frozen_balance || 0;
      const newTotal = netValid + frozen;

      console.log(`\n🔍 ${balance.user_email}`);
      console.log(`  📊 OLD total_earned: ${balance.total_earned}`);
      console.log(`  💰 net_valid_coins: ${netValid}`);
      console.log(`  ❄️  frozen_balance: ${frozen}`);
      console.log(`  ✨ NEW total_earned: ${newTotal}`);

      if (newTotal > 0) {
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          total_earned: newTotal
        });
        
        results.push({
          user_email: balance.user_email,
          old_total: balance.total_earned,
          new_total: newTotal,
          net_valid: netValid,
          frozen: frozen
        });
        
        console.log(`  ✅ Updated!`);
      }
    }

    return Response.json({
      success: true,
      total_found: usersToFix.length,
      batch_processed: results.length,
      next_skip: skipCount + batchSize,
      has_more: (skipCount + batchSize) < usersToFix.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});