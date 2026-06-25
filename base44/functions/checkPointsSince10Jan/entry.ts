import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔍 Checking if points since 10/1/2026 have been added...');

    const cutoffDate = new Date('2026-01-10T00:00:00Z');
    console.log(`📅 Cutoff: ${cutoffDate.toISOString()}`);

    // Get all logs since 10/1
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
    const logsSince10Jan = allLogs.filter(log => {
      const logDate = new Date(log.audit_date || log.created_date);
      return logDate >= cutoffDate;
    });

    console.log(`📊 Found ${logsSince10Jan.length} logs since 10/1`);

    // Group by user
    const userLogsMap = {};
    for (const log of logsSince10Jan) {
      if (!userLogsMap[log.user_email]) {
        userLogsMap[log.user_email] = [];
      }
      userLogsMap[log.user_email].push(log);
    }

    console.log(`👥 ${Object.keys(userLogsMap).length} users have activity since 10/1`);

    // Check each user
    const results = [];
    for (const [email, logs] of Object.entries(userLogsMap)) {
      // Calculate totals from logs
      let totalFromLogs = 0;
      let validFromLogs = 0;
      let frozenFromLogs = 0;

      for (const log of logs) {
        const coins = log.coins_earned || 0;
        totalFromLogs += coins;
        
        if (log.coin_category === 'frozen') {
          frozenFromLogs += coins;
        } else {
          validFromLogs += coins;
        }
      }

      // Get current balance
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
        user_email: email
      });

      if (balances.length === 0) {
        results.push({
          email,
          status: 'NO_BALANCE',
          logs_since_10jan: logs.length,
          coins_from_logs: totalFromLogs,
          valid_from_logs: validFromLogs,
          frozen_from_logs: frozenFromLogs,
          current_balance: null,
          missing: true
        });
        continue;
      }

      const balance = balances[0];

      // Get all logs (not just since 10/1) to calculate expected balance
      const allUserLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
        user_email: email
      }, '-audit_date', 10000);

      let expectedTotal = 0;
      let expectedValid = 0;
      let expectedFrozen = 0;

      for (const log of allUserLogs) {
        const coins = log.coins_earned || 0;
        expectedTotal += coins;
        
        if (log.coin_category === 'frozen') {
          expectedFrozen += coins;
        } else {
          expectedValid += coins;
        }
      }

      const balanceMatches = 
        Math.abs((balance.total_earned || 0) - expectedTotal) < 1 &&
        Math.abs((balance.net_valid_coins || 0) - expectedValid) < 1 &&
        Math.abs((balance.frozen_balance || 0) - expectedFrozen) < 1;

      results.push({
        email,
        status: balanceMatches ? 'SYNCED' : 'MISMATCH',
        logs_since_10jan: logs.length,
        coins_from_logs_10jan: totalFromLogs,
        valid_from_logs_10jan: validFromLogs,
        frozen_from_logs_10jan: frozenFromLogs,
        current_balance: {
          total_earned: balance.total_earned || 0,
          net_valid: balance.net_valid_coins || 0,
          frozen: balance.frozen_balance || 0
        },
        expected_balance: {
          total_earned: expectedTotal,
          net_valid: expectedValid,
          frozen: expectedFrozen
        },
        difference: {
          total: (balance.total_earned || 0) - expectedTotal,
          valid: (balance.net_valid_coins || 0) - expectedValid,
          frozen: (balance.frozen_balance || 0) - expectedFrozen
        },
        missing: !balanceMatches
      });
    }

    // Summary
    const synced = results.filter(r => r.status === 'SYNCED').length;
    const mismatched = results.filter(r => r.status === 'MISMATCH').length;
    const noBalance = results.filter(r => r.status === 'NO_BALANCE').length;

    console.log(`\n✅ SYNCED: ${synced}`);
    console.log(`❌ MISMATCH: ${mismatched}`);
    console.log(`⚠️ NO_BALANCE: ${noBalance}`);

    return Response.json({
      success: true,
      cutoff_date: cutoffDate.toISOString(),
      summary: {
        total_users: results.length,
        synced,
        mismatched,
        no_balance: noBalance,
        total_logs_since_10jan: logsSince10Jan.length
      },
      users: results
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});