import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { skip = 0, limit = 20 } = await req.json();
    
    console.log(`\n🔄 Recalculating balances - Batch from ${skip} to ${skip + limit}...\n`);
    
    // Get batch of users
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({}, '-updated_date', skip + limit);
    const batchBalances = allBalances.slice(skip, skip + limit);
    
    console.log(`   Processing ${batchBalances.length} users (${skip} to ${skip + batchBalances.length})`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < batchBalances.length; i++) {
      const userEmail = batchBalances[i].user_email;
      
      try {
        // Get all audit logs
        const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
          user_email: userEmail
        }, '-question_date', 10000);
        
        const validLogs = logs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = logs.filter(log => 
          log.exclusion_reason === 'duplicate' || log.exclusion_reason === 'greeting'
        );
        
        const validCoins = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const frozenCoins = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        // Get remaining transactions (NO manual_add)
        const txs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
          user_email: userEmail
        }, '-created_date', 10000);
        
        const recoveryTxs = txs.filter(tx => 
          tx.type === 'bounty_reward' && tx.description?.startsWith('Recovery:')
        );
        const adminTxs = txs.filter(tx => tx.type === 'admin_adjustment');
        const deductTxs = txs.filter(tx => tx.type === 'manual_deduct');
        
        const validQuestions = new Set(validLogs.map(log => (log.question_text || '').trim().toLowerCase()));
        
        let validRecovery = 0;
        for (const tx of recoveryTxs) {
          const question = tx.description.replace('Recovery: ', '').trim().toLowerCase();
          if (!validQuestions.has(question)) {
            validRecovery += tx.amount || 0;
          }
        }
        
        const adminTotal = adminTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const deductTotal = deductTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        // Calculate new balance (NO manual_add anymore)
        const newNetValid = validCoins + validRecovery + adminTotal - deductTotal;
        const newTotalEarned = newNetValid + frozenCoins;
        
        // Get withdrawals
        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
          user_email: userEmail,
          status: 'completed'
        }, '-created_date', 1000);
        
        const paidAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
        const newAvailable = newNetValid - paidAmount;
        
        // Update balance
        await base44.asServiceRole.entities.CamlycoinBalance.update(batchBalances[i].id, {
          total_earned: newTotalEarned,
          net_valid_coins: newNetValid,
          frozen_balance: frozenCoins,
          paid_amount: paidAmount,
          available_for_withdrawal: newAvailable
        });
        
        successCount++;
        console.log(`   ✅ ${i + 1}/${batchBalances.length}: ${userEmail}`);
        
        // Small delay to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        errorCount++;
        errors.push({ email: userEmail, error: error.message });
        console.error(`   ❌ ${userEmail}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Batch completed: ${successCount} success, ${errorCount} errors\n`);

    return Response.json({
      success: true,
      batch_info: {
        skip,
        limit,
        processed: batchBalances.length
      },
      summary: {
        success_count: successCount,
        error_count: errorCount
      },
      errors
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});