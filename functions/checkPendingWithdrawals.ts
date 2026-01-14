import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🔍 Checking pending withdrawal requests...');

        // Fetch all withdrawal requests
        const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 50000);

        console.log(`📊 Total withdrawal requests: ${allWithdrawals.length}`);

        // Group by status
        const byStatus = {
            pending: [],
            approved: [],
            processing: [],
            failed: [],
            rejected: [],
            completed: []
        };

        let totalPendingAmount = 0;
        let totalCompletedAmount = 0;

        for (const withdrawal of allWithdrawals) {
            const status = withdrawal.status || 'pending';
            if (byStatus[status]) {
                byStatus[status].push(withdrawal);
            }

            if (status === 'completed') {
                totalCompletedAmount += withdrawal.amount || 0;
            } else {
                totalPendingAmount += withdrawal.amount || 0;
            }
        }

        // Get unique users for non-completed withdrawals
        const pendingUsers = new Map();
        
        for (const status of ['pending', 'approved', 'processing', 'failed', 'rejected']) {
            for (const withdrawal of byStatus[status]) {
                const email = withdrawal.user_email;
                if (!pendingUsers.has(email)) {
                    pendingUsers.set(email, {
                        email: email,
                        total_amount: 0,
                        withdrawals: []
                    });
                }
                const userData = pendingUsers.get(email);
                userData.total_amount += withdrawal.amount || 0;
                userData.withdrawals.push({
                    id: withdrawal.id,
                    amount: withdrawal.amount,
                    status: withdrawal.status,
                    created_date: withdrawal.created_date
                });
            }
        }

        // Convert to array and sort by amount
        const pendingUsersList = Array.from(pendingUsers.values())
            .sort((a, b) => b.total_amount - a.total_amount);

        console.log(`💰 Total pending amount: ${totalPendingAmount.toLocaleString()}`);
        console.log(`✅ Total completed amount: ${totalCompletedAmount.toLocaleString()}`);
        console.log(`👥 Users with pending withdrawals: ${pendingUsersList.length}`);

        return Response.json({
            success: true,
            summary: {
                total_requests: allWithdrawals.length,
                total_pending_amount: totalPendingAmount,
                total_completed_amount: totalCompletedAmount,
                users_with_pending: pendingUsersList.length
            },
            by_status: {
                pending: byStatus.pending.length,
                approved: byStatus.approved.length,
                processing: byStatus.processing.length,
                failed: byStatus.failed.length,
                rejected: byStatus.rejected.length,
                completed: byStatus.completed.length
            },
            pending_users: pendingUsersList,
            status_details: {
                pending: byStatus.pending.map(w => ({
                    id: w.id,
                    email: w.user_email,
                    amount: w.amount,
                    created_date: w.created_date
                })),
                approved: byStatus.approved.map(w => ({
                    id: w.id,
                    email: w.user_email,
                    amount: w.amount,
                    created_date: w.created_date
                })),
                processing: byStatus.processing.map(w => ({
                    id: w.id,
                    email: w.user_email,
                    amount: w.amount,
                    created_date: w.created_date
                })),
                failed: byStatus.failed.map(w => ({
                    id: w.id,
                    email: w.user_email,
                    amount: w.amount,
                    created_date: w.created_date
                })),
                rejected: byStatus.rejected.map(w => ({
                    id: w.id,
                    email: w.user_email,
                    amount: w.amount,
                    created_date: w.created_date
                }))
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});