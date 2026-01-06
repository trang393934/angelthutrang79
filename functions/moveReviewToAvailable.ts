import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CHUYỂN ADMIN_REVIEW_PENDING SANG AVAILABLE_BALANCE
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'Missing user_email' }, { status: 400 });
    }

    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const reviewAmount = balance.admin_review_pending || 0;

    if (reviewAmount <= 0) {
      return Response.json({ error: 'No admin_review_pending to move' }, { status: 400 });
    }

    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      admin_review_pending: 0,
      available_balance: (balance.available_balance || 0) + reviewAmount
    });

    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Admin chuyển ${reviewAmount.toLocaleString()} Camly từ Chờ Admin Review → Sẵn Sàng Thanh Toán`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      user_email: user_email,
      moved_amount: reviewAmount,
      new_available: (balance.available_balance || 0) + reviewAmount
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});