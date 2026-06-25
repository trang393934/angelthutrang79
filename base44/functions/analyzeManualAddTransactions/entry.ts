import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json();
    
    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`💰 ANALYZING MANUAL_ADD TRANSACTIONS FOR: ${user_email}`);
    console.log(`${'='.repeat(80)}\n`);

    // Get all manual_add transactions
    const manualTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: user_email,
      type: 'manual_add'
    }, '-created_date', 1000);

    console.log(`📊 Total manual_add transactions: ${manualTxs.length}`);

    const totalAmount = manualTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    console.log(`💰 Total amount: ${totalAmount.toLocaleString()}`);

    // Group by description patterns
    const grouped = {};
    
    for (const tx of manualTxs) {
      const desc = tx.description || 'No description';
      
      // Categorize based on description
      let category = 'Other';
      
      if (desc.includes('Daily Login') || desc.includes('Điểm danh')) {
        category = 'Daily Login';
      } else if (desc.includes('Gratitude') || desc.includes('Biết Ơn') || desc.includes('Sám Hối')) {
        category = 'Gratitude Journal';
      } else if (desc.includes('Recovery') || desc.includes('Khôi phục')) {
        category = 'Recovery';
      } else if (desc.includes('Bonus') || desc.includes('Thưởng')) {
        category = 'Bonus/Reward';
      } else if (desc.includes('Quest') || desc.includes('Nhiệm vụ')) {
        category = 'Quest';
      } else if (desc.includes('Community') || desc.includes('Cộng đồng')) {
        category = 'Community';
      }
      
      if (!grouped[category]) {
        grouped[category] = {
          count: 0,
          total: 0,
          samples: []
        };
      }
      
      grouped[category].count++;
      grouped[category].total += tx.amount || 0;
      
      if (grouped[category].samples.length < 5) {
        grouped[category].samples.push({
          amount: tx.amount,
          description: desc,
          date: tx.created_date
        });
      }
    }

    console.log(`\n📋 BREAKDOWN BY CATEGORY:\n`);
    
    for (const [category, data] of Object.entries(grouped)) {
      console.log(`   ${category}:`);
      console.log(`      Count: ${data.count}`);
      console.log(`      Total: ${data.total.toLocaleString()}`);
      console.log(`      Samples:`);
      data.samples.forEach(s => {
        console.log(`         - ${s.amount.toLocaleString()} | ${s.description.substring(0, 60)}...`);
      });
      console.log('');
    }

    console.log(`${'='.repeat(80)}\n`);

    return Response.json({
      success: true,
      user_email,
      summary: {
        total_transactions: manualTxs.length,
        total_amount: totalAmount
      },
      breakdown_by_category: grouped,
      all_transactions: manualTxs.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        description: tx.description,
        created_date: tx.created_date
      }))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});