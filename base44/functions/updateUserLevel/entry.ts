import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userEmail } = await req.json();

    // Get user's balance and level
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
    const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ user_email: userEmail });
    
    if (balances.length === 0) {
      return Response.json({ message: 'No balance found' });
    }

    const balance = balances[0];
    const totalEarned = balance.total_earned || 0;

    // Get quality feedback count
    const feedbacks = await base44.asServiceRole.entities.Feedback.filter({ created_by: userEmail });
    const qualityCount = feedbacks.filter(f => f.rating === 'helpful').length;

    // Calculate total points (earned + quality bonuses)
    const totalPoints = totalEarned + (qualityCount * 100);

    // Determine level
    const levelThresholds = [
      { level: 'bronze', number: 1, min: 0, max: 500000, multiplier: 1.0, dailyBonus: 0 },
      { level: 'silver', number: 2, min: 500000, max: 1500000, multiplier: 1.0, dailyBonus: 2 },
      { level: 'gold', number: 3, min: 1500000, max: 3000000, multiplier: 1.0, dailyBonus: 5 },
      { level: 'platinum', number: 4, min: 3000000, max: 6000000, multiplier: 1.0, dailyBonus: 10 },
      { level: 'diamond', number: 5, min: 6000000, max: 10000000, multiplier: 1.0, dailyBonus: 15 },
      { level: 'master', number: 6, min: 10000000, max: Infinity, multiplier: 1.0, dailyBonus: 20 }
    ];

    const currentLevelData = levelThresholds.reverse().find(l => totalPoints >= l.min);
    
    // Calculate streak days
    const activities = await base44.asServiceRole.entities.UserActivity.filter(
      { user_email: userEmail },
      '-timestamp',
      1000
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

    // Determine badges
    const badges = [];
    if (qualityCount >= 10) badges.push('quality_master');
    if (qualityCount >= 50) badges.push('wisdom_seeker');
    if (streakDays >= 7) badges.push('dedicated_learner');
    if (streakDays >= 30) badges.push('enlightenment_path');
    if (totalEarned >= 100000) badges.push('coin_collector');
    if (currentLevelData.level === 'master') badges.push('grand_master');

    // Determine unlocked features
    const unlockedFeatures = ['basic_chat'];
    if (currentLevelData.number >= 2) unlockedFeatures.push('priority_support');
    if (currentLevelData.number >= 3) unlockedFeatures.push('exclusive_content');
    if (currentLevelData.number >= 4) unlockedFeatures.push('advanced_ai_tools');
    if (currentLevelData.number >= 5) unlockedFeatures.push('vip_access');
    if (currentLevelData.number >= 6) unlockedFeatures.push('custom_features');

    const nextLevelPoints = currentLevelData.max === Infinity ? null : currentLevelData.max;

    // Update or create user level
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
        reward_multiplier: currentLevelData.multiplier,
        next_level_points: nextLevelPoints,
        last_level_up_date: levelChanged ? new Date().toISOString() : oldLevel.last_level_up_date
      });

      // Send notification if level up
      if (levelChanged) {
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: userEmail,
          amount: 0,
          type: 'admin_adjustment',
          description: `🎉 LEVEL UP! Chúc mừng con lên ${currentLevelData.level.toUpperCase()} (Lv.${currentLevelData.number})!\n✨ Đặc quyền mới đã mở khóa!`
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
        reward_multiplier: currentLevelData.multiplier,
        next_level_points: nextLevelPoints,
        last_level_up_date: new Date().toISOString()
      });
    }

    return Response.json({ 
      success: true, 
      level: currentLevelData,
      totalPoints,
      streakDays
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});