import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log(`\n🔍 BẮT ĐẦU KIỂM TRA TOÀN BỘ HỆ THỐNG`);
    console.log(`⏰ ${new Date().toISOString()}\n`);

    // 1️⃣ LẤY TẤT CẢ DỮ LIỆU
    console.log(`📊 Đang load dữ liệu...`);
    const [allBalances, allLogs, allTransactions, allUsers] = await Promise.all([
      base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000),
      base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000),
      base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 20000),
      base44.asServiceRole.entities.User.list('-created_date', 10000)
    ]);

    console.log(`  ✅ Balances: ${allBalances.length}`);
    console.log(`  ✅ Audit Logs: ${allLogs.length}`);
    console.log(`  ✅ Transactions: ${allTransactions.length}`);
    console.log(`  ✅ Users: ${allUsers.length}\n`);

    // 2️⃣ PHÂN TÍCH TỪNG USER
    const issues = {
      duplicate_logs: [],
      formula_errors: [],
      orphaned_logs: [],
      missing_balance: [],
      negative_balance: [],
      zero_earned_with_logs: [],
      suspicious_manual_adds: []
    };

    console.log(`🔍 Phân tích từng user...\n`);

    for (const balance of allBalances) {
      const userEmail = balance.user_email;
      
      // Lấy logs của user
      const userLogs = allLogs.filter(log => log.user_email === userEmail);
      const userTx = allTransactions.filter(tx => tx.user_email === userEmail);

      // CHECK 1: Duplicate logs (cùng transaction_id)
      const txIdMap = new Map();
      let duplicateCount = 0;
      userLogs.forEach(log => {
        if (log.transaction_id) {
          const count = txIdMap.get(log.transaction_id) || 0;
          txIdMap.set(log.transaction_id, count + 1);
          if (count > 0) duplicateCount++;
        }
      });

      if (duplicateCount > 0) {
        issues.duplicate_logs.push({
          user_email: userEmail,
          total_logs: userLogs.length,
          duplicate_count: duplicateCount,
          severity: duplicateCount > 50 ? 'CRITICAL' : duplicateCount > 20 ? 'HIGH' : 'MEDIUM'
        });
      }

      // CHECK 2: Formula validation
      const calculatedValid = userLogs
        .filter(log => log.exclusion_reason === 'valid')
        .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      const calculatedFrozen = userLogs
        .filter(log => log.coin_category === 'frozen')
        .reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      
      const calculatedTotal = calculatedValid + calculatedFrozen;
      const calculatedAvailable = calculatedValid - (balance.paid_amount || 0);

      const totalError = Math.abs(calculatedTotal - (balance.total_earned || 0));
      const validError = Math.abs(calculatedValid - (balance.net_valid_coins || 0));
      const frozenError = Math.abs(calculatedFrozen - (balance.frozen_balance || 0));
      const availableError = Math.abs(calculatedAvailable - (balance.available_for_withdrawal || 0));

      if (totalError > 100 || validError > 100 || frozenError > 100 || availableError > 100) {
        issues.formula_errors.push({
          user_email: userEmail,
          errors: {
            total_earned: totalError,
            net_valid_coins: validError,
            frozen_balance: frozenError,
            available_for_withdrawal: availableError
          },
          stored: {
            total_earned: balance.total_earned,
            net_valid_coins: balance.net_valid_coins,
            frozen_balance: balance.frozen_balance,
            available_for_withdrawal: balance.available_for_withdrawal
          },
          calculated: {
            total_earned: calculatedTotal,
            net_valid_coins: calculatedValid,
            frozen_balance: calculatedFrozen,
            available_for_withdrawal: calculatedAvailable
          },
          severity: totalError > 50000 ? 'CRITICAL' : totalError > 10000 ? 'HIGH' : 'MEDIUM'
        });
      }

      // CHECK 3: Orphaned logs (có transaction_id nhưng không có transaction tương ứng)
      const txIds = new Set(userTx.map(tx => tx.reference_id).filter(Boolean));
      const orphanedLogs = userLogs.filter(log => 
        log.transaction_id && !txIds.has(log.transaction_id)
      );
      
      if (orphanedLogs.length > 0) {
        const orphanedCoins = orphanedLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        issues.orphaned_logs.push({
          user_email: userEmail,
          orphaned_count: orphanedLogs.length,
          orphaned_coins: orphanedCoins,
          severity: orphanedCoins > 50000 ? 'CRITICAL' : orphanedCoins > 10000 ? 'HIGH' : 'MEDIUM'
        });
      }

      // CHECK 4: Zero earned but has logs
      if ((balance.total_earned || 0) === 0 && userLogs.length > 0) {
        const totalFromLogs = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        if (totalFromLogs > 0) {
          issues.zero_earned_with_logs.push({
            user_email: userEmail,
            logs_count: userLogs.length,
            coins_from_logs: totalFromLogs,
            severity: 'HIGH'
          });
        }
      }

      // CHECK 5: Negative balance
      if ((balance.available_for_withdrawal || 0) < 0) {
        issues.negative_balance.push({
          user_email: userEmail,
          available_for_withdrawal: balance.available_for_withdrawal,
          severity: 'HIGH'
        });
      }

      // CHECK 6: Suspicious manual adds
      const manualAdds = userTx.filter(tx => tx.type === 'manual_add');
      if (manualAdds.length > 5) {
        const manualTotal = manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        if (manualTotal > 100000) {
          issues.suspicious_manual_adds.push({
            user_email: userEmail,
            manual_add_count: manualAdds.length,
            manual_add_total: manualTotal,
            severity: manualTotal > 500000 ? 'CRITICAL' : 'HIGH'
          });
        }
      }
    }

    // CHECK 7: Users without balance
    const balanceEmails = new Set(allBalances.map(b => b.user_email));
    const usersWithLogs = new Set(allLogs.map(l => l.user_email));
    usersWithLogs.forEach(email => {
      if (!balanceEmails.has(email)) {
        issues.missing_balance.push({
          user_email: email,
          logs_count: allLogs.filter(l => l.user_email === email).length,
          severity: 'HIGH'
        });
      }
    });

    // 3️⃣ TẠO BÁO CÁO TỔNG HỢP
    const summary = {
      total_users_checked: allBalances.length,
      total_issues_found: Object.values(issues).reduce((sum, arr) => sum + arr.length, 0),
      critical_issues: Object.values(issues)
        .flat()
        .filter(i => i.severity === 'CRITICAL').length,
      high_issues: Object.values(issues)
        .flat()
        .filter(i => i.severity === 'HIGH').length,
      medium_issues: Object.values(issues)
        .flat()
        .filter(i => i.severity === 'MEDIUM').length
    };

    console.log(`\n📋 TÓM TẮT KẾT QUẢ:`);
    console.log(`  Users kiểm tra: ${summary.total_users_checked}`);
    console.log(`  Tổng vấn đề: ${summary.total_issues_found}`);
    console.log(`  🔴 CRITICAL: ${summary.critical_issues}`);
    console.log(`  🟠 HIGH: ${summary.high_issues}`);
    console.log(`  🟡 MEDIUM: ${summary.medium_issues}\n`);

    console.log(`📊 CHI TIẾT TỪNG LOẠI LỖI:`);
    console.log(`  🔄 Duplicate Logs: ${issues.duplicate_logs.length} users`);
    console.log(`  ⚠️ Formula Errors: ${issues.formula_errors.length} users`);
    console.log(`  👻 Orphaned Logs: ${issues.orphaned_logs.length} users`);
    console.log(`  💸 Missing Balance: ${issues.missing_balance.length} users`);
    console.log(`  ➖ Negative Balance: ${issues.negative_balance.length} users`);
    console.log(`  0️⃣ Zero Earned w/ Logs: ${issues.zero_earned_with_logs.length} users`);
    console.log(`  🚨 Suspicious Manual Adds: ${issues.suspicious_manual_adds.length} users`);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      issues: {
        duplicate_logs: issues.duplicate_logs.sort((a, b) => 
          (b.duplicate_count || 0) - (a.duplicate_count || 0)
        ).slice(0, 20),
        formula_errors: issues.formula_errors.sort((a, b) => 
          (b.errors?.total_earned || 0) - (a.errors?.total_earned || 0)
        ).slice(0, 20),
        orphaned_logs: issues.orphaned_logs.sort((a, b) => 
          (b.orphaned_coins || 0) - (a.orphaned_coins || 0)
        ).slice(0, 20),
        missing_balance: issues.missing_balance.slice(0, 20),
        negative_balance: issues.negative_balance.slice(0, 20),
        zero_earned_with_logs: issues.zero_earned_with_logs.slice(0, 20),
        suspicious_manual_adds: issues.suspicious_manual_adds.sort((a, b) => 
          (b.manual_add_total || 0) - (a.manual_add_total || 0)
        ).slice(0, 20)
      },
      recommendations: {
        duplicate_logs: "Chạy cleanDuplicatesAndRecalculateBalance cho từng user",
        formula_errors: "Chạy resetBalanceFromAuditLogs để recalculate chính xác",
        orphaned_logs: "Chạy fixMissingCoinsByRecreatingTransactions",
        missing_balance: "Tạo CamlycoinBalance record cho users thiếu",
        negative_balance: "Xem xét lại paid_amount hoặc duyệt frozen balance",
        zero_earned_with_logs: "Recalculate total_earned từ logs",
        suspicious_manual_adds: "Audit manual_add transactions, có thể là fraud"
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});