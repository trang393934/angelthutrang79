import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { max_deletes = 500, delay_ms = 100 } = await req.json().catch(() => ({}));

        console.log('🚨 EMERGENCY SYSTEM FIX (SLOW MODE)...\n');
        console.log(`Max deletes: ${max_deletes}, Delay: ${delay_ms}ms\n`);

        const results = {
            step1_duplicates: null,
            step2_sample_recalc: null
        };

        // STEP 1: Delete duplicates (limited)
        console.log('STEP 1: Deleting duplicate logs (limited batch)...');
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
        
        const seen = new Map();
        const toDelete = [];
        
        for (const log of allLogs) {
            const key = `${log.user_email}|${log.question_text}|${log.question_date?.split('T')[0]}`;
            if (seen.has(key)) {
                toDelete.push(log.id);
                if (toDelete.length >= max_deletes) break;
            } else {
                seen.set(key, log);
            }
        }

        let deletedCount = 0;
        for (const id of toDelete) {
            try {
                await base44.asServiceRole.entities.QuestionAuditLog.delete(id);
                deletedCount++;
                if (deletedCount % 50 === 0) {
                    console.log(`Deleted ${deletedCount}/${toDelete.length} duplicates...`);
                    await new Promise(resolve => setTimeout(resolve, delay_ms));
                }
            } catch (error) {
                console.error(`Error deleting log ${id}:`, error.message);
            }
        }

        results.step1_duplicates = {
            total_logs: allLogs.length,
            duplicates_found: toDelete.length,
            duplicates_deleted: deletedCount,
            more_remaining: toDelete.length >= max_deletes
        };

        console.log(`✅ Deleted ${deletedCount} duplicate logs\n`);

        // STEP 2: Recalculate sample users with issues
        console.log('STEP 2: Recalculating users with negative balances...');
        
        const allBalances = await base45.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
        const cleanLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
        const completedWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { status: 'completed' },
            '-created_date',
            50000
        );

        // Find users with negative balances
        const problematicUsers = allBalances.filter(b => 
            (b.available_for_withdrawal || 0) < 0 || 
            (b.net_valid_coins || 0) < 0
        ).slice(0, 20);

        // Calculate paid amounts
        const paidByUser = new Map();
        for (const withdrawal of completedWithdrawals) {
            const email = withdrawal.user_email;
            paidByUser.set(email, (paidByUser.get(email) || 0) + (withdrawal.amount || 0));
        }

        let fixedCount = 0;
        for (const balance of problematicUsers) {
            try {
                const email = balance.user_email;
                const userLogs = cleanLogs.filter(log => log.user_email === email);
                
                let net_valid = 0;
                let frozen = 0;
                
                for (const log of userLogs) {
                    const coins = log.coins_earned || 0;
                    if (log.coin_category === 'frozen') {
                        frozen += coins;
                    } else {
                        net_valid += coins;
                    }
                }

                const paid = paidByUser.get(email) || 0;
                const total_earned = net_valid + frozen;
                const available = Math.max(0, net_valid - paid);

                await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
                    total_earned: total_earned,
                    net_valid_coins: net_valid,
                    frozen_balance: frozen,
                    paid_amount: paid,
                    available_for_withdrawal: available
                });

                fixedCount++;
                console.log(`Fixed ${email}: net=${net_valid}, frozen=${frozen}, paid=${paid}, available=${available}`);
                
                await new Promise(resolve => setTimeout(resolve, delay_ms));
            } catch (error) {
                console.error(`Error fixing ${balance.user_email}:`, error.message);
            }
        }

        results.step2_sample_recalc = {
            problematic_users: problematicUsers.length,
            fixed: fixedCount
        };

        console.log(`✅ Fixed ${fixedCount} users with negative balances\n`);

        console.log('\n' + '='.repeat(50));
        console.log('🏥 PARTIAL FIX COMPLETED');
        console.log(`Deleted: ${deletedCount} duplicates`);
        console.log(`Fixed: ${fixedCount} negative balances`);
        console.log(`Run again to continue fixing...`);
        console.log('='.repeat(50) + '\n');

        return Response.json({
            success: true,
            results: results,
            message: results.step1_duplicates.more_remaining ? 
                'Partial fix completed - run again to continue' : 
                'All duplicates processed'
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});