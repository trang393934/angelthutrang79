import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email required' }, { status: 400 });
    }

    console.log(`🔍 Analyzing 359 deleted questions for ${target_email}...`);

    // Get recovery transactions
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: target_email
    }, '-created_date', 10000);

    const recoveryTxs = allTransactions.filter(tx => 
      tx.type === 'bounty_reward' && 
      tx.description && 
      tx.description.startsWith('Recovery:')
    );

    console.log(`Found ${recoveryTxs.length} recovery transactions`);

    // Extract questions from descriptions
    const questions = recoveryTxs.map(tx => {
      const question = tx.description.replace('Recovery: ', '').trim();
      return {
        id: tx.id,
        question: question,
        amount: tx.amount,
        date: tx.created_date
      };
    });

    // Check for duplicates
    const questionMap = {};
    const duplicates = [];
    const unique = [];

    for (const q of questions) {
      const normalized = q.question.toLowerCase().trim();
      
      if (questionMap[normalized]) {
        duplicates.push({
          ...q,
          duplicate_of: questionMap[normalized].id
        });
      } else {
        questionMap[normalized] = q;
        unique.push(q);
      }
    }

    // Check for greetings
    const greetingPatterns = [
      /^(hi|hello|xin chào|chào|alo|dạ|vâng|cảm ơn|thank|thanks)/i,
      /^(con xin chào|con chào|con cảm ơn)/i,
      /^.{1,10}$/  // Very short messages (less than 10 chars)
    ];

    const greetings = unique.filter(q => 
      greetingPatterns.some(pattern => pattern.test(q.question))
    );

    const validQuestions = unique.filter(q => 
      !greetingPatterns.some(pattern => pattern.test(q.question))
    );

    // Calculate totals
    const duplicateAmount = duplicates.reduce((sum, q) => sum + q.amount, 0);
    const greetingAmount = greetings.reduce((sum, q) => sum + q.amount, 0);
    const validAmount = validQuestions.reduce((sum, q) => sum + q.amount, 0);

    console.log(`\n📊 ANALYSIS:`);
    console.log(`Total recovery: ${recoveryTxs.length} = ${recoveryTxs.reduce((s, t) => s + t.amount, 0).toLocaleString()}`);
    console.log(`Duplicates: ${duplicates.length} = ${duplicateAmount.toLocaleString()}`);
    console.log(`Greetings: ${greetings.length} = ${greetingAmount.toLocaleString()}`);
    console.log(`Valid: ${validQuestions.length} = ${validAmount.toLocaleString()}`);

    // Recommendation
    const shouldRemove = duplicateAmount + greetingAmount;
    const correctTotal = validAmount;

    return Response.json({
      success: true,
      user_email: target_email,
      summary: {
        total_recovery: {
          count: recoveryTxs.length,
          amount: recoveryTxs.reduce((s, t) => s + t.amount, 0)
        },
        duplicates: {
          count: duplicates.length,
          amount: duplicateAmount
        },
        greetings: {
          count: greetings.length,
          amount: greetingAmount
        },
        valid: {
          count: validQuestions.length,
          amount: validAmount
        }
      },
      should_remove: {
        count: duplicates.length + greetings.length,
        amount: shouldRemove
      },
      correct_recovery_amount: correctTotal,
      sample_duplicates: duplicates.slice(0, 20).map(d => ({
        question: d.question.substring(0, 80),
        amount: d.amount
      })),
      sample_greetings: greetings.slice(0, 20).map(g => ({
        question: g.question.substring(0, 80),
        amount: g.amount
      })),
      sample_valid: validQuestions.slice(0, 20).map(v => ({
        question: v.question.substring(0, 80),
        amount: v.amount
      }))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});