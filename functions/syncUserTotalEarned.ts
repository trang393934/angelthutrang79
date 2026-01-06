import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail is required' }, { status: 400 });
    }

    console.log(`🔄 Syncing total_earned for ${targetUserEmail}`);

    // Get user's level
    const levels = await base44.asServiceRole.entities.UserLevel.filter({ user_email: targetUserEmail });
    
    if (levels.length === 0) {
      return Response.json({ error: 'User level not found' }, { status: 404 });
    }

    const level = levels[0];
    const correctTotalEarned = level.total_points || 0;

    // Get user's balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetUserEmail });
    
    if (balances.length === 0) {
      return Response.json({ error: 'User balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const currentTotalEarned = balance.total_earned || 0;
    const difference = correctTotalEarned - currentTotalEarned;

    // Update total_earned
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      total_earned: correctTotalEarned,
      balance: (balance.balance || 0) + difference
    });

    // Create transaction log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: targetUserEmail,
      amount: 0,
      type: 'admin_adjustment',
      description: `🔄 Admin sync: total_earned từ ${currentTotalEarned.toLocaleString()} → ${correctTotalEarned.toLocaleString()} (= total_points từ UserLevel)`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      message: '✅ Đã sync total_earned = total_points',
      userEmail: targetUserEmail,
      oldTotalEarned: currentTotalEarned,
      newTotalEarned: correctTotalEarned,
      difference
    });

  } catch (error) {
    console.error('Error syncing user total_earned:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});