import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email, dry_run = false } = await req.json();
    
    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🗑️  REMOVING ADMIN_ADJUSTMENT TRANSACTIONS FOR: ${user_email}`);
    console.log(`   Dry Run: ${dry_run ? 'YES ✅' : 'NO ❌'}`);
    console.log(`${'='.repeat(80)}\n`);

    // Get all admin_adjustment transactions
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: user_email,
      type: 'admin_adjustment'
    }, '-created_date', 1000);

    console.log(`📊 Found ${allTxs.length} admin_adjustment transactions`);

    const totalAmount = allTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    console.log(`💰 Total amount: ${totalAmount.toLocaleString()}`);

    // Show sample transactions
    console.log(`\n📋 Sample transactions:`);
    allTxs.slice(0, 5).forEach(tx => {
      console.log(`   - ${tx.amount.toLocaleString()} | ${tx.description} | ${tx.created_date}`);
    });

    let deletedCount = 0;
    
    if (!dry_run) {
      console.log(`\n🗑️  Deleting ${allTxs.length} transactions...`);
      
      for (const tx of allTxs) {
        try {
          await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
          deletedCount++;
          if (deletedCount % 10 === 0) {
            console.log(`   Deleted ${deletedCount}/${allTxs.length}`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to delete ${tx.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Deleted ${deletedCount} transactions`);
      
      // Recalculate balance
      console.log(`\n🔄 Recalculating balance...`);
      
      // Get all audit logs
      const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
        user_email: user_email
      }, '-question_date', 10000);
      
      const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
      const frozenLogs = allLogs.filter(log => 
        log.exclusion_reason === 'duplicate' || log.exclusion_reason === 'greeting'
      );
      
      const validCoins = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      const frozenCoins = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      // Get remaining transactions (excluding deleted admin_adjustment)
      const remainingTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
        user_email: user_email
      }, '-created_date', 10000);
      
      const recoveryTxs = remainingTxs.filter(tx => 
        tx.type === 'bounty_reward' && tx.description?.startsWith('Recovery:')
      );
      const manualTxs = remainingTxs.filter(tx => tx.type === 'manual_add');
      const deductTxs = remainingTxs.filter(tx => tx.type === 'manual_deduct');
      
      const validQuestions = new Set(validLogs.map(log => (log.question_text || '').trim().toLowerCase()));
      
      let validRecovery = 0;
      for (const tx of recoveryTxs) {
        const question = tx.description.replace('Recovery: ', '').trim().toLowerCase();
        if (!validQuestions.has(question)) {
          validRecovery += tx.amount || 0;
        }
      }
      
      const manualTotal = manualTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const deductTotal = deductTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      
      // Calculate new balance
      const newNetValid = validCoins + validRecovery + manualTotal - deductTotal;
      const newTotalEarned = newNetValid + frozenCoins;
      
      // Get withdrawals
      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
        user_email: user_email,
        status: 'completed'
      }, '-created_date', 1000);
      
      const paidAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
      const newAvailable = newNetValid - paidAmount;
      
      console.log(`   New Total Earned: ${newTotalEarned.toLocaleString()}`);
      console.log(`   New Net Valid: ${newNetValid.toLocaleString()}`);
      console.log(`   New Frozen: ${frozenCoins.toLocaleString()}`);
      console.log(`   New Available: ${newAvailable.toLocaleString()}`);
      
      // Update balance
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
        user_email: user_email
      });
      
      if (balances.length > 0) {
        await base44.asServiceRole.entities.CamlycoinBalance.update(balances[0].id, {
          total_earned: newTotalEarned,
          net_valid_coins: newNetValid,
          frozen_balance: frozenCoins,
          paid_amount: paidAmount,
          available_for_withdrawal: newAvailable
        });
        console.log(`✅ Balance updated successfully!`);
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);

    return Response.json({
      success: true,
      user_email,
      dry_run,
      summary: {
        admin_adjustment_count: allTxs.length,
        admin_adjustment_total: totalAmount,
        deleted_count: deletedCount
      },
      sample_transactions: allTxs.slice(0, 10).map(tx => ({
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        created_date: tx.created_date
      }))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});