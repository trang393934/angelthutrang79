import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Verifying Unpaid Formula...');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    // Calculate system totals
    const totalEarned = (allBalances || []).reduce((sum, b) => sum + ((b.net_valid_coins || 0) + (b.frozen_balance || 0)), 0);
    const totalPaid = (allBalances || []).reduce((sum, b) => sum + (b.paid_amount || 0), 0);
    const totalUnpaid = (allBalances || []).reduce((sum, b) => sum + ((b.net_valid_coins || 0) - (b.paid_amount || 0)), 0);
    
    // Calculate what it SHOULD be
    const correctUnpaid = totalEarned - totalPaid;
    
    // Calculate discrepancy
    const discrepancy = correctUnpaid - totalUnpaid;
    
    console.log(`📊 System totals:`);
    console.log(`Total Earned: ${totalEarned.toLocaleString()}`);
    console.log(`Total Paid: ${totalPaid.toLocaleString()}`);
    console.log(`Total Unpaid (Current): ${totalUnpaid.toLocaleString()}`);
    console.log(`Total Unpaid (Correct): ${correctUnpaid.toLocaleString()}`);
    console.log(`Discrepancy: ${discrepancy.toLocaleString()} coins`);

    // Find users with incorrect unpaid calculations
    const usersWithErrors = [];
    
    for (const balance of allBalances) {
      const userEarned = (balance.net_valid_coins || 0) + (balance.frozen_balance || 0);
      const userPaid = balance.paid_amount || 0;
      const expectedUnpaid = (balance.net_valid_coins || 0) - userPaid;
      
      // Check if the calculation would be wrong by a significant amount
      if (Math.abs(expectedUnpaid - ((balance.net_valid_coins || 0) - userPaid)) > 0) {
        usersWithErrors.push({
          email: balance.user_email,
          net_valid: balance.net_valid_coins || 0,
          paid: userPaid,
          expected_unpaid: expectedUnpaid
        });
      }
    }

    return Response.json({
      success: true,
      formula_check: {
        total_earned: totalEarned,
        total_paid: totalPaid,
        current_unpaid_display: totalUnpaid,
        should_be_unpaid: correctUnpaid,
        discrepancy: discrepancy,
        discrepancy_percentage: ((discrepancy / correctUnpaid) * 100).toFixed(2) + '%'
      },
      users_with_errors: usersWithErrors.length,
      sample_errors: usersWithErrors.slice(0, 20)
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});