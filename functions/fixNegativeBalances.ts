import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    const fixedAccounts = [];
    const errors = [];

    for (const balance of allBalances) {
      let needsUpdate = false;
      const updates = {};
      const issues = [];

      // Fix negative values - reset to 0
      if (balance.net_valid_coins < 0) {
        updates.net_valid_coins = 0;
        needsUpdate = true;
        issues.push(`net_valid_coins: ${balance.net_valid_coins} → 0`);
      }

      if (balance.frozen_balance < 0) {
        updates.frozen_balance = 0;
        needsUpdate = true;
        issues.push(`frozen_balance: ${balance.frozen_balance} → 0`);
      }

      if (balance.paid_amount < 0) {
        updates.paid_amount = 0;
        needsUpdate = true;
        issues.push(`paid_amount: ${balance.paid_amount} → 0`);
      }

      // Get current or updated values
      const netValid = updates.net_valid_coins !== undefined ? updates.net_valid_coins : (balance.net_valid_coins || 0);
      const frozen = updates.frozen_balance !== undefined ? updates.frozen_balance : (balance.frozen_balance || 0);
      const paid = updates.paid_amount !== undefined ? updates.paid_amount : (balance.paid_amount || 0);

      // Fix total_earned formula: total_earned = net_valid_coins + frozen_balance
      const correctTotal = netValid + frozen;
      if (Math.abs((balance.total_earned || 0) - correctTotal) > 0.01) {
        updates.total_earned = correctTotal;
        needsUpdate = true;
        issues.push(`total_earned: ${balance.total_earned} → ${correctTotal}`);
      }

      // Fix available_for_withdrawal formula: available = net_valid - paid
      const correctAvailable = netValid - paid;
      if (Math.abs((balance.available_for_withdrawal || 0) - correctAvailable) > 0.01) {
        updates.available_for_withdrawal = correctAvailable;
        needsUpdate = true;
        issues.push(`available: ${balance.available_for_withdrawal} → ${correctAvailable}`);
      }

      if (needsUpdate) {
        try {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, updates);
          fixedAccounts.push({
            user_email: balance.user_email,
            issues,
            updates
          });
        } catch (error) {
          errors.push({
            user_email: balance.user_email,
            error: error.message
          });
        }
      }
    }

    return Response.json({
      success: true,
      total_checked: allBalances.length,
      fixed_count: fixedAccounts.length,
      error_count: errors.length,
      fixed_accounts: fixedAccounts,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fix error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});