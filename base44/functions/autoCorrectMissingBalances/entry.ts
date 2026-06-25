import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // List of users with missing coins
    const missingBalances = [
      { email: 'tothiloan1011@gmail.com', missing: 3581000 },
      { email: 'dungluu1717@gmail.com', missing: 2674000 },
      { email: 'vietsoan080214@gmail.com', missing: 2548000 },
      { email: 'tongvankhanhthd@gmail.com', missing: 2170900 },
      { email: 'hanhtrinhtinhthuc1990@gmail.com', missing: 1869000 },
      { email: 'sangle12111@gmail.com', missing: 1646000 },
      { email: 'nguyenvietsoan2012@gmail.com', missing: 1499000 },
      { email: 'ngocvinhthp@gmail.com', missing: 1480000 },
      { email: 'dinhhuong21111996@gmail.com', missing: 1333000 },
      { email: 'tunguyen512000@gmail.com', missing: 808000 }
    ];

    const results = [];
    let totalCorrected = 0;

    for (const item of missingBalances) {
      try {
        // Get current balance
        const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
          user_email: item.email 
        });

        if (balances.length === 0) {
          results.push({
            email: item.email,
            status: 'error',
            message: 'Balance record not found'
          });
          continue;
        }

        const balance = balances[0];
        const currentNetValid = balance.net_valid_coins || 0;
        const currentTotalEarned = balance.total_earned || 0;
        const currentFrozen = balance.frozen_balance || 0;

        // Update net_valid_coins and total_earned
        const newNetValid = currentNetValid + item.missing;
        const newTotalEarned = newNetValid + currentFrozen;

        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          net_valid_coins: newNetValid,
          total_earned: newTotalEarned,
          available_for_withdrawal: newNetValid - (balance.paid_amount || 0)
        });

        // Create transaction record
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: item.email,
          amount: 0,
          type: 'admin_adjustment',
          description: `✅ Auto-Correction: Cập nhật số dư thiếu +${item.missing.toLocaleString()} Camlycoin\n📊 Net Valid: ${currentNetValid.toLocaleString()} → ${newNetValid.toLocaleString()}\n💰 Total Earned: ${currentTotalEarned.toLocaleString()} → ${newTotalEarned.toLocaleString()}`,
          processed_by: user.email
        });

        results.push({
          email: item.email,
          status: 'success',
          missing: item.missing,
          old_net_valid: currentNetValid,
          new_net_valid: newNetValid,
          old_total_earned: currentTotalEarned,
          new_total_earned: newTotalEarned
        });

        totalCorrected += item.missing;

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.push({
          email: item.email,
          status: 'error',
          message: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return Response.json({
      success: true,
      summary: {
        total_users: missingBalances.length,
        success: successCount,
        failed: missingBalances.length - successCount,
        total_coins_corrected: totalCorrected
      },
      results
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});