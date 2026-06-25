import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'Missing target_email' }, { status: 400 });
    }

    console.log(`\n🔍 Kiểm tra chi tiết tài khoản: ${target_email}`);

    // Lấy balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    // Lấy audit logs
    const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-question_date',
      1000
    );

    // Lấy transactions
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_email },
      '-created_date',
      500
    );

    console.log(`\n📊 BALANCE HIỆN TẠI:`);
    if (balance) {
      console.log(`  total_earned: ${balance.total_earned} coins`);
      console.log(`  net_valid_coins: ${balance.net_valid_coins} coins`);
      console.log(`  frozen_balance: ${balance.frozen_balance} coins`);
      console.log(`  paid_amount: ${balance.paid_amount} coins`);
      console.log(`  available_for_withdrawal: ${balance.available_for_withdrawal} coins`);
    } else {
      console.log(`  ❌ Không có balance record`);
    }

    // Phân tích audit logs
    console.log(`\n📝 AUDIT LOGS ANALYSIS:`);
    let totalValidEarned = 0;
    let totalFrozenEarned = 0;
    let totalPendingReview = 0;
    let logsByCategory = {
      valid: [],
      frozen: [],
      pending_review: [],
      other: []
    };

    logs.forEach(log => {
      if (log.exclusion_reason === 'valid') {
        totalValidEarned += log.coins_earned || 0;
        logsByCategory.valid.push(log);
      } else if (log.coin_category === 'frozen') {
        totalFrozenEarned += log.coins_earned || 0;
        logsByCategory.frozen.push(log);
      } else if (log.coin_category === 'pending_review') {
        totalPendingReview += log.coins_earned || 0;
        logsByCategory.pending_review.push(log);
      } else {
        logsByCategory.other.push(log);
      }
    });

    console.log(`  Tổng logs: ${logs.length}`);
    console.log(`  Valid: ${logsByCategory.valid.length} logs = ${totalValidEarned} coins`);
    console.log(`  Frozen: ${logsByCategory.frozen.length} logs = ${totalFrozenEarned} coins`);
    console.log(`  Pending Review: ${logsByCategory.pending_review.length} logs = ${totalPendingReview} coins`);
    console.log(`  Other: ${logsByCategory.other.length} logs`);

    // Phân tích transactions
    console.log(`\n💳 TRANSACTIONS ANALYSIS:`);
    const txByType = {};
    let totalFromTx = 0;
    transactions.forEach(tx => {
      if (!txByType[tx.type]) {
        txByType[tx.type] = { count: 0, total: 0 };
      }
      txByType[tx.type].count++;
      txByType[tx.type].total += tx.amount || 0;
      totalFromTx += tx.amount || 0;
    });

    Object.entries(txByType).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.count} txs = ${data.total} coins`);
    });

    // Check công thức
    console.log(`\n⚙️ FORMULA CHECK:`);
    const calculatedTotalEarned = totalValidEarned + totalFrozenEarned + totalPendingReview;
    const calculatedAvailable = (balance?.net_valid_coins || 0) - (balance?.paid_amount || 0);
    
    console.log(`  Tính từ logs: total_earned = ${calculatedTotalEarned}`);
    console.log(`  Balance record: total_earned = ${balance?.total_earned || 0}`);
    console.log(`  Match: ${calculatedTotalEarned === balance?.total_earned ? '✅' : '❌'}`);

    console.log(`\n  Công thức available_for_withdrawal = net_valid_coins - paid_amount`);
    console.log(`  = ${balance?.net_valid_coins} - ${balance?.paid_amount}`);
    console.log(`  = ${calculatedAvailable}`);
    console.log(`  Balance record: ${balance?.available_for_withdrawal}`);
    console.log(`  Match: ${calculatedAvailable === balance?.available_for_withdrawal ? '✅' : '❌'}`);

    // Lấy logs từ ngày 11/1
    console.log(`\n🔎 LOGS TỪ 11/1:`);
    const jan11Logs = logs.filter(log => {
      const logDate = new Date(log.question_date);
      return logDate.toISOString().startsWith('2026-01-11');
    });

    console.log(`  Tìm thấy: ${jan11Logs.length} logs`);
    let jan11Valid = 0;
    jan11Logs.forEach(log => {
      if (log.exclusion_reason === 'valid') {
        jan11Valid += log.coins_earned || 0;
      }
    });
    console.log(`  Valid coins từ 11/1: ${jan11Valid}`);

    return Response.json({
      success: true,
      user_email: target_email,
      balance: {
        total_earned: balance?.total_earned,
        net_valid_coins: balance?.net_valid_coins,
        frozen_balance: balance?.frozen_balance,
        paid_amount: balance?.paid_amount,
        available_for_withdrawal: balance?.available_for_withdrawal
      },
      logs_analysis: {
        total_logs: logs.length,
        valid_earned: totalValidEarned,
        frozen_earned: totalFrozenEarned,
        pending_review_earned: totalPendingReview,
        jan11_valid_earned: jan11Valid
      },
      formula_check: {
        calculated_total_earned: calculatedTotalEarned,
        stored_total_earned: balance?.total_earned,
        total_earned_match: calculatedTotalEarned === balance?.total_earned,
        calculated_available: calculatedAvailable,
        stored_available: balance?.available_for_withdrawal,
        available_match: calculatedAvailable === balance?.available_for_withdrawal
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});