import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🚨 EMERGENCY SYSTEM FIX STARTING...\n');

        const results = {
            step1_duplicates: null,
            step2_recalculation: null,
            step3_verification: null
        };

        // STEP 1: Delete all duplicate logs
        console.log('STEP 1: Deleting duplicate question logs...');
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
        
        const seen = new Map();
        const toDelete = [];
        
        for (const log of allLogs) {
            const key = `${log.user_email}|${log.question_text}|${log.question_date?.split('T')[0]}`;
            if (seen.has(key)) {
                toDelete.push(log.id);
            } else {
                seen.set(key, log);
            }
        }

        let deletedCount = 0;
        for (const id of toDelete) {
            await base44.asServiceRole.entities.QuestionAuditLog.delete(id);
            deletedCount++;
            if (deletedCount % 100 === 0) {
                console.log(`Deleted ${deletedCount}/${toDelete.length} duplicates...`);
            }
        }

        results.step1_duplicates = {
            total_logs: allLogs.length,
            duplicates_deleted: deletedCount,
            remaining_logs: allLogs.length - deletedCount
        };

        console.log(`✅ Deleted ${deletedCount} duplicate logs\n`);

        // STEP 2: Recalculate all balances from clean data
        console.log('STEP 2: Recalculating all user balances...');
        
        const cleanLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
        const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
        const completedWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { status: 'completed' },
            '-created_date',
            50000
        );

        // Calculate paid amounts
        const paidByUser = new Map();
        for (const withdrawal of completedWithdrawals) {
            const email = withdrawal.user_email;
            paidByUser.set(email, (paidByUser.get(email) || 0) + (withdrawal.amount || 0));
        }

        // Calculate balances from logs
        const userStats = new Map();
        for (const log of cleanLogs) {
            const email = log.user_email;
            if (!userStats.has(email)) {
                userStats.set(email, { net_valid: 0, frozen: 0 });
            }
            const stats = userStats.get(email);
            
            const coins = log.coins_earned || 0;
            if (log.coin_category === 'frozen') {
                stats.frozen += coins;
            } else {
                stats.net_valid += coins;
            }
        }

        let updatedCount = 0;
        let errorCount = 0;

        for (const balance of allBalances) {
            try {
                const email = balance.user_email;
                const stats = userStats.get(email) || { net_valid: 0, frozen: 0 };
                const paid = paidByUser.get(email) || 0;

                const net_valid_coins = stats.net_valid;
                const frozen_balance = stats.frozen;
                const total_earned = net_valid_coins + frozen_balance;
                const available_for_withdrawal = Math.max(0, net_valid_coins - paid);

                await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
                    total_earned: total_earned,
                    net_valid_coins: net_valid_coins,
                    frozen_balance: frozen_balance,
                    paid_amount: paid,
                    available_for_withdrawal: available_for_withdrawal
                });

                updatedCount++;
                if (updatedCount % 20 === 0) {
                    console.log(`Updated ${updatedCount}/${allBalances.length} balances...`);
                }
            } catch (error) {
                console.error(`Error updating ${balance.user_email}:`, error.message);
                errorCount++;
            }
        }

        results.step2_recalculation = {
            total_users: allBalances.length,
            updated: updatedCount,
            errors: errorCount
        };

        console.log(`✅ Updated ${updatedCount} user balances\n`);

        // STEP 3: Verify the fix
        console.log('STEP 3: Verifying system integrity...');
        
        const verifiedBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
        const verifiedLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
        
        let formulaErrors = 0;
        let negativeBalances = 0;
        let availableErrors = 0;
        
        const duplicateCheck = new Map();
        for (const log of verifiedLogs) {
            const key = `${log.user_email}|${log.question_text}|${log.question_date?.split('T')[0]}`;
            duplicateCheck.set(key, (duplicateCheck.get(key) || 0) + 1);
        }
        
        let remainingDuplicates = 0;
        for (const [key, count] of duplicateCheck) {
            if (count > 1) {
                remainingDuplicates += count - 1;
            }
        }

        for (const balance of verifiedBalances) {
            const total = balance.total_earned || 0;
            const net = balance.net_valid_coins || 0;
            const frozen = balance.frozen_balance || 0;
            const paid = balance.paid_amount || 0;
            const available = balance.available_for_withdrawal || 0;

            if (Math.abs(total - (net + frozen)) > 0.01) {
                formulaErrors++;
            }
            if (Math.abs(available - Math.max(0, net - paid)) > 0.01) {
                availableErrors++;
            }
            if (net < 0 || frozen < 0 || paid < 0 || available < 0) {
                negativeBalances++;
            }
        }

        results.step3_verification = {
            remaining_duplicates: remainingDuplicates,
            formula_errors: formulaErrors,
            available_errors: availableErrors,
            negative_balances: negativeBalances,
            total_users: verifiedBalances.length,
            total_logs: verifiedLogs.length
        };

        const isHealthy = remainingDuplicates === 0 && 
                         formulaErrors === 0 && 
                         availableErrors === 0 && 
                         negativeBalances === 0;

        console.log('\n' + '='.repeat(50));
        console.log(`🏥 SYSTEM STATUS: ${isHealthy ? '✅ HEALTHY' : '⚠️ ISSUES REMAIN'}`);
        console.log(`Duplicates: ${remainingDuplicates}`);
        console.log(`Formula Errors: ${formulaErrors}`);
        console.log(`Available Errors: ${availableErrors}`);
        console.log(`Negative Balances: ${negativeBalances}`);
        console.log('='.repeat(50) + '\n');

        return Response.json({
            success: true,
            system_status: isHealthy ? 'HEALTHY' : 'NEEDS_ATTENTION',
            results: results,
            message: isHealthy ? 
                'System successfully fixed and verified!' : 
                'Some issues remain - manual intervention may be needed'
        });

    } catch (error) {
        console.error('❌ Critical Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});