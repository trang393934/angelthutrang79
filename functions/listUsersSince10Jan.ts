import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const cutoffDate = new Date('2026-01-10T00:00:00Z');
    
    // Get all logs since 10/1
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
    const logsSince10Jan = allLogs.filter(log => {
      const logDate = new Date(log.audit_date || log.created_date);
      return logDate >= cutoffDate;
    });

    // Group by user
    const userStats = {};
    for (const log of logsSince10Jan) {
      if (!userStats[log.user_email]) {
        userStats[log.user_email] = {
          email: log.user_email,
          logs_count: 0,
          total_coins: 0,
          valid_coins: 0,
          frozen_coins: 0
        };
      }
      
      const coins = log.coins_earned || 0;
      userStats[log.user_email].logs_count++;
      userStats[log.user_email].total_coins += coins;
      
      if (log.coin_category === 'frozen') {
        userStats[log.user_email].frozen_coins += coins;
      } else {
        userStats[log.user_email].valid_coins += coins;
      }
    }

    const users = Object.values(userStats).sort((a, b) => b.total_coins - a.total_coins);

    console.log('\n📋 USERS ACTIVE SINCE 10/1:');
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email} - ${u.total_coins.toLocaleString()} coins (${u.logs_count} logs)`);
    });

    return Response.json({
      success: true,
      cutoff_date: cutoffDate.toISOString(),
      total_users: users.length,
      total_logs: logsSince10Jan.length,
      users
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});