import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_user_email, batch_size = 10, delay_ms = 1000 } = await req.json();
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🔍 Bắt đầu xóa gian lận từng batch cho: ${target_user_email}`);
    console.log(`📦 Batch size: ${batch_size}, Delay: ${delay_ms}ms`);

    // Lấy tất cả transactions của user
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_user_email },
      '-created_date',
      1000
    );

    // Lọc suspicious manual_adds (tự thêm cho mình)
    const suspiciousTransactions = allTransactions.filter(tx =>
      tx.type === 'manual_add' &&
      tx.created_by === target_user_email &&
      (!tx.processed_by || tx.processed_by === target_user_email)
    );

    console.log(`📊 Tổng suspicious transactions: ${suspiciousTransactions.length}`);

    if (suspiciousTransactions.length === 0) {
      return Response.json({
        success: true,
        message: 'Không có transactions bị gian lận',
        total_processed: 0
      });
    }

    // Xóa từng batch
    let totalDeleted = 0;
    let totalAmount = 0;
    const batches = [];

    for (let i = 0; i < suspiciousTransactions.length; i += batch_size) {
      const batch = suspiciousTransactions.slice(i, i + batch_size);
      const batchNumber = Math.floor(i / batch_size) + 1;

      console.log(`\n⏳ Batch ${batchNumber}: Xóa ${batch.length} transactions...`);

      const deletedInBatch = [];
      let batchAmount = 0;

      for (const tx of batch) {
        try {
          await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
          deletedInBatch.push(tx.id);
          batchAmount += tx.amount;
          totalDeleted++;
          totalAmount += tx.amount;
          console.log(`  ✅ Xóa ${tx.id}: ${tx.amount} coins`);
        } catch (error) {
          console.error(`  ❌ Lỗi xóa ${tx.id}: ${error.message}`);
        }
      }

      batches.push({
        batch_number: batchNumber,
        deleted_count: deletedInBatch.length,
        total_amount: batchAmount
      });

      // Delay giữa các batch (trừ batch cuối)
      if (i + batch_size < suspiciousTransactions.length) {
        console.log(`⏸️  Chờ ${delay_ms}ms trước batch tiếp theo...`);
        await new Promise(resolve => setTimeout(resolve, delay_ms));
      }
    }

    // Cập nhật balance
    console.log(`\n💰 Cập nhật balance...`);
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });
    const balance = balances[0];

    if (balance) {
      const newTotalEarned = Math.max(0, (balance.total_earned || 0) - totalAmount);
      const newNetValid = Math.max(0, (balance.net_valid_coins || 0) - totalAmount);
      const newAvailable = Math.max(0, (balance.available_for_withdrawal || 0) - totalAmount);

      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        total_earned: newTotalEarned,
        net_valid_coins: newNetValid,
        available_for_withdrawal: newAvailable
      });

      console.log(`✅ Balance cập nhật:`);
      console.log(`  Old total_earned: ${balance.total_earned} → New: ${newTotalEarned}`);
      console.log(`  Old net_valid: ${balance.net_valid_coins} → New: ${newNetValid}`);
    }

    // Tạo admin adjustment transaction
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: -totalAmount,
      type: 'admin_adjustment',
      description: `🚨 Xóa ${totalDeleted} giao dịch gian lận (manual_add không hợp lệ)`,
      processed_by: user.email
    });

    console.log(`\n✅ HOÀN THÀNH`);
    console.log(`📊 Tổng xóa: ${totalDeleted} transactions`);
    console.log(`💰 Tổng amount: ${totalAmount} coins`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_deleted: totalDeleted,
      total_amount: totalAmount,
      batches: batches,
      balance_updated: !!balance
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});