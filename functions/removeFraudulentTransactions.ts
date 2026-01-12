import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Chỉ admin mới được thực hiện
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_user_email } = await req.json();

    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    // Lấy tất cả transactions của user
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_user_email
    });

    console.log(`Total transactions for ${target_user_email}: ${allTransactions.length}`);

    // Tìm các giao dịch manual_add đáng ngờ (created_by = user, không có audit log tương ứng)
    const suspiciousTransactions = allTransactions.filter(tx => 
      tx.type === 'manual_add' && 
      tx.created_by === target_user_email &&
      (!tx.processed_by || tx.processed_by === target_user_email)
    );

    console.log(`Found ${suspiciousTransactions.length} suspicious manual_add transactions`);

    // Tính tổng số tiền gian lận
    const fraudulentAmount = suspiciousTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    console.log(`Total fraudulent amount: ${fraudulentAmount}`);

    // Xóa các giao dịch gian lận
    const deletedIds = [];
    for (const tx of suspiciousTransactions) {
      await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
      deletedIds.push(tx.id);
      console.log(`Deleted transaction ${tx.id}: ${tx.amount} coins, date: ${tx.created_date}`);
    }

    // Lấy balance hiện tại của user
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ 
        error: 'User balance not found',
        deleted_transactions: deletedIds.length,
        fraudulent_amount: fraudulentAmount
      }, { status: 404 });
    }

    const balance = balances[0];
    const oldBalance = balance.balance;
    const oldTotalEarned = balance.total_earned;

    // Cập nhật balance (trừ đi số tiền gian lận)
    const newBalance = oldBalance - fraudulentAmount;
    const newTotalEarned = oldTotalEarned - fraudulentAmount;
    const newNetValidCoins = (balance.net_valid_coins || 0) - fraudulentAmount;
    const newAvailableForWithdrawal = newNetValidCoins - (balance.paid_amount || 0);

    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      balance: newBalance,
      total_earned: newTotalEarned,
      net_valid_coins: newNetValidCoins,
      available_for_withdrawal: newAvailableForWithdrawal
    });

    // Tạo transaction ghi nhận việc điều chỉnh
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: -fraudulentAmount,
      type: 'admin_adjustment',
      description: `Admin điều chỉnh: Xóa ${suspiciousTransactions.length} giao dịch gian lận manual_add`,
      processed_by: user.email
    });

    console.log(`Balance updated: ${oldBalance} -> ${newBalance}`);

    return Response.json({
      success: true,
      user: target_user_email,
      deleted_transactions: deletedIds.length,
      transaction_ids: deletedIds,
      fraudulent_amount: fraudulentAmount,
      balance_before: oldBalance,
      balance_after: newBalance,
      total_earned_before: oldTotalEarned,
      total_earned_after: newTotalEarned,
      adjustment_transaction_created: true
    });

  } catch (error) {
    console.error('Error removing fraudulent transactions:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});