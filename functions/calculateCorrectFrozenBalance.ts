import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔄 Tính toán lại Frozen Balance chính xác...\n');

    // Lấy tất cả audit logs
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    // Lấy tất cả balances hiện tại
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50000);

    // Group logs by user
    const logsByUser = {};
    
    for (const log of auditLogs) {
      if (!logsByUser[log.user_email]) {
        logsByUser[log.user_email] = {
          frozen_coins: 0,
          frozen_logs: []
        };
      }

      // Chỉ tính coins vào frozen nếu là: duplicate, greeting, hoặc exceeds_daily_limit
      if (['duplicate', 'greeting', 'exceeds_daily_limit'].includes(log.exclusion_reason)) {
        logsByUser[log.user_email].frozen_coins += (log.coins_earned || 0);
        logsByUser[log.user_email].frozen_logs.push({
          reason: log.exclusion_reason,
          coins: log.coins_earned
        });
      }
    }

    console.log(`📊 Tính toán Frozen Balance cho ${Object.keys(logsByUser).length} users\n`);

    let updateCount = 0;
    let errors = 0;
    let systemTotalFrozen = 0;

    for (const userEmail of Object.keys(logsByUser)) {
      try {
        const userFrozenData = logsByUser[userEmail];
        const frozenAmount = userFrozenData.frozen_coins;
        systemTotalFrozen += frozenAmount;

        // Tìm balance record
        const existingBalance = allBalances.find(b => b.user_email === userEmail);

        if (existingBalance && Math.abs((existingBalance.frozen_balance || 0) - frozenAmount) > 0) {
          // Cập nhật frozen_balance
          await base44.asServiceRole.entities.CamlycoinBalance.update(existingBalance.id, {
            frozen_balance: frozenAmount
          });
          updateCount++;

          if (updateCount % 10 === 0) {
            console.log(`✅ Cập nhật ${updateCount} users...`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        errors++;
        console.error(`❌ Lỗi cho ${userEmail}:`, error.message);
      }
    }

    console.log(`\n✅ HOÀN TẤT:`);
    console.log(`   - Cập nhật: ${updateCount} users`);
    console.log(`   - Lỗi: ${errors}`);
    console.log(`   - Tổng Frozen Balance (chính xác): ${systemTotalFrozen.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        users_updated: updateCount,
        errors: errors,
        total_system_frozen: systemTotalFrozen
      },
      formula: {
        frozen_balance: 'Sum of coins with exclusion_reason IN (duplicate, greeting, exceeds_daily_limit)'
      }
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});