import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`📊 Recalculating balance for ${target_user_email} from cleaned logs`);

    // Fetch all cleaned audit logs
    const cleanedLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📌 Total cleaned logs: ${cleanedLogs.length}`);

    // Calculate totals
    let totalEarned = 0;
    let netValidCoins = 0;
    let frozenBalance = 0;

    cleanedLogs.forEach(log => {
      const coins = log.coins_earned || 0;
      totalEarned += coins;
      
      if (log.exclusion_reason === 'valid') {
        netValidCoins += coins;
      } else {
        frozenBalance += coins;
      }
    });

    console.log(`\n💰 Calculated totals:`);
    console.log(`  Total Earned: ${totalEarned}`);
    console.log(`  Net Valid Coins: ${netValidCoins}`);
    console.log(`  Frozen Balance: ${frozenBalance}`);

    // Fetch current balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_user_email }
    );

    if (balances.length === 0) {
      console.log(`⚠️ No balance record found, creating new one`);
      
      const newBalance = await base44.asServiceRole.entities.CamlycoinBalance.create({
        user_email: target_user_email,
        total_earned: totalEarned,
        net_valid_coins: netValidCoins,
        frozen_balance: frozenBalance,
        paid_amount: 0,
        available_for_withdrawal: netValidCoins
      });

      console.log(`✅ Created new balance record`);

      // Create transaction record
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: target_user_email,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Cleanup duplicate audit logs (970→141). Recalculated totals: ${totalEarned} = ${netValidCoins} valid + ${frozenBalance} frozen`,
        processed_by: user.email
      });

      return Response.json({
        success: true,
        action: 'created_new_balance',
        user_email: target_user_email,
        total_logs: cleanedLogs.length,
        calculated: {
          total_earned: totalEarned,
          net_valid_coins: netValidCoins,
          frozen_balance: frozenBalance,
          paid_amount: 0,
          available_for_withdrawal: netValidCoins
        }
      });
    }

    const balance = balances[0];
    const oldTotalEarned = balance.total_earned || 0;
    const paidAmount = balance.paid_amount || 0;
    const availableForWithdrawal = netValidCoins - paidAmount;

    console.log(`\n📊 Comparison:`);
    console.log(`  Old total_earned: ${oldTotalEarned} → New: ${totalEarned} (Δ ${totalEarned - oldTotalEarned})`);
    console.log(`  Old net_valid_coins: ${balance.net_valid_coins || 0} → New: ${netValidCoins}`);
    console.log(`  Old frozen_balance: ${balance.frozen_balance || 0} → New: ${frozenBalance}`);
    console.log(`  Available for withdrawal: ${availableForWithdrawal}`);

    // Update balance
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      total_earned: totalEarned,
      net_valid_coins: netValidCoins,
      frozen_balance: frozenBalance,
      available_for_withdrawal: availableForWithdrawal
    });

    console.log(`✅ Balance updated`);

    // Create transaction record
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: target_user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Cleanup duplicate audit logs (970→141 logs). Recalculated: total_earned=${totalEarned}, net_valid=${netValidCoins}, frozen=${frozenBalance}`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      action: 'updated_balance',
      user_email: target_user_email,
      total_logs: cleanedLogs.length,
      comparison: {
        old_total_earned: oldTotalEarned,
        new_total_earned: totalEarned,
        difference: totalEarned - oldTotalEarned
      },
      calculated: {
        total_earned: totalEarned,
        net_valid_coins: netValidCoins,
        frozen_balance: frozenBalance,
        paid_amount: paidAmount,
        available_for_withdrawal: availableForWithdrawal
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});