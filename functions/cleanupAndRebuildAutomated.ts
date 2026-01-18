import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🚀 Bắt đầu quy trình dọn dẹp + rebuild tự động\n');

    // PHASE 1: Xóa tất cả manual_add (nhanh hơn, batch lớn hơn)
    console.log('📍 PHASE 1: Xóa tất cả "manual add"...');
    let totalDeleted = 0;
    let round = 0;

    while (true) {
      round++;
      const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 10000);
      const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0);

      if (manualAdds.length === 0) {
        console.log('✅ Xóa xong! Không còn manual_add nào\n');
        break;
      }

      console.log(`   Round ${round}: Tìm thấy ${manualAdds.length} cái, đang xóa...`);

      // Xóa batch lớn (500 cái/round) để tiết kiệm thời gian
      const batchSize = 500;
      let roundDeleted = 0;
      let errors = 0;

      for (let i = 0; i < Math.min(manualAdds.length, batchSize); i++) {
        try {
          await base44.asServiceRole.entities.CamlycoinTransaction.delete(manualAdds[i].id);
          roundDeleted++;
          totalDeleted++;
        } catch (error) {
          errors++;
        }

        // Delay nhỏ hơn (100ms) để xóa nhanh hơn
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`   ✓ Xóa được ${roundDeleted} cái (${errors} lỗi)`);
      
      // Dừng 1s trước round kế để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`📊 Tổng xóa: ${totalDeleted} giao dịch\n`);

    // PHASE 2: Rebuild số dư tự động
    console.log('📍 PHASE 2: Rebuild số dư user...');
    
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ status: 'completed' });
    
    // Group audit logs by user
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

    // Group transactions by user
    const txByUser = {};
    transactions.forEach(tx => {
      if (!txByUser[tx.user_email]) {
        txByUser[tx.user_email] = 0;
      }
      if (['bounty_reward', 'build_reward'].includes(tx.type)) {
        txByUser[tx.user_email] += tx.amount || 0;
      }
    });

    // Group completed withdrawals
    const withdrawalByUser = {};
    withdrawals.forEach(w => {
      if (!withdrawalByUser[w.user_email]) {
        withdrawalByUser[w.user_email] = 0;
      }
      withdrawalByUser[w.user_email] += w.amount || 0;
    });

    // Update/create balances
    const existingBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-updated_date', 50000);
    let updated = 0;
    let created = 0;

    const allUsers = new Set([
      ...Object.keys(auditByUser),
      ...Object.keys(txByUser),
      ...Object.keys(withdrawalByUser),
      ...existingBalances.map(b => b.user_email)
    ]);

    for (const userEmail of allUsers) {
      const validCoins = (auditByUser[userEmail]?.valid || 0) + (txByUser[userEmail] || 0);
      const frozenCoins = auditByUser[userEmail]?.frozen || 0;
      const paidAmount = withdrawalByUser[userEmail] || 0;
      const netValidCoins = validCoins - frozenCoins;
      const availableForWithdrawal = Math.max(0, netValidCoins - paidAmount);

      const existingBalance = existingBalances.find(b => b.user_email === userEmail);

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

    console.log(`✅ Cập nhật ${updated} user, tạo mới ${created} user\n`);

    // PHASE 3: Gửi thông báo cho admin
    console.log('📍 PHASE 3: Gửi thông báo cho admin...');
    
    try {
      await base44.asServiceRole.entities.AdminAlert.create({
        alert_type: 'cleanup_completed',
        severity: 'info',
        message: `Quy trình dọn dẹp 'manual add' hoàn tất thành công!`,
        details: {
          deleted_transactions: totalDeleted,
          updated_users: updated,
          created_users: created,
          completed_at: new Date().toISOString()
        },
        status: 'new'
      });

      // Gửi email cho admin
      await base44.integrations.Core.SendEmail({
        to: 'trang393934@gmail.com',
        subject: '✅ Quy trình dọn dẹp dữ liệu hoàn tất',
        body: `Dọn dẹp tự động hoàn tất:\n\n- Xóa ${totalDeleted} giao dịch "manual add"\n- Cập nhật ${updated} user\n- Tạo mới ${created} user\n\nToàn bộ hệ thống đã được rebuild và cập nhật.`
      });

      console.log('✅ Đã gửi thông báo cho admin\n');
    } catch (error) {
      console.log('⚠️ Không thể gửi thông báo (không critical):', error.message);
    }

    console.log('🎉 QUY TRÌNH HOÀN TẤT!');
    return Response.json({
      success: true,
      deleted_transactions: totalDeleted,
      updated_users: updated,
      created_users: created,
      message: 'Dọn dẹp và rebuild hoàn tất thành công'
    });

  } catch (error) {
    console.error('❌ Lỗi:', error);

    // Gửi alert lỗi cho admin
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.AdminAlert.create({
        alert_type: 'cleanup_failed',
        severity: 'critical',
        message: `Quy trình dọn dẹp thất bại: ${error.message}`,
        status: 'new'
      });
    } catch (e) {
      console.log('Không thể tạo alert:', e.message);
    }

    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});