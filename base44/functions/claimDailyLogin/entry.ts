import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Rate limiting: Track last claim time per user
const rateLimitMap = new Map();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 1 claim per 60 seconds
    const now = Date.now();
    const lastClaimTime = rateLimitMap.get(user.email) || 0;
    const timeSinceLastClaim = now - lastClaimTime;
    
    if (timeSinceLastClaim < 60000) { // 60 seconds
      const waitTime = Math.ceil((60000 - timeSinceLastClaim) / 1000);
      return Response.json({ 
        error: `Vui lòng đợi ${waitTime} giây trước khi thử lại!`,
        rateLimited: true,
        waitSeconds: waitTime
      }, { status: 429 });
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

    // Update rate limit map
    rateLimitMap.set(user.email, now);

    const rewardAmount = 100;

    // Create claim record
    await base44.entities.DailyLoginClaim.create({
      user_email: user.email,
      claim_date: today,
      coins_awarded: rewardAmount,
      claim_count: 1
    });

    // Update balance using service role
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: user.email });
    let balance;

    if (balances.length > 0) {
      balance = balances[0];
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        net_valid_coins: (balance.net_valid_coins || 0) + rewardAmount,
        total_earned: (balance.total_earned || 0) + rewardAmount,
        available_for_withdrawal: (balance.net_valid_coins || 0) + rewardAmount - (balance.paid_amount || 0)
      });
    } else {
      balance = await base44.asServiceRole.entities.CamlycoinBalance.create({
        user_email: user.email,
        net_valid_coins: rewardAmount,
        total_earned: rewardAmount,
        available_for_withdrawal: rewardAmount,
        frozen_balance: 0,
        paid_amount: 0
      });
    }

    // Create transaction using service role
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: rewardAmount,
      type: 'manual_add',
      description: `📅 Thưởng Đăng Nhập Hàng Ngày\n💰 +${rewardAmount} Camlycoin\n🗓️ ${new Date().toLocaleDateString('vi-VN')}`
    });

    // Update user level
    try {
      await base44.asServiceRole.functions.invoke('updateUserLevel', { userEmail: user.email });
    } catch (err) {
      console.log('Level update skipped:', err.message);
    }

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