import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { targetUserEmail } = await req.json();

    if (!targetUserEmail) {
      return Response.json({ error: 'targetUserEmail is required' }, { status: 400 });
    }

    console.log(`🔍 Analyzing earnings for ${targetUserEmail}...`);

    // Get all audit logs and transactions
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
      user_email: targetUserEmail 
    });
    
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      user_email: targetUserEmail 
    });

    // Calculate from questions
    const totalFromQuestions = allLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);

    // Analyze other sources
    const otherSources = {
      bounty_reward: [],
      build_reward: [],
      manual_add: [],
      admin_adjustment_positive: [],
      purchase: [],
      other: []
    };

    let totalFromOtherSources = 0;

    // Group audit logs by question number for quick lookup
    const questionNumberMap = {};
    for (const log of allLogs) {
      const key = `${new Date(log.question_date).toISOString().split('T')[0]}_${log.question_number_in_day}`;
      questionNumberMap[key] = log;
    }

    for (const tx of allTxs) {
      // Skip negative amounts (spending)
      if (tx.amount <= 0) continue;

      // Skip admin adjustments related to audits or daily questions
      if (tx.type === 'admin_adjustment' && 
          (tx.description?.includes('Comprehensive Audit') ||
           tx.description?.includes('Daily Question') ||
           tx.description?.includes('Reset & Recalculation'))) {
        continue;
      }

      // Try to extract question number from description
      let questionNumber = null;
      const match = tx.description?.match(/\((\d+)\/30\)/);
      if (match) {
        questionNumber = parseInt(match[1]);
      }

      // Categorize by type
      const category = tx.type || 'other';
      const amount = tx.amount;
      
      if (otherSources[category]) {
        otherSources[category].push({
          amount: amount,
          description: tx.description,
          date: tx.created_date,
          type: tx.type,
          question_number: questionNumber
        });
      } else {
        otherSources.other.push({
          amount: amount,
          description: tx.description,
          date: tx.created_date,
          type: tx.type,
          question_number: questionNumber
        });
      }

      totalFromOtherSources += amount;
    }

    // Calculate totals by category
    const breakdown = {};
    let grandTotal = 0;
    for (const [category, items] of Object.entries(otherSources)) {
      if (items.length > 0) {
        const categoryTotal = items.reduce((sum, item) => sum + item.amount, 0);
        breakdown[category] = {
          total: categoryTotal,
          count: items.length,
          items: items
        };
        grandTotal += categoryTotal;
      }
    }

    return Response.json({
      success: true,
      user_email: targetUserEmail,
      earnings: {
        from_questions: {
          total: totalFromQuestions,
          count: allLogs.length,
          description: 'Tổng từ câu hỏi chat'
        },
        from_other_sources: {
          total: totalFromOtherSources,
          breakdown: breakdown,
          description: 'Tổng từ các nguồn khác'
        },
        grand_total: totalFromQuestions + totalFromOtherSources
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});