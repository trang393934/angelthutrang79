import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Deleting manual_add transactions (SUPER SLOW - 1 per 2 seconds)...');

    let totalDeleted = 0;
    let totalErrors = 0;
    let iteration = 0;
    const startTime = Date.now();

    // Delete in very small batches, one at a time
    while (true) {
      iteration++;

      // Get ONLY 1 transaction
      const batch = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
        type: 'manual_add' 
      }, '-created_date', 1);
      
      if (batch.length === 0) {
        console.log('\n✅ All manual_add transactions deleted!');
        break;
      }

      const tx = batch[0];

      try {
        await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
        totalDeleted++;
        console.log(`[${iteration}] ✅ Deleted: ${tx.user_email} (${tx.amount})`);
      } catch (error) {
        totalErrors++;
        console.log(`[${iteration}] ❌ Error: ${error.message}`);
      }

      // Wait 2 seconds between each deletion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Safety: max 500 deletions per run
      if (totalDeleted >= 500) {
        console.log(`\n⚠️ Reached batch limit (500 deletions). Call again to continue.`);
        break;
      }
    }

    const remaining = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    });

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    return Response.json({
      success: true,
      batch_summary: {
        deleted_this_run: totalDeleted,
        errors_this_run: totalErrors,
        elapsed_time_seconds: elapsedSeconds,
        remaining: remaining.length
      },
      status: remaining.length === 0 ? '✅ COMPLETE' : '⚠️ IN PROGRESS - call again'
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});