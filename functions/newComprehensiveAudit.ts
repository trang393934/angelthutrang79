import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * COMPREHENSIVE AUDIT - LOGIC MỚI
 * 
 * Quy tắc phân loại điểm:
 * 1. 10 câu hỏi đầu tiên mỗi ngày (không trùng/chào) → available_balance (Sẵn Sàng Thanh Toán)
 * 2. Câu 11+ mỗi ngày (không trùng/chào) → admin_review_pending (Chờ Admin Review)
 * 3. Câu trùng lặp/chào hỏi → frozen_balance (Đóng Băng Vĩnh Viễn)
 * 
 * Công thức:
 * - Chờ Duyệt Thanh Toán = available_balance + admin_review_pending
 * - total_earned = KHÔNG bị trừ khi rút tiền
 * - UserLevel.total_points = total_earned - frozen_balance (Level Sạch)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_user_email, batch_size = 10, audit_all = false } = await req.json();

    // Get eligible users
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
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // Tăng delay giữa users
      } catch (error) {
        console.error(`Failed to audit ${userEmail}:`, error);
        results.push({
          user_email: userEmail,
          error: error.message,
          total_questions: 0,
          frozen_coins: 0,
          admin_review_pending_coins: 0,
          available_coins: 0
        });
      }
    }

    return Response.json({
      success: true,
      users_audited: results.length,
      summary: {
        total_frozen: results.reduce((sum, r) => sum + r.frozen_coins, 0),
        total_admin_review_pending: results.reduce((sum, r) => sum + r.admin_review_pending_coins, 0),
        total_available: results.reduce((sum, r) => sum + r.available_coins, 0),
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
    admin_review_pending_coins: 0,
    available_coins: 0,
    duplicate_count: 0,
    greeting_count: 0,
    excess_count: 0
  };

  // Fetch conversations
  const conversations = await base44.asServiceRole.entities.Conversation.filter(
    { created_by: userEmail },
    '-created_date',
    500
  );

  const userQuestions = [];
  conversations.forEach(conv => {
    if (conv.messages && Array.isArray(conv.messages)) {
      conv.messages.forEach((msg, idx) => {
        if (msg.role === 'user' && msg.content && msg.content.trim().length > 0) {
          const msgDate = new Date(conv.created_date);
          msgDate.setSeconds(msgDate.getSeconds() + idx * 30);
          
          userQuestions.push({
            text: msg.content,
            date: msgDate,
            conversation_id: conv.id
          });
        }
      });
    }
  });

  // Fetch transactions
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

  const questions = transactions
    .filter(tx => tx.amount > 0 && tx.description && tx.description.includes('Thưởng'))
    .map(tx => {
      const txDate = new Date(tx.created_date);
      const matchedQuestion = userQuestions.find(q => {
        const timeDiff = Math.abs(q.date.getTime() - txDate.getTime());
        return timeDiff < 120000;
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

  // Group by day
  const questionsByDay = {};
  questions.forEach(q => {
    const dayKey = q.date.toISOString().split('T')[0];
    if (!questionsByDay[dayKey]) {
      questionsByDay[dayKey] = [];
    }
    questionsByDay[dayKey].push(q);
  });

  // LOGIC MỚI: Phân loại theo ngày
  for (const [day, dayQuestions] of Object.entries(questionsByDay)) {
    const seenQuestions = new Set(); // Câu hỏi hợp lệ đã thấy trong ngày

    for (let i = 0; i < dayQuestions.length; i++) {
      const question = dayQuestions[i];
      let exclusionReason = 'valid';
      let coinCategory = 'pending_withdrawal';
      let similarTo = null;
      let similarityScore = 0;

      // Kiểm tra trùng lặp
      const duplicateCheck = isDuplicateFast(question.text, Array.from(seenQuestions));
      const greetingCheck = isGreetingFast(question.text);

      if (duplicateCheck.isDuplicate) {
        // Câu trùng lặp → ĐÓNG BĂNG (bất kể câu số mấy)
        exclusionReason = 'duplicate';
        coinCategory = 'frozen';
        result.frozen_coins += question.coins;
        result.duplicate_count++;
        similarTo = duplicateCheck.similarTo;
        similarityScore = duplicateCheck.similarity;
      } else if (greetingCheck.isGreeting) {
        // Câu chào hỏi → ĐÓNG BĂNG (bất kể câu số mấy)
        exclusionReason = 'greeting';
        coinCategory = 'frozen';
        result.frozen_coins += question.coins;
        result.greeting_count++;
      } else {
        // Câu hợp lệ
        seenQuestions.add(question.text.toLowerCase().trim());
        
        if (i < 10) {
          // 10 câu hợp lệ đầu tiên → AVAILABLE (Sẵn Sàng Thanh Toán)
          exclusionReason = 'valid';
          coinCategory = 'pending_withdrawal';
          result.available_coins += question.coins;
        } else {
          // Câu 11+ hợp lệ → CHỜ ADMIN REVIEW
          exclusionReason = 'exceeds_daily_limit';
          coinCategory = 'pending_review';
          result.admin_review_pending_coins += question.coins;
          result.excess_count++;
        }
      }

      // Create audit log (with retry on rate limit)
      try {
        let retries = 0;
        while (retries < 3) {
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
            break; // Success
          } catch (createError) {
            if (createError.status === 429 && retries < 2) {
              retries++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            } else {
              throw createError;
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200)); // Tăng delay
      } catch (error) {
        console.error('Failed to create audit log after retries:', error);
      }
    }
  }

  // Update balance với LOGIC MỚI
  const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });

  // CÔNG THỨC ĐÚNG: total_earned = paid + available + admin_review + frozen
  const currentPaidAmount = balances.length > 0 ? (balances[0].paid_amount || 0) : 0;
  const totalEarned = currentPaidAmount + result.available_coins + result.admin_review_pending_coins + result.frozen_coins;
  
  if (balances.length > 0) {
    const balance = balances[0];
    
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      total_earned: totalEarned,
      frozen_balance: result.frozen_coins,
      admin_review_pending: result.admin_review_pending_coins,
      available_balance: result.available_coins,
      paid_amount: currentPaidAmount, // Giữ nguyên
      last_audit_date: new Date().toISOString(),
      audit_status: result.frozen_coins > 0 || result.admin_review_pending_coins > 0 ? 'under_review' : 'clean'
    });
  } else {
    await base44.asServiceRole.entities.CamlycoinBalance.create({
      user_email: userEmail,
      total_earned: result.available_coins + result.admin_review_pending_coins + result.frozen_coins, // paid = 0 cho user mới
      frozen_balance: result.frozen_coins,
      admin_review_pending: result.admin_review_pending_coins,
      available_balance: result.available_coins,
      paid_amount: 0,
      last_audit_date: new Date().toISOString(),
      audit_status: result.frozen_coins > 0 || result.admin_review_pending_coins > 0 ? 'under_review' : 'clean'
    });
  }

  // Update UserLevel.total_points = total_earned - frozen_balance
  const levelPoints = totalEarned - result.frozen_coins;
  const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ user_email: userEmail });
  
  if (userLevels.length > 0) {
    await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
      total_points: levelPoints
    });
  }

  return result;
}

function extractQuestionFromDescription(description) {
  const lines = description.split('\n');
  for (const line of lines) {
    if (line.includes('💡') || line.includes('Q:')) {
      return line.replace('💡', '').replace('Q:', '').trim();
    }
  }
  return description.substring(0, 200);
}

function isDuplicateFast(question, previousQuestions) {
  if (previousQuestions.length === 0) {
    return { isDuplicate: false, similarTo: null, similarity: 0 };
  }
  
  const normalized = question.toLowerCase().trim();
  if (previousQuestions.includes(normalized)) {
    return { isDuplicate: true, similarTo: normalized, similarity: 1.0 };
  }
  
  for (const prevQ of previousQuestions) {
    const similarity = calculateJaccardSimilarity(normalized, prevQ);
    if (similarity > 0.85) {
      return { isDuplicate: true, similarTo: prevQ, similarity };
    }
  }
  
  return { isDuplicate: false, similarTo: null, similarity: 0 };
}

function calculateJaccardSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function isGreetingFast(text) {
  const normalized = text.toLowerCase().trim();
  
  if (normalized.length < 5) {
    return { isGreeting: true, reason: 'Quá ngắn' };
  }
  
  const greetingPatterns = [
    /^(hi|hello|hey|xin chào|chào|alo|chào bạn|chào cha)\s*[!.?]*$/i,
    /^(cảm ơn|thank|ok|oke|được|tốt|ừ|vâng|dạ)\s*[!.?]*$/i,
    /^(bye|tạm biệt|hẹn gặp lại)\s*[!.?]*$/i
  ];
  
  for (const pattern of greetingPatterns) {
    if (pattern.test(normalized)) {
      return { isGreeting: true, reason: 'Chỉ chào hỏi/cảm ơn' };
    }
  }
  
  const hasInterrogative = /\b(what|how|why|when|where|who|which|gì|như thế nào|tại sao|khi nào|ở đâu|ai|cái nào|thế nào|là gì|có phải|có thể|làm sao|ra sao|bao giờ)\b/i.test(normalized);
  
  if (!hasInterrogative && normalized.length < 15) {
    return { isGreeting: true, reason: 'Không có từ nghi vấn' };
  }
  
  return { isGreeting: false, reason: null };
}