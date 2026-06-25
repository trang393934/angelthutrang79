import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🎯 Cân bằng tài khoản: ${target_user_email}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const balance = balances[0];
    console.log(`\n💰 Trước:
  ❌ Frozen: ${(balance.frozen_balance || 0).toLocaleString()}
  🎯 Available: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);

    const needToCover = Math.abs(Math.min(0, balance.available_for_withdrawal || 0));
    if (needToCover <= 0) {
      console.log(`✅ Tài khoản đã cân bằng (available >= 0)`);
      return Response.json({
        success: true,
        message: 'Account already balanced',
        current_available: balance.available_for_withdrawal
      });
    }

    console.log(`\n📊 Cần cộng: ${needToCover.toLocaleString()} coins để cân bằng`);

    // Fetch all frozen logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    const frozenLogs = allLogs.filter(log => 
      log.coin_category === 'frozen' && log.exclusion_reason !== 'valid'
    );

    console.log(`📋 Tổng frozen: ${frozenLogs.length} câu`);

    if (frozenLogs.length === 0) {
      console.log(`⚠️  Không có câu frozen để duyệt`);
      return Response.json({
        success: false,
        message: 'No frozen questions to approve',
        still_negative: needToCover
      });
    }

    // Calculate how many logs we need to approve
    let totalToApprove = 0;
    let logsToApprove = [];

    for (const log of frozenLogs) {
      if (totalToApprove >= needToCover) break;
      totalToApprove += (log.coins_earned || 0);
      logsToApprove.push(log);
    }

    console.log(`\n✅ Sẽ duyệt: ${logsToApprove.length} câu = ${totalToApprove.toLocaleString()} coins`);

    // Approve logs with delay
    const approveIds = logsToApprove.map(log => log.id);
    let approvedCount = 0;

    for (let i = 0; i < approveIds.length; i++) {
      const logId = approveIds[i];
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.update(logId, {
          exclusion_reason: 'valid',
          coin_category: 'pending_withdrawal'
        });
        approvedCount++;
        if ((i + 1) % 10 === 0) {
          console.log(`  ✅ ${i + 1}/${approveIds.length}`);
        }
      } catch (err) {
        console.log(`⚠️  Failed: ${logId}`);
      }
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    console.log(`\n✅ Duyệt xong: ${approvedCount} câu`);

    // Update balance
    const newNetValid = (balance.net_valid_coins || 0) + totalToApprove;
    const newFrozen = Math.max(0, (balance.frozen_balance || 0) - totalToApprove);
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
      amount: totalToApprove,
      type: 'admin_adjustment',
      description: `✅ Admin cân bằng tài khoản: duyệt ${approvedCount} câu frozen\n💰 +${totalToApprove.toLocaleString()} coins\n📊 available: ${balance.available_for_withdrawal.toLocaleString()} → ${newAvailable.toLocaleString()}`,
      processed_by: user.email
    });

    console.log(`\n✨ Sau:`);
    console.log(`  ❌ Frozen: ${newFrozen.toLocaleString()}`);
    console.log(`  ✅ Net Valid: ${newNetValid.toLocaleString()}`);
    console.log(`  🎯 Available: ${newAvailable.toLocaleString()}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      approved_count: approvedCount,
      coins_moved: totalToApprove,
      before_available: balance.available_for_withdrawal,
      after_available: newAvailable,
      remaining_frozen: frozenLogs.length - logsToApprove.length
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});