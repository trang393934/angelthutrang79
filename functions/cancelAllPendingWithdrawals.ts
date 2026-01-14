import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🗑️ Cancelling all pending withdrawal requests before 2025-01-15...');

        // Parse cutoff date
        const cutoffDate = new Date('2025-01-15T00:00:00Z');
        console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);

        // Fetch all withdrawal requests
        const allWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list('-created_date', 50000);
        console.log(`📊 Total withdrawal requests found: ${allWithdrawals.length}`);

        let cancelledCount = 0;
        let keptCount = 0;
        const cancelledDetails = [];

        for (const withdrawal of allWithdrawals) {
            const createdDate = new Date(withdrawal.created_date);
            const isBeforeCutoff = createdDate < cutoffDate;
            const isNotCompleted = withdrawal.status !== 'completed';

            if (isBeforeCutoff && isNotCompleted) {
                // Delete the withdrawal request
                await base44.asServiceRole.entities.WithdrawalRequest.delete(withdrawal.id);
                cancelledCount++;
                cancelledDetails.push({
                    email: withdrawal.user_email,
                    amount: withdrawal.amount,
                    status: withdrawal.status,
                    created_date: withdrawal.created_date
                });
                console.log(`❌ Deleted: ${withdrawal.user_email} - ${withdrawal.amount} (${withdrawal.status})`);
            } else {
                keptCount++;
            }
        }

        console.log(`✅ Cancelled: ${cancelledCount}`);
        console.log(`📝 Kept: ${keptCount}`);

        return Response.json({
            success: true,
            summary: {
                total_processed: allWithdrawals.length,
                cancelled: cancelledCount,
                kept: keptCount,
                cutoff_date: cutoffDate.toISOString()
            },
            cancelled_withdrawals: cancelledDetails
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});