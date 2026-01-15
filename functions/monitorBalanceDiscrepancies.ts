import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GIÁM SÁT LIÊN TỤC - Phát hiện sai lệch sớm
 * Chạy định kỳ để phát hiện và cảnh báo sai lệch trước khi chúng lan rộng
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 MONITORING BALANCE DISCREPANCIES`);
    console.log(`${'='.repeat(80)}\n`);

    const allUsers = await base44.asServiceRole.entities.User.list('', 10000);
    
    const findings = {
      total_users: allUsers.length,
      scanned: 0,
      issues_found: [],
      critical_alerts: [],
      warnings: [],
      summary: {
        large_discrepancies: 0,
        negative_balances: 0,
        suspicious_patterns: 0,
        frozen_anomalies: 0
      }
    };

    // Quét từng user
    for (const userData of allUsers) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));

        const userEmail = userData.email;
        
        const [allLogs, allTxs, balances, withdrawals] = await Promise.all([
          base44.asServiceRole.entities.QuestionAuditLog.filter({ user_email: userEmail }, '-audit_date', 10000),
          base44.asServiceRole.entities.CamlycoinTransaction.filter({ user_email: userEmail }, '-created_date', 10000),
          base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail }),
          base44.asServiceRole.entities.WithdrawalRequest.filter({ user_email: userEmail }, '-created_date', 1000)
        ]);

        const currentBalance = balances[0];
        if (!currentBalance) continue;

        // Tính toán balance đúng
        const validLogs = allLogs.filter(log => log.exclusion_reason === 'valid');
        const frozenLogs = allLogs.filter(log => 
          log.exclusion_reason === 'duplicate' || log.coin_category === 'frozen'
        );

        const validLogTotal = validLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        const frozenLogTotal = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        const validQuestions = new Set(
          validLogs.map(log => (log.question_text || '').trim().toLowerCase())
        );

        const recoveryTxs = allTxs.filter(tx => 
          tx.type === 'bounty_reward' && tx.description?.startsWith('Recovery:')
        );

        let validRecovery = 0;
        for (const tx of recoveryTxs) {
          const q = tx.description.replace('Recovery: ', '').trim().toLowerCase();
          if (!validQuestions.has(q)) validRecovery += tx.amount || 0;
        }

        const manualTotal = allTxs.filter(tx => tx.type === 'manual_add').reduce((s, tx) => s + (tx.amount || 0), 0);
        const adminTotal = allTxs.filter(tx => tx.type === 'admin_adjustment').reduce((s, tx) => s + (tx.amount || 0), 0);
        const buildTotal = allTxs.filter(tx => tx.type === 'build_reward').reduce((s, tx) => s + (tx.amount || 0), 0);
        const deductTotal = allTxs.filter(tx => tx.type === 'manual_deduct').reduce((s, tx) => s + (tx.amount || 0), 0);

        const completedWithdrawn = withdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + (w.amount || 0), 0);

        const correctTotalEarned = validLogTotal + validRecovery + manualTotal + adminTotal + buildTotal + frozenLogTotal - deductTotal;
        const correctNetValid = validLogTotal + validRecovery + manualTotal + adminTotal + buildTotal - deductTotal;
        const correctFrozen = frozenLogTotal;
        const correctAvailable = correctNetValid - completedWithdrawn;

        // So sánh với DB
        const totalDiff = Math.abs(correctTotalEarned - (currentBalance.total_earned || 0));
        const frozenDiff = Math.abs(correctFrozen - (currentBalance.frozen_balance || 0));
        const availableDiff = Math.abs(correctAvailable - (currentBalance.available_for_withdrawal || 0));

        const maxDiff = Math.max(totalDiff, frozenDiff, availableDiff);

        // Phát hiện vấn đề
        if (maxDiff > 50000) {
          findings.issues_found.push({
            user_email: userEmail,
            severity: 'CRITICAL',
            max_discrepancy: maxDiff,
            details: {
              total_diff: correctTotalEarned - (currentBalance.total_earned || 0),
              frozen_diff: correctFrozen - (currentBalance.frozen_balance || 0),
              available_diff: correctAvailable - (currentBalance.available_for_withdrawal || 0)
            }
          });
          findings.summary.large_discrepancies++;

          // Tạo critical alert
          findings.critical_alerts.push({
            user_email: userEmail,
            issue: `Sai lệch cực lớn: ${maxDiff.toLocaleString()} coins`,
            action_needed: 'Cần kiểm tra và sửa ngay lập tức'
          });

        } else if (maxDiff > 10000) {
          findings.warnings.push({
            user_email: userEmail,
            max_discrepancy: maxDiff,
            note: 'Sai lệch đáng chú ý - nên xem xét'
          });
        }

        // Kiểm tra balance âm
        if (currentBalance.available_for_withdrawal < 0) {
          findings.summary.negative_balances++;
          findings.warnings.push({
            user_email: userEmail,
            issue: 'Balance âm',
            value: currentBalance.available_for_withdrawal
          });
        }

        // Kiểm tra frozen bất thường
        if (currentBalance.frozen_balance > currentBalance.total_earned) {
          findings.summary.frozen_anomalies++;
          findings.warnings.push({
            user_email: userEmail,
            issue: 'Frozen > Total Earned - bất thường',
            frozen: currentBalance.frozen_balance,
            total: currentBalance.total_earned
          });
        }

        // Phát hiện suspicious pattern
        if (validRecovery > 500000) {
          findings.summary.suspicious_patterns++;
          findings.warnings.push({
            user_email: userEmail,
            issue: 'Recovery amount quá lớn',
            value: validRecovery
          });
        }

        findings.scanned++;

      } catch (error) {
        console.error(`Error scanning ${userData.email}:`, error.message);
      }
    }

    console.log(`\n✅ Monitoring complete`);
    console.log(`Scanned: ${findings.scanned}/${findings.total_users}`);
    console.log(`Issues found: ${findings.issues_found.length}`);
    console.log(`Critical alerts: ${findings.critical_alerts.length}`);
    console.log(`Warnings: ${findings.warnings.length}`);

    // Tạo AdminAlert nếu có critical issues
    if (findings.critical_alerts.length > 0) {
      await base44.asServiceRole.entities.AdminAlert.create({
        alert_type: 'high_balance',
        severity: 'critical',
        title: `CRITICAL: ${findings.critical_alerts.length} users có sai lệch lớn`,
        message: `Phát hiện ${findings.critical_alerts.length} users có sai lệch > 50K coins.\n\n` +
          `Top users:\n` +
          findings.critical_alerts.slice(0, 5).map((a, i) => 
            `${i+1}. ${a.user_email}: ${a.issue}`
          ).join('\n'),
        data: {
          critical_count: findings.critical_alerts.length,
          warnings_count: findings.warnings.length,
          summary: findings.summary
        },
        status: 'new'
      });
    }

    return Response.json({
      success: true,
      findings,
      recommendation: findings.critical_alerts.length > 0 
        ? 'Chạy autoBalanceCorrection ngay để sửa các sai lệch lớn'
        : 'Hệ thống ổn định'
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});