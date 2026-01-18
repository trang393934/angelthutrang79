import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔄 Recovering manual_add to audit logs...');

    // Lấy tất cả manual_add transactions
    const manualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    }, '-created_date', 50000);

    console.log(`📊 Found ${manualAdds.length} manual_add transactions`);

    let createdLogs = 0;
    let updatedBalances = 0;
    let deletedTransactions = 0;
    let errorCount = 0;

    // Group by user để cộng gộp lại
    const byUser = {};
    for (const tx of manualAdds) {
      if (!byUser[tx.data.user_email]) {
        byUser[tx.data.user_email] = [];
      }
      byUser[tx.data.user_email].push(tx);
    }

    console.log(`Processing ${Object.keys(byUser).length} users...`);

    for (const [userEmail, txs] of Object.entries(byUser)) {
      try {
        // Tạo audit log entries từ manual_add transactions
        const totalCoins = txs.reduce((sum, tx) => sum + (tx.data.amount || 0), 0);

        // Tạo 1 entry audit log cho tất cả manual_add của user
        const auditLog = await base44.asServiceRole.entities.QuestionAuditLog.create({
          user_email: userEmail,
          question_text: `[Recovery] ${txs.length} questions - Manual rewards consolidated`,
          question_date: new Date().toISOString(),
          coins_earned: totalCoins,
          exclusion_reason: 'valid',
          coin_category: 'pending_withdrawal',
          transaction_id: `recovery_${userEmail}_${Date.now()}`
        });

        createdLogs++;

        // Update balance
        const balance = await base44.asServiceRole.entities.CamlycoinBalance.filter({
          user_email: userEmail
        });

        if (balance && balance.length > 0) {
          const bal = balance[0];
          const newNetValid = (bal.net_valid_coins || 0) + totalCoins;
          const newTotal = newNetValid + (bal.frozen_balance || 0);

          await base44.asServiceRole.entities.CamlycoinBalance.update(bal.id, {
            net_valid_coins: newNetValid,
            total_earned: newTotal,
            available_for_withdrawal: newNetValid - (bal.paid_amount || 0)
          });

          updatedBalances++;
        }

        // Delete manual_add transactions for this user
        for (const tx of txs) {
          try {
            await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
            deletedTransactions++;
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (e) {
            errorCount++;
          }
        }

        console.log(`✅ ${userEmail}: +${totalCoins.toLocaleString()} (${txs.length} TX recovered)`);
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errorCount++;
        console.error(`❌ Error for ${userEmail}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ RECOVERY COMPLETE:`);
    console.log(`- Audit logs created: ${createdLogs}`);
    console.log(`- Balances updated: ${updatedBalances}`);
    console.log(`- Transactions deleted: ${deletedTransactions}`);
    console.log(`- Errors: ${errorCount}`);

    return Response.json({
      success: true,
      summary: {
        audit_logs_created: createdLogs,
        balances_updated: updatedBalances,
        transactions_deleted: deletedTransactions,
        errors: errorCount,
        total_users_recovered: Object.keys(byUser).length,
        total_coins_recovered: Object.values(byUser).reduce((sum, txs) => 
          sum + txs.reduce((s, tx) => s + (tx.data.amount || 0), 0), 0
        )
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});