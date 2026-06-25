import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('💰 Tính toán tổng gian lận (phiên bản tối ưu)...');

    // Lấy tất cả balances - chỉ các trường cần thiết
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      {},
      '-total_earned',
      1000
    );

    console.log(`📊 Đang phân tích ${allBalances.length} tài khoản...`);

    const fraudAccounts = [];
    let totalFraudAmount = 0;
    let processedCount = 0;

    // Phân tích từng user một (batch nhỏ để tránh timeout)
    for (const balance of allBalances) {
      try {
        const email = balance.user_email;

        // Lấy transactions của user này
        const userTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
          { user_email: email, type: 'manual_add' },
          '-created_date',
          500
        );

        if (userTransactions.length === 0) {
          processedCount++;
          continue;
        }

        // Lấy audit logs của user này
        const userLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
          { user_email: email },
          '-created_date',
          500
        );

        // Tính coins từ logs
        const calculatedEarned = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Tính tổng manual_add
        const totalManualAdd = userTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        // Kiểm tra dấu hiệu gian lận
        const isSelfAdded = userTransactions.some(tx => 
          tx.created_by === email && (!tx.processed_by || tx.processed_by === email)
        );

        const hasHighRatio = totalManualAdd > calculatedEarned * 2;
        const hasManyManualAdds = userTransactions.length > 20;

        if (isSelfAdded || hasHighRatio || hasManyManualAdds) {
          const fraudAmount = Math.max(0, totalManualAdd - calculatedEarned);

          fraudAccounts.push({
            email,
            total_manual_add: totalManualAdd,
            calculated_from_logs: calculatedEarned,
            fraud_amount: fraudAmount,
            manual_add_count: userTransactions.length
          });

          totalFraudAmount += fraudAmount;
          console.log(`  ❌ ${email}: ${fraudAmount.toLocaleString('vi-VN')} coins gian lận`);
        }

        processedCount++;
      } catch (error) {
        console.error(`  ⚠️ Lỗi xử lý ${balance.user_email}: ${error.message}`);
        processedCount++;
      }
    }

    // Sắp xếp theo fraud_amount
    fraudAccounts.sort((a, b) => b.fraud_amount - a.fraud_amount);

    console.log(`\n✅ HOÀN THÀNH TÍNH TOÁN:`);
    console.log(`📊 Tài khoản gian lận: ${fraudAccounts.length}`);
    console.log(`💰 TỔNG GIAN LẬN: ${totalFraudAmount.toLocaleString('vi-VN')} Camlycoin`);
    console.log(`📈 Trung bình/account: ${Math.round(totalFraudAmount / fraudAccounts.length).toLocaleString('vi-VN')} coins`);

    return Response.json({
      success: true,
      summary: {
        total_fraud_accounts: fraudAccounts.length,
        total_fraud_amount: totalFraudAmount,
        average_per_account: fraudAccounts.length > 0 ? Math.round(totalFraudAmount / fraudAccounts.length) : 0,
        total_processed: processedCount
      },
      top_20_fraudsters: fraudAccounts.slice(0, 20),
      all_fraud_accounts: fraudAccounts
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});