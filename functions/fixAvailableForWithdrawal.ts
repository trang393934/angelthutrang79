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

    console.log(`🔧 Fix available_for_withdrawal cho: ${target_user_email}`);

    // Fetch balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({
      user_email: target_user_email
    });

    if (balances.length === 0) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const balance = balances[0];
    const netValid = balance.net_valid_coins || 0;
    const paid = balance.paid_amount || 0;
    
    // Tính toán mà KHÔNG clamp về 0 - cho phép số âm
    const newAvailable = netValid - paid;

    console.log(`\n📊 BEFORE: available=${(balance.available_for_withdrawal || 0).toLocaleString()}`);
    console.log(`  Formula: ${netValid.toLocaleString()} - ${paid.toLocaleString()} = ${newAvailable.toLocaleString()}`);
    console.log(`\n📊 AFTER: available=${newAvailable.toLocaleString()}`);

    // Update TRỰC TIẾP với số âm
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      available_for_withdrawal: newAvailable
    });

    console.log(`✅ Updated!`);

    return Response.json({
      success: true,
      user_email: target_user_email,
      net_valid_coins: netValid,
      paid_amount: paid,
      available_for_withdrawal: newAvailable,
      formula: `${netValid} - ${paid} = ${newAvailable}`
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});