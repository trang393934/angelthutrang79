import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    // Get all user balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('', 10000);
    
    const results = [];
    
    for (const balance of allBalances) {
      const total = balance.total_earned || 0;
      const available = balance.available_balance || 0;
      const frozen = balance.frozen_balance || 0;
      const paid = balance.paid_amount || 0;
      const unpaid = balance.unpaid_amount || 0;
      const pendingReview = balance.pending_review_balance || 0;
      
      // Calculate pending amount: all earned coins not yet in available, frozen, or paid
      const calculatedPending = Math.max(0, total - available - frozen - paid);
      
      // Update balance to consolidate all pending amounts
      if (calculatedPending > 0 || unpaid > 0 || pendingReview > 0) {
        // Move all to available_balance
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          available_balance: available + calculatedPending + unpaid + pendingReview,
          unpaid_amount: 0,
          pending_review_balance: 0
        });
        
        results.push({
          user: balance.user_email,
          moved_to_available: calculatedPending + unpaid + pendingReview
        });
      }
    }

    return Response.json({ 
      success: true, 
      message: `Processed ${results.length} users`,
      results 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});