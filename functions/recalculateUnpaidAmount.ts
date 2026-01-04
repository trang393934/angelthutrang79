import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔄 Recalculating unpaid_amount for all users...');

    const report = {
      processed: 0,
      success: 0,
      errors: [],
      details: []
    };

    // Get all balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 10000);

    for (const balance of allBalances) {
      try {
        const userEmail = balance.user_email;
        console.log(`\n📊 Processing ${userEmail}...`);

        const totalEarned = balance.total_earned || 0;
        const availableBalance = balance.available_balance || 0;
        const paidAmount = balance.paid_amount || 0;
        const frozenBalance = balance.frozen_balance || 0;
        const pendingReviewBalance = balance.pending_review_balance || 0;

        // Apply formula: unpaid_amount = total_earned - available_balance - paid_amount - frozen_balance - pending_review_balance
        const calculatedUnpaidAmount = totalEarned - availableBalance - paidAmount - frozenBalance - pendingReviewBalance;

        console.log(`Total Earned: ${totalEarned}`);
        console.log(`Available: ${availableBalance}`);
        console.log(`Paid: ${paidAmount}`);
        console.log(`Frozen: ${frozenBalance}`);
        console.log(`Pending Review: ${pendingReviewBalance}`);
        console.log(`Calculated Unpaid: ${calculatedUnpaidAmount}`);
        console.log(`Current Unpaid: ${balance.unpaid_amount || 0}`);

        // Update unpaid_amount
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          unpaid_amount: Math.max(0, calculatedUnpaidAmount)
        });

        // Create transaction log
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: userEmail,
          amount: 0,
          type: 'admin_adjustment',
          description: `🔧 Admin recalculate unpaid_amount:\n` +
            `Formula: ${totalEarned} - ${availableBalance} - ${paidAmount} - ${frozenBalance} - ${pendingReviewBalance} = ${calculatedUnpaidAmount}\n` +
            `Unpaid Amount = ${Math.max(0, calculatedUnpaidAmount)} Camlycoin`,
          processed_by: user.email
        });

        report.success++;
        report.details.push({
          user_email: userEmail,
          old_unpaid: balance.unpaid_amount || 0,
          new_unpaid: Math.max(0, calculatedUnpaidAmount),
          difference: Math.max(0, calculatedUnpaidAmount) - (balance.unpaid_amount || 0)
        });

        // Delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing ${balance.user_email}:`, error);
        report.errors.push({
          user: balance.user_email,
          error: error.message
        });
      }

      report.processed++;
    }

    return Response.json({
      success: true,
      message: `Recalculated unpaid_amount for ${report.success}/${report.processed} users`,
      report
    });

  } catch (error) {
    console.error('Recalculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});