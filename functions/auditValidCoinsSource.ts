import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Kiểm tra nguồn Valid Coins từ tất cả transactions...\n');

    // Lấy tất cả audit logs
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    // Lấy tất cả transactions
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    
    // Lấy tất cả community rewards
    const communityRewards = await base44.asServiceRole.entities.CommunityReward.list('-created_date', 50000);

    // Tính từ QuestionAuditLog
    let validCoinsFromLogs = 0;
    const validFromLogs = {};
    
    for (const log of auditLogs) {
      if (log.exclusion_reason === 'valid') {
        if (!validFromLogs[log.user_email]) validFromLogs[log.user_email] = 0;
        validFromLogs[log.user_email] += (log.coins_earned || 0);
        validCoinsFromLogs += (log.coins_earned || 0);
      }
    }

    // Tính từ CamlycoinTransaction (các loại không phải admin_adjustment)
    let totalFromTransactions = 0;
    const byType = {};
    const byUser = {};

    for (const tx of transactions) {
      const amount = tx.amount || 0;
      if (amount > 0) { // Chỉ tính incoming coins
        if (!byType[tx.type]) byType[tx.type] = 0;
        byType[tx.type] += amount;
        totalFromTransactions += amount;

        if (!byUser[tx.user_email]) byUser[tx.user_email] = 0;
        byUser[tx.user_email] += amount;
      }
    }

    // Tính từ CommunityReward (status = 'approved')
    let totalFromCommunityRewards = 0;
    for (const reward of communityRewards) {
      if (reward.status === 'approved') {
        totalFromCommunityRewards += (reward.coins_awarded || 0);
      }
    }

    console.log('📊 KIỂM TRA NGUỒN COINS:\n');
    console.log(`1. Valid Coins từ QuestionAuditLog (exclusion_reason='valid'): ${validCoinsFromLogs.toLocaleString()}`);
    console.log(`2. Tổng Coins từ CamlycoinTransaction (incoming): ${totalFromTransactions.toLocaleString()}`);
    console.log(`3. Coins từ Community Rewards (approved): ${totalFromCommunityRewards.toLocaleString()}`);
    console.log(`\n📈 Breakdown theo loại transaction:`);
    
    for (const [type, amount] of Object.entries(byType)) {
      console.log(`   - ${type}: ${amount.toLocaleString()}`);
    }

    console.log(`\n⚠️ CÓ TÍNH DOUBLE KHÔNG?`);
    console.log(`   Valid coins từ QuestionAuditLog: ${validCoinsFromLogs.toLocaleString()}`);
    console.log(`   (Có trong CamlycoinTransaction không?)`);

    // Top 5 users
    console.log(`\n👥 Top 5 users theo valid_coins từ logs:`);
    const top5 = Object.entries(validFromLogs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [email, coins] of top5) {
      const txCoins = byUser[email] || 0;
      console.log(`   ${email}: ${coins.toLocaleString()} (từ logs), ${txCoins.toLocaleString()} (từ tx)`);
    }

    return Response.json({
      success: true,
      sources: {
        valid_coins_from_audit_logs: validCoinsFromLogs,
        total_from_transactions: totalFromTransactions,
        total_from_community_rewards: totalFromCommunityRewards,
        transaction_types: byType
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