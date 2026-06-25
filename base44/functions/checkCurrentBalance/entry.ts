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

    console.log(`📊 Check balance for: ${target_user_email}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];

    console.log(`\n💾 CURRENT DATABASE STATE:`);
    console.log(`  total_earned: ${(balance.total_earned || 0).toLocaleString()}`);
    console.log(`  net_valid_coins: ${(balance.net_valid_coins || 0).toLocaleString()}`);
    console.log(`  frozen_balance: ${(balance.frozen_balance || 0).toLocaleString()}`);
    console.log(`  paid_amount: ${(balance.paid_amount || 0).toLocaleString()}`);
    console.log(`  available_for_withdrawal: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);

    // Verify formula
    const calculatedTotal = (balance.net_valid_coins || 0) + (balance.frozen_balance || 0);
    const calculatedAvailable = (balance.net_valid_coins || 0) - (balance.paid_amount || 0);

    console.log(`\n🔍 FORMULA VERIFICATION:`);
    console.log(`  total_earned should = net_valid + frozen = ${(balance.net_valid_coins || 0).toLocaleString()} + ${(balance.frozen_balance || 0).toLocaleString()} = ${calculatedTotal.toLocaleString()}`);
    console.log(`  Database shows: ${(balance.total_earned || 0).toLocaleString()}`);
    console.log(`  Match: ${calculatedTotal === (balance.total_earned || 0) ? '✅ YES' : '❌ NO'}`);

    console.log(`\n  available = net_valid - paid = ${(balance.net_valid_coins || 0).toLocaleString()} - ${(balance.paid_amount || 0).toLocaleString()} = ${calculatedAvailable.toLocaleString()}`);
    console.log(`  Database shows: ${(balance.available_for_withdrawal || 0).toLocaleString()}`);
    console.log(`  Match: ${calculatedAvailable === (balance.available_for_withdrawal || 0) ? '✅ YES' : '❌ NO'}`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_earned: balance.total_earned || 0,
      net_valid_coins: balance.net_valid_coins || 0,
      frozen_balance: balance.frozen_balance || 0,
      paid_amount: balance.paid_amount || 0,
      available_for_withdrawal: balance.available_for_withdrawal || 0,
      formula_valid: {
        total_earned_correct: calculatedTotal === (balance.total_earned || 0),
        available_correct: calculatedAvailable === (balance.available_for_withdrawal || 0)
      }
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});