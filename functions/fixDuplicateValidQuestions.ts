import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Starting duplicate valid questions fix...');

    // Fetch all valid questions
    const allValidQuestions = await base44.asServiceRole.entities.QuestionAuditLog.filter(
      { exclusion_reason: 'valid' },
      '-question_date'
    );

    console.log(`📊 Found ${allValidQuestions.length} valid questions to check`);

    // Group by user and date
    const userDateGroups = {};
    allValidQuestions.forEach(q => {
      const dateKey = q.question_date.split('T')[0]; // YYYY-MM-DD
      const key = `${q.user_email}_${dateKey}`;
      
      if (!userDateGroups[key]) {
        userDateGroups[key] = [];
      }
      userDateGroups[key].push(q);
    });

    let totalProcessed = 0;
    let totalDuplicatesFound = 0;
    let totalCoinsMovedToFrozen = 0;
    const userUpdates = {};

    // Helper function to check similarity
    const calculateSimilarity = (str1, str2) => {
      const words1 = new Set(str1.toLowerCase().split(/\s+/));
      const words2 = new Set(str2.toLowerCase().split(/\s+/));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      return intersection.size / union.size;
    };

    // Process each user-date group
    for (const [key, questions] of Object.entries(userDateGroups)) {
      const [userEmail, date] = key.split('_');
      
      // Sort by question_number_in_day
      questions.sort((a, b) => (a.question_number_in_day || 0) - (b.question_number_in_day || 0));

      const seenQuestions = [];
      const duplicatesToFreeze = [];

      for (const question of questions) {
        const questionNum = question.question_number_in_day || 0;
        
        // Check if this question is duplicate of any previous question
        let isDuplicate = false;
        let similarTo = null;
        
        for (const seen of seenQuestions) {
          const similarity = calculateSimilarity(question.question_text, seen.question_text);
          if (similarity > 0.7) { // 70% similarity threshold
            isDuplicate = true;
            similarTo = seen.question_text;
            break;
          }
        }

        if (isDuplicate) {
          // This is a duplicate - should be frozen
          duplicatesToFreeze.push(question);
          totalDuplicatesFound++;
          
          // Update audit log
          await base44.asServiceRole.entities.QuestionAuditLog.update(question.id, {
            exclusion_reason: 'duplicate',
            coin_category: 'frozen',
            similar_to_question: similarTo
          });
          
          console.log(`❌ Duplicate found: "${question.question_text.substring(0, 50)}..." for ${userEmail} on ${date}`);
        } else {
          // Not duplicate - keep as valid
          seenQuestions.push(question);
        }
      }

      // Update user balance if duplicates found
      if (duplicatesToFreeze.length > 0) {
        const coinsToFreeze = duplicatesToFreeze.reduce((sum, q) => sum + (q.coins_earned || 0), 0);
        
        if (!userUpdates[userEmail]) {
          userUpdates[userEmail] = { coinsToFreeze: 0, duplicateCount: 0 };
        }
        userUpdates[userEmail].coinsToFreeze += coinsToFreeze;
        userUpdates[userEmail].duplicateCount += duplicatesToFreeze.length;
        totalCoinsMovedToFrozen += coinsToFreeze;
      }

      totalProcessed++;
    }

    console.log(`\n💰 Updating user balances...`);

    // Update user balances
    for (const [userEmail, data] of Object.entries(userUpdates)) {
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
      
      if (balances.length > 0) {
        const balance = balances[0];
        const currentAvailable = balance.available_balance || 0;
        const currentPending = balance.admin_review_pending || 0;
        const currentFrozen = balance.frozen_balance || 0;
        
        // Move coins from available or pending to frozen
        let newAvailable = currentAvailable;
        let newPending = currentPending;
        let coinsRemaining = data.coinsToFreeze;
        
        // First take from available
        if (newAvailable > 0 && coinsRemaining > 0) {
          const toTake = Math.min(newAvailable, coinsRemaining);
          newAvailable -= toTake;
          coinsRemaining -= toTake;
        }
        
        // Then take from pending if needed
        if (newPending > 0 && coinsRemaining > 0) {
          const toTake = Math.min(newPending, coinsRemaining);
          newPending -= toTake;
          coinsRemaining -= toTake;
        }
        
        const newFrozen = currentFrozen + data.coinsToFreeze;
        
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          available_balance: newAvailable,
          admin_review_pending: newPending,
          frozen_balance: newFrozen
        });

        // Update UserLevel total_points (= total_earned - frozen_balance)
        const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ user_email: userEmail });
        if (userLevels.length > 0) {
          const newTotalPoints = (balance.total_earned || 0) - newFrozen;
          await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
            total_points: newTotalPoints
          });
        }

        console.log(`✅ ${userEmail}: Moved ${data.coinsToFreeze} coins to frozen (${data.duplicateCount} duplicates)`);
      }
    }

    return Response.json({
      success: true,
      summary: {
        total_groups_processed: totalProcessed,
        total_duplicates_found: totalDuplicatesFound,
        total_coins_moved_to_frozen: totalCoinsMovedToFrozen,
        users_affected: Object.keys(userUpdates).length
      },
      user_details: userUpdates
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});