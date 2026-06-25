import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Auditing withdrawal requests in-flight...');

    // Get all pending withdrawals
    const pending = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'pending' 
    }, '-created_date', 5000);

    const processing = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'processing' 
    }, '-created_date', 5000);

    const approved = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'approved' 
    }, '-created_date', 5000);

    // Check for blockchain txs
    const withTxHash = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'completed' 
    }, '-created_date', 5000);

    const txOnBlockchain = withTxHash.filter(w => w.tx_hash && w.tx_hash.length > 0);

    console.log(`\n📊 Withdrawal Status Breakdown:`);
    console.log(`  🟡 Pending: ${pending.length}`);
    console.log(`  🟠 Processing: ${processing.length}`);
    console.log(`  🟢 Approved: ${approved.length}`);
    console.log(`  ✅ Completed with TX: ${txOnBlockchain.length}`);
    console.log(`  ⚠️ CRITICAL IN-FLIGHT (Processing + Approved): ${processing.length + approved.length}`);

    const totalAmount = [...pending, ...processing, ...approved].reduce((sum, w) => sum + (w.amount || 0), 0);
    const blockchainAmount = txOnBlockchain.reduce((sum, w) => sum + (w.amount || 0), 0);

    console.log(`\n💰 Amount Breakdown:`);
    console.log(`  Total pending/processing/approved: ${totalAmount.toLocaleString()} Camly`);
    console.log(`  Already on blockchain: ${blockchainAmount.toLocaleString()} Camly`);

    // Get top in-flight requests
    const inFlight = [...processing, ...approved].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 20);

    return Response.json({
      success: true,
      summary: {
        pending_count: pending.length,
        processing_count: processing.length,
        approved_count: approved.length,
        completed_with_tx: txOnBlockchain.length,
        critical_in_flight: processing.length + approved.length,
        total_pending_amount: totalAmount,
        amount_on_blockchain: blockchainAmount
      },
      critical_in_flight_requests: inFlight.map(w => ({
        email: w.user_email,
        amount: w.amount,
        status: w.status,
        tx_hash: w.tx_hash || 'pending',
        created_date: w.created_date
      })),
      action_required: processing.length + approved.length > 0 ? 'YES - Pause immediately' : 'No critical in-flight'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});