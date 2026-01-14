import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Lấy tất cả balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);

    const negativeBalances = {
      negative_total_earned: [],
      negative_net_valid: [],
      negative_frozen: [],
      negative_available: [],
      negative_paid: [],
      invalid_formula: []
    };

    for (const balance of allBalances) {
      const issues = [];

      // Check negative values
      if (balance.total_earned < 0) {
        negativeBalances.negative_total_earned.push({
          user_email: balance.user_email,
          total_earned: balance.total_earned,
          net_valid_coins: balance.net_valid_coins,
          frozen_balance: balance.frozen_balance,
          paid_amount: balance.paid_amount,
          available_for_withdrawal: balance.available_for_withdrawal
        });
        issues.push('total_earned < 0');
      }

      if (balance.net_valid_coins < 0) {
        negativeBalances.negative_net_valid.push({
          user_email: balance.user_email,
          net_valid_coins: balance.net_valid_coins,
          total_earned: balance.total_earned,
          frozen_balance: balance.frozen_balance
        });
        issues.push('net_valid_coins < 0');
      }

      if (balance.frozen_balance < 0) {
        negativeBalances.negative_frozen.push({
          user_email: balance.user_email,
          frozen_balance: balance.frozen_balance
        });
        issues.push('frozen_balance < 0');
      }

      if (balance.available_for_withdrawal < 0) {
        negativeBalances.negative_available.push({
          user_email: balance.user_email,
          available_for_withdrawal: balance.available_for_withdrawal,
          net_valid_coins: balance.net_valid_coins,
          paid_amount: balance.paid_amount
        });
        issues.push('available_for_withdrawal < 0');
      }

      if (balance.paid_amount < 0) {
        negativeBalances.negative_paid.push({
          user_email: balance.user_email,
          paid_amount: balance.paid_amount
        });
        issues.push('paid_amount < 0');
      }

      // Check formula validity: total_earned = net_valid_coins + frozen_balance
      const expectedTotal = (balance.net_valid_coins || 0) + (balance.frozen_balance || 0);
      const actualTotal = balance.total_earned || 0;
      
      if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        negativeBalances.invalid_formula.push({
          user_email: balance.user_email,
          actual_total_earned: actualTotal,
          expected_total_earned: expectedTotal,
          difference: actualTotal - expectedTotal,
          net_valid_coins: balance.net_valid_coins,
          frozen_balance: balance.frozen_balance
        });
        issues.push('total_earned formula invalid');
      }

      // Check available formula: available = net_valid - paid
      const expectedAvailable = (balance.net_valid_coins || 0) - (balance.paid_amount || 0);
      const actualAvailable = balance.available_for_withdrawal || 0;
      
      if (Math.abs(expectedAvailable - actualAvailable) > 0.01) {
        if (!negativeBalances.invalid_formula.some(item => item.user_email === balance.user_email)) {
          negativeBalances.invalid_formula.push({
            user_email: balance.user_email,
            actual_available: actualAvailable,
            expected_available: expectedAvailable,
            difference: actualAvailable - expectedAvailable,
            net_valid_coins: balance.net_valid_coins,
            paid_amount: balance.paid_amount
          });
        }
        issues.push('available_for_withdrawal formula invalid');
      }
    }

    const summary = {
      total_accounts: allBalances.length,
      accounts_with_issues: new Set([
        ...negativeBalances.negative_total_earned.map(b => b.user_email),
        ...negativeBalances.negative_net_valid.map(b => b.user_email),
        ...negativeBalances.negative_frozen.map(b => b.user_email),
        ...negativeBalances.negative_available.map(b => b.user_email),
        ...negativeBalances.negative_paid.map(b => b.user_email),
        ...negativeBalances.invalid_formula.map(b => b.user_email)
      ]).size,
      negative_total_earned_count: negativeBalances.negative_total_earned.length,
      negative_net_valid_count: negativeBalances.negative_net_valid.length,
      negative_frozen_count: negativeBalances.negative_frozen.length,
      negative_available_count: negativeBalances.negative_available.length,
      negative_paid_count: negativeBalances.negative_paid.length,
      invalid_formula_count: negativeBalances.invalid_formula.length
    };

    return Response.json({
      success: true,
      summary,
      details: negativeBalances,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Audit error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});