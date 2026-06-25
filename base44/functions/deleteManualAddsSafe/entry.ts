import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🗑️ Deleting all remaining manual_add transactions (safe mode)...');

    let totalDeleted = 0;
    let totalErrors = 0;
    let iteration = 0;

    // Keep deleting batches until none left
    while (true) {
      iteration++;
      console.log(`\nIteration ${iteration}: Fetching batch...`);

      const batch = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
        type: 'manual_add' 
      }, '-created_date', 500);
      
      if (batch.length === 0) {
        console.log('✅ No more manual_add transactions!');
        break;
      }

      console.log(`Found ${batch.length} transactions in this batch`);

      for (const tx of batch) {
        try {
          await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
          totalDeleted++;
          await new Promise(resolve => setTimeout(resolve, 80));
        } catch (error) {
          totalErrors++;
          console.log(`⚠️ Failed to delete ${tx.id}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`Batch done. Deleted so far: ${totalDeleted}, Errors: ${totalErrors}`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Safety: stop after 10 iterations
      if (iteration >= 10) {
        console.log('⚠️ Reached iteration limit (10)');
        break;
      }
    }

    const remaining = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      type: 'manual_add' 
    });

    return Response.json({
      success: true,
      total_deleted: totalDeleted,
      total_errors: totalErrors,
      iterations: iteration,
      remaining_manual_adds: remaining.length,
      status: remaining.length === 0 ? '✅ COMPLETE' : '⚠️ INCOMPLETE'
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});