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

    console.log(`🔧 Fix net_valid_coins formula cho: ${target_user_email}`);

    // Fetch ALL logs cho user này
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Tổng logs: ${allLogs.length}`);

    // Tính lại chỉ từ logs với exclusion_reason === 'valid'
    const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
    const correctNetValid = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    console.log(`✅ Valid logs: ${validLogs.length}`);
    console.log(`💰 Correct net_valid_coins: ${correctNetValid.toLocaleString()}`);

    // Fetch current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      console.log(`⚠️ Không tìm thấy balance`);
      return Response.json({ 
        success: false, 
        error: 'Balance not found' 
      }, { status: 404 });
    }

    const balance = balances[0];
    const oldNetValid = balance.net_valid_coins || 0;
    const frozenBalance = balance.frozen_balance || 0;
    const paidAmount = balance.paid_amount || 0;

    // Tính lại total_earned = net_valid_coins + frozen_balance
    const newTotalEarned = correctNetValid + frozenBalance;
    
    // Tính lại available_for_withdrawal = net_valid_coins - paid_amount
    const newAvailable = correctNetValid - paidAmount;

    console.log(`\n📊 TRƯỚC:`);
    console.log(`  ✅ Net Valid: ${oldNetValid.toLocaleString()}`);
    console.log(`  💰 Total Earned: ${(balance.total_earned || 0).toLocaleString()}`);
    console.log(`  🎯 Available: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);

    console.log(`\n📊 SAU:`);
    console.log(`  ✅ Net Valid: ${correctNetValid.toLocaleString()}`);
    console.log(`  💰 Total Earned: ${newTotalEarned.toLocaleString()}`);
    console.log(`  🎯 Available: ${newAvailable.toLocaleString()}`);

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: correctNetValid,
      total_earned: newTotalEarned,
      available_for_withdrawal: newAvailable
    });

    // Log transaction
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Admin fix net_valid_coins formula\n📊 Trước: ${oldNetValid.toLocaleString()} → Sau: ${correctNetValid.toLocaleString()}\n🔧 Chỉ tính ${validLogs.length} logs với exclusion_reason='valid'`,
      processed_by: user.email
    });

    console.log(`\n✨ Cập nhật hoàn tất!`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      valid_logs_count: validLogs.length,
      changes: {
        net_valid_coins: {
          before: oldNetValid,
          after: correctNetValid,
          diff: correctNetValid - oldNetValid
        },
        total_earned: {
          before: balance.total_earned || 0,
          after: newTotalEarned,
          diff: newTotalEarned - (balance.total_earned || 0)
        },
        available_for_withdrawal: {
          before: balance.available_for_withdrawal || 0,
          after: newAvailable,
          diff: newAvailable - (balance.available_for_withdrawal || 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});