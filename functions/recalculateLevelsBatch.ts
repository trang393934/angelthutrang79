import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batchSize = 10, skipCount = 0 } = await req.json();

    // Level thresholds với công thức mới
    const levelThresholds = [
      { level: 'bronze', number: 1, min: 0, max: 500000, dailyBonus: 0 },
      { level: 'silver', number: 2, min: 500000, max: 1500000, dailyBonus: 2 },
      { level: 'gold', number: 3, min: 1500000, max: 3000000, dailyBonus: 5 },
      { level: 'platinum', number: 4, min: 3000000, max: 6000000, dailyBonus: 10 },
      { level: 'diamond', number: 5, min: 6000000, max: 10000000, dailyBonus: 15 },
      { level: 'master', number: 6, min: 10000000, max: Infinity, dailyBonus: 20 }
    ];

    // Get batch of users
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 10000);
    const batch = allBalances.slice(skipCount, skipCount + batchSize);

    const updated = [];

    for (const balance of batch) {
      try {
        const userEmail = balance.user_email;
        const totalEarned = balance.total_earned || 0;

        // Get quality feedback
        const feedbacks = await base44.asServiceRole.entities.Feedback.filter({ created_by: userEmail });
        const qualityCount = feedbacks.filter(f => f.rating === 'helpful').length;

        // Enhanced Point Calculation
        // Base: Total Earned Camlycoin
        let totalPoints = totalEarned;

        // Quality Feedback Bonus: +100 per helpful feedback
        const qualityBonus = qualityCount * 100;
        totalPoints += qualityBonus;

        // Streak Bonus: +50 per day of continuous activity
        const streakBonus = streakDays * 50;
        totalPoints += streakBonus;

        // Activity Bonus: Based on recent activity count
        const recentActivities = activities.filter(a => {
          const activityDate = new Date(a.timestamp);
          const daysSince = (new Date() - activityDate) / (1000 * 60 * 60 * 24);
          return daysSince <= 30; // Last 30 days
        });
        const activityBonus = recentActivities.length * 10;
        totalPoints += activityBonus;

        // Quality Ratio Bonus: If >70% helpful feedback
        const totalFeedbacks = feedbacks.length;
        const qualityRatio = totalFeedbacks > 0 ? (qualityCount / totalFeedbacks) : 0;
        const qualityRatioBonus = qualityRatio >= 0.7 && totalFeedbacks >= 5 ? 500 : 0;
        totalPoints += qualityRatioBonus;

        // Find correct level
        const currentLevelData = levelThresholds.reverse().find(l => totalPoints >= l.min);
        levelThresholds.reverse(); // Reset order

        // Calculate streak
        const activities = await base44.asServiceRole.entities.UserActivity.filter(
          { user_email: userEmail },
          '-timestamp',
          365
        );

        let streakDays = 0;
        if (activities.length > 0) {
          const today = new Date();
          let checkDate = new Date(today);
          
          for (let i = 0; i < 365; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const hasActivity = activities.some(a => 
              new Date(a.timestamp).toISOString().split('T')[0] === dateStr
            );
            
            if (hasActivity) {
              streakDays++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
        }

        // Badges
        const badges = [];
        if (qualityCount >= 10) badges.push('quality_master');
        if (qualityCount >= 50) badges.push('wisdom_seeker');
        if (streakDays >= 7) badges.push('dedicated_learner');
        if (streakDays >= 30) badges.push('enlightenment_path');
        if (totalEarned >= 100000) badges.push('coin_collector');
        if (currentLevelData.level === 'master') badges.push('grand_master');

        // Unlocked features
        const unlockedFeatures = ['basic_chat'];
        if (currentLevelData.number >= 2) unlockedFeatures.push('priority_support');
        if (currentLevelData.number >= 3) unlockedFeatures.push('exclusive_content');
        if (currentLevelData.number >= 4) unlockedFeatures.push('advanced_ai_tools');
        if (currentLevelData.number >= 5) unlockedFeatures.push('vip_access');
        if (currentLevelData.number >= 6) unlockedFeatures.push('custom_features');

        const nextLevelPoints = currentLevelData.max === Infinity ? null : currentLevelData.max;

        // Update or create
        const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ user_email: userEmail });

        if (userLevels.length > 0) {
          const oldLevel = userLevels[0];
          const levelChanged = oldLevel.current_level !== currentLevelData.level;

          await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
            current_level: currentLevelData.level,
            level_number: currentLevelData.number,
            total_points: totalPoints,
            quality_feedback_count: qualityCount,
            streak_days: streakDays,
            badges: badges,
            unlocked_features: unlockedFeatures,
            daily_limit_bonus: currentLevelData.dailyBonus,
            reward_multiplier: 1.0,
            next_level_points: nextLevelPoints,
            last_level_up_date: levelChanged ? new Date().toISOString() : oldLevel.last_level_up_date,
            // Point breakdown for transparency
            point_breakdown: {
              base_earned: totalEarned,
              quality_bonus: qualityBonus,
              streak_bonus: streakBonus,
              activity_bonus: activityBonus,
              quality_ratio_bonus: qualityRatioBonus,
              quality_ratio: qualityRatio,
              total_feedbacks: totalFeedbacks,
              recent_activities_count: recentActivities.length
            }
          });

          if (levelChanged) {
            await base44.asServiceRole.entities.CamlycoinTransaction.create({
              user_email: userEmail,
              amount: 0,
              type: 'admin_adjustment',
              description: `🎉 LEVEL UP! Chúc mừng con lên ${currentLevelData.level.toUpperCase()} (Lv.${currentLevelData.number})!`
            });
          }
        } else {
          await base44.asServiceRole.entities.UserLevel.create({
            user_email: userEmail,
            current_level: currentLevelData.level,
            level_number: currentLevelData.number,
            total_points: totalPoints,
            quality_feedback_count: qualityCount,
            streak_days: streakDays,
            badges: badges,
            unlocked_features: unlockedFeatures,
            daily_limit_bonus: currentLevelData.dailyBonus,
            reward_multiplier: 1.0,
            next_level_points: nextLevelPoints,
            last_level_up_date: new Date().toISOString(),
            // Point breakdown for transparency
            point_breakdown: {
              base_earned: totalEarned,
              quality_bonus: qualityBonus,
              streak_bonus: streakBonus,
              activity_bonus: activityBonus,
              quality_ratio_bonus: qualityRatioBonus,
              quality_ratio: qualityRatio,
              total_feedbacks: totalFeedbacks,
              recent_activities_count: recentActivities.length
            }
          });
        }

        updated.push({
          email: userEmail,
          level: currentLevelData.level,
          totalPoints: totalPoints
        });

        // Small delay to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error updating ${balance.user_email}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: `Updated ${updated.length} users`,
      updated: updated,
      nextSkipCount: skipCount + batchSize,
      totalUsers: allBalances.length,
      hasMore: (skipCount + batchSize) < allBalances.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});