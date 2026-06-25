import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { dry_run = true } = await req.json();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🗑️  REMOVING ALL MANUAL_ADD REWARD TRANSACTIONS`);
    console.log(`   Dry Run: ${dry_run ? 'YES ✅' : 'NO ❌ - LIVE RUN'}`);
    console.log(`${'='.repeat(80)}\n`);

    // Get ALL manual_add transactions
    console.log('📊 Fetching all manual_add transactions...');
    const allManualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      type: 'manual_add'
    }, '-created_date', 100000);

    console.log(`   Found ${allManualAdds.length} manual_add transactions`);

    const totalAmount = allManualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    console.log(`   Total amount: ${totalAmount.toLocaleString()}`);

    // Group by user
    const byUser = {};
    for (const tx of allManualAdds) {
      if (!byUser[tx.user_email]) {
        byUser[tx.user_email] = {
          count: 0,
          total: 0
        };
      }
      byUser[tx.user_email].count++;
      byUser[tx.user_email].total += tx.amount || 0;
    }

    console.log(`\n📋 Affected users: ${Object.keys(byUser).length}`);
    console.log(`   Top 10 users:`);
    const sorted = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    sorted.forEach(([email, data]) => {
      console.log(`      ${email}: ${data.count} txs, ${data.total.toLocaleString()} coins`);
    });

    if (!dry_run) {
      console.log(`\n🗑️  DELETING ${allManualAdds.length} transactions...`);
      
      let deletedCount = 0;
      const batchSize = 50;
      
      for (let i = 0; i < allManualAdds.length; i += batchSize) {
        const batch = allManualAdds.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (tx) => {
          try {
            await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
            deletedCount++;
          } catch (error) {
            console.error(`   ❌ Failed to delete ${tx.id}: ${error.message}`);
          }
        }));
        
        console.log(`   Progress: ${deletedCount}/${allManualAdds.length}`);
      }
      
      console.log(`✅ Deleted ${deletedCount} transactions`);
      
      // Recalculate all balances
      console.log(`\n🔄 Recalculating balances for ${Object.keys(byUser).length} users...`);
      
      let updatedCount = 0;
      for (const userEmail of Object.keys(byUser)) {
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
          
          // Get remaining transactions
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
          const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
            user_email: userEmail
          });
          
          if (balances.length > 0) {
            await base44.asServiceRole.entities.CamlycoinBalance.update(balances[0].id, {
              total_earned: newTotalEarned,
              net_valid_coins: newNetValid,
              frozen_balance: frozenCoins,
              paid_amount: paidAmount,
              available_for_withdrawal: newAvailable
            });
            updatedCount++;
          }
          
          if (updatedCount % 10 === 0) {
            console.log(`   Updated ${updatedCount}/${Object.keys(byUser).length} users`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to update ${userEmail}: ${error.message}`);
        }
      }
      
      console.log(`✅ Updated ${updatedCount} user balances`);
    }

    console.log(`\n${'='.repeat(80)}\n`);

    return Response.json({
      success: true,
      dry_run,
      summary: {
        total_transactions: allManualAdds.length,
        total_amount: totalAmount,
        affected_users: Object.keys(byUser).length,
        deleted_count: dry_run ? 0 : allManualAdds.length,
        updated_users: dry_run ? 0 : Object.keys(byUser).length
      },
      by_user: byUser
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});