import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Deleting manual_add transactions BATCH 1 (0-2500)...');

    const allManualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    }, '-created_date', 3000);
    
    console.log(`Found ${allManualAdds.length} transactions in this batch`);

    let deletedCount = 0;
    for (let i = 0; i < allManualAdds.length; i++) {
      await base44.asServiceRole.entities.CamlycoinTransaction.delete(allManualAdds[i].id);
      deletedCount++;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if ((i + 1) % 200 === 0) {
        console.log(`✅ ${deletedCount}`);
      }
    }

    return Response.json({
      success: true,
      batch: 1,
      deleted: deletedCount
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});