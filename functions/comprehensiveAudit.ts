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

    const { target_user_email, batch_size = 10, audit_all = false } = await req.json();

    // Get eligible users (có transaction = đã hỏi câu hỏi)
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 5000);
    
    const userEmails = target_user_email 
      ? [target_user_email]
      : [...new Set(allTransactions
          .filter(tx => tx.amount > 0 && tx.type === 'manual_add')
          .map(tx => tx.user_email)
        )].slice(0, audit_all ? undefined : batch_size);

    const results = [];

    for (const userEmail of userEmails) {
      try {
        const auditResult = await auditSingleUser(userEmail, base44);
        results.push(auditResult);
        
        // Add delay between users to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to audit ${userEmail}:`, error);
        results.push({
          user_email: userEmail,
          error: error.message,
          total_questions: 0,
          frozen_coins: 0,
          pending_review_coins: 0,
          valid_coins: 0,
          duplicate_count: 0,
          greeting_count: 0,
          excess_count: 0
        });
      }
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

  // Fetch all conversations to get questions (limit to recent 500)
  const conversations = await base44.asServiceRole.entities.Conversation.filter(
    { created_by: userEmail },
    '-created_date',
    500
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

  // Fetch all reward transactions for this user (limit to recent 2000)
  const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
    { 
      user_email: userEmail,
      type: 'manual_add'
    },
    '-created_date',
    2000
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
      let similarTo = null;
      let similarityScore = 0;
      let auditReason = '';

      // Check 1: Is it 11th+ question? (No coins, not frozen - just not rewarded)
      if (i >= 10) {
        exclusionReason = 'exceeds_daily_limit';
        coinCategory = 'valid'; // Not frozen, just not rewarded
        result.excess_count++;
        // Don't add to any category - these questions don't get coins at all
        continue;
      }
      
      // For first 10 questions only:
      // Check 2: Fast duplicate detection (Jaccard only, skip AI to save time)
      const duplicateCheck = await isDuplicateFast(question.text, Array.from(seenQuestions));
      if (duplicateCheck.isDuplicate) {
        exclusionReason = 'duplicate';
        coinCategory = 'frozen';
        result.frozen_coins += question.coins;
        result.duplicate_count++;
        similarTo = duplicateCheck.similarTo;
        similarityScore = duplicateCheck.similarity;
        auditReason = duplicateCheck.reason || `Trùng với: "${duplicateCheck.similarTo}"`;
      }
      // Check 3: Fast greeting detection (pattern only, skip AI)
      else {
        const greetingCheck = isGreetingFast(question.text);
        if (greetingCheck.isGreeting) {
          exclusionReason = 'greeting';
          coinCategory = 'frozen';
          result.frozen_coins += question.coins;
          result.greeting_count++;
          auditReason = greetingCheck.reason;
        }
        // Valid question - gets full reward
        else {
          exclusionReason = 'valid';
          coinCategory = 'pending_withdrawal';
          result.valid_coins += question.coins;
          seenQuestions.add(question.text.toLowerCase().trim());
          auditReason = 'Câu hỏi hợp lệ, có giá trị tri thức';
        }
      }

      // Create detailed audit log with AI reasoning
      try {
        await base44.asServiceRole.entities.QuestionAuditLog.create({
          user_email: userEmail,
          transaction_id: question.id,
          question_text: question.text,
          question_date: question.date.toISOString(),
          coins_earned: question.coins,
          exclusion_reason: exclusionReason,
          coin_category: coinCategory,
          audit_date: new Date().toISOString(),
          question_number_in_day: i + 1,
          similar_to_question: similarTo || null,
          similarity_score: similarityScore || 0
        });
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }
    }
  }

  // Update user balance
  const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
  
  // Calculate total balance correctly
  const totalBalance = result.frozen_coins + result.pending_review_coins + result.valid_coins;
  
  if (balances.length > 0) {
    const balance = balances[0];
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      balance: totalBalance, // CRITICAL: Update total balance
      frozen_balance: result.frozen_coins,
      pending_review_balance: result.pending_review_coins,
      available_balance: result.valid_coins, // Available = ready for admin payment
      last_audit_date: new Date().toISOString(),
      audit_status: result.frozen_coins > 0 || result.pending_review_coins > 0 ? 'under_review' : 'clean'
    });
  } else {
    await base44.asServiceRole.entities.CamlycoinBalance.create({
      user_email: userEmail,
      balance: totalBalance,
      frozen_balance: result.frozen_coins,
      pending_review_balance: result.pending_review_coins,
      available_balance: result.valid_coins,
      total_earned: totalBalance,
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

// Fast duplicate detection WITHOUT AI (for performance)
function isDuplicateFast(question, previousQuestions) {
  if (previousQuestions.length === 0) {
    return { isDuplicate: false, similarTo: null, similarity: 0, reason: null };
  }
  
  // Quick exact match check first
  const normalized = question.toLowerCase().trim();
  if (previousQuestions.includes(normalized)) {
    return { isDuplicate: true, similarTo: normalized, similarity: 1.0, reason: 'Giống hệt 100%' };
  }
  
  // Jaccard similarity for fast matching (threshold 0.85)
  for (const prevQ of previousQuestions) {
    const similarity = calculateJaccardSimilarity(normalized, prevQ);
    if (similarity > 0.85) {
      return { isDuplicate: true, similarTo: prevQ, similarity, reason: `Tương đồng ${(similarity * 100).toFixed(0)}%` };
    }
  }
  
  return { isDuplicate: false, similarTo: null, similarity: 0, reason: null };
}

function calculateJaccardSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Fast greeting/non-question detection WITHOUT AI (for performance)
function isGreetingFast(text) {
  const normalized = text.toLowerCase().trim();
  
  // Quick pattern check for obvious cases
  if (normalized.length < 5) {
    return { isGreeting: true, reason: 'Quá ngắn, không có nội dung' };
  }
  
  const greetingPatterns = [
    /^(hi|hello|hey|xin chào|chào|alo|chào bạn|chào cha)\s*[!.?]*$/i,
    /^(cảm ơn|thank|ok|oke|được|tốt|ừ|vâng|dạ)\s*[!.?]*$/i,
    /^(bye|tạm biệt|hẹn gặp lại)\s*[!.?]*$/i
  ];
  
  for (const pattern of greetingPatterns) {
    if (pattern.test(normalized)) {
      return { isGreeting: true, reason: 'Chỉ chào hỏi/cảm ơn ngắn gọn' };
    }
  }
  
  // Check if has question words
  const hasInterrogative = /\b(what|how|why|when|where|who|which|gì|như thế nào|tại sao|khi nào|ở đâu|ai|cái nào|thế nào|là gì|có phải|có thể|làm sao|ra sao|bao giờ)\b/i.test(normalized);
  
  // If no question words and very short, likely greeting
  if (!hasInterrogative && normalized.length < 15) {
    return { isGreeting: true, reason: 'Không có từ nghi vấn và quá ngắn' };
  }
  
  return { isGreeting: false, reason: null };
}