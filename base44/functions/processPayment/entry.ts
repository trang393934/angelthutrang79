import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { userEmail, amount, txHash } = await req.json();

    if (!userEmail || typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'Missing userEmail or invalid amount' }, { status: 400 });
    }

    const balances = await base44.entities.CamlycoinBalance.filter({ user_email: userEmail });
    if (balances.length === 0) {
      return Response.json({ error: 'CamlycoinBalance not found for user' }, { status: 404 });
    }

    const currentBalance = balances[0];

    const newPaidAmount = (currentBalance.paid_amount || 0) + amount;
    const totalEarned = currentBalance.total_earned || 0;
    const frozenBalance = currentBalance.frozen_balance || 0;

    // Công thức: pending_review_balance = total_earned - paid_amount - frozen_balance
    const correctPendingReview = totalEarned - newPaidAmount - frozenBalance;
    const newPendingReviewBalance = Math.max(0, correctPendingReview);
    const newAvailableBalance = Math.max(0, correctPendingReview);

    const newUnpaidAmount = totalEarned - newPaidAmount;

    await base44.entities.CamlycoinBalance.update(currentBalance.id, {
      paid_amount: newPaidAmount,
      unpaid_amount: newUnpaidAmount,
      pending_review_balance: newPendingReviewBalance,
      available_balance: newAvailableBalance,
    });

    // Create transaction record
    await base44.entities.CamlycoinTransaction.create({
      user_email: userEmail,
      amount: -amount,
      type: 'admin_adjustment',
      description: `💸 Thanh toán thành công
💰 -${amount.toLocaleString()} Camlycoin
🔗 TX: ${txHash || 'N/A'}`,
      reference_id: `payment_${Date.now()}`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      message: `Successfully processed payment for ${userEmail}`,
      updatedBalance: {
        user_email: userEmail,
        paid_amount: newPaidAmount,
        unpaid_amount: newUnpaidAmount,
        pending_review_balance: newPendingReviewBalance,
        available_balance: newAvailableBalance,
        frozen_balance: frozenBalance,
        total_earned: totalEarned
      }
    });

  } catch (error) {
    console.error('Process payment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});