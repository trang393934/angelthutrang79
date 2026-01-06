import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * XỬ LÝ THANH TOÁN CHO 1 USER CỤ THỂ
 * Cập nhật paid_amount và cộng vào total_earned + total_points
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email, paid_amount } = await req.json();

    if (!user_email || !paid_amount) {
      return Response.json({ error: 'Missing user_email or paid_amount' }, { status: 400 });
    }

    // Get user's balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const oldPaidAmount = balance.paid_amount || 0;
    const newPaidAmount = oldPaidAmount + paid_amount;
    const oldTotalEarned = balance.total_earned || 0;
    const newTotalEarned = oldTotalEarned + paid_amount;

    // Update CamlycoinBalance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      paid_amount: newPaidAmount,
      total_earned: newTotalEarned
    });

    // Update UserLevel
    const levels = await base44.asServiceRole.entities.UserLevel.filter({
      user_email: user_email
    });

    let levelUpdate = null;
    if (levels.length > 0) {
      const level = levels[0];
      const oldTotalPoints = level.total_points || 0;
      const newTotalPoints = oldTotalPoints + paid_amount;

      await base44.asServiceRole.entities.UserLevel.update(level.id, {
        total_points: newTotalPoints
      });

      levelUpdate = {
        old: oldTotalPoints,
        new: newTotalPoints,
        added: paid_amount
      };
    }

    // Create transaction log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Admin xác nhận thanh toán thành công ${paid_amount.toLocaleString()} Camly → Cộng vào Tổng Đã Kiếm và Level Points`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      user_email: user_email,
      paid_amount: paid_amount,
      balance: {
        paid_amount: {
          old: oldPaidAmount,
          new: newPaidAmount
        },
        total_earned: {
          old: oldTotalEarned,
          new: newTotalEarned
        }
      },
      level: levelUpdate
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});