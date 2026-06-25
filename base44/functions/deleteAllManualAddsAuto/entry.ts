import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Xóa TẤT CẢ manual_add transactions tự động...\n');

    let deleted = 0;
    let errors = 0;
    let totalRound = 0;

    while (true) {
      totalRound++;
      console.log(`\n🔄 Round ${totalRound}:`);

      // Lấy manual_add còn lại
      const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 5000);
      const manualAdds = transactions.filter(tx => tx.type === 'manual_add' && (tx.amount || 0) > 0);

      if (manualAdds.length === 0) {
        console.log('✅ Không còn manual_add nào!');
        break;
      }

      console.log(`   Tìm thấy ${manualAdds.length} cái, đang xóa...`);

      let roundDeleted = 0;
      let roundErrors = 0;

      for (let i = 0; i < manualAdds.length; i++) {
        try {
          const tx = manualAdds[i];
          await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
          roundDeleted++;
          deleted++;

          if ((i + 1) % 50 === 0) {
            console.log(`   ✓ ${i + 1}/${manualAdds.length}`);
          }

          // Delay 300ms/tx để tránh rate limit
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
          roundErrors++;
          errors++;
          console.log(`   ✗ Lỗi: ${error.message}`);
          
          // Nếu rate limit, dừng round và chờ
          if (error.message?.includes('Rate limit')) {
            console.log(`   ⏸️ Rate limit! Chờ 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            break;
          }
        }
      }

      console.log(`   Round hoàn tất: +${roundDeleted} deleted, ${roundErrors} errors`);
      console.log(`   Tổng: ${deleted} deleted, ${errors} errors`);

      // Chờ 5s trước round tiếp theo
      if (manualAdds.length > 0) {
        console.log(`   Chờ 5s trước round kế...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`\n🎉 HOÀN TẤT!`);
    console.log(`   - Xóa thành công: ${deleted}`);
    console.log(`   - Lỗi: ${errors}`);
    console.log(`   - Rounds: ${totalRound}`);

    return Response.json({
      success: true,
      deleted: deleted,
      errors: errors,
      rounds: totalRound
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});