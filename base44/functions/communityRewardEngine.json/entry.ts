import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * COMMUNITY REWARD ENGINE
 * Tự động tặng Camlycoin cho các hoạt động cộng đồng tích cực
 */

// Reward rates
const REWARD_RATES = {
  share_content: 500,           // Share to FUN ecosystem
  upload_knowledge: 2000,       // Upload tài liệu tri thức
  helpful_feedback: 300,        // Feedback hữu ích
  daily_login: 100,            // Login hàng ngày
  gratitude_journal: 500,      // Viết nhật ký biết ơn
  vision_creation: 1000,       // Tạo personal vision
  community_help: 1500,        // Giúp đỡ người khác
  quality_question: 0          // Calculated separately
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, reward_type, activity_description, reference_id, amount } = await req.json();

    if (action === 'award_community_reward') {
      // Calculate reward amount
      const coinsAwarded = amount || REWARD_RATES[reward_type] || 0;

      if (coinsAwarded === 0) {
        return Response.json({ error: 'Invalid reward type' }, { status: 400 });
      }

      // Check daily limits for certain activities
      const today = new Date().toISOString().split('T')[0];
      const todayRewards = await base44.entities.CommunityReward.filter({
        user_email: user.email,
        reward_type: reward_type
      });

      const todayCount = todayRewards.filter(r => {
        const rewardDate = new Date(r.created_date).toISOString().split('T')[0];
        return rewardDate === today;
      }).length;

      // Limits
      const dailyLimits = {
        daily_login: 1,
        gratitude_journal: 1,
        share_content: 5,
        helpful_feedback: 10
      };

      if (dailyLimits[reward_type] && todayCount >= dailyLimits[reward_type]) {
        return Response.json({ 
          success: false, 
          message: 'Đã đạt giới hạn hoạt động này trong ngày' 
        }, { status: 400 });
      }

      // Auto-approve for trusted activities
      const autoApprove = ['daily_login', 'share_content', 'helpful_feedback', 'gratitude_journal', 'vision_creation'].includes(reward_type);

      // Create community reward record
      const reward = await base44.entities.CommunityReward.create({
        user_email: user.email,
        reward_type: reward_type,
        activity_description: activity_description,
        coins_awarded: coinsAwarded,
        reference_id: reference_id || null,
        status: autoApprove ? 'approved' : 'pending',
        auto_approved: autoApprove
      });

      // If auto-approved, add coins immediately
      if (autoApprove) {
        const balances = await base44.entities.CamlycoinBalance.filter({ user_email: user.email });
        if (balances.length > 0) {
          const balance = balances[0];
          await base44.entities.CamlycoinBalance.update(balance.id, {
            balance: (balance.balance || 0) + coinsAwarded,
            available_balance: (balance.available_balance || 0) + coinsAwarded,
            total_earned: (balance.total_earned || 0) + coinsAwarded
          });
        } else {
          await base44.entities.CamlycoinBalance.create({
            user_email: user.email,
            balance: coinsAwarded,
            available_balance: coinsAwarded,
            total_earned: coinsAwarded,
            total_spent: 0,
            paid_amount: 0,
            unpaid_amount: 0,
            frozen_balance: 0,
            pending_review_balance: 0
          });
        }

        // Create transaction
        await base44.entities.CamlycoinTransaction.create({
          user_email: user.email,
          amount: coinsAwarded,
          type: 'manual_add',
          description: `🎁 Thưởng cộng đồng: ${activity_description}\n💰 +${coinsAwarded} Camlycoin`,
          reference_id: reward.id
        });
      }

      return Response.json({ 
        success: true, 
        reward_id: reward.id,
        coins_awarded: coinsAwarded,
        auto_approved: autoApprove,
        message: autoApprove 
          ? `Đã nhận ${coinsAwarded} Camlycoin!` 
          : 'Đang chờ admin duyệt'
      });
    }

    // Admin: Approve reward
    if (action === 'approve_reward') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      const { reward_id } = await req.json();
      const rewards = await base44.asServiceRole.entities.CommunityReward.filter({ id: reward_id });
      
      if (rewards.length === 0) {
        return Response.json({ error: 'Reward not found' }, { status: 404 });
      }

      const reward = rewards[0];

      // Add coins to user balance
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: reward.user_email });
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          balance: (balance.balance || 0) + reward.coins_awarded,
          available_balance: (balance.available_balance || 0) + reward.coins_awarded,
          total_earned: (balance.total_earned || 0) + reward.coins_awarded
        });
      }

      // Update reward status
      await base44.asServiceRole.entities.CommunityReward.update(reward_id, {
        status: 'approved',
        processed_by: user.email,
        processed_date: new Date().toISOString()
      });

      // Create transaction
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: reward.user_email,
        amount: reward.coins_awarded,
        type: 'manual_add',
        description: `🎁 Admin duyệt thưởng: ${reward.activity_description}\n💰 +${reward.coins_awarded} Camlycoin`,
        reference_id: reward_id,
        processed_by: user.email
      });

      return Response.json({ success: true });
    }

    // Admin: Reject reward
    if (action === 'reject_reward') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      const { reward_id, reason } = await req.json();

      await base44.asServiceRole.entities.CommunityReward.update(reward_id, {
        status: 'rejected',
        processed_by: user.email,
        processed_date: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});