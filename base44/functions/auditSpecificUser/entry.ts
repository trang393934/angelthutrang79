import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email required' }, { status: 400 });
    }

    console.log(`🔍 Auditing ${target_email}...`);

    // Get balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const balance = balances[0];

    // Get ALL logs
    const logs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: target_email
    }, '-audit_date', 10000);

    // Get ALL withdrawals
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      user_email: target_email
    }, '-created_date', 1000);

    // Calculate totals from logs
    let totalFromLogs = 0;
    let validFromLogs = 0;
    let frozenFromLogs = 0;

    const logsByDate = {};
    for (const log of logs) {
      const coins = log.coins_earned || 0;
      totalFromLogs += coins;
      
      if (log.coin_category === 'frozen') {
        frozenFromLogs += coins;
      } else {
        validFromLogs += coins;
      }

      const date = (log.audit_date || log.created_date).split('T')[0];
      if (!logsByDate[date]) {
        logsByDate[date] = { valid: 0, frozen: 0, count: 0 };
      }
      logsByDate[date].count++;
      if (log.coin_category === 'frozen') {
        logsByDate[date].frozen += coins;
      } else {
        logsByDate[date].valid += coins;
      }
    }

    // Group withdrawals by status
    const withdrawalsByStatus = {};
    let totalWithdrawn = 0;
    for (const w of withdrawals) {
      if (!withdrawalsByStatus[w.status]) {
        withdrawalsByStatus[w.status] = [];
      }
      withdrawalsByStatus[w.status].push({
        amount: w.amount,
        date: w.created_date,
        status: w.status
      });
      if (w.status === 'completed') {
        totalWithdrawn += w.amount || 0;
      }
    }

    // Timeline: combine logs and withdrawals
    const timeline = [];
    
    for (const log of logs) {
      timeline.push({
        date: log.audit_date || log.created_date,
        type: 'EARN',
        amount: log.coins_earned || 0,
        category: log.coin_category,
        details: `Question: ${log.question_text?.substring(0, 50)}...`
      });
    }

    for (const w of withdrawals) {
      timeline.push({
        date: w.created_date,
        type: 'WITHDRAWAL',
        amount: w.amount,
        status: w.status,
        details: `Withdrawal ${w.status}`
      });
    }

    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningValid = 0;
    let runningWithdrawn = 0;
    for (const event of timeline) {
      if (event.type === 'EARN' && event.category !== 'frozen') {
        runningValid += event.amount;
      }
      if (event.type === 'WITHDRAWAL' && event.status === 'completed') {
        runningWithdrawn += event.amount;
      }
      event.running_valid = runningValid;
      event.running_withdrawn = runningWithdrawn;
      event.running_available = runningValid - runningWithdrawn;
    }

    console.log(`\n📊 CURRENT BALANCE:`);
    console.log(`Total Earned: ${balance.total_earned?.toLocaleString()}`);
    console.log(`Net Valid: ${balance.net_valid_coins?.toLocaleString()}`);
    console.log(`Frozen: ${balance.frozen_balance?.toLocaleString()}`);
    console.log(`Paid: ${balance.paid_amount?.toLocaleString()}`);
    console.log(`Available: ${balance.available_for_withdrawal?.toLocaleString()}`);

    console.log(`\n📈 FROM LOGS:`);
    console.log(`Total: ${totalFromLogs.toLocaleString()}`);
    console.log(`Valid: ${validFromLogs.toLocaleString()}`);
    console.log(`Frozen: ${frozenFromLogs.toLocaleString()}`);
    console.log(`Withdrawn: ${totalWithdrawn.toLocaleString()}`);

    console.log(`\n❌ PROBLEM: User withdrew ${totalWithdrawn.toLocaleString()} but only earned ${validFromLogs.toLocaleString()}`);
    console.log(`Deficit: ${(totalWithdrawn - validFromLogs).toLocaleString()}`);

    return Response.json({
      success: true,
      user_email: target_email,
      current_balance: {
        total_earned: balance.total_earned || 0,
        net_valid: balance.net_valid_coins || 0,
        frozen: balance.frozen_balance || 0,
        paid: balance.paid_amount || 0,
        available: balance.available_for_withdrawal || 0
      },
      from_logs: {
        total: totalFromLogs,
        valid: validFromLogs,
        frozen: frozenFromLogs,
        withdrawn: totalWithdrawn
      },
      deficit: totalWithdrawn - validFromLogs,
      logs_by_date: logsByDate,
      withdrawals_by_status: withdrawalsByStatus,
      timeline: timeline.slice(0, 50), // First 50 events
      summary: {
        total_logs: logs.length,
        total_withdrawals: withdrawals.length,
        completed_withdrawals: withdrawals.filter(w => w.status === 'completed').length
      }
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});