import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, metadata } = await req.json();

    // Get today's date for daily quest reset
    const today = new Date().toISOString().split('T')[0];

    // Get all active quests
    const allQuests = await base44.entities.Quest.filter({ is_active: true });

    // Get user's quest progress
    const userProgress = await base44.entities.UserQuestProgress.filter({ 
      user_email: user.email 
    });

    // Find quests that match this action
    const matchingQuests = allQuests.filter(quest => quest.target_action === action);

    for (const quest of matchingQuests) {
      let progress = userProgress.find(p => p.quest_id === quest.id);

      // Check if quest needs reset (daily/weekly)
      if (progress && quest.reset_schedule !== 'never') {
        const resetDate = progress.reset_date;
        let shouldReset = false;

        if (quest.reset_schedule === 'daily' && resetDate !== today) {
          shouldReset = true;
        } else if (quest.reset_schedule === 'weekly') {
          const lastReset = new Date(resetDate);
          const daysSinceReset = Math.floor((new Date() - lastReset) / (1000 * 60 * 60 * 24));
          if (daysSinceReset >= 7) {
            shouldReset = true;
          }
        }

        if (shouldReset && progress.status === 'claimed') {
          // Reset progress
          await base44.entities.UserQuestProgress.update(progress.id, {
            current_progress: 0,
            status: 'in_progress',
            reset_date: today,
            completed_date: null,
            claimed_date: null,
            reward_claimed: false
          });
          progress.current_progress = 0;
          progress.status = 'in_progress';
        }
      }

      // Create progress if doesn't exist
      if (!progress) {
        progress = await base44.entities.UserQuestProgress.create({
          user_email: user.email,
          quest_id: quest.id,
          current_progress: 0,
          target_count: quest.target_count,
          status: 'in_progress',
          started_date: new Date().toISOString(),
          reset_date: today
        });
      }

      // Skip if already claimed and not reset
      if (progress.status === 'claimed') {
        continue;
      }

      // Increment progress
      const newProgress = Math.min(progress.current_progress + 1, quest.target_count);
      const isCompleted = newProgress >= quest.target_count;

      await base44.entities.UserQuestProgress.update(progress.id, {
        current_progress: newProgress,
        status: isCompleted ? 'completed' : 'in_progress',
        completed_date: isCompleted ? new Date().toISOString() : progress.completed_date
      });
    }

    return Response.json({ 
      success: true,
      message: 'Quest progress updated',
      matchedQuests: matchingQuests.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});