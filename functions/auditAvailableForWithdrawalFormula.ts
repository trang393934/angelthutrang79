import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Auditing available_for_withdrawal formula...');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-available_for_withdrawal', 50000);
    
    let systemTotalAvailable = 0;
    let formulaErrors = 0;
    const errors = [];

    for (const balance of allBalances) {
      const net_valid = balance.net_valid_coins || 0;
      const paid = balance.paid_amount || 0;
      const available_stored = balance.available_for_withdrawal || 0;
      
      // Tính công thức đúng
      const available_correct = net_valid - paid;
      systemTotalAvailable += available_correct;

      if (Math.abs(available_stored - available_correct) > 0) {
        formulaErrors++;
        if (errors.length < 30) {
          errors.push({
            email: balance.user_email,
            net_valid_coins: net_valid,
            paid_amount: paid,
            available_stored: available_stored,
            available_correct: available_correct,
            difference: available_stored - available_correct
          });
        }
      }
    }

    console.log(`\n📊 AVAILABLE_FOR_WITHDRAWAL AUDIT:`);
    console.log(`System total available (correct): ${systemTotalAvailable.toLocaleString()}`);
    console.log(`Users with formula errors: ${formulaErrors}/${allBalances.length}`);
    console.log(`\nLỗi công thức: available = net_valid_coins - paid_amount`);

    return Response.json({
      success: true,
      audit_results: {
        system_total_available_correct: systemTotalAvailable,
        users_checked: allBalances.length,
        users_with_errors: formulaErrors,
        formula: "available_for_withdrawal = net_valid_coins - paid_amount"
      },
      sample_errors: errors
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});