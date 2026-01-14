import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { batch_size = 3, delay_seconds = 5 } = await req.json().catch(() => ({}));

    console.log(`🚀 Starting Slow Batch Cleanup - Batch: ${batch_size}, Delay: ${delay_seconds}s`);

    // Get all users with duplicates
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    const userDuplicates = {};
    const seen = {};

    for (const log of allLogs) {
      const key = `${log.user_email}_${log.question_text}_${log.question_date}`;
      if (seen[key]) {
        if (!userDuplicates[log.user_email]) {
          userDuplicates[log.user_email] = [];
        }
        userDuplicates[log.user_email].push(log.id);
      } else {
        seen[key] = log.id;
      }
    }

    const usersToFix = Object.keys(userDuplicates)
      .map(email => ({
        email,
        duplicate_count: userDuplicates[email].length
      }))
      .sort((a, b) => b.duplicate_count - a.duplicate_count)
      .slice(0, batch_size);

    console.log(`👥 Found ${usersToFix.length} users to process`);

    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < usersToFix.length; i++) {
      const userInfo = usersToFix[i];
      console.log(`\n[${i + 1}/${usersToFix.length}] 🔧 Processing: ${userInfo.email} (${userInfo.duplicate_count} duplicates)`);

      try {
        // Delete duplicates for this user
        const duplicateIds = userDuplicates[userInfo.email];
        
        for (const dupId of duplicateIds) {
          await base44.asServiceRole.entities.QuestionAuditLog.delete(dupId);
        }

        // Recalculate balance
        const remainingLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
          user_email: userInfo.email
        });

        let net_valid = 0;
        let frozen = 0;

        for (const log of remainingLogs) {
          if (log.coin_category === 'pending_withdrawal') {
            net_valid += log.coins_earned;
          } else if (log.coin_category === 'frozen') {
            frozen += log.coins_earned;
          }
        }

        const balance = await base44.asServiceRole.entities.CamlycoinBalance.filter({
          user_email: userInfo.email
        });

        if (balance[0]) {
          await base44.asServiceRole.entities.CamlycoinBalance.update(balance[0].id, {
            net_valid_coins: net_valid,
            frozen_balance: frozen,
            total_earned: net_valid + frozen,
            available_for_withdrawal: net_valid - (balance[0].paid_amount || 0)
          });
        }

        console.log(`  ✅ Deleted ${duplicateIds.length} duplicates, recalculated balance`);
        results.push({
          user_email: userInfo.email,
          deleted_count: duplicateIds.length,
          new_net_valid: net_valid,
          new_frozen: frozen,
          new_total: net_valid + frozen
        });
        successful++;

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        results.push({
          user_email: userInfo.email,
          error: error.message
        });
        failed++;
      }

      // Delay before next user
      if (i < usersToFix.length - 1) {
        console.log(`  ⏳ Waiting ${delay_seconds}s...`);
        await new Promise(resolve => setTimeout(resolve, delay_seconds * 1000));
      }
    }

    const remaining = Object.keys(userDuplicates).length - batch_size;

    return Response.json({
      success: true,
      summary: {
        processed: usersToFix.length,
        successful,
        failed,
        remaining_users: remaining > 0 ? remaining : 0
      },
      results,
      next_batch: remaining > 0 ? Object.keys(userDuplicates)
        .filter(email => !usersToFix.find(u => u.email === email))
        .slice(0, batch_size) : []
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});