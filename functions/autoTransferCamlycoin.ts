import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.9.0';

// ERC20 ABI for Camlycoin token transfers
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { withdrawalRequestId } = await req.json();

    if (!withdrawalRequestId) {
      return Response.json({ error: 'withdrawalRequestId is required' }, { status: 400 });
    }

    // Get environment variables
    const privateKey = Deno.env.get("ADMIN_WALLET_PRIVATE_KEY");
    const contractAddress = Deno.env.get("CAMLYCOIN_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("BSC_RPC_URL");

    if (!privateKey || !contractAddress || !rpcUrl) {
      return Response.json({ 
        error: 'Missing configuration. Please set ADMIN_WALLET_PRIVATE_KEY, CAMLYCOIN_CONTRACT_ADDRESS, and BSC_RPC_URL in environment variables.' 
      }, { status: 500 });
    }

    // Get withdrawal request by listing and finding
    const allRequests = await base44.asServiceRole.entities.WithdrawalRequest.list();
    const withdrawalRequest = allRequests.find(r => r.id === withdrawalRequestId);
    
    if (!withdrawalRequest) {
      return Response.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    if (withdrawalRequest.status !== 'approved') {
      return Response.json({ 
        error: 'Withdrawal request must be approved first',
        currentStatus: withdrawalRequest.status 
      }, { status: 400 });
    }

    // SECURITY CHECK: Verify daily limit (500k max per day)
    const today = new Date().toISOString().split('T')[0];
    const dailyLimits = await base44.asServiceRole.entities.DailyAutoClaimLimit.filter({
      user_email: withdrawalRequest.user_email,
      date: today
    });
    
    const dailyLimit = dailyLimits[0];
    if (dailyLimit) {
      const remaining = dailyLimit.remaining_limit || 0;
      if (withdrawalRequest.amount > remaining) {
        return Response.json({ 
          error: `Vượt quá giới hạn rút hôm nay. Còn lại: ${remaining.toLocaleString()} CAMLY`,
          remaining: remaining,
          requested: withdrawalRequest.amount
        }, { status: 400 });
      }
    }

    // SECURITY CHECK: Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawalRequest.withdrawal_address)) {
      return Response.json({ 
        error: 'Invalid BEP-20 wallet address format',
        address: withdrawalRequest.withdrawal_address
      }, { status: 400 });
    }

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);

    // Get token decimals
    const decimals = await contract.decimals();
    
    // Convert amount to token units (assuming Camlycoin uses standard decimals)
    const amountInTokenUnits = ethers.parseUnits(withdrawalRequest.amount.toString(), decimals);

    // Check admin wallet balance
    const adminBalance = await contract.balanceOf(wallet.address);
    if (adminBalance < amountInTokenUnits) {
      return Response.json({ 
        error: 'Insufficient admin wallet balance',
        required: withdrawalRequest.amount,
        available: ethers.formatUnits(adminBalance, decimals)
      }, { status: 400 });
    }

    // Update status to processing
    await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequest.id, {
      status: 'processing'
    });

    // Execute transfer
    const tx = await contract.transfer(
      withdrawalRequest.withdrawal_address,
      amountInTokenUnits
    );

    // Wait for confirmation
    const receipt = await tx.wait();

    // ONLY NOW deduct from user's balance (after successful transfer)
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email: withdrawalRequest.user_email 
    });
    if (balances.length > 0) {
      const balance = balances[0];
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        available_balance: Math.max(0, (balance.available_balance || 0) - withdrawalRequest.amount),
        balance: Math.max(0, (balance.balance || 0) - withdrawalRequest.amount),
        paid_amount: (balance.paid_amount || 0) + withdrawalRequest.amount
      });
    }

    // Update withdrawal request with tx hash
    await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequest.id, {
      status: 'completed',
      tx_hash: receipt.hash,
      processed_date: new Date().toISOString()
    });

    // Update daily limit tracking
    if (dailyLimit) {
      await base44.asServiceRole.entities.DailyAutoClaimLimit.update(dailyLimit.id, {
        total_claimed_today: (dailyLimit.total_claimed_today || 0) + withdrawalRequest.amount,
        claim_count: (dailyLimit.claim_count || 0) + 1,
        remaining_limit: Math.max(0, (dailyLimit.remaining_limit || 500000) - withdrawalRequest.amount)
      });
    } else {
      await base44.asServiceRole.entities.DailyAutoClaimLimit.create({
        user_email: withdrawalRequest.user_email,
        date: today,
        total_claimed_today: withdrawalRequest.amount,
        claim_count: 1,
        remaining_limit: Math.max(0, 500000 - withdrawalRequest.amount)
      });
    }

    // Create transaction log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: withdrawalRequest.user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Đã chuyển ${withdrawalRequest.amount.toLocaleString()} Camlycoin về ví tự động\n🔗 TX: ${receipt.hash}`,
      reference_id: withdrawalRequest.id,
      processed_by: user?.email || 'auto_claim_system'
    });

    // Send email notification
    await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
      type: 'withdrawal_completed',
      recipient_email: withdrawalRequest.user_email,
      data: { 
        amount: withdrawalRequest.amount,
        tx_hash: receipt.hash,
        address: withdrawalRequest.withdrawal_address
      }
    }).catch(err => console.error('Email notification failed:', err));

    return Response.json({
      success: true,
      message: 'Đã chuyển tiền thành công!',
      tx_hash: receipt.hash,
      amount: withdrawalRequest.amount,
      recipient: withdrawalRequest.withdrawal_address
    });

  } catch (error) {
    console.error('Auto-transfer error:', error);

    // Update status to failed if there's an error
    try {
      const { withdrawalRequestId } = await req.json();
      if (withdrawalRequestId) {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequestId, {
          status: 'failed',
          rejection_reason: error.message
        });
      }
    } catch (updateError) {
      console.error('Failed to update status:', updateError);
    }

    return Response.json({ 
      error: error.message || 'Có lỗi xảy ra khi chuyển tiền tự động',
      details: error.toString()
    }, { status: 500 });
  }
});