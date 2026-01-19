import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🚀 Bắt đầu batch cleanup + rebuild...\n');

    // PHASE 1: Xóa batch manual_add (50 cái)
    console.log('📍 PHASE 1: Xóa 50 manual_add đầu tiên...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 1000);
    const manualAdds = allTransactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0);
    
    console.log(`   Tìm thấy ${manualAdds.length} manual_add còn lại`);
    
    const toDelete = manualAdds.slice(0, 50);
    let deleted = 0;
    
    for (const tx of toDelete) {
      try {
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
        deleted++;
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.log(`   ⚠️ Lỗi xóa ${tx.id}: ${e.message}`);
      }
    }
    
    console.log(`✅ Đã xóa ${deleted}/${toDelete.length}\n`);

    // PHASE 2: Rebuild 20 users đầu tiên
    console.log('📍 PHASE 2: Rebuild 20 users...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 500);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 500);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ status: 'completed' });
    
    // Group by user
    const auditByUser = {};
    auditLogs.forEach(log => {
      if (!auditByUser[log.user_email]) {
        auditByUser[log.user_email] = { valid: 0, frozen: 0 };
      }
      if (log.exclusion_reason === 'valid') {
        auditByUser[log.user_email].valid += log.coins_earned || 0;
      } else if (['duplicate', 'greeting', 'exceeds_daily_limit'].includes(log.exclusion_reason)) {
        auditByUser[log.user_email].frozen += log.coins_earned || 0;
      }
    });

    const txByUser = {};
    transactions.forEach(tx => {
      if (!txByUser[tx.user_email]) {
        txByUser[tx.user_email] = 0;
      }
      if (['bounty_reward', 'build_reward'].includes(tx.type)) {
        txByUser[tx.user_email] += tx.amount || 0;
      }
    });

    const withdrawalByUser = {};
    withdrawals.forEach(w => {
      if (!withdrawalByUser[w.user_email]) {
        withdrawalByUser[w.user_email] = 0;
      }
      withdrawalByUser[w.user_email] += w.amount || 0;
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    const existingBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-updated_date', 500);
    
    const allUsers = new Set([
      ...Object.keys(auditByUser),
      ...Object.keys(txByUser),
      ...Object.keys(withdrawalByUser),
      ...existingBalances.map(b => b.user_email)
    ]);

    // Chỉ xử lý 20 users đầu
    const usersToProcess = Array.from(allUsers).slice(0, 20);
    let updated = 0;
    let created = 0;

    for (const userEmail of usersToProcess) {
      const validCoins = (auditByUser[userEmail]?.valid || 0) + (txByUser[userEmail] || 0);
      const frozenCoins = auditByUser[userEmail]?.frozen || 0;
      const paidAmount = withdrawalByUser[userEmail] || 0;
      const netValidCoins = validCoins - frozenCoins;
      const availableForWithdrawal = Math.max(0, netValidCoins - paidAmount);

      const existingBalance = existingBalances.find(b => b.user_email === userEmail);

      await new Promise(resolve => setTimeout(resolve, 500));

      if (existingBalance) {
        await base44.asServiceRole.entities.CamlycoinBalance.update(existingBalance.id, {
          net_valid_coins: netValidCoins,
          frozen_balance: frozenCoins,
          total_earned: validCoins,
          paid_amount: paidAmount,
          available_for_withdrawal: availableForWithdrawal
        });
        updated++;
      } else {
        await base44.asServiceRole.entities.CamlycoinBalance.create({
          user_email: userEmail,
          net_valid_coins: netValidCoins,
          frozen_balance: frozenCoins,
          total_earned: validCoins,
          paid_amount: paidAmount,
          available_for_withdrawal: availableForWithdrawal
        });
        created++;
      }
    }

    console.log(`✅ Cập nhật ${updated} users, tạo mới ${created} users\n`);

    const remaining = manualAdds.length - deleted;
    const needMoreRounds = remaining > 0 || allUsers.size > 20;

    return Response.json({
      success: true,
      deleted_transactions: deleted,
      remaining_manual_adds: remaining,
      updated_users: updated,
      created_users: created,
      total_users_found: allUsers.size,
      need_more_rounds: needMoreRounds,
      message: needMoreRounds 
        ? `Batch hoàn tất! Còn ${remaining} manual_add và ${allUsers.size - 20} users. Chạy lại để tiếp tục.`
        : 'Hoàn tất tất cả!'
    });

  } catch (error) {
    console.error('❌ Lỗi:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});