import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Chỉ admin mới được thực hiện
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Bắt đầu rà soát các tài khoản có total_earned = 0...');

    // Lấy tất cả balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({});
    console.log(`📊 Tổng số balance records: ${allBalances.length}`);

    // Lọc các tài khoản có total_earned = 0
    const zeroEarnedAccounts = allBalances.filter(b => 
      (b.total_earned === 0 || !b.total_earned)
    );
    console.log(`⚠️ Tìm thấy ${zeroEarnedAccounts.length} tài khoản có total_earned = 0`);

    // Lấy tất cả audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({});
    console.log(`📝 Tổng số audit logs: ${allLogs.length}`);

    // Kiểm tra từng tài khoản
    const results = [];
    for (const balance of zeroEarnedAccounts) {
      const userEmail = balance.user_email;
      
      // Lấy logs của user này
      const userLogs = allLogs.filter(log => log.user_email === userEmail);
      
      if (userLogs.length > 0) {
        // Tính tổng coins từ logs
        const validCoins = userLogs
          .filter(log => log.exclusion_reason === 'valid')
          .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        const frozenCoins = userLogs
          .filter(log => log.exclusion_reason !== 'valid')
          .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        const totalFromLogs = validCoins + frozenCoins;

        if (totalFromLogs > 0) {
          // Có logs và có coins nhưng total_earned = 0 => LỖI
          results.push({
            user_email: userEmail,
            current_total_earned: balance.total_earned || 0,
            current_net_valid: balance.net_valid_coins || 0,
            current_frozen: balance.frozen_balance || 0,
            logs_count: userLogs.length,
            calculated_valid: validCoins,
            calculated_frozen: frozenCoins,
            calculated_total: totalFromLogs,
            discrepancy: totalFromLogs - (balance.total_earned || 0),
            status: '❌ LỖI - Có logs nhưng balance = 0'
          });
          
          console.log(`❌ ${userEmail}: ${userLogs.length} logs, should have ${totalFromLogs} coins but total_earned = 0`);
        } else {
          // Có logs nhưng tất cả đều 0 coins
          results.push({
            user_email: userEmail,
            current_total_earned: balance.total_earned || 0,
            logs_count: userLogs.length,
            calculated_total: 0,
            status: '⚠️ Có logs nhưng tất cả coins_earned = 0'
          });
        }
      } else {
        // Không có logs => Bình thường (user mới hoặc chưa hoạt động)
        results.push({
          user_email: userEmail,
          current_total_earned: balance.total_earned || 0,
          logs_count: 0,
          status: '✅ OK - Không có logs (user mới)'
        });
      }
    }

    // Phân loại kết quả
    const errors = results.filter(r => r.status.includes('❌'));
    const warnings = results.filter(r => r.status.includes('⚠️'));
    const ok = results.filter(r => r.status.includes('✅'));

    console.log(`\n📊 KẾT QUẢ RÀ SOÁT:`);
    console.log(`❌ Lỗi nghiêm trọng: ${errors.length} tài khoản`);
    console.log(`⚠️ Cảnh báo: ${warnings.length} tài khoản`);
    console.log(`✅ Bình thường: ${ok.length} tài khoản`);

    return Response.json({
      success: true,
      summary: {
        total_zero_earned: zeroEarnedAccounts.length,
        errors: errors.length,
        warnings: warnings.length,
        ok: ok.length
      },
      errors: errors,
      warnings: warnings,
      ok_accounts: ok,
      all_results: results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});