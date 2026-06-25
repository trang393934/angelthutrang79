import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Kiểm tra Net Valid Coins cho Top 5 users...\n');

    // Lấy tất cả audit logs
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    // Lấy tất cả balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);

    // Group logs by user
    const logsByUser = {};
    
    for (const log of auditLogs) {
      if (!logsByUser[log.user_email]) {
        logsByUser[log.user_email] = {
          valid_coins: 0,
          frozen_coins: 0,
          valid_logs: [],
          frozen_logs: []
        };
      }

      // Valid coins: chỉ từ exclusion_reason = 'valid'
      if (log.exclusion_reason === 'valid') {
        logsByUser[log.user_email].valid_coins += (log.coins_earned || 0);
        logsByUser[log.user_email].valid_logs.push({
          question: log.question_text?.substring(0, 50),
          coins: log.coins_earned
        });
      } else {
        logsByUser[log.user_email].frozen_coins += (log.coins_earned || 0);
        logsByUser[log.user_email].frozen_logs.push({
          reason: log.exclusion_reason,
          coins: log.coins_earned
        });
      }
    }

    // Sort by valid_coins desc và lấy top 5
    const top5 = Object.entries(logsByUser)
      .map(([email, data]) => ({
        email,
        valid_coins: data.valid_coins,
        frozen_coins: data.frozen_coins,
        total: data.valid_coins + data.frozen_coins,
        valid_count: data.valid_logs.length,
        frozen_count: data.frozen_logs.length
      }))
      .sort((a, b) => b.valid_coins - a.valid_coins)
      .slice(0, 5);

    console.log('📊 TOP 5 USERS (theo valid_coins):\n');
    
    let sysValidTotal = 0;
    let sysFrozenTotal = 0;

    for (let i = 0; i < top5.length; i++) {
      const user = top5[i];
      const balance = allBalances.find(b => b.user_email === user.email);
      
      sysValidTotal += user.valid_coins;
      sysFrozenTotal += user.frozen_coins;

      console.log(`${i + 1}. ${user.email}`);
      console.log(`   Valid coins (từ exclusion_reason='valid'): ${user.valid_coins.toLocaleString()}`);
      console.log(`   Frozen coins (duplicate/greeting/11+): ${user.frozen_coins.toLocaleString()}`);
      console.log(`   Tổng từ logs: ${user.total.toLocaleString()}`);
      if (balance) {
        console.log(`   Stored net_valid_coins: ${(balance.net_valid_coins || 0).toLocaleString()}`);
        console.log(`   Stored frozen_balance: ${(balance.frozen_balance || 0).toLocaleString()}`);
        console.log(`   Lỗi (valid): ${user.valid_coins - (balance.net_valid_coins || 0)}`);
        console.log(`   Lỗi (frozen): ${user.frozen_coins - (balance.frozen_balance || 0)}`);
      }
      console.log('');
    }

    return Response.json({
      success: true,
      top5_details: top5,
      system_totals: {
        total_valid_coins_from_logs: sysValidTotal,
        total_frozen_coins_from_logs: sysFrozenTotal,
        total_all: sysValidTotal + sysFrozenTotal
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