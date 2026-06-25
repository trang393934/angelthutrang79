import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const { withdrawalIds } = await req.json();

    if (!withdrawalIds || !Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return Response.json({ error: 'Invalid withdrawal IDs' }, { status: 400 });
    }

    console.log(`Processing batch approval for ${withdrawalIds.length} withdrawals`);

    const results = [];

    for (const withdrawalId of withdrawalIds) {
      try {
        // Get withdrawal request
        const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.list();
        const withdrawal = withdrawals.find(w => w.id === withdrawalId);

        if (!withdrawal) {
          results.push({
            id: withdrawalId,
            success: false,
            error: 'Withdrawal not found'
          });
          continue;
        }

        if (withdrawal.status !== 'pending') {
          results.push({
            id: withdrawalId,
            success: false,
            error: `Status is ${withdrawal.status}, not pending`
          });
          continue;
        }

        // Update to approved
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalId, {
          status: 'approved',
          processed_by: 'system_scheduled',
          processed_date: new Date().toISOString()
        });

        // Auto-transfer
        const transferResult = await base44.asServiceRole.functions.invoke('autoTransferCamlycoin', {
          withdrawalRequestId: withdrawalId
        });

        if (transferResult.data.success) {
          results.push({
            id: withdrawalId,
            email: withdrawal.user_email,
            amount: withdrawal.amount,
            success: true,
            tx_hash: transferResult.data.tx_hash
          });
        } else {
          results.push({
            id: withdrawalId,
            email: withdrawal.user_email,
            success: false,
            error: transferResult.data.error || 'Transfer failed'
          });
        }
      } catch (error) {
        results.push({
          id: withdrawalId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Batch approval completed: ${successCount} success, ${failCount} failed`);

    return Response.json({
      success: true,
      total: withdrawalIds.length,
      successCount,
      failCount,
      results
    });
  } catch (error) {
    console.error('Error in batch approval:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});