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

    console.log(`💰 Recalculating balance for ${target_user_email}`);

    // Fetch all cleaned logs (should be 141 now)
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Total cleaned logs: ${allLogs.length}`);

    // Calculate totals from logs
    let total_earned = 0;
    let net_valid_coins = 0;
    let frozen_balance = 0;
    let valid_count = 0;
    let frozen_count = 0;

    allLogs.forEach(log => {
      const coins = log.coins_earned || 0;
      total_earned += coins;

      if (log.exclusion_reason === 'valid') {
        net_valid_coins += coins;
        valid_count++;
      } else {
        frozen_balance += coins;
        frozen_count++;
      }
    });

    console.log(`\n✅ Valid questions: ${valid_count} = ${net_valid_coins.toLocaleString()} coins`);
    console.log(`❌ Frozen/Duplicate: ${frozen_count} = ${frozen_balance.toLocaleString()} coins`);
    console.log(`💰 Total Earned: ${total_earned.toLocaleString()} coins`);

    // Get current balance to find paid_amount
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_user_email }
    );
    const currentBalance = balances[0];
    const paid_amount = currentBalance?.paid_amount || 0;

    console.log(`\n💸 Paid Amount: ${paid_amount.toLocaleString()} coins`);

    // Calculate available_for_withdrawal
    const available_for_withdrawal = net_valid_coins - paid_amount;

    console.log(`📈 Available for withdrawal: ${available_for_withdrawal.toLocaleString()} coins`);

    // Update balance
    if (currentBalance) {
      await base44.asServiceRole.entities.CamlycoinBalance.update(currentBalance.id, {
        total_earned,
        net_valid_coins,
        frozen_balance,
        available_for_withdrawal
      });
    } else {
      await base44.asServiceRole.entities.CamlycoinBalance.create({
        user_email: target_user_email,
        total_earned,
        net_valid_coins,
        frozen_balance,
        paid_amount,
        available_for_withdrawal
      });
    }

    console.log(`\n✅ Balance updated!`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      logs_count: allLogs.length,
      calculated: {
        total_earned,
        net_valid_coins,
        frozen_balance,
        paid_amount,
        available_for_withdrawal,
        valid_questions: valid_count,
        frozen_questions: frozen_count
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});