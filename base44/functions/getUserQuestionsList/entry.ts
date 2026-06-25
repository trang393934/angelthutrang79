import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'Missing user_email' }, { status: 400 });
    }

    // Get ALL audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-question_date', 10000);
    const userLogs = allLogs.filter(log => log.user_email === user_email);

    // Sort by question_date
    userLogs.sort((a, b) => new Date(a.question_date) - new Date(b.question_date));

    // Group by category
    const grouped = {
      available: [],
      admin_review: [],
      frozen: []
    };

    userLogs.forEach(log => {
      const item = {
        question: log.question_text,
        date: log.question_date,
        coins: log.coins_earned,
        reason: log.exclusion_reason,
        category: log.coin_category,
        question_number: log.question_number_in_day,
        similarity: log.similarity_score || 0,
        similar_to: log.similar_to_question
      };

      if (log.coin_category === 'pending_withdrawal') {
        grouped.available.push(item);
      } else if (log.coin_category === 'pending_review') {
        grouped.admin_review.push(item);
      } else if (log.coin_category === 'frozen') {
        grouped.frozen.push(item);
      }
    });

    const summary = {
      total_questions: userLogs.length,
      available: {
        count: grouped.available.length,
        total_coins: grouped.available.reduce((sum, q) => sum + q.coins, 0)
      },
      admin_review: {
        count: grouped.admin_review.length,
        total_coins: grouped.admin_review.reduce((sum, q) => sum + q.coins, 0)
      },
      frozen: {
        count: grouped.frozen.length,
        total_coins: grouped.frozen.reduce((sum, q) => sum + q.coins, 0)
      }
    };

    return Response.json({
      user_email,
      summary,
      questions: {
        available: grouped.available,
        admin_review: grouped.admin_review,
        frozen: grouped.frozen
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});