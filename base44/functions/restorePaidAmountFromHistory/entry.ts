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

    const { user_email } = await req.json().catch(() => ({}));

    console.log('🔄 KHÔI PHỤC PAID_AMOUNT TỪ TRANSACTION HISTORY');

    let allBalances = [];
    if (user_email) {
      const found = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      allBalances = found;
      console.log(`📊 Processing 1 user: ${user_email}`);
    } else {
      allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50000);
      console.log(`📊 Processing ${allBalances.length} users`);
    }

    const results = [];

    for (const balance of allBalances) {
      const email = balance.user_email;

      try {
        console.log(`\n🔍 ${email}`);
        
        // Fetch all transactions
        const transactions = await retryWithBackoff(async () => {
          return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: email },
            '-created_date',
            10000
          );
        });

        // Find all payment transactions (Admin đã thanh toán)
        let totalPaidFromTransactions = 0;
        const paymentTransactions = transactions.filter(tx => 
          tx.description && (
            tx.description.includes('Admin đã chuyển khoản') ||
            tx.description.includes('Đã thanh toán') ||
            tx.description.includes('✅ Admin đánh dấu thanh toán')
          )
        );

        console.log(`  💰 Found ${paymentTransactions.length} payment transactions`);

        // Extract paid amounts from transaction descriptions
        for (const tx of paymentTransactions) {
          const match = tx.description.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*Camlycoin/);
          if (match) {
            const amount = parseInt(match[1].replace(/,/g, ''));
            totalPaidFromTransactions += amount;
            console.log(`    → ${amount.toLocaleString()} Camlycoin (${tx.created_date.split('T')[0]})`);
          }
        }

        console.log(`  📊 Total paid from history: ${totalPaidFromTransactions.toLocaleString()}`);

        // Update balance with restored paid_amount
        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            paid_amount: totalPaidFromTransactions
          });
        });

        console.log(`  ✅ Restored paid_amount: ${totalPaidFromTransactions}`);

        results.push({
          email,
          success: true,
          paid_amount_restored: totalPaidFromTransactions,
          payment_count: paymentTransactions.length
        });

        await sleep(200);
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          email,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalRestored = results.reduce((sum, r) => sum + (r.paid_amount_restored || 0), 0);
    
    console.log(`\n✅ Success: ${successCount}/${allBalances.length}`);
    console.log(`💰 Total paid_amount restored: ${totalRestored.toLocaleString()}`);

    return Response.json({
      success: true,
      summary: {
        total: allBalances.length,
        success: successCount,
        failed: allBalances.length - successCount,
        total_paid_restored: totalRestored
      },
      results,
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});