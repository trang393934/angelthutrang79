import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SPAM DETECTION & AUDIT SYSTEM
 * 
 * Phân tích user activity để phát hiện spam/farming patterns
 * Tính toán spam score dựa trên:
 * 1. Volume: Số câu hỏi/giờ trung bình
 * 2. Repetition: Độ tương đồng giữa các câu hỏi
 * 3. Quality: Độ dài, chất lượng câu hỏi
 * 4. Pattern: Timing patterns (bot-like behavior)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can run audit
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { mode = 'dry_run', user_email = null, batch_size = 50 } = await req.json();

    // Fetch all transactions to analyze
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 10000);
    
    // Group by user
    const userActivities = {};
    for (const tx of allTransactions) {
      if (!tx.user_email) continue;
      if (!userActivities[tx.user_email]) {
        userActivities[tx.user_email] = {
          transactions: [],
          totalCoins: 0,
          questionCount: 0
        };
      }
      userActivities[tx.user_email].transactions.push(tx);
      if (tx.amount > 0) {
        userActivities[tx.user_email].totalCoins += tx.amount;
        userActivities[tx.user_email].questionCount++;
      }
    }

    const auditResults = [];

    // Analyze each user
    for (const [email, activity] of Object.entries(userActivities)) {
      // Filter for specific user if requested
      if (user_email && email !== user_email) continue;

      const analysis = await analyzeUserActivity(email, activity, base44);
      
      if (analysis.spam_score > 30) { // Only flag suspicious users
        auditResults.push(analysis);
      }

      // Limit batch size
      if (auditResults.length >= batch_size) break;
    }

    // Sort by spam score (highest first)
    auditResults.sort((a, b) => b.spam_score - a.spam_score);

    // Take action if not dry run
    if (mode === 'execute') {
      for (const result of auditResults) {
        await takeAuditAction(result, base44);
      }
    }

    return Response.json({
      mode,
      analyzed_users: Object.keys(userActivities).length,
      flagged_users: auditResults.length,
      results: auditResults,
      summary: {
        high_risk: auditResults.filter(r => r.spam_score >= 70).length,
        medium_risk: auditResults.filter(r => r.spam_score >= 40 && r.spam_score < 70).length,
        low_risk: auditResults.filter(r => r.spam_score < 40).length
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

async function analyzeUserActivity(email, activity, base44) {
  const { transactions, totalCoins, questionCount } = activity;
  
  let spam_score = 0;
  const reasons = [];

  // 1. Volume Analysis
  if (transactions.length > 0) {
    const firstTx = new Date(transactions[transactions.length - 1].created_date);
    const lastTx = new Date(transactions[0].created_date);
    const hoursDiff = (lastTx - firstTx) / (1000 * 60 * 60);
    const questionsPerHour = hoursDiff > 0 ? questionCount / hoursDiff : 0;

    if (questionsPerHour > 20) {
      spam_score += 40;
      reasons.push(`Quá nhiều câu hỏi: ${questionsPerHour.toFixed(1)}/giờ`);
    } else if (questionsPerHour > 10) {
      spam_score += 20;
      reasons.push(`Số lượng cao: ${questionsPerHour.toFixed(1)}/giờ`);
    }
  }

  // 2. Quality Analysis - Check descriptions
  let shortQuestions = 0;
  let repetitiveCount = 0;
  const descriptions = [];

  for (const tx of transactions) {
    if (tx.description && tx.amount > 0) {
      descriptions.push(tx.description);
      // Check for very short descriptions
      if (tx.description.length < 30) {
        shortQuestions++;
      }
    }
  }

  if (questionCount > 0) {
    const shortRatio = shortQuestions / questionCount;
    if (shortRatio > 0.7) {
      spam_score += 25;
      reasons.push(`${(shortRatio * 100).toFixed(0)}% câu hỏi quá ngắn`);
    }
  }

  // 3. Repetition Analysis - Simple similarity check
  for (let i = 0; i < descriptions.length - 1; i++) {
    for (let j = i + 1; j < descriptions.length; j++) {
      const similarity = calculateSimpleSimilarity(descriptions[i], descriptions[j]);
      if (similarity > 0.8) {
        repetitiveCount++;
      }
    }
  }

  if (questionCount > 5) {
    const repetitiveRatio = repetitiveCount / (questionCount * (questionCount - 1) / 2);
    if (repetitiveRatio > 0.3) {
      spam_score += 30;
      reasons.push(`${(repetitiveRatio * 100).toFixed(0)}% nội dung lặp lại`);
    }
  }

  // 4. Reward Pattern - Check if always getting high rewards (suspicious)
  const avgReward = totalCoins / questionCount;
  if (avgReward > 4000 && questionCount > 20) {
    spam_score += 15;
    reasons.push(`Thưởng trung bình cao bất thường: ${avgReward.toFixed(0)}`);
  }

  // Calculate spam ratio
  const spam_ratio = spam_score / 100;

  return {
    user_email: email,
    total_questions: questionCount,
    total_coins: totalCoins,
    spam_score: Math.min(100, spam_score),
    spam_ratio,
    detection_reasons: reasons,
    questions_per_hour: transactions.length > 0 ? 
      (questionCount / ((new Date(transactions[0].created_date) - new Date(transactions[transactions.length - 1].created_date)) / (1000 * 60 * 60))) : 0,
    avg_reward: avgReward,
    risk_level: spam_score >= 70 ? 'HIGH' : spam_score >= 40 ? 'MEDIUM' : 'LOW'
  };
}

function calculateSimpleSimilarity(str1, str2) {
  // Simple Jaccard similarity on words
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

async function takeAuditAction(result, base44) {
  const { user_email, spam_score, total_coins, detection_reasons } = result;

  // Get user balance
  const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
  if (balances.length === 0) return;

  const balance = balances[0];
  const freezeDate = new Date();
  freezeDate.setDate(freezeDate.getDate() + 45); // Freeze for 45 days

  let action = 'flagged';
  let coinsToFreeze = 0;

  if (spam_score >= 70) {
    // High risk - freeze 80% of coins
    action = 'frozen';
    coinsToFreeze = Math.floor(total_coins * 0.8);
  } else if (spam_score >= 40) {
    // Medium risk - freeze 50% of coins
    action = 'under_review';
    coinsToFreeze = Math.floor(total_coins * 0.5);
  }

  if (coinsToFreeze > 0) {
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      available_balance: Math.max(0, balance.balance - coinsToFreeze),
      frozen_balance: coinsToFreeze,
      spam_score: spam_score,
      spam_ratio: result.spam_ratio,
      audit_status: action,
      freeze_until_date: freezeDate.toISOString(),
      last_audit_date: new Date().toISOString()
    });
  }

  // Log audit
  await base44.asServiceRole.entities.SpamAuditLog.create({
    user_email,
    audit_date: new Date().toISOString(),
    total_questions: result.total_questions,
    spam_questions: Math.floor(result.total_questions * result.spam_ratio),
    spam_ratio: result.spam_ratio,
    spam_score,
    detection_reasons,
    questions_per_hour: result.questions_per_hour,
    coins_frozen: coinsToFreeze,
    action_taken: action
  });
}