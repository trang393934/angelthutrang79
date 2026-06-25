import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('⏸️ Pausing all in-flight withdrawal requests...');

    // Get pending and approved (not yet on blockchain)
    const pending = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'pending' 
    }, '-created_date', 5000);

    const processing = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'processing' 
    }, '-created_date', 5000);

    const approved = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'approved' 
    }, '-created_date', 5000);

    let pausedCount = 0;
    let errorCount = 0;

    // Update all to a "paused" status by creating a marker
    for (const withdrawal of [...pending, ...processing, ...approved]) {
      try {
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'pending',
          rejection_reason: 'SYSTEM MAINTENANCE - All withdrawals paused for data integrity check. Expected reopen: 20:00 Jan 18, 2026',
          requires_manual_review: true
        });
        
        // Create admin log
        await base44.asServiceRole.entities.AdminAlert.create({
          alert_type: 'high_balance',
          severity: 'medium',
          title: `⏸️ Withdrawal Paused - ${withdrawal.user_email}`,
          message: `Withdrawal of ${withdrawal.amount} Camly paused for system maintenance`,
          user_email: withdrawal.user_email,
          data: {
            withdrawal_id: withdrawal.id,
            amount: withdrawal.amount,
            reason: 'System maintenance'
          }
        });

        pausedCount++;
      } catch (error) {
        errorCount++;
        console.log(`❌ Error pausing ${withdrawal.user_email}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      summary: {
        pending_paused: pending.length,
        processing_paused: processing.length,
        approved_paused: approved.length,
        total_paused: pausedCount,
        errors: errorCount
      },
      status: '✅ All withdrawals paused'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});