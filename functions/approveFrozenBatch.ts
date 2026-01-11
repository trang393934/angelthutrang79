import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 20 } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🔄 Duyệt frozen batch (size: ${batch_size}) cho ${target_user_email}`);

    // Fetch all frozen logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    const frozenLogs = allLogs.filter(log => {
      const isFrozen = log.coin_category === 'frozen' || log.coin_category === 'pending_review';
      const notApproved = log.exclusion_reason !== 'valid' || !log.exclusion_reason;
      return isFrozen && notApproved;
    });

    console.log(`📊 Frozen logs: ${frozenLogs.length}`);

    if (frozenLogs.length === 0) {
      console.log(`✅ Không có câu nào cần duyệt`);
      return Response.json({
        success: true,
        message: 'No frozen questions to approve',
        remaining: 0
      });
    }

    // Approve first batch_size logs
    const batch = frozenLogs.slice(0, batch_size);
    const batchIds = batch.map(log => log.id);
    const batchCoins = batch.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    console.log(`\n🔄 Duyệt batch: ${batch.length} câu = ${batchCoins.toLocaleString()} coins`);

    // Update logs with delay
    let approvedCount = 0;
    for (let i = 0; i < batchIds.length; i++) {
      const logId = batchIds[i];
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.update(logId, {
          exclusion_reason: 'valid',
          coin_category: 'pending_withdrawal'
        });
        approvedCount++;
      } catch (err) {
        console.log(`⚠️  Failed: ${logId}`);
      }
      // Delay 40ms between updates
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    console.log(`✅ Approved: ${approvedCount}/${batch.length}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    const balance = balances[0];

    // Update balance: frozen → net_valid
    const newNetValid = (balance.net_valid_coins || 0) + batchCoins;
    const newFrozen = Math.max(0, (balance.frozen_balance || 0) - batchCoins);
    const paidAmount = balance.paid_amount || 0;
    const newAvailable = newNetValid - paidAmount;

    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      frozen_balance: newFrozen,
      net_valid_coins: newNetValid,
      available_for_withdrawal: newAvailable
    });

    // Log transaction
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: batchCoins,
      type: 'admin_adjustment',
      description: `✅ Admin duyệt ${approvedCount} câu từ Đóng Băng (batch)\n💰 +${batchCoins.toLocaleString()} → Sẵn Sàng Rút`,
      processed_by: user.email
    });

    console.log(`\n✨ Cập nhật:`);
    console.log(`  ✅ Net Valid: ${newNetValid.toLocaleString()}`);
    console.log(`  ❌ Frozen: ${newFrozen.toLocaleString()}`);
    console.log(`  🎯 Available: ${newAvailable.toLocaleString()}`);
    console.log(`\n📌 Còn lại: ${frozenLogs.length - batch.length} câu`);

    return Response.json({
      success: true,
      approved: approvedCount,
      coins_moved: batchCoins,
      remaining: frozenLogs.length - batch.length,
      new_available: newAvailable
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});