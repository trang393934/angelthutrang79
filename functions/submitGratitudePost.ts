import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postContent, postType, isSelfWritten } = await req.json();

    if (!postContent || !postType) {
      return Response.json({ error: 'Missing postContent or postType' }, { status: 400 });
    }

    // isSelfWritten must be explicitly provided
    if (typeof isSelfWritten !== 'boolean') {
      return Response.json({ error: 'Missing isSelfWritten field' }, { status: 400 });
    }

    // Validate post type
    if (!['repentance', 'gratitude', 'both'].includes(postType)) {
      return Response.json({ error: 'Invalid postType' }, { status: 400 });
    }

    // Get current time in Vietnam timezone (UTC+7)
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const hour = vietnamTime.getUTCHours();
    const isAfter8PM = hour >= 20 || hour < 6; // After 8pm until 6am next day

    // Calculate word count
    const wordCount = postContent.trim().split(/\s+/).length;

    // Calculate base reward (5000-10000 Camlycoin)
    let baseReward = 0;
    if (wordCount >= 50 && wordCount < 100) {
      baseReward = 5000;
    } else if (wordCount >= 100 && wordCount < 200) {
      baseReward = 7500;
    } else if (wordCount >= 200) {
      baseReward = 10000;
    } else {
      return Response.json({ 
        error: 'Bài viết phải có ít nhất 50 từ để nhận thưởng',
        wordCount 
      }, { status: 400 });
    }

    // Apply bonus multiplier ONLY if self-written
    let bonusMultiplier = 1.0;
    if (isSelfWritten) {
      if (isAfter8PM) {
        bonusMultiplier = 1.5; // 50% bonus after 8pm
      }

      // Apply bonus for type "both"
      if (postType === 'both') {
        bonusMultiplier += 0.2; // Additional 20% for both types
      }
    }

    const coinsEarned = Math.round(baseReward * bonusMultiplier);

    // Check if user already posted today
    const today = vietnamTime.toISOString().split('T')[0];
    const existingPosts = await base44.entities.GratitudeJournal.list('-post_date', 10000);
    const todayPosts = existingPosts.filter(post => {
      const postDate = new Date(post.post_date).toISOString().split('T')[0];
      return post.user_email === user.email && postDate === today;
    });

    if (todayPosts.length >= 3) {
      return Response.json({ 
        error: 'Bạn đã đăng đủ 3 bài trong ngày hôm nay. Vui lòng quay lại vào ngày mai!',
        todayPostsCount: todayPosts.length
      }, { status: 400 });
    }

    // Create gratitude journal entry
    const journal = await base44.entities.GratitudeJournal.create({
      user_email: user.email,
      post_content: postContent,
      post_type: postType,
      post_date: now.toISOString(),
      post_hour: hour,
      is_after_8pm: isAfter8PM,
      coins_earned: coinsEarned,
      word_count: wordCount,
      status: 'approved',
      bonus_multiplier: bonusMultiplier,
      is_self_written: isSelfWritten
    });

    // Update user balance using service role
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: user.email });
    let balance;

    if (balances.length > 0) {
      balance = balances[0];
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        net_valid_coins: (balance.net_valid_coins || 0) + coinsEarned,
        total_earned: (balance.total_earned || 0) + coinsEarned,
        available_for_withdrawal: (balance.net_valid_coins || 0) + coinsEarned - (balance.paid_amount || 0)
      });
    } else {
      balance = await base44.asServiceRole.entities.CamlycoinBalance.create({
        user_email: user.email,
        net_valid_coins: coinsEarned,
        total_earned: coinsEarned,
        available_for_withdrawal: coinsEarned,
        frozen_balance: 0,
        paid_amount: 0
      });
    }

    // Create transaction record
    const typeLabel = postType === 'repentance' ? 'Sám Hối' :
                      postType === 'gratitude' ? 'Biết Ơn' : 'Sám Hối & Biết Ơn';
    
    const selfWrittenText = isSelfWritten ? '\n✍️ Tự viết' : '\n📝 Dựa gợi ý';
    const bonusText = (isSelfWritten && isAfter8PM) ? '\n🌙 Bonus sau 20h: +50%' : '';
    const bothTypeBonus = (isSelfWritten && postType === 'both') ? '\n✨ Bonus cả 2 loại: +20%' : '';

    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: coinsEarned,
      type: 'manual_add',
      description: `📝 ${typeLabel}${selfWrittenText}\n💰 +${coinsEarned} Camlycoin (${wordCount} từ)${bonusText}${bothTypeBonus}\n⏰ ${vietnamTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
      reference_id: journal.id
    });

    // Update user level
    try {
      await base44.asServiceRole.functions.invoke('updateUserLevel', { userEmail: user.email });
    } catch (err) {
      console.log('Level update skipped:', err.message);
    }

    return Response.json({
      success: true,
      message: '✅ Đăng bài thành công!',
      coinsEarned,
      wordCount,
      bonusMultiplier,
      isAfter8PM,
      postType,
      isSelfWritten,
      journal,
      remainingPostsToday: 3 - (todayPosts.length + 1)
    });

  } catch (error) {
    console.error('Submit gratitude post error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});