import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batchSize = 3 } = await req.json().catch(() => ({}));

    console.log(`🔍 Starting batch duplicate fix (${batchSize} users per batch)...`);

    // Get all balances sorted by total_earned
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 1000);
    
    // Find users that haven't been processed yet (check for a marker or just process all)
    const usersToProcess = allBalances.slice(0, batchSize);

    console.log(`📊 Processing ${usersToProcess.length} users...`);

    const results = [];
    
    for (const balance of usersToProcess) {
      const userEmail = balance.user_email;
      console.log(`\n👤 Processing ${userEmail}...`);

      // Add delay between users to avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Fetch valid questions for this user
        const validQuestions = await base44.asServiceRole.entities.QuestionAuditLog.filter(
          { user_email: userEmail, exclusion_reason: 'valid' },
          'question_date',
          10000
        );

        console.log(`  📝 Found ${validQuestions.length} valid questions`);

        if (validQuestions.length === 0) {
          results.push({ userEmail, status: 'skipped', reason: 'no valid questions' });
          continue;
        }

        // Group by date
        const byDate = {};
        validQuestions.forEach(q => {
          const dateKey = q.question_date.split('T')[0];
          if (!byDate[dateKey]) byDate[dateKey] = [];
          byDate[dateKey].push(q);
        });

        let duplicatesFound = 0;
        let coinsToFreeze = 0;

        // Helper function
        const calculateSimilarity = (str1, str2) => {
          const words1 = new Set(str1.toLowerCase().split(/\s+/));
          const words2 = new Set(str2.toLowerCase().split(/\s+/));
          const intersection = new Set([...words1].filter(x => words2.has(x)));
          const union = new Set([...words1, ...words2]);
          return intersection.size / union.size;
        };

        // Process each date
        for (const [date, questions] of Object.entries(byDate)) {
          questions.sort((a, b) => (a.question_number_in_day || 0) - (b.question_number_in_day || 0));

          const seenQuestions = [];

          for (const question of questions) {
            let isDuplicate = false;
            let similarTo = null;

            for (const seen of seenQuestions) {
              const similarity = calculateSimilarity(question.question_text, seen.question_text);
              if (similarity > 0.7) {
                isDuplicate = true;
                similarTo = seen.question_text;
                break;
              }
            }

            if (isDuplicate) {
              duplicatesFound++;
              coinsToFreeze += question.coins_earned || 0;

              // Update audit log with delay
              await new Promise(resolve => setTimeout(resolve, 100));
              await base44.asServiceRole.entities.QuestionAuditLog.update(question.id, {
                exclusion_reason: 'duplicate',
                coin_category: 'frozen',
                similar_to_question: similarTo
              });

              console.log(`  ❌ Duplicate: "${question.question_text.substring(0, 40)}..."`);
            } else {
              seenQuestions.push(question);
            }
          }
        }

        // Update balance if duplicates found
        if (duplicatesFound > 0) {
          const currentAvailable = balance.available_balance || 0;
          const currentPending = balance.admin_review_pending || 0;
          const currentFrozen = balance.frozen_balance || 0;

          let newAvailable = currentAvailable;
          let newPending = currentPending;
          let coinsRemaining = coinsToFreeze;

          if (newAvailable > 0 && coinsRemaining > 0) {
            const toTake = Math.min(newAvailable, coinsRemaining);
            newAvailable -= toTake;
            coinsRemaining -= toTake;
          }

          if (newPending > 0 && coinsRemaining > 0) {
            const toTake = Math.min(newPending, coinsRemaining);
            newPending -= toTake;
            coinsRemaining -= toTake;
          }

          const newFrozen = currentFrozen + coinsToFreeze;

          await new Promise(resolve => setTimeout(resolve, 200));
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
            available_balance: newAvailable,
            admin_review_pending: newPending,
            frozen_balance: newFrozen
          });

          // Update UserLevel
          const userLevels = await base44.asServiceRole.entities.UserLevel.filter({ user_email: userEmail });
          if (userLevels.length > 0) {
            const newTotalPoints = (balance.total_earned || 0) - newFrozen;
            await new Promise(resolve => setTimeout(resolve, 100));
            await base44.asServiceRole.entities.UserLevel.update(userLevels[0].id, {
              total_points: newTotalPoints
            });
          }

          console.log(`  ✅ Moved ${coinsToFreeze} coins to frozen (${duplicatesFound} duplicates)`);
          
          results.push({
            userEmail,
            status: 'processed',
            duplicatesFound,
            coinsToFreeze
          });
        } else {
          console.log(`  ✅ No duplicates found`);
          results.push({ userEmail, status: 'clean' });
        }

      } catch (error) {
        console.error(`  ❌ Error processing ${userEmail}:`, error.message);
        results.push({
          userEmail,
          status: 'error',
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});