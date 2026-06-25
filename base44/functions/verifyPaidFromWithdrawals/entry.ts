import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message?.includes('Rate limit') && i < maxRetries - 1) {
        await sleep(3000 * Math.pow(2, i));
      } else {
        throw error;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🔍 KIỂM TRA PAID_AMOUNT TỪ WITHDRAWAL HISTORY');

    // Fetch all completed withdrawals
    const allWithdrawals = await retryWithBackoff(async () => {
      return await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 50000);
    });

    const completedWithdrawals = allWithdrawals.filter(w => w.status === 'completed');
    
    console.log(`📊 Total withdrawals: ${allWithdrawals.length}`);
    console.log(`✅ Completed withdrawals: ${completedWithdrawals.length}`);

    // Group by user and sum amounts
    const userPaidMap = new Map();
    
    for (const withdrawal of completedWithdrawals) {
      const email = withdrawal.user_email;
      const amount = withdrawal.amount || 0;
      
      const current = userPaidMap.get(email) || { total: 0, count: 0, withdrawals: [] };
      current.total += amount;
      current.count += 1;
      current.withdrawals.push({
        amount,
        date: withdrawal.processed_date || withdrawal.created_date,
        tx_hash: withdrawal.tx_hash
      });
      
      userPaidMap.set(email, current);
    }

    console.log(`\n👥 Users with completed withdrawals: ${userPaidMap.size}`);

    // Calculate totals
    let grandTotal = 0;
    const userDetails = [];

    for (const [email, data] of userPaidMap.entries()) {
      grandTotal += data.total;
      userDetails.push({
        email,
        total_paid: data.total,
        withdrawal_count: data.count,
        withdrawals: data.withdrawals
      });
      
      console.log(`\n💰 ${email}`);
      console.log(`  Total: ${data.total.toLocaleString()} Camlycoin`);
      console.log(`  Withdrawals: ${data.count}`);
      for (const w of data.withdrawals) {
        console.log(`    → ${w.amount.toLocaleString()} (${w.date.split('T')[0]}) ${w.tx_hash ? '✅' : ''}`);
      }
    }

    console.log(`\n💎 GRAND TOTAL: ${grandTotal.toLocaleString()} Camlycoin`);
    console.log(`📊 Average per user: ${Math.round(grandTotal / userPaidMap.size).toLocaleString()} Camlycoin`);

    // Now update all balances with correct paid_amount
    console.log(`\n🔄 Updating ${userPaidMap.size} user balances...`);
    
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50000);
    let updateCount = 0;

    for (const balance of allBalances) {
      const paidData = userPaidMap.get(balance.user_email);
      const correctPaidAmount = paidData ? paidData.total : 0;

      if (balance.paid_amount !== correctPaidAmount) {
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            paid_amount: correctPaidAmount
          });
        });
        
        console.log(`  ✅ ${balance.user_email}: ${balance.paid_amount} → ${correctPaidAmount}`);
        updateCount++;
        await sleep(200);
      }
    }

    console.log(`\n✅ Updated ${updateCount} balances`);

    return Response.json({
      success: true,
      summary: {
        total_withdrawals: allWithdrawals.length,
        completed_withdrawals: completedWithdrawals.length,
        users_with_withdrawals: userPaidMap.size,
        grand_total_paid: grandTotal,
        balances_updated: updateCount
      },
      user_details: userDetails.sort((a, b) => b.total_paid - a.total_paid)
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});