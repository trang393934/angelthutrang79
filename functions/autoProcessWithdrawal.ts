import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.7.1';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🤖 Auto Process Withdrawal Started...');

    // Get all pending withdrawal requests
    const pendingWithdrawals = await base44.asServiceRole.entities.WithdrawalRequest.filter({
      status: 'pending'
    });

    console.log(`Found ${pendingWithdrawals.length} pending withdrawals`);

    const results = {
      autoApproved: 0,
      autoTransferred: 0,
      manualReviewRequired: 0,
      errors: []
    };

    for (const withdrawal of pendingWithdrawals) {
      try {
        console.log(`\n📋 Processing ${withdrawal.user_email}: ${withdrawal.amount.toLocaleString()} Camlycoin`);

        // Check auto-approval criteria
        const amount = withdrawal.amount;
        const riskLevel = withdrawal.risk_level || 'medium';
        const requiresManualReview = withdrawal.requires_manual_review || false;

        // Auto-approve conditions:
        // 1. Amount between 100,000 and 500,000
        // 2. Risk level is 'low'
        // 3. Does not require manual review
        const canAutoApprove = amount >= 100000 && 
                              amount <= 500000 && 
                              riskLevel === 'low' && 
                              !requiresManualReview;

        if (!canAutoApprove) {
          console.log(`⏸️ Manual review required: amount=${amount}, risk=${riskLevel}, manual=${requiresManualReview}`);
          results.manualReviewRequired++;
          continue;
        }

        // Auto-approve
        console.log('✅ Auto-approving...');
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'approved',
          processed_by: 'auto-system',
          processed_date: new Date().toISOString()
        });
        results.autoApproved++;

        // Auto-transfer
        console.log('💸 Auto-transferring...');
        
        // Get environment variables
        const rpcUrl = Deno.env.get('BSC_RPC_URL');
        const contractAddress = Deno.env.get('CAMLYCOIN_CONTRACT_ADDRESS');
        const privateKey = Deno.env.get('ADMIN_WALLET_PRIVATE_KEY');

        if (!rpcUrl || !contractAddress || !privateKey) {
          throw new Error('Missing blockchain configuration');
        }

        // Connect to BSC
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);

        // Get token decimals
        const decimals = await contract.decimals();
        const amountInTokenUnits = ethers.parseUnits(amount.toString(), decimals);

        // Check admin wallet balance
        const adminBalance = await contract.balanceOf(wallet.address);
        if (adminBalance < amountInTokenUnits) {
          throw new Error('Insufficient admin wallet balance');
        }

        // Update to processing
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'processing'
        });

        // Send transaction
        const tx = await contract.transfer(withdrawal.withdrawal_address, amountInTokenUnits);
        console.log(`⏳ TX sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`✅ TX confirmed: block ${receipt.blockNumber}`);

        // Calculate gas fee
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const gasFeeWei = gasUsed * gasPrice;
        const gasFeeInBNB = parseFloat(ethers.formatEther(gasFeeWei));

        // Update to completed
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'completed',
          tx_hash: tx.hash,
          gas_fee_bnb: gasFeeInBNB,
          processed_date: new Date().toISOString()
        });

        // Create transaction log
        await base44.asServiceRole.entities.CamlycoinTransaction.create({
          user_email: withdrawal.user_email,
          amount: 0,
          type: 'admin_adjustment',
          description: `🤖 Auto-Withdrawal: ${amount.toLocaleString()} Camlycoin\n📬 TX: ${tx.hash}\n⛽ Gas: ${gasFeeInBNB.toFixed(6)} BNB`,
          processed_by: 'auto-system'
        });

        // Send success email
        try {
          await base44.integrations.Core.SendEmail({
            to: withdrawal.user_email,
            subject: '✅ Rút Camlycoin Thành Công (Tự Động)',
            body: `
Chào bạn,

Yêu cầu rút Camlycoin của bạn đã được xử lý TỰ ĐỘNG thành công! 🎉🤖

💰 Số lượng: ${amount.toLocaleString()} Camlycoin
📬 Địa chỉ ví: ${withdrawal.withdrawal_address}
🔗 Transaction Hash: ${tx.hash}
⛽ Phí gas: ${gasFeeInBNB.toFixed(6)} BNB

✅ Trạng thái: Tự động phê duyệt và chuyển tiền (Low Risk)

Kiểm tra giao dịch trên BSCScan:
https://bscscan.com/tx/${tx.hash}

Cảm ơn bạn đã tin tưởng sử dụng dịch vụ!

Trân trọng,
Angel AI Team
            `
          });
        } catch (emailError) {
          console.error('Email notification failed:', emailError);
        }

        results.autoTransferred++;
        console.log(`✅ Successfully processed ${withdrawal.user_email}`);

      } catch (error) {
        console.error(`❌ Error processing ${withdrawal.user_email}:`, error);
        
        // Update withdrawal to failed
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawal.id, {
          status: 'failed',
          rejection_reason: `Auto-process failed: ${error.message}`
        });

        // Send failure email
        try {
          await base44.integrations.Core.SendEmail({
            to: withdrawal.user_email,
            subject: '❌ Rút Camlycoin Thất Bại',
            body: `
Chào bạn,

Yêu cầu rút Camlycoin của bạn đã gặp lỗi khi xử lý tự động.

💰 Số lượng: ${withdrawal.amount.toLocaleString()} Camlycoin
📬 Địa chỉ ví: ${withdrawal.withdrawal_address}
❌ Lý do: ${error.message}

Vui lòng liên hệ admin để được hỗ trợ.

Trân trọng,
Angel AI Team
            `
          });
        } catch (emailError) {
          console.error('Failure email notification failed:', emailError);
        }

        results.errors.push({
          user: withdrawal.user_email,
          error: error.message
        });
      }
    }

    console.log('\n📊 Auto Process Summary:');
    console.log(`✅ Auto-approved: ${results.autoApproved}`);
    console.log(`💸 Auto-transferred: ${results.autoTransferred}`);
    console.log(`⏸️ Manual review: ${results.manualReviewRequired}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Auto process error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});