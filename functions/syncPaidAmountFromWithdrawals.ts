import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all completed withdrawal requests
    const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 10000);
    const completedWithdrawals = allWithdrawals.filter(w => w.status === 'completed');

    console.log(`Found ${completedWithdrawals.length} completed withdrawals`);

    // Group by user and calculate total withdrawn
    const userWithdrawals = {};
    for (const withdrawal of completedWithdrawals) {
      if (!userWithdrawals[withdrawal.user_email]) {
        userWithdrawals[withdrawal.user_email] = 0;
      }
      userWithdrawals[withdrawal.user_email] += withdrawal.amount;
    }

    console.log(`Processing ${Object.keys(userWithdrawals).length} users`);

    const results = [];

    // Update each user's paid_amount
    for (const [userEmail, totalWithdrawn] of Object.entries(userWithdrawals)) {
      try {
        const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
        
        if (balances.length === 0) {
          console.warn(`No balance found for ${userEmail}`);
          continue;
        }

        const balance = balances[0];
        const currentPaid = balance.paid_amount || 0;

        // Update paid_amount to match total withdrawn
        if (currentPaid !== totalWithdrawn) {
          const difference = totalWithdrawn - currentPaid;
          
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            paid_amount: totalWithdrawn,
            balance: (balance.balance || 0) - difference
          });

          // Create transaction log
          await base44.asServiceRole.entities.CamlycoinTransaction.create({
            user_email: userEmail,
            amount: 0,
            type: 'admin_adjustment',
            description: `✅ Sync: Đã cập nhật paid_amount từ ${currentPaid.toLocaleString()} → ${totalWithdrawn.toLocaleString()} Camlycoin (dựa trên withdrawal requests)`,
            processed_by: user.email
          });

          results.push({
            userEmail,
            oldPaid: currentPaid,
            newPaid: totalWithdrawn,
            difference,
            status: 'updated'
          });

          console.log(`✅ Updated ${userEmail}: ${currentPaid} → ${totalWithdrawn}`);
        } else {
          results.push({
            userEmail,
            paid: totalWithdrawn,
            status: 'already_correct'
          });
        }
      } catch (error) {
        console.error(`Error updating ${userEmail}:`, error);
        results.push({
          userEmail,
          status: 'error',
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      message: 'Đã sync paid_amount từ withdrawal requests',
      totalProcessed: results.length,
      updated: results.filter(r => r.status === 'updated').length,
      alreadyCorrect: results.filter(r => r.status === 'already_correct').length,
      errors: results.filter(r => r.status === 'error').length,
      details: results
    });

  } catch (error) {
    console.error('Error syncing paid amounts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});