import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * USER APPEAL HANDLER
 * Cho phép user kháng cáo khi coins bị frozen
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, appeal_type, explanation, evidence_urls = [] } = await req.json();

    if (action === 'submit_appeal') {
      // User submits appeal
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: user.email });
      
      if (balances.length === 0 || balances[0].frozen_balance === 0) {
        return Response.json({ 
          error: 'Bạn không có coins bị đóng băng' 
        }, { status: 400 });
      }

      const appeal = await base44.entities.UserAppeal.create({
        user_email: user.email,
        appeal_type,
        frozen_amount: balances[0].frozen_balance,
        explanation,
        evidence_urls,
        status: 'pending'
      });

      return Response.json({ 
        success: true,
        appeal_id: appeal.id,
        message: 'Kháng cáo đã được gửi. Admin sẽ xem xét trong 7-14 ngày.'
      });

    } else if (action === 'check_status') {
      // Check appeal status
      const appeals = await base44.entities.UserAppeal.filter(
        { user_email: user.email },
        '-created_date',
        10
      );

      return Response.json({ appeals });

    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});