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

    console.log('🔧 AUTO-FIX FORMULA ERRORS');
    console.log(`📧 Target: ${user_email || 'ALL USERS'}`);

    // Get balances to fix
    let balances = [];
    if (user_email) {
      const found = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      balances = found;
    } else {
      balances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 1000);
    }

    console.log(`👥 Fixing ${balances.length} users...`);

    const results = [];
    let fixedCount = 0;
    let unchangedCount = 0;

    for (const balance of balances) {
      const email = balance.user_email;

      try {
        // Check if needs fixing
        const expectedTotal = (balance.net_valid_coins || 0) + (balance.frozen_balance || 0);
        const expectedAvailable = Math.max(0, (balance.net_valid_coins || 0) - (balance.paid_amount || 0));

        const needsFixTotal = balance.total_earned !== expectedTotal;
        const needsFixAvailable = balance.available_for_withdrawal !== expectedAvailable;

        if (!needsFixTotal && !needsFixAvailable) {
          unchangedCount++;
          continue;
        }

        // Fix the values
        const oldValues = {
          total_earned: balance.total_earned || 0,
          available_for_withdrawal: balance.available_for_withdrawal || 0,
        };

        await retryWithBackoff(async () => {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            total_earned: expectedTotal,
            available_for_withdrawal: expectedAvailable,
          });
        });

        fixedCount++;

        console.log(`  ✅ ${email} - Fixed`);
        if (needsFixTotal) {
          console.log(`     total_earned: ${oldValues.total_earned} → ${expectedTotal}`);
        }
        if (needsFixAvailable) {
          console.log(`     available_for_withdrawal: ${oldValues.available_for_withdrawal} → ${expectedAvailable}`);
        }

        results.push({
          user_email: email,
          fixed: true,
          changes: {
            total_earned: needsFixTotal ? { from: oldValues.total_earned, to: expectedTotal } : null,
            available_for_withdrawal: needsFixAvailable ? { from: oldValues.available_for_withdrawal, to: expectedAvailable } : null,
          }
        });

      } catch (error) {
        console.error(`  ❌ Error fixing ${email}: ${error.message}`);
        results.push({
          user_email: email,
          fixed: false,
          error: error.message,
        });
      }

      await sleep(300);
    }

    console.log(`\n📊 FIX RESULTS:`);
    console.log(`✅ Fixed: ${fixedCount}`);
    console.log(`⏭️  Unchanged: ${unchangedCount}`);

    return Response.json({
      success: true,
      summary: {
        total_users: balances.length,
        fixed_count: fixedCount,
        unchanged_count: unchangedCount,
        failed_count: balances.length - fixedCount - unchangedCount,
      },
      results,
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});