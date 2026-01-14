import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🔍 Starting comprehensive security audit...');

        const issues = {
            critical: [],
            warnings: [],
            info: []
        };

        // 1. Check for duplicate question logs
        console.log('📋 Checking duplicate question logs...');
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.list('-audit_date', 50000);
        const duplicateMap = new Map();
        
        for (const log of allLogs) {
            const key = `${log.user_email}|${log.question_text}|${log.question_date?.split('T')[0]}`;
            if (!duplicateMap.has(key)) {
                duplicateMap.set(key, []);
            }
            duplicateMap.get(key).push(log);
        }

        let duplicateCount = 0;
        for (const [key, logs] of duplicateMap) {
            if (logs.length > 1) {
                duplicateCount += logs.length - 1;
            }
        }

        if (duplicateCount > 0) {
            issues.critical.push({
                type: 'duplicate_logs',
                message: `Found ${duplicateCount} duplicate question logs`,
                severity: 'CRITICAL'
            });
        } else {
            issues.info.push({
                type: 'duplicate_logs',
                message: 'No duplicate logs found',
                severity: 'OK'
            });
        }

        // 2. Check balance formula consistency
        console.log('💰 Checking balance formula consistency...');
        const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
        let formulaErrors = 0;
        let availableErrors = 0;
        let negativeBalances = 0;

        for (const balance of allBalances) {
            const total = balance.total_earned || 0;
            const net = balance.net_valid_coins || 0;
            const frozen = balance.frozen_balance || 0;
            const paid = balance.paid_amount || 0;
            const available = balance.available_for_withdrawal || 0;

            // Check: total_earned = net_valid_coins + frozen_balance
            if (Math.abs(total - (net + frozen)) > 0.01) {
                formulaErrors++;
                if (formulaErrors <= 5) {
                    issues.critical.push({
                        type: 'formula_error',
                        user: balance.user_email,
                        message: `total_earned (${total}) ≠ net_valid (${net}) + frozen (${frozen})`,
                        severity: 'CRITICAL'
                    });
                }
            }

            // Check: available_for_withdrawal = net_valid_coins - paid_amount
            if (Math.abs(available - (net - paid)) > 0.01) {
                availableErrors++;
                if (availableErrors <= 5) {
                    issues.critical.push({
                        type: 'available_error',
                        user: balance.user_email,
                        message: `available (${available}) ≠ net_valid (${net}) - paid (${paid})`,
                        severity: 'CRITICAL'
                    });
                }
            }

            // Check negative values
            if (net < 0 || frozen < 0 || paid < 0 || available < 0) {
                negativeBalances++;
                issues.critical.push({
                    type: 'negative_balance',
                    user: balance.user_email,
                    message: `Negative values: net=${net}, frozen=${frozen}, paid=${paid}, available=${available}`,
                    severity: 'CRITICAL'
                });
            }
        }

        if (formulaErrors > 5) {
            issues.critical.push({
                type: 'formula_error_summary',
                message: `Total ${formulaErrors} users with formula errors (showing first 5)`,
                severity: 'CRITICAL'
            });
        }

        if (availableErrors > 5) {
            issues.critical.push({
                type: 'available_error_summary',
                message: `Total ${availableErrors} users with available_for_withdrawal errors (showing first 5)`,
                severity: 'CRITICAL'
            });
        }

        // 3. Check paid_amount vs completed withdrawals
        console.log('💸 Checking paid amounts vs withdrawals...');
        const completedWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter(
            { status: 'completed' },
            '-created_date',
            50000
        );

        const paidByUser = new Map();
        for (const withdrawal of completedWithdrawals) {
            const email = withdrawal.user_email;
            paidByUser.set(email, (paidByUser.get(email) || 0) + (withdrawal.amount || 0));
        }

        let paidMismatch = 0;
        for (const balance of allBalances) {
            const recordedPaid = balance.paid_amount || 0;
            const actualPaid = paidByUser.get(balance.user_email) || 0;
            
            if (Math.abs(recordedPaid - actualPaid) > 0.01) {
                paidMismatch++;
                if (paidMismatch <= 5) {
                    issues.warnings.push({
                        type: 'paid_mismatch',
                        user: balance.user_email,
                        message: `Recorded paid (${recordedPaid}) ≠ Actual withdrawals (${actualPaid})`,
                        severity: 'WARNING'
                    });
                }
            }
        }

        if (paidMismatch > 5) {
            issues.warnings.push({
                type: 'paid_mismatch_summary',
                message: `Total ${paidMismatch} users with paid amount mismatch (showing first 5)`,
                severity: 'WARNING'
            });
        }

        // 4. Check for zero total_earned with activity
        console.log('🔎 Checking zero balances with activity...');
        let zeroWithActivity = 0;
        for (const balance of allBalances) {
            if (balance.total_earned === 0) {
                const userLogs = allLogs.filter(log => log.user_email === balance.user_email);
                if (userLogs.length > 0) {
                    zeroWithActivity++;
                    if (zeroWithActivity <= 3) {
                        issues.warnings.push({
                            type: 'zero_with_activity',
                            user: balance.user_email,
                            message: `Has ${userLogs.length} question logs but total_earned = 0`,
                            severity: 'WARNING'
                        });
                    }
                }
            }
        }

        // 5. Calculate totals
        console.log('📊 Calculating system totals...');
        let totalEarned = 0;
        let totalNetValid = 0;
        let totalFrozen = 0;
        let totalPaid = 0;
        let totalAvailable = 0;

        for (const balance of allBalances) {
            totalEarned += balance.total_earned || 0;
            totalNetValid += balance.net_valid_coins || 0;
            totalFrozen += balance.frozen_balance || 0;
            totalPaid += balance.paid_amount || 0;
            totalAvailable += balance.available_for_withdrawal || 0;
        }

        // Summary
        const summary = {
            total_users: allBalances.length,
            total_logs: allLogs.length,
            duplicate_logs: duplicateCount,
            formula_errors: formulaErrors,
            available_errors: availableErrors,
            negative_balances: negativeBalances,
            paid_mismatches: paidMismatch,
            zero_with_activity: zeroWithActivity,
            system_totals: {
                total_earned: totalEarned,
                total_net_valid: totalNetValid,
                total_frozen: totalFrozen,
                total_paid: totalPaid,
                total_available: totalAvailable
            }
        };

        // Overall health
        const criticalCount = issues.critical.length;
        const warningCount = issues.warnings.length;
        
        let healthStatus = 'HEALTHY';
        if (criticalCount > 0) {
            healthStatus = 'CRITICAL';
        } else if (warningCount > 0) {
            healthStatus = 'WARNING';
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`🏥 SYSTEM HEALTH: ${healthStatus}`);
        console.log(`❌ Critical Issues: ${criticalCount}`);
        console.log(`⚠️  Warnings: ${warningCount}`);
        console.log(`ℹ️  Info: ${issues.info.length}`);
        console.log(`${'='.repeat(50)}\n`);

        return Response.json({
            success: true,
            health_status: healthStatus,
            summary: summary,
            issues: {
                critical: issues.critical,
                warnings: issues.warnings,
                info: issues.info
            },
            recommendations: criticalCount > 0 ? [
                'Run cleanDuplicatesAndRecalculateBalance to fix duplicate logs',
                'Run resetAndRecalculateAllBalances to fix formula errors',
                'Verify withdrawal history matches paid_amount'
            ] : [
                'System is healthy - continue monitoring'
            ]
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});