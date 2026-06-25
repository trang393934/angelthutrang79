import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔄 REBUILDING USER BALANCES FROM SCRATCH...\n');

    // Fetch all data sources
    const auditLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 50000);
    const existingBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50000);

    console.log(`📊 Data sources:`);
    console.log(`   - Audit logs: ${auditLogs.length}`);
    console.log(`   - Transactions: ${transactions.length}`);
    console.log(`   - Withdrawals: ${withdrawals.length}`);
    console.log(`   - Existing balances: ${existingBalances.length}\n`);

    // Group audit logs by user
    const logsByUser = {};
    for (const log of auditLogs) {
      if (!logsByUser[log.user_email]) {
        logsByUser[log.user_email] = {
          valid: [],
          frozen: []
        };
      }
      if (log.exclusion_reason === 'valid') {
        logsByUser[log.user_email].valid.push(log);
      } else {
        logsByUser[log.user_email].frozen.push(log);
      }
    }

    // Group successful withdrawals by user
    const withdrawalsByUser = {};
    for (const withdrawal of withdrawals) {
      if (withdrawal.status === 'completed') {
        if (!withdrawalsByUser[withdrawal.user_email]) {
          withdrawalsByUser[withdrawal.user_email] = [];
        }
        withdrawalsByUser[withdrawal.user_email].push(withdrawal);
      }
    }

    // Calculate correct balances for each user
    const newBalances = {};
    const allUsers = new Set([
      ...Object.keys(logsByUser),
      ...Object.keys(withdrawalsByUser),
      ...existingBalances.map(b => b.user_email)
    ]);

    console.log(`👥 Total unique users: ${allUsers.size}\n`);

    let updateCount = 0;
    let createCount = 0;
    let errors = 0;

    for (const userEmail of allUsers) {
      try {
        const userLogs = logsByUser[userEmail] || { valid: [], frozen: [] };
        const userWithdrawals = withdrawalsByUser[userEmail] || [];

        // Calculate net_valid_coins from valid audit logs
        const net_valid_coins = userLogs.valid.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Calculate frozen_balance from frozen audit logs
        const frozen_balance = userLogs.frozen.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

        // Calculate paid_amount from completed withdrawals
        const paid_amount = userWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

        // Calculate derived fields
        const total_earned = net_valid_coins + frozen_balance;
        const available_for_withdrawal = Math.max(0, net_valid_coins - paid_amount);

        // Find existing balance record
        const existingBalance = existingBalances.find(b => b.user_email === userEmail);

        if (existingBalance) {
          // Update existing record
          await base44.asServiceRole.entities.CamlycoinBalance.update(existingBalance.id, {
            net_valid_coins,
            frozen_balance,
            total_earned,
            paid_amount,
            available_for_withdrawal
          });
          updateCount++;
        } else {
          // Create new record
          await base44.asServiceRole.entities.CamlycoinBalance.create({
            user_email: userEmail,
            net_valid_coins,
            frozen_balance,
            total_earned,
            paid_amount,
            available_for_withdrawal
          });
          createCount++;
        }

        if ((updateCount + createCount) % 10 === 0) {
          console.log(`✅ Processed ${updateCount + createCount} users...`);
        }

        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        errors++;
        console.error(`❌ Error for ${userEmail}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Verify final totals
    const finalBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    const systemTotalEarned = finalBalances.reduce((sum, b) => sum + ((b.net_valid_coins || 0) + (b.frozen_balance || 0)), 0);
    const systemTotalAvailable = finalBalances.reduce((sum, b) => sum + (b.available_for_withdrawal || 0), 0);
    const systemTotalPaid = finalBalances.reduce((sum, b) => sum + (b.paid_amount || 0), 0);

    console.log(`\n✅ REBUILD COMPLETE:`);
    console.log(`   - Balances updated: ${updateCount}`);
    console.log(`   - Balances created: ${createCount}`);
    console.log(`   - Errors: ${errors}\n`);
    console.log(`📊 SYSTEM TOTALS (RECALCULATED):`);
    console.log(`   - Total Earned: ${systemTotalEarned.toLocaleString()}`);
    console.log(`   - Total Available: ${systemTotalAvailable.toLocaleString()}`);
    console.log(`   - Total Paid: ${systemTotalPaid.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        total_users: allUsers.size,
        balances_updated: updateCount,
        balances_created: createCount,
        errors: errors
      },
      system_totals: {
        total_earned: systemTotalEarned,
        total_available_for_withdrawal: systemTotalAvailable,
        total_paid_amount: systemTotalPaid
      },
      formula_used: {
        net_valid_coins: "sum of all audit logs with exclusion_reason='valid'",
        frozen_balance: "sum of all audit logs with exclusion_reason!='valid'",
        total_earned: "net_valid_coins + frozen_balance",
        paid_amount: "sum of completed withdrawals",
        available_for_withdrawal: "max(0, net_valid_coins - paid_amount)"
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