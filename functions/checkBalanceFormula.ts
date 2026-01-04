import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail is required' }, { status: 400 });
    }

    console.log(`🔍 Checking balance formula for ${targetUserEmail}...`);

    // Get user balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email: targetUserEmail 
    });

    if (balances.length === 0) {
      return Response.json({ error: 'No balance found for user' }, { status: 404 });
    }

    const balance = balances[0];

    // Extract values
    const totalEarned = balance.total_earned || 0;
    const availableBalance = balance.available_balance || 0;
    const paidAmount = balance.paid_amount || 0;
    const frozenBalance = balance.frozen_balance || 0;
    const unpaidAmount = balance.unpaid_amount || 0;
    const pendingReviewBalance = balance.pending_review_balance || 0;
    const currentBalance = balance.balance || 0;

    // Calculate expected unpaid_amount using formula:
    // unpaid_amount = total_earned - available_balance - paid_amount - frozen_balance - pending_review_balance
    const calculatedUnpaidAmount = totalEarned - availableBalance - paidAmount - frozenBalance - pendingReviewBalance;

    // Check if formula is correct
    const isCorrect = Math.abs(calculatedUnpaidAmount - unpaidAmount) < 1;

    console.log('\n📊 Balance Breakdown:');
    console.log(`Total Earned: ${totalEarned.toLocaleString()}`);
    console.log(`Available Balance: ${availableBalance.toLocaleString()}`);
    console.log(`Paid Amount: ${paidAmount.toLocaleString()}`);
    console.log(`Frozen Balance: ${frozenBalance.toLocaleString()}`);
    console.log(`Pending Review: ${pendingReviewBalance.toLocaleString()}`);
    console.log(`Current Balance: ${currentBalance.toLocaleString()}`);
    console.log(`\n🧮 Formula Check:`);
    console.log(`${totalEarned.toLocaleString()} - ${availableBalance.toLocaleString()} - ${paidAmount.toLocaleString()} - ${frozenBalance.toLocaleString()} - ${pendingReviewBalance.toLocaleString()} = ${calculatedUnpaidAmount.toLocaleString()}`);
    console.log(`Actual Unpaid Amount: ${unpaidAmount.toLocaleString()}`);
    console.log(`Difference: ${(calculatedUnpaidAmount - unpaidAmount).toLocaleString()}`);

    return Response.json({
      success: true,
      user_email: targetUserEmail,
      balance_data: {
        total_earned: totalEarned,
        available_balance: availableBalance,
        paid_amount: paidAmount,
        frozen_balance: frozenBalance,
        pending_review_balance: pendingReviewBalance,
        unpaid_amount: unpaidAmount,
        current_balance: currentBalance
      },
      formula_check: {
        calculated_unpaid_amount: calculatedUnpaidAmount,
        actual_unpaid_amount: unpaidAmount,
        difference: calculatedUnpaidAmount - unpaidAmount,
        is_correct: isCorrect,
        formula: 'total_earned - available_balance - paid_amount - frozen_balance - pending_review_balance = unpaid_amount'
      }
    });

  } catch (error) {
    console.error('Check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});