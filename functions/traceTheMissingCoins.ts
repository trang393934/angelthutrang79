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

    console.log(`\n🔎 TÌM NGUỒN CỦA 80,000 COINS: ${target_email}`);

    // Lấy tất cả transactions
    const allTx = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_email },
      '-created_date',
      1000
    );

    console.log(`\n💳 PHÂN TÍCH TRANSACTIONS:`);
    console.log(`  Tổng: ${allTx.length} transactions`);

    // Group by type
    let byType = {};
    let totalByType = {};

    allTx.forEach(tx => {
      if (!byType[tx.type]) {
        byType[tx.type] = [];
        totalByType[tx.type] = 0;
      }
      byType[tx.type].push(tx);
      totalByType[tx.type] += tx.amount || 0;
    });

    console.log(`\n  📊 By type:`);
    Object.entries(totalByType).forEach(([type, total]) => {
      console.log(`    ${type}: ${byType[type].length} txs = ${total} coins`);
    });

    // Tìm bounty_reward
    console.log(`\n🎁 BOUNTY_REWARD TRANSACTIONS:`);
    const bountyTxs = byType['bounty_reward'] || [];
    console.log(`  ${bountyTxs.length} transactions`);
    let bountyTotal = 0;
    bountyTxs.slice(0, 20).forEach(tx => {
      console.log(`    ${tx.description}: ${tx.amount} coins (ref: ${tx.reference_id}, created: ${tx.created_date})`);
      bountyTotal += tx.amount || 0;
    });
    console.log(`  Tổng bounty: ${bountyTotal}`);

    // Tìm build_reward
    console.log(`\n🏗️ BUILD_REWARD TRANSACTIONS:`);
    const buildTxs = byType['build_reward'] || [];
    console.log(`  ${buildTxs.length} transactions`);
    let buildTotal = 0;
    buildTxs.slice(0, 20).forEach(tx => {
      console.log(`    ${tx.description}: ${tx.amount} coins (ref: ${tx.reference_id}, created: ${tx.created_date})`);
      buildTotal += tx.amount || 0;
    });
    console.log(`  Tổng build: ${buildTotal}`);

    // Tìm admin_adjustment
    console.log(`\n⚙️ ADMIN_ADJUSTMENT TRANSACTIONS:`);
    const adminTxs = byType['admin_adjustment'] || [];
    console.log(`  ${adminTxs.length} transactions`);
    let adminTotal = 0;
    adminTxs.slice(0, 20).forEach(tx => {
      console.log(`    ${tx.description}: ${tx.amount} coins (processed_by: ${tx.processed_by}, created: ${tx.created_date})`);
      adminTotal += tx.amount || 0;
    });
    console.log(`  Tổng admin: ${adminTotal}`);

    // Tìm manual_add
    console.log(`\n🔧 MANUAL_ADD TRANSACTIONS:`);
    const manualTxs = byType['manual_add'] || [];
    console.log(`  ${manualTxs.length} transactions`);
    let manualTotal = 0;
    manualTxs.slice(0, 20).forEach(tx => {
      console.log(`    ${tx.description}: ${tx.amount} coins (processed_by: ${tx.processed_by}, created: ${tx.created_date})`);
      manualTotal += tx.amount || 0;
    });
    console.log(`  Tổng manual: ${manualTotal}`);

    // Lấy balance để so sánh
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    console.log(`\n📊 BALANCE SO SÁNH:`);
    console.log(`  Stored total_earned: ${balance?.total_earned || 0}`);
    console.log(`  Tx total earned (bounty + build + admin + manual): ${bountyTotal + buildTotal + adminTotal + manualTotal}`);
    console.log(`  Chênh lệch: ${(balance?.total_earned || 0) - (bountyTotal + buildTotal + adminTotal + manualTotal)}`);

    // Lấy audit logs để tìm những transaction không có logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_email },
      '-created_date',
      2000
    );

    console.log(`\n📝 AUDIT LOGS:`);
    console.log(`  ${allLogs.length} logs`);

    // Tìm những logs không có transaction tương ứng
    const logsWithTxId = allLogs.filter(log => log.transaction_id);
    const txIds = new Set(allTx.map(tx => tx.reference_id).filter(Boolean));
    const orphanedLogs = logsWithTxId.filter(log => !txIds.has(log.transaction_id));

    console.log(`\n⚠️ ORPHANED LOGS (không có transaction tương ứng):`);
    console.log(`  ${orphanedLogs.length} logs`);
    let orphanedTotal = 0;
    orphanedLogs.slice(0, 10).forEach(log => {
      console.log(`    ${log.question_text?.substring(0, 50)}: ${log.coins_earned} coins (tx_id: ${log.transaction_id})`);
      orphanedTotal += log.coins_earned || 0;
    });
    console.log(`  Tổng orphaned: ${orphanedTotal}`);

    return Response.json({
      success: true,
      user_email: target_email,
      findings: {
        bounty_total: bountyTotal,
        build_total: buildTotal,
        admin_total: adminTotal,
        manual_total: manualTotal,
        total_from_tx: bountyTotal + buildTotal + adminTotal + manualTotal,
        stored_total_earned: balance?.total_earned || 0,
        discrepancy: (balance?.total_earned || 0) - (bountyTotal + buildTotal + adminTotal + manualTotal),
        audit_logs_count: allLogs.length,
        orphaned_logs_count: orphanedLogs.length,
        orphaned_logs_total: orphanedTotal,
        orphaned_logs_samples: orphanedLogs.slice(0, 5).map(log => ({
          coins: log.coins_earned,
          transaction_id: log.transaction_id,
          question: log.question_text?.substring(0, 100),
          date: log.question_date
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});