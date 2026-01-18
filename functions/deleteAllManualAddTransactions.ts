import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Xóa tất cả manual_add transactions...\n');

    // Lấy tất cả transactions
    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 50000);
    
    // Filter manual_add
    const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0);

    console.log(`📊 Tìm thấy ${manualAdds.length} manual_add transactions`);
    console.log(`💰 Tổng coins: ${manualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0).toLocaleString()}\n`);

    let deleted = 0;
    let errors = 0;
    const deletedByUser = {};

    for (let i = 0; i < manualAdds.length; i++) {
      try {
        const tx = manualAdds[i];
        
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
        
        deleted++;
        if (!deletedByUser[tx.user_email]) {
          deletedByUser[tx.user_email] = {
            count: 0,
            total: 0
          };
        }
        deletedByUser[tx.user_email].count++;
        deletedByUser[tx.user_email].total += (tx.amount || 0);

        if ((i + 1) % 50 === 0) {
          console.log(`✅ Đã xóa ${i + 1}/${manualAdds.length}...`);
        }

        // Delay để tránh quá tải
        await new Promise(resolve => setTimeout(resolve, 20));

      } catch (error) {
        errors++;
        console.error(`❌ Lỗi xóa transaction ${i}:`, error.message);
      }
    }

    console.log(`\n✅ HOÀN TẤT XÓA:`);
    console.log(`   - Xóa thành công: ${deleted}`);
    console.log(`   - Lỗi: ${errors}`);
    console.log(`   - Tổng coins bị xóa: ${Object.values(deletedByUser).reduce((sum, data) => sum + data.total, 0).toLocaleString()}`);
    console.log(`\n👥 Top users bị ảnh hưởng:`);
    
    const sorted = Object.entries(deletedByUser)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    for (const [email, data] of sorted) {
      console.log(`   - ${email}: xóa ${data.count} tx, ${data.total.toLocaleString()} coins`);
    }

    return Response.json({
      success: true,
      deleted: deleted,
      errors: errors,
      total_coins_removed: Object.values(deletedByUser).reduce((sum, data) => sum + data.total, 0)
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});