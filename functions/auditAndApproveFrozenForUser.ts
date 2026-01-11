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

    console.log(`\n📊 KIỂM TRA TÀI KHOẢN: ${target_user_email}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ 
        error: 'User not found',
        user_email: target_user_email
      }, { status: 404 });
    }

    const balance = balances[0];

    console.log(`\n💰 HIỆN TẠI:`);
    console.log(`  📈 Total Earned: ${(balance.total_earned || 0).toLocaleString()} coins`);
    console.log(`  ✅ Net Valid: ${(balance.net_valid_coins || 0).toLocaleString()} coins`);
    console.log(`  ❌ Frozen: ${(balance.frozen_balance || 0).toLocaleString()} coins`);
    console.log(`  💵 Paid: ${(balance.paid_amount || 0).toLocaleString()} coins`);
    console.log(`  🎯 Available: ${(balance.available_for_withdrawal || 0).toLocaleString()} coins`);

    // Fetch all logs for this user
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`\n📋 KIỂM TRA CÂU HỎI:`);
    console.log(`  Tổng: ${allLogs.length} câu`);

    // Find frozen questions
    const frozenLogs = allLogs.filter(log => 
      log.coin_category === 'frozen' && log.exclusion_reason !== 'valid'
    );

    console.log(`  ❌ Đóng Băng: ${frozenLogs.length} câu`);
    if (frozenLogs.length > 0) {
      const frozenCoins = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      console.log(`     = ${frozenCoins.toLocaleString()} coins`);
      
      // Show first few frozen questions
      console.log(`\n  Top frozen questions:`);
      frozenLogs.slice(0, 3).forEach((log, idx) => {
        console.log(`    ${idx + 1}. "${log.question_text.substring(0, 50)}..." = ${log.coins_earned} coins (${log.exclusion_reason})`);
      });
    }

    // Find admin review pending
    const reviewLogs = allLogs.filter(log => 
      log.coin_category === 'pending_review' && log.exclusion_reason !== 'valid'
    );

    console.log(`\n⏳ Chờ Duyệt: ${reviewLogs.length} câu`);
    if (reviewLogs.length > 0) {
      const reviewCoins = reviewLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      console.log(`   = ${reviewCoins.toLocaleString()} coins`);
    }

    // Find valid questions
    const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
    const validCoins = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
    console.log(`\n✅ Hợp Lệ: ${validLogs.length} câu = ${validCoins.toLocaleString()} coins`);

    // APPROVE all frozen questions in batches
    if (frozenLogs.length > 0) {
      console.log(`\n🔄 DUYỆT ${frozenLogs.length} CÂU TỪ FROZEN...`);

      const frozenIds = frozenLogs.map(log => log.id);
      const frozenCoins = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

      // Update each frozen log with delay to avoid rate limit
      let approvedCount = 0;
      for (let i = 0; i < frozenIds.length; i++) {
        const logId = frozenIds[i];
        try {
          await base44.asServiceRole.entities.QuestionAuditLog.update(logId, {
            exclusion_reason: 'valid',
            coin_category: 'pending_withdrawal'
          });
          approvedCount++;
          if ((i + 1) % 50 === 0) {
            console.log(`  ✅ ${i + 1}/${frozenIds.length}`);
          }
        } catch (err) {
          console.log(`⚠️  Failed to approve ${logId}`);
        }
        // Delay 30ms between updates
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Update balance: frozen → net_valid
      const newNetValid = (balance.net_valid_coins || 0) + frozenCoins;
      const newFrozen = Math.max(0, (balance.frozen_balance || 0) - frozenCoins);
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
        amount: frozenCoins,
        type: 'admin_adjustment',
        description: `✅ Admin duyệt ${approvedCount} câu từ Đóng Băng\n💰 +${frozenCoins.toLocaleString()} → Sẵn Sàng Rút`,
        processed_by: user.email
      });

      console.log(`\n✅ DUYỆT THÀNH CÔNG: ${approvedCount} câu`);
    }

    // Fetch updated balance
    const updatedBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });
    const updatedBalance = updatedBalances[0];

    console.log(`\n✨ CẬP NHẬT:`);
    console.log(`  ✅ Net Valid: ${(updatedBalance.net_valid_coins || 0).toLocaleString()} coins`);
    console.log(`  ❌ Frozen: ${(updatedBalance.frozen_balance || 0).toLocaleString()} coins`);
    console.log(`  🎯 Available: ${(updatedBalance.available_for_withdrawal || 0).toLocaleString()} coins`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      before: {
        total_earned: balance.total_earned,
        net_valid_coins: balance.net_valid_coins,
        frozen_balance: balance.frozen_balance,
        paid_amount: balance.paid_amount,
        available_for_withdrawal: balance.available_for_withdrawal
      },
      after: {
        total_earned: updatedBalance.total_earned,
        net_valid_coins: updatedBalance.net_valid_coins,
        frozen_balance: updatedBalance.frozen_balance,
        paid_amount: updatedBalance.paid_amount,
        available_for_withdrawal: updatedBalance.available_for_withdrawal
      },
      frozen_approved: frozenLogs.length,
      frozen_coins_moved: frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0)
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});