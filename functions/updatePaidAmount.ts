import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Chỉ cho phép admin truy cập chức năng này
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userEmail, amount } = await req.json();

    if (!userEmail || typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'userEmail và amount hợp lệ là bắt buộc' }, { status: 400 });
    }

    // Lấy thông tin số dư hiện tại của người dùng
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter({ user_email: userEmail });
    let userBalance = balances[0];

    if (!userBalance) {
      return Response.json({ error: `Không tìm thấy số dư Camlycoin cho người dùng: ${userEmail}` }, { status: 404 });
    }

    const newPaidAmount = (userBalance.paid_amount || 0) + amount;
    const newBalance = (userBalance.balance || 0) - amount;

    // Cập nhật CamlycoinBalance
    await base44.asServiceRole.entities.CamlycoinBalance.update(userBalance.id, {
      paid_amount: newPaidAmount,
      balance: newBalance
    });

    // Tạo giao dịch lịch sử
    await base44.asServiceRole.entities.CamlycoinTransaction.create({
      user_email: userEmail,
      amount: 0,
      type: 'admin_adjustment',
      description: `✅ Admin đã ghi nhận ${amount.toLocaleString()} Camlycoin đã thanh toán`,
      processed_by: user.email
    });

    return Response.json({ 
      success: true, 
      message: 'Đã cập nhật số Camlycoin đã thanh toán thành công.',
      newPaidAmount,
      newBalance
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật số Camlycoin đã thanh toán:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});