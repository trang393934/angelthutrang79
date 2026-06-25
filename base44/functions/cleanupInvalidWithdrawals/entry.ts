import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🧹 Starting cleanup of invalid withdrawal requests...');

    // Get all withdrawal requests (pending, approved, processing)
    const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 10000);
    const activeWithdrawals = allWithdrawals.filter(w => 
      w.status === 'pending' || w.status === 'approved' || w.status === 'processing'
    );

    // Get all user balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000);

    const cleanupResults = [];
    let totalRejected = 0;
    let totalRestored = 0;

    for (const withdrawal of activeWithdrawals) {
      const userBalance = allBalances.find(b => b.user_email === withdrawal.user_email);

      if (!userBalance) {
        // User không có balance → reject ngay
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'rejected',
          rejection_reason: '🧹 Auto-cleanup: User không có balance record',
          processed_by: 'auto_cleanup_system',
          processed_date: new Date().toISOString()
        });

        cleanupResults.push({
          email: withdrawal.user_email,
          amount: withdrawal.amount,
          reason: 'No balance record',
          action: 'rejected'
        });
        totalRejected++;
        continue;
      }

      // Check if withdrawal amount > available_balance
      const availableBalance = userBalance.available_balance || 0;
      
      if (withdrawal.amount > availableBalance) {
        // INVALID WITHDRAWAL → Reject + Restore balance
        console.log(`❌ Invalid withdrawal: ${withdrawal.user_email} requested ${withdrawal.amount} but only has ${availableBalance} available`);

        // Calculate restore amount (tùy vào status đã trừ chưa)
        let restoreAmount = 0;
        
        // Nếu đã approved/processing nghĩa là có thể đã trừ balance rồi
        // Nhưng với logic mới, available_balance chỉ bị trừ khi TẠO request (status = pending)
        // Vậy tất cả pending/approved/processing ĐỀU ĐÃ TRỪ available_balance rồi
        // → Cần HOÀN LẠI
        
        restoreAmount = withdrawal.amount;

        // Hoàn lại available_balance
        await base44.asServiceRole.entities.CamlycoinBalance.update(userBalance.id, {
          available_balance: availableBalance + restoreAmount
        });

        // Reject withdrawal request
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'rejected',
          rejection_reason: `🧹 Auto-cleanup: Yêu cầu rút ${withdrawal.amount.toLocaleString()} > Available balance ${availableBalance.toLocaleString()}. Đã hoàn lại ${restoreAmount.toLocaleString()} Camlycoin.`,
          processed_by: 'auto_cleanup_system',
          processed_date: new Date().toISOString()
        });

        // Create transaction log
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: withdrawal.user_email,
          amount: 0,
          type: 'admin_adjustment',
          description: `🧹 AUTO CLEANUP: Hủy yêu cầu rút ${withdrawal.amount.toLocaleString()} (vượt available ${availableBalance.toLocaleString()})\n💰 Hoàn lại ${restoreAmount.toLocaleString()} → Available balance`,
          processed_by: 'auto_cleanup_system'
        });

        cleanupResults.push({
          email: withdrawal.user_email,
          amount: withdrawal.amount,
          available: availableBalance,
          restored: restoreAmount,
          reason: 'Amount > available_balance',
          action: 'rejected_and_restored'
        });

        totalRejected++;
        totalRestored += restoreAmount;
      }
    }

    console.log(`✅ Cleanup completed: ${totalRejected} withdrawals rejected, ${totalRestored.toLocaleString()} Camlycoin restored`);

    return Response.json({
      success: true,
      message: `Cleanup completed successfully`,
      summary: {
        total_active_withdrawals: activeWithdrawals.length,
        total_rejected: totalRejected,
        total_restored: totalRestored,
      },
      details: cleanupResults
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});