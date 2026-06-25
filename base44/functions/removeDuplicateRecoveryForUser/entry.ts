import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { user_email, dry_run = true } = await req.json();
    
    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🗑️  REMOVE DUPLICATE RECOVERY FOR: ${user_email}`);
    console.log(`   Mode: ${dry_run ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}`);
    console.log(`${'='.repeat(80)}\n`);

    // 1. Get all valid questions from audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
      user_email: user_email,
      exclusion_reason: 'valid'
    }, '-audit_date', 10000);

    const validQuestions = new Set(
      allLogs.map(log => (log.question_text || '').trim().toLowerCase())
    );

    console.log(`📊 Valid questions in logs: ${validQuestions.size}`);

    // 2. Get all recovery transactions (bounty_reward starting with "Recovery:")
    const allTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter({
      user_email: user_email,
      type: 'bounty_reward'
    }, '-created_date', 10000);

    const recoveryTxs = allTxs.filter(tx => 
      tx.description && tx.description.startsWith('Recovery:')
    );

    console.log(`💰 Total recovery transactions: ${recoveryTxs.length}`);

    // 3. Identify duplicates
    const duplicateRecoveries = [];
    const validRecoveries = [];

    for (const tx of recoveryTxs) {
      const question = tx.description.replace('Recovery: ', '').trim().toLowerCase();
      if (validQuestions.has(question)) {
        duplicateRecoveries.push({
          id: tx.id,
          amount: tx.amount || 0,
          question: question.substring(0, 100) + '...',
          created_date: tx.created_date
        });
      } else {
        validRecoveries.push({
          id: tx.id,
          amount: tx.amount || 0,
          question: question.substring(0, 100) + '...',
          created_date: tx.created_date
        });
      }
    }

    const duplicateTotal = duplicateRecoveries.reduce((sum, tx) => sum + tx.amount, 0);
    const validTotal = validRecoveries.reduce((sum, tx) => sum + tx.amount, 0);

    console.log(`\n✅ Valid Recovery: ${validRecoveries.length} txs = ${validTotal.toLocaleString()} coins`);
    console.log(`❌ Duplicate Recovery: ${duplicateRecoveries.length} txs = ${duplicateTotal.toLocaleString()} coins`);

    if (duplicateRecoveries.length > 0) {
      console.log(`\n📋 Sample duplicates (first 5):`);
      duplicateRecoveries.slice(0, 5).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.amount.toLocaleString()} coins - "${tx.question}"`);
      });
    }

    // 4. Delete duplicates if not dry_run
    let deleted_count = 0;
    if (!dry_run && duplicateRecoveries.length > 0) {
      console.log(`\n🔥 DELETING ${duplicateRecoveries.length} duplicate recovery transactions...`);
      
      for (const tx of duplicateRecoveries) {
        try {
          await base44.asServiceRole.entities.CamlycoinTransaction.delete(tx.id);
          deleted_count++;
          if (deleted_count % 50 === 0) {
            console.log(`   Deleted ${deleted_count}/${duplicateRecoveries.length}...`);
          }
        } catch (error) {
          console.error(`   Error deleting ${tx.id}:`, error.message);
        }
      }
      
      console.log(`✅ Deleted ${deleted_count} duplicate transactions`);
    }

    return Response.json({
      success: true,
      user_email,
      dry_run,
      summary: {
        total_recovery_txs: recoveryTxs.length,
        valid_recoveries: validRecoveries.length,
        duplicate_recoveries: duplicateRecoveries.length,
        valid_total: validTotal,
        duplicate_total: duplicateTotal,
        deleted_count
      },
      duplicate_transactions: duplicateRecoveries.slice(0, 20) // Return first 20 for inspection
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});