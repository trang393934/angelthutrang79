import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { 
      max_deletes_per_run = 20,
      delay_per_delete_seconds = 3,
      target_user = null 
    } = await req.json().catch(() => ({}));

    console.log(`🐌 Ultra Slow Cleanup - Max: ${max_deletes_per_run}, Delay: ${delay_per_delete_seconds}s`);

    // Get all logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000);
    
    // Find duplicates
    const seen = {};
    const duplicatesToDelete = [];

    for (const log of allLogs) {
      // Filter by target user if specified
      if (target_user && log.user_email !== target_user) continue;

      const key = `${log.user_email}_${log.question_text}_${log.question_date}`;
      
      if (seen[key]) {
        duplicatesToDelete.push({
          id: log.id,
          user_email: log.user_email,
          question_text: log.question_text.substring(0, 50)
        });
      } else {
        seen[key] = log.id;
      }
    }

    console.log(`📊 Found ${duplicatesToDelete.length} total duplicates`);

    // Process only limited amount
    const toProcess = duplicatesToDelete.slice(0, max_deletes_per_run);
    console.log(`🎯 Processing ${toProcess.length} duplicates this run`);

    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const dup = toProcess[i];
      console.log(`\n[${i + 1}/${toProcess.length}] 🗑️ Deleting: ${dup.user_email} - "${dup.question_text}..."`);

      try {
        await base44.asServiceRole.entities.QuestionAuditLog.delete(dup.id);
        console.log(`  ✅ Deleted`);
        successful++;
        results.push({
          id: dup.id,
          user_email: dup.user_email,
          status: 'deleted'
        });

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        failed++;
        results.push({
          id: dup.id,
          user_email: dup.user_email,
          status: 'failed',
          error: error.message
        });
      }

      // Delay before next delete
      if (i < toProcess.length - 1) {
        console.log(`  ⏳ Waiting ${delay_per_delete_seconds}s...`);
        await new Promise(resolve => setTimeout(resolve, delay_per_delete_seconds * 1000));
      }
    }

    const remaining = duplicatesToDelete.length - toProcess.length;

    // Get affected users for recalculation suggestion
    const affectedUsers = [...new Set(toProcess.map(d => d.user_email))];

    return Response.json({
      success: true,
      summary: {
        total_duplicates_found: duplicatesToDelete.length,
        processed_this_run: toProcess.length,
        successful,
        failed,
        remaining_duplicates: remaining,
        estimated_runs_needed: Math.ceil(remaining / max_deletes_per_run)
      },
      affected_users: affectedUsers,
      results,
      message: remaining > 0 
        ? `Còn ${remaining} duplicates. Chạy lại function để tiếp tục.`
        : `✅ Hoàn thành! Đã xóa hết duplicates${target_user ? ` cho ${target_user}` : ''}.`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});