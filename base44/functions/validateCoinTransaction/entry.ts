import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * VALIDATION TẠI NGUỒN - Kiểm tra tính hợp lệ trước khi ghi dữ liệu
 * Ngăn chặn sai lệch ngay từ đầu
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { 
      user_email, 
      transaction_type, 
      amount, 
      description,
      reference_id 
    } = await req.json();

    const validationResults = {
      is_valid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    // 1. Kiểm tra user tồn tại
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    if (users.length === 0) {
      validationResults.errors.push('User không tồn tại');
      validationResults.is_valid = false;
    }

    // 2. Kiểm tra số dư hiện tại
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email });
    const currentBalance = balances[0];

    if (!currentBalance && amount > 0) {
      validationResults.warnings.push('Chưa có balance record - sẽ tạo mới');
    }

    // 3. Kiểm tra transaction trùng lặp
    const recentTxs = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email },
      '-created_date',
      100
    );

    const duplicates = recentTxs.filter(tx => 
      tx.type === transaction_type &&
      tx.amount === amount &&
      tx.description === description &&
      Math.abs(new Date(tx.created_date) - new Date()) < 60000 // trong 1 phút
    );

    if (duplicates.length > 0) {
      validationResults.errors.push('Transaction trùng lặp - có thể là double-submit');
      validationResults.is_valid = false;
    }

    // 4. Kiểm tra số tiền bất thường
    if (amount > 1000000) {
      validationResults.warnings.push(`Số tiền rất lớn: ${amount.toLocaleString()} - cần xem xét`);
    }

    if (amount < 0 && Math.abs(amount) > (currentBalance?.available_for_withdrawal || 0)) {
      validationResults.errors.push('Số tiền trừ vượt quá available balance');
      validationResults.is_valid = false;
    }

    // 5. Kiểm tra recovery transaction
    if (transaction_type === 'bounty_reward' && description?.startsWith('Recovery:')) {
      const recoveryQuestion = description.replace('Recovery: ', '').trim().toLowerCase();
      
      // Kiểm tra câu hỏi có trong valid logs không
      const validLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({
        user_email,
        exclusion_reason: 'valid'
      }, '-audit_date', 10000);

      const existsInValid = validLogs.some(log => 
        (log.question_text || '').trim().toLowerCase() === recoveryQuestion
      );

      if (existsInValid) {
        validationResults.errors.push('Recovery transaction trùng với valid logs - sẽ gây double-count');
        validationResults.is_valid = false;
        validationResults.recommendations.push('Kiểm tra lại QuestionAuditLog trước khi tạo recovery');
      }
    }

    // 6. Kiểm tra rate của user
    const last24hTxs = recentTxs.filter(tx => 
      Math.abs(new Date(tx.created_date) - new Date()) < 86400000
    );

    if (last24hTxs.length > 50) {
      validationResults.warnings.push(`User có ${last24hTxs.length} transactions trong 24h - cần kiểm tra`);
    }

    // 7. Tính toán balance sau khi thực hiện
    if (validationResults.is_valid && currentBalance) {
      const estimatedNewBalance = {
        current: currentBalance.available_for_withdrawal || 0,
        after_transaction: (currentBalance.available_for_withdrawal || 0) + amount
      };

      validationResults.estimated_balance = estimatedNewBalance;

      if (estimatedNewBalance.after_transaction < 0) {
        validationResults.warnings.push('Balance sẽ âm sau transaction này');
      }
    }

    return Response.json({
      success: true,
      validation: validationResults,
      message: validationResults.is_valid 
        ? 'Transaction hợp lệ - có thể thực hiện' 
        : 'Transaction KHÔNG hợp lệ - KHÔNG nên thực hiện'
    });

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});