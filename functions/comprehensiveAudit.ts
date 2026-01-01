import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * COMPREHENSIVE QUESTION AUDIT SYSTEM
 * Review 100% câu hỏi của users, phân loại và phân bổ lại coins
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 50 } = await req.json();

    // Get eligible users (có transaction = đã hỏi câu hỏi)
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 10000);
    
    const userEmails = target_user_email 
      ? [target_user_email]
      : [...new Set(allTransactions
          .filter(tx => tx.amount > 0 && tx.type === 'manual_add')
          .map(tx => tx.user_email)
        )].slice(0, batch_size);

    const results = [];

    for (const userEmail of userEmails) {
      const auditResult = await auditSingleUser(userEmail, base44);
      results.push(auditResult);
    }

    return Response.json({
      success: true,
      users_audited: results.length,
      summary: {
        total_frozen: results.reduce((sum, r) => sum + r.frozen_coins, 0),
        total_pending_review: results.reduce((sum, r) => sum + r.pending_review_coins, 0),
        total_valid: results.reduce((sum, r) => sum + r.valid_coins, 0),
      },
      results
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

async function auditSingleUser(userEmail, base44) {
  const result = {
    user_email: userEmail,
    total_questions: 0,
    frozen_coins: 0,
    pending_review_coins: 0,
    valid_coins: 0,
    duplicate_count: 0,
    greeting_count: 0,
    excess_count: 0
  };

  // Fetch all conversations to get questions
  const conversations = await base44.asServiceRole.entities.Conversation.filter(
    { created_by: userEmail },
    'created_date',
    1000
  );

  // Extract all user questions from conversations with timestamps
  const userQuestions = [];
  conversations.forEach(conv => {
    if (conv.messages && Array.isArray(conv.messages)) {
      conv.messages.forEach((msg, idx) => {
        if (msg.role === 'user' && msg.content && msg.content.trim().length > 0) {
          // Estimate timestamp based on conversation created_date + message index
          const msgDate = new Date(conv.created_date);
          msgDate.setSeconds(msgDate.getSeconds() + idx * 30); // Assume 30s between messages
          
          userQuestions.push({
            text: msg.content,
            date: msgDate,
            conversation_id: conv.id
          });
        }
      });
    }
  });

  // Fetch all reward transactions for this user
  const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
    { 
      user_email: userEmail,
      type: 'manual_add'
    },
    'created_date',
    5000
  );

  if (transactions.length === 0) {
    return result;
  }

  // Match questions with transactions by timestamp (within 2 minutes)
  const questions = transactions
    .filter(tx => tx.amount > 0 && tx.description && tx.description.includes('Thưởng'))
    .map(tx => {
      const txDate = new Date(tx.created_date);
      
      // Find closest user question within 2 minutes
      const matchedQuestion = userQuestions.find(q => {
        const timeDiff = Math.abs(q.date.getTime() - txDate.getTime());
        return timeDiff < 120000; // 2 minutes
      });

      return {
        id: tx.id,
        text: matchedQuestion ? matchedQuestion.text : extractQuestionFromDescription(tx.description),
        date: txDate,
        coins: tx.amount,
        transaction: tx
      };
    });

  result.total_questions = questions.length;

  // Group by day (UTC)
  const questionsByDay = {};
  questions.forEach(q => {
    const dayKey = q.date.toISOString().split('T')[0];
    if (!questionsByDay[dayKey]) {
      questionsByDay[dayKey] = [];
    }
    questionsByDay[dayKey].push(q);
  });

  // Audit each day
  for (const [day, dayQuestions] of Object.entries(questionsByDay)) {
    const seenQuestions = new Set();

    for (let i = 0; i < dayQuestions.length; i++) {
      const question = dayQuestions[i];
      let exclusionReason = 'valid';
      let coinCategory = 'pending_withdrawal';

      // Check 1: Is it 11th+ question?
      if (i >= 10) {
        exclusionReason = 'exceeds_daily_limit';
        coinCategory = 'pending_review';
        result.pending_review_coins += question.coins;
        result.excess_count++;
      }
      // Check 2: Is it a duplicate?
      else if (isDuplicate(question.text, Array.from(seenQuestions))) {
        exclusionReason = 'duplicate';
        coinCategory = 'frozen';
        result.frozen_coins += question.coins;
        result.duplicate_count++;
      }
      // Check 3: Is it a greeting/non-question?
      else if (isGreeting(question.text)) {
        exclusionReason = 'greeting';
        coinCategory = 'frozen';
        result.frozen_coins += question.coins;
        result.greeting_count++;
      }
      // Valid question
      else {
        result.valid_coins += question.coins;
        seenQuestions.add(question.text.toLowerCase().trim());
      }

      // Log the audit
      await base44.asServiceRole.entities.QuestionAuditLog.create({
        user_email: userEmail,
        transaction_id: question.id,
        question_text: question.text,
        question_date: question.date.toISOString(),
        coins_earned: question.coins,
        exclusion_reason,
        coin_category,
        audit_date: new Date().toISOString(),
        question_number_in_day: i + 1
      });
    }
  }

  // Update user balance
  const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
  
  if (balances.length > 0) {
    const balance = balances[0];
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      frozen_balance: result.frozen_coins,
      pending_review_balance: result.pending_review_coins,
      pending_withdrawal_balance: result.valid_coins,
      available_balance: result.valid_coins, // Available = ready to withdraw
      last_audit_date: new Date().toISOString(),
      audit_status: result.frozen_coins > 0 || result.pending_review_coins > 0 ? 'under_review' : 'clean'
    });
  } else {
    await base44.asServiceRole.entities.CamlycoinBalance.create({
      user_email: userEmail,
      balance: result.frozen_coins + result.pending_review_coins + result.valid_coins,
      frozen_balance: result.frozen_coins,
      pending_review_balance: result.pending_review_coins,
      pending_withdrawal_balance: result.valid_coins,
      available_balance: result.valid_coins,
      total_earned: result.frozen_coins + result.pending_review_coins + result.valid_coins,
      last_audit_date: new Date().toISOString(),
      audit_status: result.frozen_coins > 0 || result.pending_review_coins > 0 ? 'under_review' : 'clean'
    });
  }

  return result;
}

function extractQuestionFromDescription(description) {
  // Format: "✨ Thưởng (score/30)\n💰 +amount Camlycoin\n💡 reason"
  // hoặc chỉ có text thuần
  const lines = description.split('\n');
  
  // Tìm dòng có question (thường là dòng cuối hoặc trong reason)
  for (const line of lines) {
    if (line.includes('💡') || line.includes('Q:')) {
      return line.replace('💡', '').replace('Q:', '').trim();
    }
  }
  
  // Fallback: return full description nếu không tìm thấy pattern
  return description.substring(0, 200);
}

function isDuplicate(questionText, previousQuestions) {
  const normalized = questionText.toLowerCase().trim();
  
  // Exact match
  if (previousQuestions.includes(normalized)) {
    return true;
  }

  // High similarity (Jaccard similarity > 0.85)
  for (const prev of previousQuestions) {
    const similarity = calculateJaccardSimilarity(normalized, prev);
    if (similarity > 0.85) {
      return true;
    }
  }

  return false;
}

function calculateJaccardSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function isGreeting(questionText) {
  const text = questionText.toLowerCase().trim();
  
  // Very short (< 5 chars)
  if (text.length < 5) {
    return true;
  }

  // Common greetings
  const greetingPatterns = [
    /^(hi|hello|hey|xin chào|chào|chào bạn|alo|hii|helo)\s*[!.?]*$/i,
    /^(how are you|bạn khỏe không|khỏe không|như thế nào)\s*[!.?]*$/i,
    /^(good morning|good evening|buổi sáng|buổi tối)\s*[!.?]*$/i,
    /^(thank|thanks|cảm ơn|cám ơn|thank you|thanks a lot)\s*[!.?]*$/i,
    /^(ok|okay|oke|good|tốt|được|uhm|ừ|à|ơ)\s*[!.?]*$/i
  ];

  for (const pattern of greetingPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // No interrogative words and very short (< 20 chars)
  const hasInterrogative = /\b(what|how|why|when|where|who|which|gì|như thế nào|tại sao|khi nào|ở đâu|ai|cái nào|thế nào|là gì|có phải|có thể)\b/i.test(text);
  
  if (!hasInterrogative && text.length < 20) {
    return true;
  }

  return false;
}