import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email required' }, { status: 400 });
    }

    console.log(`🔍 Checking bounty rewards for ${target_email}...`);

    // Get ALL CamlycoinTransaction entries
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_email
    }, '-created_date', 10000);

    // Filter bounty_reward transactions
    const bountyRewards = allTransactions.filter(tx => tx.type === 'bounty_reward');
    const manualAdds = allTransactions.filter(tx => tx.type === 'manual_add');
    const adminAdjustments = allTransactions.filter(tx => tx.type === 'admin_adjustment');

    console.log(`\n📊 BOUNTY REWARDS: ${bountyRewards.length} transactions`);
    console.log(`📊 MANUAL ADDS: ${manualAdds.length} transactions`);
    console.log(`📊 ADMIN ADJUSTMENTS: ${adminAdjustments.length} transactions`);

    // Calculate totals
    const bountyTotal = bountyRewards.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const manualTotal = manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const adminTotal = adminAdjustments.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Group by date
    const bountyByDate = {};
    for (const tx of bountyRewards) {
      const date = tx.created_date.split('T')[0];
      if (!bountyByDate[date]) {
        bountyByDate[date] = { count: 0, amount: 0, items: [] };
      }
      bountyByDate[date].count++;
      bountyByDate[date].amount += tx.amount || 0;
      bountyByDate[date].items.push({
        time: tx.created_date,
        amount: tx.amount,
        description: tx.description,
        reference_id: tx.reference_id
      });
    }

    // Check if these transactions are from real bounty submissions
    const referenceIds = [...new Set(bountyRewards.map(tx => tx.reference_id).filter(Boolean))];
    console.log(`\n🔗 Unique reference_ids: ${referenceIds.length}`);

    const submissionCheck = [];
    for (const refId of referenceIds.slice(0, 20)) { // Check first 20
      try {
        const submissions = await base44.asServiceRole.entities.BountySubmission.filter({
          id: refId
        });
        submissionCheck.push({
          reference_id: refId,
          found: submissions.length > 0,
          submission: submissions.length > 0 ? {
            status: submissions[0].status,
            coins_awarded: submissions[0].coins_awarded
          } : null
        });
      } catch (e) {
        submissionCheck.push({
          reference_id: refId,
          error: e.message
        });
      }
    }

    console.log(`\n💰 TOTALS:`);
    console.log(`Bounty Rewards: ${bountyTotal.toLocaleString()}`);
    console.log(`Manual Adds: ${manualTotal.toLocaleString()}`);
    console.log(`Admin Adjustments: ${adminTotal.toLocaleString()}`);
    console.log(`TOTAL: ${(bountyTotal + manualTotal + adminTotal).toLocaleString()}`);

    return Response.json({
      success: true,
      user_email: target_email,
      summary: {
        bounty_rewards: {
          count: bountyRewards.length,
          total: bountyTotal
        },
        manual_adds: {
          count: manualAdds.length,
          total: manualTotal
        },
        admin_adjustments: {
          count: adminAdjustments.length,
          total: adminTotal
        },
        grand_total: bountyTotal + manualTotal + adminTotal
      },
      bounty_by_date: bountyByDate,
      submission_check: submissionCheck,
      sample_bounty_rewards: bountyRewards.slice(0, 20).map(tx => ({
        date: tx.created_date,
        amount: tx.amount,
        description: tx.description,
        reference_id: tx.reference_id
      })),
      sample_manual_adds: manualAdds.slice(0, 10).map(tx => ({
        date: tx.created_date,
        amount: tx.amount,
        description: tx.description
      })),
      sample_admin_adjustments: adminAdjustments.slice(0, 10).map(tx => ({
        date: tx.created_date,
        amount: tx.amount,
        description: tx.description
      }))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});