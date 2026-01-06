import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * XỬ LÝ RÚT TIỀN - LOGIC MỚI
 * 
 * Khi user rút tiền thành công:
 * - Trừ điểm từ available_balance
 * - Cộng điểm vào paid_amount
 * - total_earned KHÔNG BỊ THAY ĐỔI
 * - UserLevel.total_points KHÔNG ĐỔI (vì total_earned không đổi)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email, amount, tx_hash } = await req.json();

    if (!user_email || !amount || amount <= 0) {
      return Response.json({ error: 'Missing user_email or invalid amount' }, { status: 400 });
    }

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email 
    });
    
    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const currentAvailable = balance.available_balance || 0;
    const currentPaid = balance.paid_amount || 0;

    if (amount > currentAvailable) {
      return Response.json({ 
        error: 'Số tiền rút vượt quá Sẵn Sàng Thanh Toán',
        available: currentAvailable,
        requested: amount
      }, { status: 400 });
    }

    // Cập nhật balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      available_balance: currentAvailable - amount,
      paid_amount: currentPaid + amount
      // total_earned KHÔNG ĐỔI
    });

    // Log transaction
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email,
      amount: -amount, // Âm để đánh dấu là rút tiền
      type: 'admin_adjustment',
      description: `💸 Rút Tiền Thành Công\n💰 -${amount.toLocaleString()} Camlycoin\n🔗 TX: ${tx_hash || 'N/A'}\n📅 ${new Date().toLocaleDateString('vi-VN')}`,
      reference_id: `withdrawal_${Date.now()}`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      message: 'Withdrawal processed successfully',
      updated_balance: {
        user_email,
        available_balance: currentAvailable - amount,
        paid_amount: currentPaid + amount,
        total_earned: balance.total_earned // Không đổi
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});