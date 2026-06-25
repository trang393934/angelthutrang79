import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔗 Checking blockchain transactions...');

    const completed = await base44.asServiceRole.entities.WithdrawalRequest.filter({ 
      status: 'completed' 
    }, '-updated_date', 5000);

    // Get only those with tx_hash
    const withHash = completed.filter(w => w.tx_hash && w.tx_hash.length > 0);

    // Try to verify a few recent ones (if we can)
    const recent = withHash.sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)).slice(0, 10);

    const summary = {
      total_completed: completed.length,
      with_tx_hash: withHash.length,
      without_tx_hash: completed.length - withHash.length,
      recent_txs: recent.map(w => ({
        user_email: w.user_email,
        amount: w.amount,
        tx_hash: w.tx_hash,
        completed_date: w.processed_date || w.updated_date,
        address: w.withdrawal_address ? `${w.withdrawal_address.substring(0, 10)}...` : 'unknown'
      }))
    };

    console.log(`\n📋 Blockchain Transaction Status:`);
    console.log(`  Total completed: ${summary.total_completed}`);
    console.log(`  With TX hash: ${summary.with_tx_hash}`);
    console.log(`  Without TX hash: ${summary.without_tx_hash}`);

    if (summary.with_tx_hash > 0) {
      console.log(`\n⚠️ ${summary.with_tx_hash} transactions already sent to blockchain!`);
      console.log(`   These cannot be reversed without blockchain rollback.`);
    }

    return Response.json({
      success: true,
      blockchain_status: summary,
      critical_warning: summary.with_tx_hash > 0 ? 
        `${summary.with_tx_hash} transactions already on blockchain - cannot be easily reversed` : 
        'No transactions on blockchain yet - safe to pause'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});