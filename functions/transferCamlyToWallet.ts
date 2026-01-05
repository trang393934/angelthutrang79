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

    const { withdrawalRequestId } = await req.json();

    if (!withdrawalRequestId) {
      return Response.json({ error: 'withdrawalRequestId is required' }, { status: 400 });
    }

    // Get withdrawal request
    const request = await base44.asServiceRole.entities.WithdrawalRequest.get(withdrawalRequestId);
    
    if (!request) {
      return Response.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    if (request.status !== 'approved') {
      return Response.json({ error: 'Withdrawal request not approved yet' }, { status: 400 });
    }

    // Get environment variables
    const rpcUrl = Deno.env.get('BSC_RPC_URL');
    const contractAddress = Deno.env.get('CAMLYCOIN_CONTRACT_ADDRESS');
    const privateKey = Deno.env.get('ADMIN_WALLET_PRIVATE_KEY');

    if (!rpcUrl || !contractAddress || !privateKey) {
      return Response.json({ 
        error: 'Missing required environment variables (BSC_RPC_URL, CAMLYCOIN_CONTRACT_ADDRESS, ADMIN_WALLET_PRIVATE_KEY)' 
      }, { status: 500 });
    }

    console.log(`🚀 Processing withdrawal for ${request.user_email}...`);
    console.log(`Amount: ${request.amount.toLocaleString()} Camlycoin`);
    console.log(`To: ${request.withdrawal_address}`);

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);

    // Get token decimals
    const decimals = await contract.decimals();
    console.log(`Token decimals: ${decimals}`);

    // Convert amount to token units (with decimals)
    const amountInTokenUnits = ethers.parseUnits(request.amount.toString(), decimals);
    console.log(`Amount in token units: ${amountInTokenUnits.toString()}`);

    // Check admin wallet balance
    const adminBalance = await contract.balanceOf(wallet.address);
    console.log(`Admin wallet balance: ${ethers.formatUnits(adminBalance, decimals)} Camlycoin`);

    if (adminBalance < amountInTokenUnits) {
      await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequestId, {
        status: 'failed',
        rejection_reason: `Insufficient balance in admin wallet. Required: ${request.amount.toLocaleString()}, Available: ${ethers.formatUnits(adminBalance, decimals)}`
      });

      return Response.json({ 
        success: false,
        error: 'Insufficient balance in admin wallet',
        required: request.amount,
        available: ethers.formatUnits(adminBalance, decimals)
      }, { status: 400 });
    }

    // Update status to processing
    await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequestId, {
      status: 'processing'
    });

    console.log('📤 Sending transaction...');

    // Send transaction
    const tx = await contract.transfer(request.withdrawal_address, amountInTokenUnits);
    
    console.log(`⏳ Transaction sent. Hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Estimate gas fee (in BNB)
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice || tx.gasPrice;
    const gasFeeWei = gasUsed * gasPrice;
    const gasFeeInBNB = parseFloat(ethers.formatEther(gasFeeWei));

    console.log(`⛽ Gas used: ${gasUsed.toString()}`);
    console.log(`💰 Gas fee: ${gasFeeInBNB} BNB`);

    // Update withdrawal request to completed
    await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequestId, {
      status: 'completed',
      tx_hash: tx.hash,
      gas_fee_bnb: gasFeeInBNB,
      processed_by: user.email,
      processed_date: new Date().toISOString()
    });

    // Create transaction log
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: request.user_email,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Rút tiền thành công: ${request.amount.toLocaleString()} Camlycoin\n📬 TX: ${tx.hash}\n⛽ Gas: ${gasFeeInBNB.toFixed(6)} BNB`,
      processed_by: user.email
    });

    // Send email notification to user
    try {
      await base44.integrations.Core.SendEmail({
        to: request.user_email,
        subject: '✅ Rút Camlycoin Thành Công',
        body: `
Chào bạn,

Yêu cầu rút Camlycoin của bạn đã được xử lý thành công! 🎉

💰 Số lượng: ${request.amount.toLocaleString()} Camlycoin
📬 Địa chỉ ví: ${request.withdrawal_address}
🔗 Transaction Hash: ${tx.hash}
⛽ Phí gas: ${gasFeeInBNB.toFixed(6)} BNB

Bạn có thể kiểm tra giao dịch trên BSCScan:
https://bscscan.com/tx/${tx.hash}

Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!

Trân trọng,
Angel AI Team
        `
      });
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return Response.json({
      success: true,
      message: 'Withdrawal processed successfully',
      tx_hash: tx.hash,
      amount: request.amount,
      to: request.withdrawal_address,
      gas_fee_bnb: gasFeeInBNB,
      block_number: receipt.blockNumber
    });

  } catch (error) {
    console.error('Transfer error:', error);
    
    // Try to update withdrawal request to failed
    try {
      const { withdrawalRequestId } = await req.json();
      if (withdrawalRequestId) {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.WithdrawalRequest.update(withdrawalRequestId, {
          status: 'failed',
          rejection_reason: `Transaction failed: ${error.message}`
        });
      }
    } catch (updateError) {
      console.error('Failed to update withdrawal request:', updateError);
    }

    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});