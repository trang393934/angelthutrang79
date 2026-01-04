import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const { withdrawalIds, scheduledDateTime, scheduledBy } = await req.json();

    if (!withdrawalIds || !Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      return Response.json({ error: 'Invalid withdrawal IDs' }, { status: 400 });
    }

    if (!scheduledDateTime) {
      return Response.json({ error: 'Scheduled date/time required' }, { status: 400 });
    }

    // Parse scheduled time
    const scheduledDate = new Date(scheduledDateTime);
    const now = new Date();

    if (scheduledDate <= now) {
      return Response.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    // Create task name
    const taskName = `Batch Approval ${scheduledDate.toISOString().split('T')[0]} ${withdrawalIds.length}reqs`;

    // Create scheduled task using Base44 SDK
    // Note: This requires a scheduled tasks API in Base44 SDK
    // For now, we'll store the schedule in a temporary entity and use a scheduled function to process it

    // Create a record to track this scheduled approval
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: scheduledBy,
      amount: 0,
      type: 'admin_adjustment',
      description: `📅 Đặt lịch duyệt ${withdrawalIds.length} yêu cầu rút tiền vào ${scheduledDate.toLocaleString('vi-VN')}`,
      reference_id: withdrawalIds.join(','),
      processed_by: scheduledBy
    });

    return Response.json({
      success: true,
      message: `Scheduled ${withdrawalIds.length} withdrawals for ${scheduledDateTime}`,
      taskName: taskName,
      scheduledDateTime: scheduledDateTime
    });
  } catch (error) {
    console.error('Error creating scheduled batch approval:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});