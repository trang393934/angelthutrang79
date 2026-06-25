import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email } = await req.json();
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`💳 Check transaction history for: ${target_user_email}`);

    // Fetch all transactions
    const allTx = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 10000);
    const userTx = allTx.filter(t => t.user_email === target_user_email);

    console.log(`\n📊 TOTAL TRANSACTIONS: ${userTx.length}`);

    // Group by type
    const byType = {};
    let totalIncome = 0;
    let totalExpense = 0;

    userTx.forEach(tx => {
      const type = tx.type || 'unknown';
      if (!byType[type]) byType[type] = { count: 0, amount: 0 };
      byType[type].count++;
      byType[type].amount += tx.amount || 0;

      if ((tx.amount || 0) > 0) totalIncome += tx.amount || 0;
      else totalExpense += tx.amount || 0;
    });

    console.log(`\n💰 BY TYPE:`);
    Object.entries(byType).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.count} tx = ${data.amount.toLocaleString()}`);
    });

    console.log(`\n📈 SUMMARY:`);
    console.log(`  Total Income: ${totalIncome.toLocaleString()}`);
    console.log(`  Total Expense: ${totalExpense.toLocaleString()}`);
    console.log(`  Net: ${(totalIncome + totalExpense).toLocaleString()}`);

    // Check for sudden large withdrawals or deductions
    const largeNegativeTx = userTx.filter(t => (t.amount || 0) < -10000).sort((a, b) => (a.amount || 0) - (b.amount || 0));
    
    if (largeNegativeTx.length > 0) {
      console.log(`\n⚠️ LARGE NEGATIVE TRANSACTIONS (< -10,000):`);
      largeNegativeTx.slice(0, 10).forEach(tx => {
        console.log(`  ${tx.amount.toLocaleString()} - ${tx.description || tx.type}`);
        console.log(`    Date: ${new Date(tx.created_date).toLocaleString()}`);
      });
    }

    // Most recent transactions
    console.log(`\n📝 MOST RECENT 10 TRANSACTIONS:`);
    userTx.slice(0, 10).forEach((tx, i) => {
      const sign = (tx.amount || 0) > 0 ? '+' : '';
      console.log(`  [${i}] ${sign}${(tx.amount || 0).toLocaleString()} - ${tx.description || tx.type}`);
      console.log(`      ${new Date(tx.created_date).toLocaleString()}`);
    });

    return Response.json({
      success: true,
      total_transactions: userTx.length,
      by_type: byType,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_change: totalIncome + totalExpense,
      large_negative_count: largeNegativeTx.length,
      recent_transactions: userTx.slice(0, 10).map(tx => ({
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        date: tx.created_date
      }))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});