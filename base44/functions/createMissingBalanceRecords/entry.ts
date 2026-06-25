import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔄 Creating missing balance records for manual_add users...');

    // Lấy tất cả manual_add transactions
    const manualAdds = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    }, '-created_date', 50000);

    // Lấy unique users từ manual_add
    const uniqueUsers = [...new Set(manualAdds.map(tx => tx.user_email))];
    console.log(`📊 Found ${uniqueUsers.length} unique users with manual_add`);

    // Lấy existing balances
    const existingBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 50000);
    const existingUserEmails = new Set(existingBalances.map(b => b.user_email));

    // Tìm users cần tạo balance
    const missingUsers = uniqueUsers.filter(email => !existingUserEmails.has(email));
    console.log(`⚠️  Missing balance records: ${missingUsers.length}`);

    let created = 0;
    let errors = 0;

    for (const userEmail of missingUsers) {
      try {
        // Tính tổng manual_add coins cho user
        const userManualAdds = manualAdds.filter(tx => tx.user_email === userEmail);
        const totalCoins = userManualAdds.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        // Tạo balance record
        await base44.asServiceRole.entities.CamlycoinBalance.create({
          user_email: userEmail,
          total_earned: totalCoins,
          net_valid_coins: totalCoins,
          frozen_balance: 0,
          paid_amount: 0,
          available_for_withdrawal: totalCoins
        });

        created++;
        console.log(`✅ Created balance for ${userEmail}: ${totalCoins.toLocaleString()} coins`);
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors++;
        console.error(`❌ Error for ${userEmail}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`\n✅ COMPLETE: Created ${created} balance records, ${errors} errors`);

    return Response.json({
      success: true,
      created: created,
      errors: errors,
      total_unique_users: uniqueUsers.length,
      previously_missing: missingUsers.length
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});