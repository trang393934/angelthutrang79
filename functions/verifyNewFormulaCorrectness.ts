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

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json().catch(() => ({}));

    console.log('🔍 VERIFY NEW FORMULA CORRECTNESS');
    console.log(`📧 Target: ${user_email || 'ALL USERS'}`);

    // Get balances to verify
    let balances = [];
    if (user_email) {
      const found = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      balances = found;
    } else {
      balances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 1000);
    }

    console.log(`👥 Verifying ${balances.length} users...`);

    const results = [];
    let correctCount = 0;
    let incorrectCount = 0;

    for (const balance of balances) {
      const email = balance.user_email;

      try {
        // Verify formula:
        // total_earned = net_valid_coins + frozen_balance ✓
        // available_for_withdrawal = net_valid_coins - paid_amount ✓

        const expectedTotal = (balance.net_valid_coins || 0) + (balance.frozen_balance || 0);
        const expectedAvailable = Math.max(0, (balance.net_valid_coins || 0) - (balance.paid_amount || 0));

        const actualTotal = balance.total_earned || 0;
        const actualAvailable = balance.available_for_withdrawal || 0;

        const totalCorrect = actualTotal === expectedTotal;
        const availableCorrect = actualAvailable === expectedAvailable;
        const isCorrect = totalCorrect && availableCorrect;

        if (isCorrect) {
          correctCount++;
        } else {
          incorrectCount++;
          console.log(`  ⚠️ ${email} - Mismatch detected`);
          if (!totalCorrect) {
            console.log(`     Total: expected ${expectedTotal}, got ${actualTotal}`);
          }
          if (!availableCorrect) {
            console.log(`     Available: expected ${expectedAvailable}, got ${actualAvailable}`);
          }
        }

        results.push({
          user_email: email,
          correct: isCorrect,
          total_earned: {
            expected: expectedTotal,
            actual: actualTotal,
            match: totalCorrect
          },
          available_for_withdrawal: {
            expected: expectedAvailable,
            actual: actualAvailable,
            match: availableCorrect
          },
          fields: {
            net_valid_coins: balance.net_valid_coins || 0,
            frozen_balance: balance.frozen_balance || 0,
            paid_amount: balance.paid_amount || 0,
          }
        });

      } catch (error) {
        console.error(`  ❌ Error verifying ${email}: ${error.message}`);
        results.push({
          user_email: email,
          correct: false,
          error: error.message,
        });
        incorrectCount++;
      }

      await sleep(100);
    }

    console.log(`\n📊 VERIFICATION RESULTS:`);
    console.log(`✅ Correct: ${correctCount}`);
    console.log(`⚠️  Incorrect: ${incorrectCount}`);

    return Response.json({
      success: true,
      summary: {
        total_users: balances.length,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        accuracy_percentage: ((correctCount / balances.length) * 100).toFixed(2) + '%',
      },
      results: results.filter(r => !r.correct || user_email), // Show only incorrect or if specific user requested
      detailed_results: user_email ? results : undefined, // Full details if checking single user
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});