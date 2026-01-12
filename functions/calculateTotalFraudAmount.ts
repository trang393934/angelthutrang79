import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Bắt đầu tính toán tổng gian lận...');

    // Lấy tất cả balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      {},
      '-total_earned',
      5000
    );

    // Lấy tất cả transactions
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { type: 'manual_add' },
      '-created_date',
      10000
    );

    // Lấy tất cả audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      {},
      '-created_date',
      10000
    );

    console.log(`📊 Tổng balances: ${allBalances.length}`);
    console.log(`💳 Tổng manual_add transactions: ${allTransactions.length}`);
    console.log(`📝 Tổng audit logs: ${allLogs.length}`);

    const fraudAccounts = [];
    let totalFraudAmount = 0;

    // Phân tích từng user
    for (const balance of allBalances) {
      const email = balance.user_email;
      const userTransactions = allTransactions.filter(tx => tx.user_email === email);
      const userLogs = allLogs.filter(log => log.user_email === email);

      if (userTransactions.length === 0) continue;

      // Tính coins từ logs
      const calculatedEarned = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

      // Tính tổng manual_add
      const totalManualAdd = userTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

      // Các dấu hiệu gian lận
      const isSelfAdded = userTransactions.some(tx => 
        tx.created_by === email && (!tx.processed_by || tx.processed_by === email)
      );

      const hasHighRatio = totalManualAdd > calculatedEarned * 2;
      const hasManyManualAdds = userTransactions.length > 20;

      if (isSelfAdded || hasHighRatio || hasManyManualAdds) {
        // Tính fraud amount = manual_add mà vượt quá earned từ logs
        const fraudAmount = Math.max(0, totalManualAdd - calculatedEarned);

        fraudAccounts.push({
          email,
          total_manual_add: totalManualAdd,
          calculated_from_logs: calculatedEarned,
          fraud_amount: fraudAmount,
          manual_add_count: userTransactions.length,
          reasons: [
            isSelfAdded && '❌ Tự thêm coins cho mình',
            hasHighRatio && '⚠️ Manual_add gấp đôi earned',
            hasManyManualAdds && '⏰ Quá nhiều manual_add'
          ].filter(Boolean)
        });

        totalFraudAmount += fraudAmount;
      }
    }

    // Sắp xếp theo fraud_amount
    fraudAccounts.sort((a, b) => b.fraud_amount - a.fraud_amount);

    console.log(`\n📊 KẾT QUẢ TÍNH TOÁN GIAN LẬN:`);
    console.log(`❌ Tổng tài khoản gian lận: ${fraudAccounts.length}`);
    console.log(`💰 TỔNG CAMLYCOIN GIA LẬN: ${totalFraudAmount.toLocaleString('vi-VN')} coins`);
    console.log(`📈 Trung bình mỗi account: ${Math.round(totalFraudAmount / fraudAccounts.length).toLocaleString('vi-VN')} coins`);

    return Response.json({
      success: true,
      summary: {
        total_fraud_accounts: fraudAccounts.length,
        total_fraud_amount: totalFraudAmount,
        average_per_account: Math.round(totalFraudAmount / fraudAccounts.length),
        top_10_fraudsters: fraudAccounts.slice(0, 10)
      },
      all_fraud_accounts: fraudAccounts
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});