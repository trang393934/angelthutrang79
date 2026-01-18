import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const batchSize = 500; // Xóa từng batch 500

    console.log('🗑️ Xóa manual_add transactions theo batch (500 cái)...\n');

    // Lấy tất cả manual_add
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0);

    console.log(`📊 Tìm thấy ${manualAdds.length} manual_add transactions`);
    console.log(`💰 Tổng coins: ${manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0).toLocaleString()}\n`);

    let deleted = 0;
    let errors = 0;

    // Xóa từng batch
    for (let i = 0; i < manualAdds.length; i++) {
      try {
        const tx = manualAdds[i];
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
        deleted++;

        if ((i + 1) % 100 === 0) {
          console.log(`✅ Đã xóa ${i + 1}/${manualAdds.length}...`);
        }

        // Delay dài hơn để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        errors++;
      }

      // Nếu đủ batch, tạm dừng
      if ((i + 1) % batchSize === 0) {
        console.log(`⏸️ Batch ${Math.floor((i + 1) / batchSize)} hoàn tất, tạm dừng...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n✅ HOÀN TẤT!`);
    console.log(`   - Xóa thành công: ${deleted}`);
    console.log(`   - Lỗi: ${errors}`);

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