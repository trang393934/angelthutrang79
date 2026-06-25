import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Xóa 100 manual_add transactions (non-blocking)...\n');

    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 5000);
    const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0).slice(0, 100);

    if (manualAdds.length === 0) {
      return Response.json({ success: true, message: 'Không còn manual_add' });
    }

    console.log(`📊 Xóa ${manualAdds.length} cái...`);

    let deleted = 0;
    let errors = 0;

    for (let i = 0; i < manualAdds.length; i++) {
      try {
        const tx = manualAdds[i];
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
        deleted++;

        if ((i + 1) % 20 === 0) {
          console.log(`✓ ${i + 1}/${manualAdds.length}`);
        }

        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (error) {
        errors++;
      }
    }

    console.log(`\n✅ Batch này: +${deleted} deleted (${errors} errors)`);

    // Lấy số cái còn lại
    const remaining = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 5000);
    const stillLeft = remaining.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0).length;

    console.log(`⏳ Còn ${stillLeft} cái nữa (chạy lại nhiều lần)`);

    return Response.json({
      success: true,
      deleted_this_batch: deleted,
      errors: errors,
      remaining: stillLeft
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});