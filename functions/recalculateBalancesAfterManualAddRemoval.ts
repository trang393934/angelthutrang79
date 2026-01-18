import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_emails = [] } = await req.json();
    
    console.log(`\n🔄 Recalculating balances for ${user_emails.length || 'ALL'} users...\n`);
    
    let targetUsers = user_emails;
    
    // If no specific users provided, get all users with balances
    if (targetUsers.length === 0) {
      const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({}, '-updated_date', 10000);
      targetUsers = allBalances.map(b => b.user_email);
      console.log(`   Found ${targetUsers.length} users to update`);
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < targetUsers.length; i++) {
      const userEmail = targetUsers[i];
      
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
          successCount++;
        }
        
        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${targetUsers.length} (${successCount} success, ${errorCount} errors)`);
        }
        
        // Add delay to avoid rate limit - increased for safety
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay after each user
        
        if ((i + 1) % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Longer delay every 3 users
        }
        
      } catch (error) {
        errorCount++;
        errors.push({ email: userEmail, error: error.message });
        console.error(`   ❌ ${userEmail}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Completed: ${successCount} success, ${errorCount} errors\n`);

    return Response.json({
      success: true,
      summary: {
        total_users: targetUsers.length,
        success_count: successCount,
        error_count: errorCount
      },
      errors: errors.slice(0, 20) // Return first 20 errors
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});