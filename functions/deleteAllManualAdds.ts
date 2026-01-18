import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Deleting all manual_add transactions...');

    const allManualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    }, '-created_date', 10000);
    
    const totalCoins = allManualAdds.reduce((sum, t) => sum + t.amount, 0);
    console.log(`Found ${allManualAdds.length} transactions = ${totalCoins.toLocaleString()} coins\n`);

    let deletedCount = 0;
    for (let i = 0; i < allManualAdds.length; i++) {
      await base44.asServiceRole.entities.CamlycoinTransaction.delete(allManualAdds[i].id);
      deletedCount++;
      
      if ((i + 1) % 50 === 0) {
        console.log(`✅ ${deletedCount}/${allManualAdds.length}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return Response.json({
      success: true,
      deleted: deletedCount,
      total_coins_removed: totalCoins
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});