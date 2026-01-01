import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * UNIFIED REWARD DECISION ENGINE
 * 
 * Pipeline xử lý thưởng Camlycoin với các bước kiểm tra:
 * 1. Rate Limiting (20 questions/hour)
 * 2. Daily Limit (10 questions/day)
 * 3. Content Quality & Similarity Check
 * 4. Anomaly Detection (spike detection)
 * 5. Historical Pattern Analysis
 * 
 * Returns: { approved, reward_amount, frozen_amount, reason, flags }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { question, energy_analysis } = await req.json();
    
    const decision = {
      approved: true,
      reward_amount: energy_analysis.reward_amount || 0,
      frozen_amount: 0,
      reason: '',
      flags: [],
      checks_passed: []
    };

    // === CHECK 1: Rate Limiting (20 questions/hour) ===
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const recentTransactions = await base44.entities.CamlycoinTransaction.filter({
      user_email: user.email,
    }, '-created_date', 100);

    const lastHourQuestions = recentTransactions.filter(tx => 
      new Date(tx.created_date) >= oneHourAgo && tx.amount > 0
    ).length;

    if (lastHourQuestions >= 20) {
      decision.approved = false;
      decision.reward_amount = 0;
      decision.reason = 'Vượt quá giới hạn 20 câu/giờ. Vui lòng nghỉ ngơi!';
      decision.flags.push('RATE_LIMIT_EXCEEDED');
      
      // Log suspicious activity
      await base44.asServiceRole.entities.SpamAuditLog.create({
        user_email: user.email,
        audit_date: new Date().toISOString(),
        total_questions: lastHourQuestions,
        spam_questions: 0,
        spam_ratio: 0,
        spam_score: 50,
        detection_reasons: ['Rate limit: >20 questions/hour'],
        questions_per_hour: lastHourQuestions,
        coins_frozen: 0,
        action_taken: 'flagged'
      });

      return Response.json(decision);
    }
    decision.checks_passed.push('rate_limit');

    // === CHECK 2: Daily Limit (10 questions/day) ===
    const today = new Date().toISOString().split('T')[0];
    const dailyLimits = await base44.entities.DailyRewardLimit.filter({
      user_email: user.email,
      date: today
    });

    const currentLimit = dailyLimits[0];
    if (currentLimit && currentLimit.questions_rewarded >= 10) {
      decision.approved = false;
      decision.reward_amount = 0;
      decision.reason = 'Đã hết 10 lượt thưởng hôm nay. Quay lại vào ngày mai!';
      decision.flags.push('DAILY_LIMIT_REACHED');
      return Response.json(decision);
    }
    decision.checks_passed.push('daily_limit');

    // === CHECK 3: Content Quality Check ===
    if (question.length < 10) {
      decision.approved = false;
      decision.reward_amount = 0;
      decision.reason = 'Câu hỏi quá ngắn. Hãy chia sẻ chi tiết hơn từ trái tim!';
      decision.flags.push('LOW_QUALITY_SHORT');
      return Response.json(decision);
    }

    // Check for repetitive content (last 10 questions)
    const recentQuestions = recentTransactions
      .filter(tx => tx.description && tx.amount > 0)
      .slice(0, 10)
      .map(tx => tx.description);

    let maxSimilarity = 0;
    for (const prevQ of recentQuestions) {
      const similarity = calculateSimilarity(question, prevQ);
      if (similarity > maxSimilarity) maxSimilarity = similarity;
    }

    if (maxSimilarity > 0.85) {
      // High similarity - reduce reward or freeze
      decision.flags.push('REPETITIVE_CONTENT');
      decision.frozen_amount = Math.floor(decision.reward_amount * 0.5);
      decision.reward_amount = Math.floor(decision.reward_amount * 0.5);
      decision.reason = 'Nội dung tương tự câu hỏi trước. 50% thưởng bị tạm giữ.';
    } else {
      decision.checks_passed.push('content_quality');
    }

    // === CHECK 4: Anomaly Detection (Spike Detection) ===
    // Calculate user's average questions per hour over last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weekTransactions = recentTransactions.filter(tx => 
      new Date(tx.created_date) >= sevenDaysAgo && tx.amount > 0
    );

    if (weekTransactions.length > 0) {
      const hoursInWeek = 7 * 24;
      const avgQuestionsPerHour = weekTransactions.length / hoursInWeek;
      const currentHourRate = lastHourQuestions;

      // If current rate is 5x average, flag as anomaly
      if (avgQuestionsPerHour > 0 && currentHourRate > avgQuestionsPerHour * 5) {
        decision.flags.push('ANOMALY_SPIKE');
        decision.frozen_amount += Math.floor(decision.reward_amount * 0.3);
        decision.reward_amount = Math.floor(decision.reward_amount * 0.7);
        decision.reason = (decision.reason ? decision.reason + ' ' : '') + 'Hoạt động bất thường - 30% tạm giữ.';
      } else {
        decision.checks_passed.push('anomaly_detection');
      }
    }

    // === CHECK 5: Historical Pattern Analysis ===
    const userBalances = await base44.entities.CamlycoinBalance.filter({
      user_email: user.email
    });

    if (userBalances.length > 0) {
      const balance = userBalances[0];
      
      // If user already has high spam score, freeze all new rewards
      if (balance.spam_score && balance.spam_score >= 70) {
        decision.approved = false;
        decision.reward_amount = 0;
        decision.frozen_amount = energy_analysis.reward_amount || 0;
        decision.reason = 'Tài khoản đang được xem xét do hoạt động nghi ngờ.';
        decision.flags.push('HIGH_SPAM_SCORE');
        return Response.json(decision);
      }

      // If moderate spam score, freeze 50%
      if (balance.spam_score && balance.spam_score >= 40) {
        decision.flags.push('MODERATE_SPAM_SCORE');
        decision.frozen_amount = Math.floor(decision.reward_amount * 0.5);
        decision.reward_amount = Math.floor(decision.reward_amount * 0.5);
        decision.reason = (decision.reason || '') + ' Tài khoản cần xem xét - 50% tạm giữ.';
      } else {
        decision.checks_passed.push('historical_pattern');
      }
    }

    // === FINAL DECISION ===
    if (decision.checks_passed.length >= 4) {
      decision.reason = decision.reason || 'Tất cả kiểm tra đều hợp lệ. Thưởng đầy đủ!';
    }

    // Log the decision
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0, // Just for logging
      type: 'admin_adjustment',
      description: `Decision Log: ${decision.flags.join(', ') || 'All checks passed'}`,
      reference_id: `decision_${Date.now()}`
    });

    return Response.json(decision);

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

function calculateSimilarity(str1, str2) {
  // Jaccard similarity on words
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}