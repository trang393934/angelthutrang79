import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user balance
    const balances = await base44.entities.CamlycoinBalance.filter({ 
      user_email: user.email 
    });

    if (balances.length === 0) {
      return Response.json({ 
        error: 'Không tìm thấy thông tin số dư' 
      }, { status: 404 });
    }

    const balance = balances[0];
    const availableBalance = balance.available_balance || 0;

    // Check minimum amount
    if (availableBalance < 100000) {
      return Response.json({ 
        error: 'Số dư phải đạt tối thiểu 100,000 Camlycoin',
        available: availableBalance,
        required: 100000
      }, { status: 400 });
    }

    // Get or check wallet address from previous submissions/withdrawals
    const submissions = await base44.asServiceRole.entities.BountySubmission.list();
    const userSubmissions = submissions.filter(s => s.created_by === user.email);
    
    const withdrawals = await base44.entities.WithdrawalRequest.filter({ 
      user_email: user.email 
    }, '-created_date', 1);

    let walletAddress = null;
    
    if (withdrawals.length > 0) {
      walletAddress = withdrawals[0].withdrawal_address;
    } else if (userSubmissions.length > 0) {
      walletAddress = userSubmissions[0].wallet_address;
    }

    if (!walletAddress) {
      return Response.json({ 
        error: 'Chưa có địa chỉ ví. Vui lòng tạo yêu cầu rút tiền thủ công lần đầu để lưu địa chỉ ví.',
        needsManualSetup: true
      }, { status: 400 });
    }

    // Create auto-claim withdrawal request
    const withdrawalRequest = await base44.entities.WithdrawalRequest.create({
      user_email: user.email,
      withdrawal_address: walletAddress,
      amount: availableBalance,
      status: 'pending',
      verification_status: 'email_verified',
      requires_manual_review: false
    });

    // Deduct from available balance immediately
    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      available_balance: 0,
      balance: (balance.balance || 0) - availableBalance
    });

    // Create transaction log
    await base44.entities.CamlycoinTransaction.create({
      user_email: user.email,
      amount: 0,
      type: 'admin_adjustment',
      description: `🤖 Auto-Claim: Đã gửi yêu cầu rút ${availableBalance.toLocaleString()} Camlycoin tự động về ví ${walletAddress.substring(0, 10)}...`,
      reference_id: withdrawalRequest.id
    });

    // Send email notification
    await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
      type: 'auto_claim_submitted',
      recipient_email: user.email,
      data: { 
        amount: availableBalance,
        address: walletAddress
      }
    }).catch(err => console.error('Email notification failed:', err));

    return Response.json({ 
      success: true,
      message: 'Đã gửi yêu cầu tự động claim thành công!',
      amount: availableBalance,
      address: walletAddress,
      request_id: withdrawalRequest.id
    });

  } catch (error) {
    console.error('Auto-claim error:', error);
    return Response.json({ 
      error: error.message || 'Có lỗi xảy ra khi xử lý auto-claim' 
    }, { status: 500 });
  }
});