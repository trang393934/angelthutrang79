import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Kiểm tra tất cả manual_add transactions...\n');

    // Lấy tất cả transactions
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    
    // Filter manual_add
    const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0);

    // Group by user
    const byUser = {};
    for (const tx of manualAdds) {
      if (!byUser[tx.user_email]) {
        byUser[tx.user_email] = {
          total: 0,
          transactions: []
        };
      }
      byUser[tx.user_email].total += (tx.amount || 0);
      byUser[tx.user_email].transactions.push({
        amount: tx.amount,
        description: tx.description,
        date: tx.created_date,
        processed_by: tx.processed_by
      });
    }

    // Sort by total
    const sorted = Object.entries(byUser)
      .sort((a, b) => b[1].total - a[1].total);

    console.log(`📊 MANUAL_ADD TRANSACTIONS BREAKDOWN:\n`);
    console.log(`Tổng users nhận manual_add: ${sorted.length}`);
    console.log(`Tổng coins manual_add: ${sorted.reduce((sum, [_, data]) => sum + data.total, 0).toLocaleString()}\n`);

    console.log(`TOP 10 USERS NHẬN MANUAL_ADD:\n`);
    
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const [email, data] = sorted[i];
      console.log(`${i + 1}. ${email}: ${data.total.toLocaleString()}`);
      
      for (const tx of data.transactions) {
        console.log(`   - ${tx.amount.toLocaleString()} coins: "${tx.description}" (${tx.date})`);
        if (tx.processed_by) {
          console.log(`     Xử lý bởi: ${tx.processed_by}`);
        }
      }
      console.log('');
    }

    return Response.json({
      success: true,
      summary: {
        total_users: sorted.length,
        total_manual_add_coins: sorted.reduce((sum, [_, data]) => sum + data.total, 0),
        by_user: Object.fromEntries(sorted.slice(0, 10).map(([email, data]) => [
          email, 
          {
            total: data.total,
            tx_count: data.transactions.length
          }
        ]))
      }
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});