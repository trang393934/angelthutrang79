import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message?.includes('Rate limit') && i < maxRetries - 1) {
        const delay = 2000 * Math.pow(2, i);
        await sleep(delay);
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

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json().catch(() => ({}));

    console.log(`\n🔍 DETAILED AUDIT FOR: ${user_email || 'ALL USERS'}`);

    let balances = [];
    if (user_email) {
      const found = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
      balances = found;
    } else {
      balances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50);
    }

    const auditResults = [];

    for (const balance of balances) {
      const email = balance.user_email;
      console.log(`\n📧 USER: ${email}`);
      console.log(`📊 Current Balance Record:`);
      console.log(`  - total_earned: ${balance.total_earned}`);
      console.log(`  - available_balance: ${balance.available_balance}`);
      console.log(`  - admin_review_pending: ${balance.admin_review_pending}`);
      console.log(`  - frozen_balance: ${balance.frozen_balance}`);
      console.log(`  - paid_amount: ${balance.paid_amount}`);

      // Fetch transactions
      const transactions = await retryWithBackoff(async () => {
        return await base44.asServiceRole.entities.CamlycoinTransaction.filter(
          { user_email: email },
          '-created_date',
          1000
        );
      });

      const txPositive = transactions.filter(t => t.amount > 0);
      const txNegative = transactions.filter(t => t.amount < 0);
      const txTotalPositive = txPositive.reduce((s, t) => s + (t.amount || 0), 0);
      const txTotalNegative = txNegative.reduce((s, t) => s + Math.abs(t.amount || 0), 0);

      console.log(`\n💳 TRANSACTIONS (${transactions.length} total):`);
      console.log(`  - Positive: ${txPositive.length} items = ${txTotalPositive}`);
      txPositive.slice(0, 5).forEach(t => {
        console.log(`    • ${t.type}: ${t.amount} (${t.description})`);
      });
      if (txPositive.length > 5) console.log(`    ... and ${txPositive.length - 5} more`);
      console.log(`  - Negative: ${txNegative.length} items = ${txTotalNegative}`);

      // Fetch audit logs
      const auditLogs = await retryWithBackoff(async () => {
        return await base44.asServiceRole.entities.QuestionAuditLog.filter(
          { user_email: email },
          '-created_date',
          1000
        );
      });

      const auditByCategory = {
        valid: auditLogs.filter(a => a.coin_category === 'pending_withdrawal'),
        pending_review: auditLogs.filter(a => a.coin_category === 'pending_review'),
        frozen: auditLogs.filter(a => a.coin_category === 'frozen'),
      };

      const totals = {
        valid: auditByCategory.valid.reduce((s, a) => s + (a.coins_earned || 0), 0),
        pending_review: auditByCategory.pending_review.reduce((s, a) => s + (a.coins_earned || 0), 0),
        frozen: auditByCategory.frozen.reduce((s, a) => s + (a.coins_earned || 0), 0),
      };

      console.log(`\n📋 AUDIT LOGS (${auditLogs.length} total):`);
      console.log(`  - Valid/Withdrawal: ${auditByCategory.valid.length} items = ${totals.valid}`);
      console.log(`  - Pending Review: ${auditByCategory.pending_review.length} items = ${totals.pending_review}`);
      console.log(`  - Frozen: ${auditByCategory.frozen.length} items = ${totals.frozen}`);

      // Fetch withdrawals
      const withdrawals = await retryWithBackoff(async () => {
        return await base44.asServiceRole.entities.WithdrawalRequest.filter(
          { user_email: email },
          '-created_date',
          500
        );
      });

      const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
      const totalPaid = completedWithdrawals.reduce((s, w) => s + (w.amount || 0), 0);

      console.log(`\n💸 WITHDRAWALS (${withdrawals.length} total):`);
      console.log(`  - Completed: ${completedWithdrawals.length} = ${totalPaid}`);
      completedWithdrawals.slice(0, 5).forEach(w => {
        console.log(`    • ${w.amount} (${new Date(w.created_date).toLocaleDateString('vi-VN')})`);
      });

      // Calculate expected
      const expectedTotalEarned = txTotalPositive + totals.valid + totals.pending_review + totals.frozen;
      const expectedAvailable = Math.max(0, expectedTotalEarned - totals.pending_review - totals.frozen - totalPaid);

      console.log(`\n✅ EXPECTED CALCULATION:`);
      console.log(`  Total Earned: ${txTotalPositive} + ${totals.valid} + ${totals.pending_review} + ${totals.frozen} = ${expectedTotalEarned}`);
      console.log(`  Available: ${expectedTotalEarned} - ${totals.pending_review} - ${totals.frozen} - ${totalPaid} = ${expectedAvailable}`);

      // Compare
      const discrepancies = [];
      if (balance.total_earned !== expectedTotalEarned) {
        discrepancies.push({
          field: 'total_earned',
          current: balance.total_earned,
          expected: expectedTotalEarned,
          diff: expectedTotalEarned - balance.total_earned
        });
      }
      if (balance.available_balance !== expectedAvailable) {
        discrepancies.push({
          field: 'available_balance',
          current: balance.available_balance,
          expected: expectedAvailable,
          diff: expectedAvailable - balance.available_balance
        });
      }
      if (balance.admin_review_pending !== totals.pending_review) {
        discrepancies.push({
          field: 'admin_review_pending',
          current: balance.admin_review_pending,
          expected: totals.pending_review,
          diff: totals.pending_review - balance.admin_review_pending
        });
      }
      if (balance.frozen_balance !== totals.frozen) {
        discrepancies.push({
          field: 'frozen_balance',
          current: balance.frozen_balance,
          expected: totals.frozen,
          diff: totals.frozen - balance.frozen_balance
        });
      }
      if (balance.paid_amount !== totalPaid) {
        discrepancies.push({
          field: 'paid_amount',
          current: balance.paid_amount,
          expected: totalPaid,
          diff: totalPaid - balance.paid_amount
        });
      }

      if (discrepancies.length > 0) {
        console.log(`\n❌ DISCREPANCIES FOUND:`);
        discrepancies.forEach(d => {
          console.log(`  ❌ ${d.field}: ${d.current} vs ${d.expected} (diff: ${d.diff > 0 ? '+' : ''}${d.diff})`);
        });
      } else {
        console.log(`\n✅ ALL FIELDS MATCH!`);
      }

      auditResults.push({
        user_email: email,
        current: {
          total_earned: balance.total_earned,
          available_balance: balance.available_balance,
          admin_review_pending: balance.admin_review_pending,
          frozen_balance: balance.frozen_balance,
          paid_amount: balance.paid_amount,
        },
        sources: {
          tx_positive: txTotalPositive,
          audit_valid: totals.valid,
          audit_pending: totals.pending_review,
          audit_frozen: totals.frozen,
          withdrawals_completed: totalPaid,
        },
        expected: {
          total_earned: expectedTotalEarned,
          available_balance: expectedAvailable,
          admin_review_pending: totals.pending_review,
          frozen_balance: totals.frozen,
          paid_amount: totalPaid,
        },
        discrepancies,
        isCorrect: discrepancies.length === 0,
      });

      await sleep(300);
    }

    const correctCount = auditResults.filter(r => r.isCorrect).length;
    const wrongCount = auditResults.filter(r => !r.isCorrect).length;

    console.log(`\n🎉 AUDIT SUMMARY:`);
    console.log(`✅ Correct: ${correctCount}`);
    console.log(`❌ Wrong: ${wrongCount}`);

    return Response.json({
      summary: {
        total: auditResults.length,
        correct: correctCount,
        wrong: wrongCount,
      },
      results: auditResults,
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});