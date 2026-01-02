import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const { targetUserEmail, autoApply = false } = await req.json();

    // Fetch all users or specific user
    let usersToAnalyze = [];
    if (targetUserEmail) {
      const targetUsers = await base44.asServiceRole.entities.User.filter({ email: targetUserEmail });
      if (targetUsers.length > 0) {
        usersToAnalyze = [targetUsers[0]];
      }
    } else {
      usersToAnalyze = await base44.asServiceRole.entities.User.list('', 1000);
    }

    const recommendations = [];

    for (const analyzeUser of usersToAnalyze) {
      // Fetch user data
      const [balance, transactions, userLevel, quests, appeals] = await Promise.all([
        base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: analyzeUser.email }).then(b => b[0] || null),
        base44.asServiceRole.entities.CamlycoinTransaction.filter({ user_email: analyzeUser.email }, '-created_date', 100),
        base44.asServiceRole.entities.UserLevel.filter({ user_email: analyzeUser.email }).then(l => l[0] || null),
        base44.asServiceRole.entities.UserQuestProgress.filter({ user_email: analyzeUser.email }),
        base44.asServiceRole.entities.UserAppeal.filter({ user_email: analyzeUser.email })
      ]);

      // Calculate metrics
      const totalEarned = balance?.total_earned || 0;
      const streakDays = userLevel?.streak_days || 0;
      const qualityFeedback = userLevel?.quality_feedback_count || 0;
      const completedQuests = quests.filter(q => q.status === 'completed' || q.status === 'claimed').length;
      const recentTransactions = transactions.slice(0, 30);
      const avgTransactionAmount = recentTransactions.length > 0 
        ? recentTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / recentTransactions.length 
        : 0;
      const frozenBalance = balance?.frozen_balance || 0;
      const spamScore = balance?.spam_score || 0;
      const pendingAppeals = appeals.filter(a => a.status === 'pending').length;

      // AI Analysis prompt
      const analysisPrompt = `Analyze this user's activity and recommend rewards:

User: ${analyzeUser.email}
Total Earned: ${totalEarned.toLocaleString()} Camlycoin
Current Level: ${userLevel?.current_level || 'bronze'} (${userLevel?.level_number || 1})
Streak Days: ${streakDays}
Quality Feedback: ${qualityFeedback}
Completed Quests: ${completedQuests}
Recent Avg Transaction: ${avgTransactionAmount.toFixed(0)} Camlycoin
Frozen Balance: ${frozenBalance.toLocaleString()}
Spam Score: ${spamScore}
Pending Appeals: ${pendingAppeals}

Recent Activity Summary:
${recentTransactions.slice(0, 10).map(tx => `- ${tx.description} (${tx.amount > 0 ? '+' : ''}${tx.amount})`).join('\n')}

Based on this data, recommend:
1. Should this user receive a bonus reward? If yes, how much and why?
2. Are they a high-quality user deserving special recognition?
3. Any red flags or concerns?
4. Suggested next action (bonus, watch, freeze, etc.)

Provide your response in this exact JSON format:
{
  "recommendation": "bonus|watch|normal|freeze",
  "bonus_amount": <number or 0>,
  "reason": "<detailed reason>",
  "quality_score": <1-10>,
  "risk_level": "low|medium|high",
  "suggested_actions": ["action1", "action2"]
}`;

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: analysisPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendation: { type: "string" },
            bonus_amount: { type: "number" },
            reason: { type: "string" },
            quality_score: { type: "number" },
            risk_level: { type: "string" },
            suggested_actions: { type: "array", items: { type: "string" } }
          }
        }
      });

      recommendations.push({
        user_email: analyzeUser.email,
        analysis: aiResponse,
        current_metrics: {
          total_earned: totalEarned,
          streak_days: streakDays,
          quality_feedback: qualityFeedback,
          level: userLevel?.current_level || 'bronze',
          frozen_balance: frozenBalance,
          spam_score: spamScore
        }
      });

      // Auto-apply if requested and recommendation is bonus
      if (autoApply && aiResponse.recommendation === 'bonus' && aiResponse.bonus_amount > 0) {
        // Update balance
        if (balance) {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            balance: balance.balance + aiResponse.bonus_amount,
            total_earned: balance.total_earned + aiResponse.bonus_amount
          });
        } else {
          await base44.asServiceRole.entities.CamlycoinBalance.create({
            user_email: analyzeUser.email,
            balance: aiResponse.bonus_amount,
            total_earned: aiResponse.bonus_amount,
            total_spent: 0
          });
        }

        // Create transaction
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: analyzeUser.email,
          amount: aiResponse.bonus_amount,
          type: 'admin_adjustment',
          description: `🤖 AI Bonus: ${aiResponse.reason.substring(0, 200)}`,
          processed_by: user.email
        });
      }
    }

    return Response.json({ 
      success: true,
      analyzed_count: usersToAnalyze.length,
      recommendations,
      auto_applied: autoApply
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});