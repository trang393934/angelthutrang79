import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { dry_run = true, skip = 0, limit = 50 } = await req.json();
    
    console.log(`\n🔍 AUTO RECOVERY - Batch từ ${skip} đến ${skip + limit}${dry_run ? ' (DRY RUN)' : ''}\n`);
    
    // Get all users with balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({}, '-updated_date', skip + limit + 100);
    const batchBalances = allBalances.slice(skip, skip + limit);
    
    const recoveryNeeded = [];
    let processedCount = 0;
    let recoveredCount = 0;
    let totalRecovered = 0;
    
    for (const balance of batchBalances) {
      processedCount++;
      const userEmail = balance.user_email;
      
      try {
        // Get valid audit logs
        const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
          user_email: userEmail,
          exclusion_reason: 'valid'
        }, '-question_date', 1000);
        
        const validCoins = logs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        // Get all current transactions (excluding manual_add which were deleted)
        const txs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
          user_email: userEmail
        }, '-created_date', 1000);
        
        const recoveryTxs = txs.filter(tx => 
          tx.type === 'bounty_reward' && tx.description?.startsWith('Recovery:')
        );
        const adminTxs = txs.filter(tx => tx.type === 'admin_adjustment');
        const deductTxs = txs.filter(tx => tx.type === 'manual_deduct');
        
        // Calculate valid recovery (recovery txs not in audit logs)
        const validQuestions = new Set(logs.map(log => (log.question_text || '').trim().toLowerCase()));
        
        let validRecovery = 0;
        for (const tx of recoveryTxs) {
          const question = tx.description.replace('Recovery: ', '').trim().toLowerCase();
          if (!validQuestions.has(question)) {
            validRecovery += tx.amount || 0;
          }
        }
        
        const adminTotal = adminTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const deductTotal = deductTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        // Calculate expected net_valid_coins
        const expectedNetValid = validCoins + validRecovery + adminTotal - deductTotal;
        const currentNetValid = balance.net_valid_coins || 0;
        
        // Calculate discrepancy
        const discrepancy = expectedNetValid - currentNetValid;
        
        // Only recover if discrepancy > 1000 (to avoid small rounding errors)
        if (discrepancy > 1000) {
          recoveryNeeded.push({
            user_email: userEmail,
            current_net_valid: currentNetValid,
            expected_net_valid: expectedNetValid,
            discrepancy: discrepancy,
            valid_audit_coins: validCoins,
            valid_recovery: validRecovery,
            admin_adjustments: adminTotal,
            deductions: deductTotal,
            current_total_earned: balance.total_earned || 0,
            frozen_balance: balance.frozen_balance || 0
          });
          
          if (!dry_run) {
            // Create recovery transaction
            await base44.asServiceRole.entities.CamlycoinTransaction.create({
              user_email: userEmail,
              amount: discrepancy,
              type: 'admin_adjustment',
              description: `🔄 Auto Recovery - Khôi phục ${discrepancy.toLocaleString()} coins sau audit hệ thống. Expected: ${expectedNetValid.toLocaleString()}, Current: ${currentNetValid.toLocaleString()}`,
              reference_id: `auto_recovery_${userEmail}_${Date.now()}`,
              processed_by: user.email
            });
            
            // Get frozen balance from logs
            const frozenLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
              user_email: userEmail
            }, '-question_date', 1000);
            
            const frozenCoins = frozenLogs
              .filter(log => log.exclusion_reason === 'duplicate' || log.exclusion_reason === 'greeting')
              .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
            
            // Get withdrawals
            const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
              user_email: userEmail,
              status: 'completed'
            }, '-created_date', 1000);
            
            const paidAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
            
            // Calculate new values
            const newNetValid = expectedNetValid;
            const newTotalEarned = newNetValid + frozenCoins;
            const newAvailable = newNetValid - paidAmount;
            
            // Update balance
            await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
              total_earned: newTotalEarned,
              net_valid_coins: newNetValid,
              frozen_balance: frozenCoins,
              paid_amount: paidAmount,
              available_for_withdrawal: newAvailable
            });
            
            recoveredCount++;
            totalRecovered += discrepancy;
            
            console.log(`   ✅ ${processedCount}/${batchBalances.length}: ${userEmail} - Recovered ${discrepancy.toLocaleString()} coins`);
          } else {
            console.log(`   📋 ${processedCount}/${batchBalances.length}: ${userEmail} - Would recover ${discrepancy.toLocaleString()} coins`);
          }
          
          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          console.log(`   ✓ ${processedCount}/${batchBalances.length}: ${userEmail} - OK (discrepancy: ${discrepancy})`);
        }
        
      } catch (error) {
        console.error(`   ❌ ${userEmail}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Batch completed: ${recoveryNeeded.length} users need recovery`);
    if (!dry_run) {
      console.log(`   Recovered: ${recoveredCount} users, Total: ${totalRecovered.toLocaleString()} coins\n`);
    }

    return Response.json({
      success: true,
      dry_run,
      batch_info: {
        skip,
        limit,
        processed: processedCount
      },
      summary: {
        users_need_recovery: recoveryNeeded.length,
        recovered_count: recoveredCount,
        total_recovered: totalRecovered
      },
      recovery_details: recoveryNeeded.slice(0, 20) // First 20 for preview
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});