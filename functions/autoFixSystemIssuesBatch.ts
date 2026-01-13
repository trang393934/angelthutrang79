import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { 
      issue_type = 'duplicate_logs', // duplicate_logs, formula_errors, orphaned_logs, missing_balance
      batch_size = 10,
      delay_ms = 1000,
      users_list = [] // Nếu có thì chỉ fix những user này
    } = await req.json();

    console.log(`\n🔧 AUTO FIX BATCH - ${issue_type}`);
    console.log(`📦 Batch size: ${batch_size}`);
    console.log(`⏱️ Delay: ${delay_ms}ms\n`);

    // Lấy danh sách users cần fix từ systemWideDataIntegrityCheck
    let targetUsers = users_list;
    
    if (targetUsers.length === 0) {
      console.log(`🔍 Đang quét hệ thống tìm lỗi...`);
      const [allBalances, allLogs, allTransactions] = await Promise.all([
        base44.asServiceRole.entities.CamlycoinBalance.list('-created_date', 10000),
        base44.asServiceRole.entities.QuestionAuditLog.list('-created_date', 50000),
        base44.asServiceRole.entities.CamlycoinTransaction.list('-created_date', 20000)
      ]);

      // Tìm users có vấn đề theo issue_type
      if (issue_type === 'duplicate_logs') {
        for (const balance of allBalances) {
          const userLogs = allLogs.filter(log => log.user_email === balance.user_email);
          const txIdMap = new Map();
          let duplicateCount = 0;
          
          userLogs.forEach(log => {
            if (log.transaction_id) {
              const count = txIdMap.get(log.transaction_id) || 0;
              txIdMap.set(log.transaction_id, count + 1);
              if (count > 0) duplicateCount++;
            }
          });
          
          if (duplicateCount > 0) {
            targetUsers.push(balance.user_email);
          }
        }
      } else if (issue_type === 'formula_errors' || issue_type === 'orphaned_logs') {
        targetUsers = allBalances.map(b => b.user_email);
      }
    }

    console.log(`👥 Tìm thấy ${targetUsers.length} users cần fix\n`);

    const results = {
      total_processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      details: []
    };

    // Xử lý từng batch
    for (let i = 0; i < targetUsers.length && i < batch_size; i++) {
      const userEmail = targetUsers[i];
      console.log(`\n[${i + 1}/${Math.min(batch_size, targetUsers.length)}] 🔧 Fixing: ${userEmail}`);

      try {
        if (issue_type === 'duplicate_logs') {
          // Clean duplicates
          const userLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: userEmail },
            '-created_date',
            5000
          );

          const txIdMap = new Map();
          const logsToKeep = [];
          const logsToDelete = [];

          const sortedLogs = [...userLogs].sort((a, b) => 
            new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
          );

          sortedLogs.forEach(log => {
            const key = log.transaction_id || log.id;
            if (!txIdMap.has(key)) {
              txIdMap.set(key, true);
              logsToKeep.push(log);
            } else {
              logsToDelete.push(log);
            }
          });

          // Xóa duplicates
          for (const log of logsToDelete) {
            await base44.asServiceRole.entities.QuestionAuditLog.delete(log.id);
          }

          // Recalculate balance
          let newValidCoins = 0;
          let newFrozenCoins = 0;

          logsToKeep.forEach(log => {
            if (log.exclusion_reason === 'valid') {
              newValidCoins += log.coins_earned || 0;
            } else if (log.coin_category === 'frozen') {
              newFrozenCoins += log.coins_earned || 0;
            }
          });

          const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
            { user_email: userEmail }
          );
          const balance = balances[0];

          if (balance) {
            const paid = balance.paid_amount || 0;
            await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
              net_valid_coins: newValidCoins,
              frozen_balance: newFrozenCoins,
              total_earned: newValidCoins + newFrozenCoins,
              available_for_withdrawal: newValidCoins - paid
            });
          }

          results.details.push({
            user_email: userEmail,
            deleted_duplicates: logsToDelete.length,
            remaining_logs: logsToKeep.length,
            new_total_earned: newValidCoins + newFrozenCoins
          });

          console.log(`  ✅ Deleted ${logsToDelete.length} duplicates`);

        } else if (issue_type === 'formula_errors') {
          // Recalculate balance from logs
          const userLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: userEmail },
            '-created_date',
            5000
          );

          let calculatedValid = 0;
          let calculatedFrozen = 0;

          userLogs.forEach(log => {
            if (log.exclusion_reason === 'valid') {
              calculatedValid += log.coins_earned || 0;
            } else if (log.coin_category === 'frozen') {
              calculatedFrozen += log.coins_earned || 0;
            }
          });

          const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
            { user_email: userEmail }
          );
          const balance = balances[0];

          if (balance) {
            const paid = balance.paid_amount || 0;
            await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
              net_valid_coins: calculatedValid,
              frozen_balance: calculatedFrozen,
              total_earned: calculatedValid + calculatedFrozen,
              available_for_withdrawal: calculatedValid - paid
            });

            results.details.push({
              user_email: userEmail,
              old_total: balance.total_earned,
              new_total: calculatedValid + calculatedFrozen,
              correction: (calculatedValid + calculatedFrozen) - (balance.total_earned || 0)
            });

            console.log(`  ✅ Recalculated: ${calculatedValid + calculatedFrozen} coins`);
          }

        } else if (issue_type === 'orphaned_logs') {
          // Fix orphaned logs by creating missing transactions
          const userLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
            { user_email: userEmail },
            '-created_date',
            5000
          );

          const userTx = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
            { user_email: userEmail },
            '-created_date',
            1000
          );

          const txIds = new Set(userTx.map(tx => tx.reference_id).filter(Boolean));
          const orphanedLogs = userLogs.filter(log => 
            log.transaction_id && !txIds.has(log.transaction_id)
          );

          const txToCreate = orphanedLogs.map(log => ({
            user_email: userEmail,
            amount: log.coins_earned || 0,
            type: 'bounty_reward',
            description: `Recovery: ${log.question_text?.substring(0, 100) || 'Q&A'}`,
            reference_id: log.transaction_id
          }));

          if (txToCreate.length > 0) {
            const batchSize = 50;
            for (let j = 0; j < txToCreate.length; j += batchSize) {
              const batch = txToCreate.slice(j, j + batchSize);
              await base44.asServiceRole.entities.CamlycoinTransaction.bulkCreate(batch);
            }

            results.details.push({
              user_email: userEmail,
              transactions_created: txToCreate.length,
              total_recovered: txToCreate.reduce((sum, tx) => sum + tx.amount, 0)
            });

            console.log(`  ✅ Created ${txToCreate.length} transactions`);
          }

        } else if (issue_type === 'missing_balance') {
          // Create missing balance record
          const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
            { user_email: userEmail }
          );

          if (balances.length === 0) {
            const userLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter(
              { user_email: userEmail },
              '-created_date',
              5000
            );

            let validCoins = 0;
            let frozenCoins = 0;

            userLogs.forEach(log => {
              if (log.exclusion_reason === 'valid') {
                validCoins += log.coins_earned || 0;
              } else if (log.coin_category === 'frozen') {
                frozenCoins += log.coins_earned || 0;
              }
            });

            await base44.asServiceRole.entities.CamlycoinBalance.create({
              user_email: userEmail,
              net_valid_coins: validCoins,
              frozen_balance: frozenCoins,
              total_earned: validCoins + frozenCoins,
              available_for_withdrawal: validCoins,
              paid_amount: 0
            });

            results.details.push({
              user_email: userEmail,
              balance_created: true,
              total_earned: validCoins + frozenCoins
            });

            console.log(`  ✅ Created balance: ${validCoins + frozenCoins} coins`);
          }
        }

        results.successful++;
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        results.failed++;
        results.errors.push({
          user_email: userEmail,
          error: error.message
        });
      }

      results.total_processed++;

      // Delay để tránh rate limit
      if (i < Math.min(batch_size, targetUsers.length) - 1) {
        await new Promise(resolve => setTimeout(resolve, delay_ms));
      }
    }

    console.log(`\n✅ HOÀN THÀNH`);
    console.log(`  Processed: ${results.total_processed}`);
    console.log(`  Success: ${results.successful}`);
    console.log(`  Failed: ${results.failed}`);

    return Response.json({
      success: true,
      issue_type,
      results,
      remaining_users: Math.max(0, targetUsers.length - batch_size),
      next_batch_users: targetUsers.slice(batch_size, batch_size + 10)
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});