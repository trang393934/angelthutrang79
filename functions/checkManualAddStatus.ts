import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Checking manual_add transaction status...');

    // Count all manual_add transactions
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    }, '-created_date', 10000);

    console.log(`Total manual_add transactions: ${allTransactions.length}`);

    // Sum by user
    const byUser = {};
    let totalManualAdd = 0;
    
    for (const tx of allTransactions) {
      if (!byUser[tx.user_email]) {
        byUser[tx.user_email] = 0;
      }
      byUser[tx.user_email] += tx.amount;
      totalManualAdd += tx.amount;
    }

    // Sort by amount
    const sortedUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    console.log(`\nTotal manual_add coins: ${totalManualAdd.toLocaleString()}`);
    console.log(`\nTop 20 users with manual_add:`);
    for (const [email, amount] of sortedUsers) {
      console.log(`  ${email}: ${amount.toLocaleString()}`);
    }

    // Sample: check if net_valid_coins includes manual_add
    const sampleEmail = Object.keys(byUser)[0];
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email: sampleEmail 
    });
    const balance = balances[0];

    const manualAddForSample = byUser[sampleEmail];
    
    console.log(`\n📊 Sample verification for ${sampleEmail}:`);
    console.log(`  balance.net_valid_coins: ${balance.net_valid_coins}`);
    console.log(`  manual_add total: ${manualAddForSample}`);
    console.log(`  Difference: ${balance.net_valid_coins - manualAddForSample}`);

    return Response.json({
      success: true,
      total_manual_add_transactions: allTransactions.length,
      total_manual_add_coins: totalManualAdd,
      unique_users_with_manual_add: Object.keys(byUser).length,
      top_users: Object.fromEntries(sortedUsers),
      conclusion: totalManualAdd > 0 ? '⚠️ Manual_add vẫn còn trong DB!' : '✅ Tất cả manual_add đã xóa'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});