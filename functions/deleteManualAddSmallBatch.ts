import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Xóa 200 manual_add transactions...\n');

    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0).slice(0, 200);

    console.log(`📊 Xóa ${manualAdds.length} manual_add transactions`);
    console.log(`💰 Tổng coins: ${manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0).toLocaleString()}\n`);

    let deleted = 0;
    let errors = 0;

    for (let i = 0; i < manualAdds.length; i++) {
      try {
        const tx = manualAdds[i];
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
        deleted++;

        if ((i + 1) % 50 === 0) {
          console.log(`✅ ${i + 1}/${manualAdds.length}`);
        }

        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        errors++;
      }
    }

    console.log(`\n✅ Batch này xóa ${deleted} (lỗi: ${errors})`);

    return Response.json({
      success: true,
      deleted: deleted,
      errors: errors
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});