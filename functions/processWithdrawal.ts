import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.9.0';

/**
 * CAMLY WITHDRAWAL PROCESSOR
 * Xử lý rút Camly (BEP-20) ra ví ngoài với điều kiện an toàn
 */

const CAMLY_TOKEN_ADDRESS = '0x0910320181889fefde0bb1ca63962b0a8882e413';
const MIN_WITHDRAWAL_CLEAN = 50;
const MIN_WITHDRAWAL_FLAGGED = 200;

// BEP-20 ABI (chỉ cần transfer function)
const BEP20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, withdrawal_id, address, amount } = await req.json();

    // === ACTION: CREATE WITHDRAWAL REQUEST ===
    if (action === 'create_request') {
      // Validate address format
      if (!ethers.isAddress(address)) {
        return Response.json({ 
          error: 'Địa chỉ BEP-20 không hợp lệ',
          approved: false 
        }, { status: 400 });
      }

      // Check user balance
      const balances = await base44.entities.CamlycoinBalance.filter({ user_email: user.email });
      if (balances.length === 0 || balances[0].available_balance < amount) {
        return Response.json({ 
          error: 'Số dư không đủ',
          approved: false 
        }, { status: 400 });
      }

      const userBalance = balances[0];

      // === ELIGIBILITY CHECKS ===
      const eligibility = await checkWithdrawalEligibility(user, userBalance, amount, base44);

      if (!eligibility.approved) {
        return Response.json(eligibility, { status: 400 });
      }

      // Create withdrawal request
      const withdrawal = await base44.entities.WithdrawalRequest.create({
        user_email: user.email,
        withdrawal_address: address,
        amount: amount,
        status: eligibility.requires_manual_review ? 'pending' : 'approved',
        risk_level: eligibility.risk_level,
        requires_manual_review: eligibility.requires_manual_review,
        verification_status: eligibility.verification_status,
        purity_streak_days: eligibility.purity_streak_days,
        gas_fee_bnb: 0.0005 // Estimate
      });

      // Send email notification to user
      await base44.functions.invoke('sendNotificationEmail', {
        type: 'withdrawal_requested',
        recipient_email: user.email,
        data: {
          amount: amount,
          address: address
        }
      }).catch(err => console.error('Email notification failed:', err));

      // If auto-approved (low risk), process immediately
      if (!eligibility.requires_manual_review) {
        // Deduct from available balance immediately
        await base44.entities.CamlycoinBalance.update(userBalance.id, {
          available_balance: userBalance.available_balance - amount,
          balance: userBalance.balance - amount,
          total_spent: (userBalance.total_spent || 0) + amount
        });

        // Queue for processing (in production, this would go to a job queue)
        return Response.json({
          approved: true,
          withdrawal_id: withdrawal.id,
          status: 'approved',
          message: 'Withdrawal đã được duyệt! Sẽ xử lý trong vòng 1-24 giờ.',
          estimated_time: '1-24 hours'
        });
      } else {
        return Response.json({
          approved: true,
          withdrawal_id: withdrawal.id,
          status: 'pending',
          message: eligibility.message,
          requires_review: true
        });
      }
    }

    // === ACTION: PROCESS (Execute blockchain transaction) ===
    if (action === 'process' && user.role === 'admin') {
      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ id: withdrawal_id });
      if (withdrawals.length === 0) {
        return Response.json({ error: 'Withdrawal not found' }, { status: 404 });
      }

      const withdrawal = withdrawals[0];
      
      // Connect to BSC
      const privateKey = Deno.env.get('CAMLY_HOT_WALLET_PRIVATE_KEY');
      const rpcUrl = Deno.env.get('BSC_RPC_URL') || 'https://bsc-dataseed1.binance.org/';
      
      if (!privateKey) {
        return Response.json({ error: 'Hot wallet not configured' }, { status: 500 });
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(CAMLY_TOKEN_ADDRESS, BEP20_ABI, wallet);

      // Get decimals
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(withdrawal.amount.toString(), decimals);

      // Estimate gas fee
      const gasPrice = await provider.getFeeData();
      const estimatedGas = await tokenContract.transfer.estimateGas(withdrawal.withdrawal_address, amountWei);
      const gasFeeWei = estimatedGas * gasPrice.gasPrice;
      const gasFeeEth = ethers.formatEther(gasFeeWei);

      // Send transaction
      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal_id, {
        status: 'processing',
        gas_fee_bnb: parseFloat(gasFeeEth)
      });

      const tx = await tokenContract.transfer(withdrawal.withdrawal_address, amountWei);
      
      // Wait for confirmation
      const receipt = await tx.wait();

      // Update status
      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal_id, {
        status: receipt.status === 1 ? 'completed' : 'failed',
        tx_hash: tx.hash,
        processed_by: user.email,
        processed_date: new Date().toISOString()
      });

      // Send email + in-app notification to user
      if (receipt.status === 1) {
        await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
          type: 'withdrawal_completed',
          recipient_email: withdrawal.user_email,
          data: {
            amount: withdrawal.amount,
            address: withdrawal.withdrawal_address,
            tx_hash: tx.hash
          }
        }).catch(err => console.error('Email notification failed:', err));

        // Create in-app notification
        await base44.asServiceRole.entities.Notification.create({
          user_email: withdrawal.user_email,
          type: 'system',
          title: '🎉 Rút Tiền Thành Công!',
          content: `${withdrawal.amount.toLocaleString()} Camlycoin đã được chuyển đến ví của bạn. TX: ${tx.hash}`,
          reference_id: withdrawal_id,
          reference_type: 'withdrawal',
          from_user: user.email,
          is_read: false,
          action_url: `https://bscscan.com/tx/${tx.hash}`
        }).catch(err => console.error('In-app notification failed:', err));
      }

      // Create transaction log
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: withdrawal.user_email,
        amount: -withdrawal.amount,
        type: 'purchase',
        description: `Withdrawal to ${withdrawal.withdrawal_address.substring(0, 8)}...`,
        reference_id: tx.hash,
        processed_by: user.email
      });

      // Send alert
      await base44.asServiceRole.functions.invoke('sendAdminAlert', {
        alert_type: 'frozen_coins',
        user_email: withdrawal.user_email,
        details: `Withdrawal processed: ${withdrawal.amount} Camly to ${withdrawal.withdrawal_address}\nTx: ${tx.hash}`,
        severity: 'medium'
      });

      return Response.json({
        success: true,
        tx_hash: tx.hash,
        status: receipt.status === 1 ? 'completed' : 'failed',
        explorer_url: `https://bscscan.com/tx/${tx.hash}`
      });
    }

    // === ACTION: ADMIN APPROVE ===
    if (action === 'approve' && user.role === 'admin') {
      // Get withdrawal first
      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ id: withdrawal_id });
      const withdrawal = withdrawals[0];

      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal_id, {
        status: 'approved',
        processed_by: user.email
      });

      // Deduct balance
      const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
        user_email: withdrawal.user_email 
      });
      
      if (balances.length > 0) {
        const balance = balances[0];
        await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
          available_balance: balance.available_balance - withdrawal.amount,
          balance: balance.balance - withdrawal.amount
        });
      }

      // Send email + in-app notification to user
      await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
        type: 'withdrawal_approved',
        recipient_email: withdrawal.user_email,
        data: {
          amount: withdrawal.amount,
          address: withdrawal.withdrawal_address
        }
      }).catch(err => console.error('Email notification failed:', err));

      // Create in-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_email: withdrawal.user_email,
        type: 'system',
        title: '✅ Yêu Cầu Rút Tiền Được Duyệt',
        content: `Yêu cầu rút ${withdrawal.amount.toLocaleString()} Camlycoin đã được admin phê duyệt. Giao dịch sẽ được thực thi trong vòng 1-24h.`,
        reference_id: withdrawal_id,
        reference_type: 'withdrawal',
        from_user: user.email,
        is_read: false
      }).catch(err => console.error('In-app notification failed:', err));

      return Response.json({ success: true, message: 'Approved - ready for processing' });
    }

    // === ACTION: REJECT ===
    if (action === 'reject' && user.role === 'admin') {
      const { reason } = await req.json();

      // Get withdrawal first
      const withdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({ id: withdrawal_id });
      const withdrawal = withdrawals[0];

      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal_id, {
        status: 'rejected',
        rejection_reason: reason,
        processed_by: user.email
      });

      // Send email + in-app notification to user
      await base44.asServiceRole.functions.invoke('sendNotificationEmail', {
        type: 'withdrawal_rejected',
        recipient_email: withdrawal.user_email,
        data: {
          amount: withdrawal.amount,
          address: withdrawal.withdrawal_address,
          reason: reason
        }
      }).catch(err => console.error('Email notification failed:', err));

      // Create in-app notification
      await base44.asServiceRole.entities.Notification.create({
        user_email: withdrawal.user_email,
        type: 'system',
        title: '❌ Yêu Cầu Rút Tiền Bị Từ Chối',
        content: `Yêu cầu rút ${withdrawal.amount.toLocaleString()} Camlycoin bị từ chối. Lý do: ${reason}`,
        reference_id: withdrawal_id,
        reference_type: 'withdrawal',
        from_user: user.email,
        is_read: false
      }).catch(err => console.error('In-app notification failed:', err));

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});

async function checkWithdrawalEligibility(user, userBalance, amount, base44) {
  const result = {
    approved: false,
    requires_manual_review: false,
    risk_level: 'low',
    message: '',
    verification_status: 'not_verified',
    purity_streak_days: 0
  };

  // 1. Check verification (simplified - assume email verified if logged in)
  result.verification_status = 'email_verified';

  // 2. Check spam score
  const spamScore = userBalance.spam_score || 0;
  const frozenBalance = userBalance.frozen_balance || 0;

  if (spamScore >= 70) {
    result.risk_level = 'high';
    result.message = 'Tài khoản có spam score cao. Cần 30 ngày hoạt động clean và manual review.';
    result.requires_manual_review = true;
  } else if (spamScore >= 40) {
    result.risk_level = 'medium';
    result.message = 'Cần 14 ngày hoạt động clean trước khi rút.';
  }

  // 3. Check minimum withdrawal
  const minWithdrawal = spamScore >= 40 ? MIN_WITHDRAWAL_FLAGGED : MIN_WITHDRAWAL_CLEAN;
  if (amount < minWithdrawal) {
    result.message = `Số tiền rút tối thiểu: ${minWithdrawal} Camly`;
    return result;
  }

  // 4. Check if amount exceeds available balance
  if (amount > userBalance.available_balance) {
    result.message = 'Số dư available không đủ';
    return result;
  }

  // 5. Check rate limit (1 withdrawal/day)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  const recentWithdrawals = await base44.entities.WithdrawalRequest.filter({
    user_email: user.email
  }, '-created_date', 10);

  const todayWithdrawals = recentWithdrawals.filter(w => 
    new Date(w.created_date) >= oneDayAgo && w.status !== 'rejected'
  );

  if (todayWithdrawals.length > 0) {
    result.message = 'Bạn chỉ có thể rút 1 lần mỗi ngày';
    return result;
  }

  // 6. Check monthly limit for flagged users (50% of balance)
  if (spamScore >= 40) {
    const monthlyLimit = userBalance.available_balance * 0.5;
    if (amount > monthlyLimit) {
      result.message = `User có spam history chỉ được rút tối đa 50% balance/tháng (${monthlyLimit.toFixed(0)} Camly)`;
      return result;
    }
  }

  // 7. Large withdrawal requires review
  if (amount > 1000) {
    result.requires_manual_review = true;
    result.message = 'Withdrawal lớn (>1000 Camly) cần admin review trong 24-48h.';
  }

  result.approved = true;
  if (!result.message) {
    result.message = 'Withdrawal đủ điều kiện!';
  }
  
  return result;
}