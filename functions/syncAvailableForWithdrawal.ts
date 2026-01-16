import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check admin authentication
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    console.log('🔄 Syncing available_for_withdrawal for all users...');

    // Fetch all balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);
    
    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const balance of allBalances) {
      try {
        const netValidCoins = balance.net_valid_coins || 0;
        const paidAmount = balance.paid_amount || 0;
        const correctAvailableForWithdrawal = netValidCoins - paidAmount;
        const currentAvailableForWithdrawal = balance.available_for_withdrawal || 0;

        // Only update if different
        if (currentAvailableForWithdrawal !== correctAvailableForWithdrawal) {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            available_for_withdrawal: Math.max(0, correctAvailableForWithdrawal)
          });

          results.push({
            email: balance.user_email,
            old: currentAvailableForWithdrawal,
            new: correctAvailableForWithdrawal,
            difference: correctAvailableForWithdrawal - currentAvailableForWithdrawal
          });

          successCount++;
          console.log(`✅ ${balance.user_email}: ${currentAvailableForWithdrawal} → ${correctAvailableForWithdrawal}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating ${balance.user_email}:`, error.message);
        results.push({
          email: balance.user_email,
          error: error.message
        });
      }
    }

    console.log(`\n✅ Sync completed: ${successCount} updated, ${errorCount} errors`);

    return Response.json({
      success: true,
      summary: {
        total: allBalances.length,
        updated: successCount,
        errors: errorCount
      },
      results: results.slice(0, 50) // Return first 50 results
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});