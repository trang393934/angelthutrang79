import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail is required' }, { status: 400 });
    }

    console.log(`🧹 Cleaning up duplicate daily logins for ${targetUserEmail}`);

    // Get all daily login transactions for this user
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 10000);
    const loginTransactions = allTransactions.filter(tx => 
      tx.user_email === targetUserEmail &&
      tx.description.includes('Thưởng Đăng Nhập Hàng Ngày')
    );

    console.log(`Found ${loginTransactions.length} daily login transactions`);

    // Group by date
    const loginsByDate = {};
    loginTransactions.forEach(tx => {
      const date = new Date(tx.created_date).toISOString().split('T')[0];
      if (!loginsByDate[date]) {
        loginsByDate[date] = [];
      }
      loginsByDate[date].push(tx);
    });

    let totalDuplicates = 0;
    let totalCoinsToDeduct = 0;
    const duplicateDetails = [];

    // Find duplicates (keep first claim each day, remove others)
    for (const [date, claims] of Object.entries(loginsByDate)) {
      if (claims.length > 1) {
        // Sort by created_date to keep the earliest
        claims.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        
        // All except the first are duplicates
        const duplicates = claims.slice(1);
        totalDuplicates += duplicates.length;
        
        const coinsToDeduct = duplicates.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        totalCoinsToDeduct += coinsToDeduct;

        duplicateDetails.push({
          date,
          totalClaims: claims.length,
          duplicates: duplicates.length,
          coinsToDeduct,
          keptClaim: claims[0].id,
          removedClaims: duplicates.map(d => d.id)
        });
      }
    }

    if (totalDuplicates === 0) {
      return Response.json({
        success: true,
        message: '✅ Không có duplicate daily login',
        userEmail: targetUserEmail
      });
    }

    // Deduct the duplicate coins from balance
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: targetUserEmail });
    
    if (balances.length > 0) {
      const balance = balances[0];
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        balance: (balance.balance || 0) - totalCoinsToDeduct,
        total_earned: (balance.total_earned || 0) - totalCoinsToDeduct,
        unpaid_amount: Math.max(0, (balance.unpaid_amount || 0) - totalCoinsToDeduct)
      });
    }

    // Create admin transaction log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: targetUserEmail,
      amount: 0,
      type: 'admin_adjustment',
      description: `🧹 Admin cleanup: Loại bỏ ${totalDuplicates} daily login duplicates\n💰 -${totalCoinsToDeduct.toLocaleString()} Camlycoin (spam claims)\n📊 Giữ lại ${Object.keys(loginsByDate).length} claims hợp lệ (1 claim/ngày)`,
      processed_by: user.email
    });

    return Response.json({
      success: true,
      message: '✅ Đã cleanup duplicate daily logins',
      userEmail: targetUserEmail,
      totalDuplicates,
      totalCoinsDeducted: totalCoinsToDeduct,
      validClaims: Object.keys(loginsByDate).length,
      details: duplicateDetails
    });

  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});