import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🔍 Calculating total unpaid amount...');

        // Fetch all balances
        const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-available_for_withdrawal', 50000);

        console.log(`📊 Total balance records: ${allBalances.length}`);

        // Calculate total unpaid (available_for_withdrawal)
        let totalUnpaid = 0;
        let usersWithUnpaid = 0;
        const topUnpaid = [];

        for (const balance of allBalances) {
            const unpaid = balance.available_for_withdrawal || 0;
            if (unpaid > 0) {
                usersWithUnpaid++;
                topUnpaid.push({
                    email: balance.user_email,
                    unpaid: unpaid
                });
            }
            totalUnpaid += unpaid;
        }

        // Sort top unpaid
        topUnpaid.sort((a, b) => b.unpaid - a.unpaid);

        console.log(`💰 Total Unpaid: ${totalUnpaid.toLocaleString()}`);
        console.log(`👥 Users with unpaid: ${usersWithUnpaid}`);

        // Also calculate other totals for verification
        let totalNetValid = 0;
        let totalFrozen = 0;
        let totalPaid = 0;
        let totalEarned = 0;

        for (const balance of allBalances) {
            totalNetValid += balance.net_valid_coins || 0;
            totalFrozen += balance.frozen_balance || 0;
            totalPaid += balance.paid_amount || 0;
            totalEarned += balance.total_earned || 0;
        }

        return Response.json({
            success: true,
            verification: {
                total_unpaid: totalUnpaid,
                users_with_unpaid: usersWithUnpaid,
                formula_check: {
                    total_net_valid: totalNetValid,
                    total_paid: totalPaid,
                    calculated_unpaid: totalNetValid - totalPaid,
                    matches: (totalNetValid - totalPaid) === totalUnpaid
                }
            },
            totals: {
                total_earned: totalEarned,
                total_net_valid: totalNetValid,
                total_frozen: totalFrozen,
                total_paid: totalPaid,
                total_unpaid: totalUnpaid
            },
            top_10_unpaid: topUnpaid.slice(0, 10),
            total_records: allBalances.length
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});