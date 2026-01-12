import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'Missing target_email' }, { status: 400 });
    }

    console.log(`\n🧹 CLEAN DUPLICATES: ${target_email}`);

    // Lấy tất cả logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-created_date',
      5000
    );

    console.log(`\n📊 Tổng logs trước: ${allLogs.length}`);

    // Chiến lược: Giữ log đầu tiên (theo created_date), xóa những cái sau
    // Dùng transaction_id làm key vì đó là nguồn gốc trùng lặp chính
    
    const txIdMap = new Map();
    const logsToKeep = [];
    const logsToDelete = [];

    // Sắp xếp theo created_date (cũ nhất trước)
    const sortedLogs = [...allLogs].sort((a, b) => 
      new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    );

    sortedLogs.forEach(log => {
      const key = log.transaction_id || log.id;
      
      if (!txIdMap.has(key)) {
        txIdMap.set(key, true);
        logsToKeep.push(log);
      } else {
        logsToDelete.push(log);
      }
    });

    console.log(`\n✅ Logs sẽ giữ: ${logsToKeep.length}`);
    console.log(`❌ Logs sẽ xóa: ${logsToDelete.length}`);

    // Xóa logs trùng lặp
    let deletedCount = 0;
    for (const log of logsToDelete) {
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(log.id);
        deletedCount++;
      } catch (err) {
        console.log(`⚠️ Lỗi xóa ${log.id}:`, err.message);
      }
    }

    console.log(`\n🗑️ Đã xóa: ${deletedCount} logs`);

    // Recalculate balance từ logs sạch
    let newValidCoins = 0;
    let newFrozenCoins = 0;

    logsToKeep.forEach(log => {
      if (log.exclusion_reason === 'valid') {
        newValidCoins += log.coins_earned || 0;
      } else if (log.coin_category === 'frozen') {
        newFrozenCoins += log.coins_earned || 0;
      }
    });

    const newTotalEarned = newValidCoins + newFrozenCoins;

    console.log(`\n💰 BALANCE MỚI:`);
    console.log(`  net_valid_coins: ${newValidCoins}`);
    console.log(`  frozen_balance: ${newFrozenCoins}`);
    console.log(`  total_earned: ${newTotalEarned}`);

    // Update balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    const oldBalance = {
      total_earned: balance?.total_earned || 0,
      net_valid_coins: balance?.net_valid_coins || 0,
      frozen_balance: balance?.frozen_balance || 0,
      available_for_withdrawal: balance?.available_for_withdrawal || 0
    };

    const paid = balance?.paid_amount || 0;
    const newAvailable = newValidCoins - paid;

    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: newValidCoins,
      frozen_balance: newFrozenCoins,
      total_earned: newTotalEarned,
      available_for_withdrawal: newAvailable
    });

    console.log(`\n✅ HOÀN THÀNH`);
    console.log(`  Deleted: ${deletedCount} duplicate logs`);
    console.log(`  Remaining: ${logsToKeep.length} logs`);
    console.log(`  Old balance: ${oldBalance.total_earned}`);
    console.log(`  New balance: ${newTotalEarned}`);
    console.log(`  Correction: ${newTotalEarned - oldBalance.total_earned}`);

    return Response.json({
      success: true,
      user_email: target_email,
      deleted_logs: deletedCount,
      remaining_logs: logsToKeep.length,
      old_balance: oldBalance,
      new_balance: {
        net_valid_coins: newValidCoins,
        frozen_balance: newFrozenCoins,
        total_earned: newTotalEarned,
        available_for_withdrawal: newAvailable
      },
      correction: newTotalEarned - oldBalance.total_earned
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});