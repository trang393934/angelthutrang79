import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin or scheduled tasks can trigger this
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🤖 Starting auto-claim check...');

    // Get all auto-claim configs that are enabled
    const allConfigs = await base44.asServiceRole.entities.AutoClaimConfig.list();
    const enabledConfigs = allConfigs.filter(c => c.enabled === true);

    console.log(`Found ${enabledConfigs.length} enabled auto-claim configs`);

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    for (const config of enabledConfigs) {
      try {
        // Get user balance
        const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
          user_email: config.user_email 
        });
        
        if (balances.length === 0) continue;
        const userBalance = balances[0];

        // Check daily limit
        const dailyLimits = await base44.asServiceRole.entities.DailyAutoClaimLimit.filter({
          user_email: config.user_email,
          date: today
        });
        
        let dailyLimit = dailyLimits[0];
        if (!dailyLimit) {
          dailyLimit = await base44.asServiceRole.entities.DailyAutoClaimLimit.create({
            user_email: config.user_email,
            date: today,
            total_claimed_today: 0,
            claim_count: 0,
            remaining_limit: 500000
          });
        }

        // Check if can claim today
        if ((dailyLimit.remaining_limit || 0) <= 0) {
          console.log(`❌ ${config.user_email}: Đã hết hạn mức hôm nay`);
          continue;
        }

        // Check cooldown (24h)
        if (config.last_claim_date) {
          const lastClaim = new Date(config.last_claim_date);
          const hoursSinceLastClaim = (Date.now() - lastClaim.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastClaim < (config.cooldown_hours || 24)) {
            console.log(`❌ ${config.user_email}: Chưa đủ cooldown (${hoursSinceLastClaim.toFixed(1)}h/${config.cooldown_hours || 24}h)`);
            continue;
          }
        }

        // Check if meets threshold
        const availableBalance = userBalance.available_balance || 0;
        const threshold = config.threshold_amount || 100000;

        if (config.claim_mode === 'threshold' && availableBalance < threshold) {
          console.log(`❌ ${config.user_email}: Chưa đủ ngưỡng (${availableBalance}/${threshold})`);
          continue;
        }

        // Calculate claim amount (min of available, daily limit remaining)
        const claimAmount = Math.min(
          availableBalance,
          dailyLimit.remaining_limit,
          config.max_daily_claim || 500000
        );

        if (claimAmount < 10000) {
          console.log(`❌ ${config.user_email}: Số tiền rút quá nhỏ (${claimAmount})`);
          continue;
        }

        console.log(`✅ ${config.user_email}: Đủ điều kiện auto-claim ${claimAmount.toLocaleString()} CAMLY`);

        // Create auto withdrawal request
        const withdrawal = await base44.asServiceRole.entities.WithdrawalRequest.create({
          user_email: config.user_email,
          withdrawal_address: config.primary_wallet,
          amount: claimAmount,
          status: 'pending',
          verification_status: 'email_verified',
          requires_manual_review: false
        });

        // Auto-approve and transfer immediately
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'approved',
          processed_by: 'auto_claim_system',
          processed_date: new Date().toISOString()
        });

        const transferResult = await base44.asServiceRole.functions.invoke('autoTransferCamlycoin', {
          withdrawalRequestId: withdrawal.id
        });

        if (transferResult.data.success) {
          // Update config
          await base44.asServiceRole.entities.AutoClaimConfig.update(config.id, {
            last_claim_date: new Date().toISOString(),
            total_auto_claimed: (config.total_auto_claimed || 0) + claimAmount
          });

          // Update daily limit
          await base44.asServiceRole.entities.DailyAutoClaimLimit.update(dailyLimit.id, {
            total_claimed_today: (dailyLimit.total_claimed_today || 0) + claimAmount,
            claim_count: (dailyLimit.claim_count || 0) + 1,
            remaining_limit: Math.max(0, (dailyLimit.remaining_limit || 500000) - claimAmount)
          });

          // Send notification
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: config.user_email,
            subject: '✅ Auto-Claim CAMLY Thành Công!',
            body: `Chào bạn,

🎉 Hệ thống đã tự động chuyển ${claimAmount.toLocaleString()} CAMLY COIN vào ví của bạn!

📍 Địa chỉ ví: ${config.primary_wallet}
🔗 TX Hash: ${transferResult.data.tx_hash}
📊 Xem chi tiết: https://bscscan.com/tx/${transferResult.data.tx_hash}

Cảm ơn bạn đã tin tưởng Angel AI! ✨`
          }).catch(err => console.error('Email failed:', err));

          results.push({
            email: config.user_email,
            amount: claimAmount,
            success: true,
            tx_hash: transferResult.data.tx_hash
          });
        } else {
          results.push({
            email: config.user_email,
            amount: claimAmount,
            success: false,
            error: transferResult.data.error
          });
        }
      } catch (error) {
        console.error(`Error processing ${config.user_email}:`, error);
        results.push({
          email: config.user_email,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Auto-claim completed: ${successCount}/${results.length} success`);

    return Response.json({
      success: true,
      processed: results.length,
      successCount,
      failCount: results.length - successCount,
      results
    });
  } catch (error) {
    console.error('Error in auto-claim check:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});