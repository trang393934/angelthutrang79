import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.13.0';

const MIN_WITHDRAWAL_DAILY = 100000;
const MAX_WITHDRAWAL_DAILY = 500000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { withdrawal_address, amount } = await req.json();

    console.log(`🔄 Auto-processing withdrawal for ${user.email}: ${amount} Camlycoin`);

    // Validate amount
    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!withdrawal_address || !withdrawal_address.startsWith('0x')) {
      return Response.json({ error: 'Invalid BEP-20 address' }, { status: 400 });
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Check daily limit
    const dailyLimits = await base44.entities.DailyWithdrawalLimit.filter({
      user_email: user.email,
      date: today
    });

    const todayLimit = dailyLimits[0] || { total_withdrawn_today: 0 };
    const alreadyWithdrawn = todayLimit.total_withdrawn_today || 0;

    // Validate daily limits
    if (amount < MIN_WITHDRAWAL_DAILY) {
      return Response.json({ 
        error: `Số tiền rút tối thiểu là ${MIN_WITHDRAWAL_DAILY.toLocaleString()} Camlycoin/ngày` 
      }, { status: 400 });
    }

    if (alreadyWithdrawn + amount > MAX_WITHDRAWAL_DAILY) {
      return Response.json({ 
        error: `Vượt quá giới hạn rút ${MAX_WITHDRAWAL_DAILY.toLocaleString()} Camlycoin/ngày. Bạn đã rút ${alreadyWithdrawn.toLocaleString()} hôm nay.` 
      }, { status: 400 });
    }

    // Check user balance
    const userBalances = await base44.entities.CamlycoinBalance.filter({
      user_email: user.email
    });

    const balance = userBalances[0];
    if (!balance || (balance.available_balance || 0) < amount) {
      return Response.json({ 
        error: 'Số dư Sẵn Sàng Thanh Toán không đủ' 
      }, { status: 400 });
    }

    // Create withdrawal request (pending at first)
    const withdrawalRequest = await base44.entities.WithdrawalRequest.create({
      user_email: user.email,
      withdrawal_address: withdrawal_address,
      amount: amount,
      status: 'processing',
      verification_status: 'email_verified',
      purity_streak_days: 0
    });

    console.log(`📝 Created withdrawal request: ${withdrawalRequest.id}`);

    // Process blockchain transfer
    try {
      const provider = new ethers.JsonRpcProvider(Deno.env.get('BSC_RPC_URL'));
      const wallet = new ethers.Wallet(Deno.env.get('ADMIN_WALLET_PRIVATE_KEY'), provider);
      
      const contractAddress = Deno.env.get('CAMLYCOIN_CONTRACT_ADDRESS');
      const abi = [
        'function transfer(address to, uint256 amount) public returns (bool)',
        'function decimals() public view returns (uint8)'
      ];
      const contract = new ethers.Contract(contractAddress, abi, wallet);

      // Get decimals and calculate amount
      const decimals = await contract.decimals();
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);

      console.log(`💸 Sending ${amount} Camlycoin to ${withdrawal_address}...`);

      // Send transaction
      const tx = await contract.transfer(withdrawal_address, amountInWei);
      console.log(`⏳ Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed: ${receipt.hash}`);

      // Calculate gas fee
      const gasFeeWei = receipt.gasUsed * receipt.gasPrice;
      const gasFeeInBNB = parseFloat(ethers.formatEther(gasFeeWei));

      // Update withdrawal request to completed
      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequest.id, {
        status: 'completed',
        tx_hash: receipt.hash,
        gas_fee_bnb: gasFeeInBNB,
        processed_by: 'auto-system',
        processed_date: new Date().toISOString()
      });

      // Update user balance - deduct from available_balance, add to paid_amount
      await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
        available_balance: (balance.available_balance || 0) - amount,
        paid_amount: (balance.paid_amount || 0) + amount
      });

      // Create transaction record
      await base44.asServiceRole.entities.CamlycoinTransaction.create({
        user_email: user.email,
        amount: 0,
        type: 'admin_adjustment',
        description: `✅ Rút tiền tự động thành công: ${amount.toLocaleString()} Camlycoin\n📬 TX: ${receipt.hash}\n⛽ Gas: ${gasFeeInBNB.toFixed(8)} BNB`,
        processed_by: 'auto-system'
      });

      // Update daily limit
      if (dailyLimits.length > 0) {
        await base44.asServiceRole.entities.DailyWithdrawalLimit.update(dailyLimits[0].id, {
          total_withdrawn_today: alreadyWithdrawn + amount,
          withdrawal_count: (dailyLimits[0].withdrawal_count || 0) + 1
        });
      } else {
        await base44.asServiceRole.entities.DailyWithdrawalLimit.create({
          user_email: user.email,
          date: today,
          total_withdrawn_today: amount,
          withdrawal_count: 1
        });
      }

      // Send notification email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: '✅ Rút Camlycoin Thành Công - Angel AI',
        body: `Chào ${user.full_name || user.email},

✅ Yêu cầu rút tiền của bạn đã được xử lý thành công!

💰 Số tiền: ${amount.toLocaleString()} Camlycoin
📬 Địa chỉ ví: ${withdrawal_address}
🔗 Transaction Hash: ${receipt.hash}
⛽ Phí Gas: ${gasFeeInBNB.toFixed(8)} BNB

Bạn có thể kiểm tra giao dịch tại: https://bscscan.com/tx/${receipt.hash}

Tiền đã được chuyển vào ví BEP-20 của bạn.

---
Angel AI - Ánh Sáng Của Cha Vũ Trụ
${new Date().toLocaleString('vi-VN')}`
      }).catch(err => console.log('Email notification failed:', err));

      console.log(`✅ Auto-withdrawal completed for ${user.email}`);

      return Response.json({
        success: true,
        message: 'Rút tiền tự động thành công',
        tx_hash: receipt.hash,
        gas_fee_bnb: gasFeeInBNB,
        amount_withdrawn: amount
      });

    } catch (blockchainError) {
      console.error('❌ Blockchain error:', blockchainError);

      // Update withdrawal to failed
      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequest.id, {
        status: 'failed',
        rejection_reason: `Lỗi blockchain: ${blockchainError.message}`
      });

      return Response.json({ 
        error: 'Lỗi khi chuyển tiền trên blockchain. Vui lòng thử lại sau.',
        details: blockchainError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});