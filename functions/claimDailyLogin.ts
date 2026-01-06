import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if already claimed today
    const existingClaims = await base44.entities.DailyLoginClaim.filter({
      user_email: user.email,
      claim_date: today
    });

    if (existingClaims.length > 0) {
      return Response.json({ 
        error: 'Bạn đã nhận thưởng đăng nhập hôm nay rồi!',
        alreadyClaimed: true 
      }, { status: 400 });
    }

    const rewardAmount = 100;

    // Create claim record
    await base44.entities.DailyLoginClaim.create({
      user_email: user.email,
      claim_date: today,
      coins_awarded: rewardAmount,
      claim_count: 1
    });

    // Update balance
    const balances = await base44.entities.CamlycoinBalance.filter({ user_email: user.email });
    let balance;

    if (balances.length > 0) {
      balance = balances[0];
      await base44.entities.CamlycoinBalance.update(balance.id, {
        balance: (balance.balance || 0) + rewardAmount,
        unpaid_amount: (balance.unpaid_amount || 0) + rewardAmount,
        total_earned: (balance.total_earned || 0) + rewardAmount
      });
    } else {
      balance = await base44.entities.CamlycoinBalance.create({
        user_email: user.email,
        balance: rewardAmount,
        unpaid_amount: rewardAmount,
        total_earned: rewardAmount
      });
    }

    // Create transaction
    await base44.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: rewardAmount,
      type: 'manual_add',
      description: `📅 Thưởng Đăng Nhập Hàng Ngày\n💰 +${rewardAmount} Camlycoin\n🗓️ ${new Date().toLocaleDateString('vi-VN')}`
    });

    // Update user level
    await base44.functions.invoke('updateUserLevel', { userEmail: user.email });

    return Response.json({
      success: true,
      message: '✅ Nhận thưởng đăng nhập thành công!',
      coinsAwarded: rewardAmount,
      newBalance: (balance.balance || 0) + rewardAmount
    });

  } catch (error) {
    console.error('Daily login claim error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});