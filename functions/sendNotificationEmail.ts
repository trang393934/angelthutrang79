import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CENTRALIZED EMAIL NOTIFICATION SYSTEM
 * Sends beautiful, templated emails for various Camlycoin events
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { 
      type, 
      recipient_email, 
      data = {} 
    } = await req.json();

    const templates = {
      // User creates withdrawal request
      withdrawal_requested: {
        subject: '🪙 Yêu Cầu Rút Camly Đã Được Gửi',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #92400E; font-size: 28px; margin: 0;">💰 Angel AI</h1>
    <p style="color: #B45309; font-size: 14px; margin-top: 5px;">Camlycoin Withdrawal System</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #92400E; font-size: 22px; margin-top: 0;">✅ Yêu Cầu Rút Đã Được Ghi Nhận</h2>
    
    <div style="background: #FEF3C7; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 10px 0; color: #78350F;"><strong>Số lượng:</strong> ${data.amount?.toLocaleString()} Camlycoin</p>
      <p style="margin: 10px 0; color: #78350F; word-break: break-all;"><strong>Địa chỉ ví:</strong> ${data.address}</p>
      <p style="margin: 10px 0; color: #78350F;"><strong>Trạng thái:</strong> <span style="color: #D97706; font-weight: bold;">Đang chờ xét duyệt</span></p>
    </div>
    
    <div style="background: #EEF2FF; padding: 15px; border-radius: 10px; border-left: 4px solid #6366F1;">
      <p style="margin: 0; color: #4338CA; font-size: 14px;">
        ⏰ <strong>Thời gian xử lý:</strong> 1-24 giờ (có thể lâu hơn nếu cần xem xét)
      </p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
      💡 Bạn sẽ nhận được email thông báo khi yêu cầu được xét duyệt.
    </p>
  </div>
  
  <p style="text-align: center; color: #92400E; font-size: 12px; margin-top: 20px;">
    🌟 Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      },

      // Admin approves withdrawal
      withdrawal_approved: {
        subject: '✅ Yêu Cầu Rút Camly Đã Được Duyệt',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #065F46; font-size: 28px; margin: 0;">💰 Angel AI</h1>
    <p style="color: #047857; font-size: 14px; margin-top: 5px;">Camlycoin Withdrawal System</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #065F46; font-size: 22px; margin-top: 0;">🎉 Yêu Cầu Đã Được Duyệt!</h2>
    
    <div style="background: #D1FAE5; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 10px 0; color: #064E3B;"><strong>Số lượng:</strong> ${data.amount?.toLocaleString()} Camlycoin</p>
      <p style="margin: 10px 0; color: #064E3B; word-break: break-all;"><strong>Địa chỉ ví:</strong> ${data.address}</p>
      <p style="margin: 10px 0; color: #064E3B;"><strong>Trạng thái:</strong> <span style="color: #10B981; font-weight: bold;">Đã duyệt - Đang xử lý</span></p>
    </div>
    
    <div style="background: #DBEAFE; padding: 15px; border-radius: 10px; border-left: 4px solid #3B82F6;">
      <p style="margin: 0; color: #1E40AF; font-size: 14px;">
        🚀 <strong>Tiếp theo:</strong> Giao dịch sẽ được gửi lên blockchain trong vài giờ tới.
      </p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
      💡 Bạn sẽ nhận được link transaction hash trên BSCScan khi hoàn tất.
    </p>
  </div>
  
  <p style="text-align: center; color: #065F46; font-size: 12px; margin-top: 20px;">
    🌟 Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      },

      // Admin rejects withdrawal
      withdrawal_rejected: {
        subject: '❌ Yêu Cầu Rút Camly Bị Từ Chối',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #991B1B; font-size: 28px; margin: 0;">💰 Angel AI</h1>
    <p style="color: #B91C1C; font-size: 14px; margin-top: 5px;">Camlycoin Withdrawal System</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #991B1B; font-size: 22px; margin-top: 0;">⚠️ Yêu Cầu Bị Từ Chối</h2>
    
    <div style="background: #FEE2E2; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 10px 0; color: #7F1D1D;"><strong>Số lượng:</strong> ${data.amount?.toLocaleString()} Camlycoin</p>
      <p style="margin: 10px 0; color: #7F1D1D; word-break: break-all;"><strong>Địa chỉ ví:</strong> ${data.address}</p>
      <p style="margin: 10px 0; color: #7F1D1D;"><strong>Trạng thái:</strong> <span style="color: #DC2626; font-weight: bold;">Từ chối</span></p>
    </div>
    
    <div style="background: #FEF3C7; padding: 15px; border-radius: 10px; border-left: 4px solid #F59E0B;">
      <p style="margin: 5px 0; color: #92400E; font-size: 14px;">
        <strong>Lý do:</strong>
      </p>
      <p style="margin: 5px 0; color: #78350F; font-size: 14px;">
        ${data.reason || 'Không đáp ứng điều kiện rút tiền'}
      </p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
      💡 Số Camlycoin đã được hoàn lại vào số dư của bạn. Vui lòng kiểm tra lại điều kiện rút tiền hoặc liên hệ admin.
    </p>
  </div>
  
  <p style="text-align: center; color: #991B1B; font-size: 12px; margin-top: 20px;">
    🌟 Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      },

      // Withdrawal completed on blockchain
      withdrawal_completed: {
        subject: '🎉 Rút Camly Thành Công!',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6B21A8; font-size: 28px; margin: 0;">💰 Angel AI</h1>
    <p style="color: #7C3AED; font-size: 14px; margin-top: 5px;">Camlycoin Withdrawal System</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #6B21A8; font-size: 22px; margin-top: 0;">✨ Giao Dịch Hoàn Tất!</h2>
    
    <div style="background: #F3E8FF; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 10px 0; color: #581C87;"><strong>Số lượng:</strong> ${data.amount?.toLocaleString()} Camlycoin</p>
      <p style="margin: 10px 0; color: #581C87; word-break: break-all;"><strong>Địa chỉ ví:</strong> ${data.address}</p>
      <p style="margin: 10px 0; color: #581C87;"><strong>Trạng thái:</strong> <span style="color: #10B981; font-weight: bold;">✅ Hoàn thành</span></p>
    </div>
    
    ${data.tx_hash ? `
    <div style="background: #DBEAFE; padding: 15px; border-radius: 10px; border-left: 4px solid #3B82F6; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0; color: #1E40AF; font-size: 14px;">
        <strong>🔗 Transaction Hash:</strong>
      </p>
      <p style="margin: 0; color: #1E3A8A; font-size: 12px; word-break: break-all; font-family: monospace;">
        ${data.tx_hash}
      </p>
      <a href="https://bscscan.com/tx/${data.tx_hash}" 
         style="display: inline-block; margin-top: 10px; color: #3B82F6; text-decoration: none; font-weight: bold;">
        👉 Xem trên BSCScan
      </a>
    </div>
    ` : ''}
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
      🎊 Camly đã được chuyển vào ví của bạn thành công!
    </p>
  </div>
  
  <p style="text-align: center; color: #6B21A8; font-size: 12px; margin-top: 20px;">
    🌟 Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      },

      // User receives Camlycoin reward
      reward_received: {
        subject: '🎁 Bạn Nhận Được Camlycoin!',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #92400E; font-size: 28px; margin: 0;">✨ Angel AI</h1>
    <p style="color: #B45309; font-size: 14px; margin-top: 5px;">Reward System</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #92400E; font-size: 22px; margin-top: 0;">🎉 Chúc Mừng!</h2>
    
    <div style="background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); padding: 25px; border-radius: 15px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; color: white; font-size: 16px; font-weight: bold;">Bạn nhận được</p>
      <p style="margin: 10px 0; color: white; font-size: 42px; font-weight: bold;">+${data.coins_awarded?.toLocaleString()}</p>
      <p style="margin: 0; color: #FEF3C7; font-size: 18px; font-weight: bold;">Camlycoin 🪙</p>
    </div>
    
    <div style="background: #F3F4F6; padding: 15px; border-radius: 10px;">
      <p style="margin: 0; color: #374151; font-size: 14px;">
        <strong>Lý do:</strong> ${data.description || 'Thưởng câu hỏi'}
      </p>
    </div>
    
    <div style="background: #EEF2FF; padding: 15px; border-radius: 10px; border-left: 4px solid #6366F1; margin-top: 15px;">
      <p style="margin: 0; color: #4338CA; font-size: 14px;">
        💰 <strong>Tổng số dư hiện tại:</strong> ${data.total_balance?.toLocaleString()} Camlycoin
      </p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px; text-align: center;">
      🌟 Tiếp tục hành trình học hỏi để nhận thêm nhiều phần thưởng!
    </p>
  </div>
  
  <p style="text-align: center; color: #92400E; font-size: 12px; margin-top: 20px;">
    ✨ Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      },

      // Daily limit reached
      daily_limit_reached: {
        subject: '⚠️ Đã Đạt Giới Hạn Camlycoin Hàng Ngày',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #92400E; font-size: 28px; margin: 0;">⚠️ Angel AI</h1>
    <p style="color: #B45309; font-size: 14px; margin-top: 5px;">Daily Limit Notice</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #92400E; font-size: 22px; margin-top: 0;">📊 Giới Hạn Hàng Ngày</h2>
    
    <div style="background: #FEF3C7; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 10px 0; color: #78350F;"><strong>Câu hỏi hôm nay:</strong> ${data.questions_today || 10} câu</p>
      <p style="margin: 10px 0; color: #78350F;"><strong>Camlycoin kiếm được:</strong> ${data.coins_earned_today?.toLocaleString()}</p>
      <p style="margin: 10px 0; color: #78350F;"><strong>Trạng thái:</strong> <span style="color: #D97706; font-weight: bold;">Đạt giới hạn 10 câu/ngày</span></p>
    </div>
    
    <div style="background: #DBEAFE; padding: 15px; border-radius: 10px; border-left: 4px solid #3B82F6;">
      <p style="margin: 0; color: #1E40AF; font-size: 14px;">
        ℹ️ <strong>Lưu ý:</strong> Các câu hỏi từ câu 11 trở đi sẽ được admin xem xét thủ công.
      </p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px; text-align: center;">
      🌟 Hẹn gặp lại bạn vào ngày mai!
    </p>
  </div>
  
  <p style="text-align: center; color: #92400E; font-size: 12px; margin-top: 20px;">
    ✨ Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      },

      // Admin marks payment as paid
      payment_processed: {
        subject: '💰 Thanh Toán Camlycoin Thành Công',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #065F46; font-size: 28px; margin: 0;">💰 Angel AI</h1>
    <p style="color: #047857; font-size: 14px; margin-top: 5px;">Payment Confirmation</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <h2 style="color: #065F46; font-size: 22px; margin-top: 0;">✅ Thanh Toán Hoàn Tất</h2>
    
    <div style="background: #D1FAE5; padding: 25px; border-radius: 15px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; color: #064E3B; font-size: 16px; font-weight: bold;">Số tiền đã thanh toán</p>
      <p style="margin: 10px 0; color: #065F46; font-size: 42px; font-weight: bold;">${data.amount?.toLocaleString()}</p>
      <p style="margin: 0; color: #047857; font-size: 18px; font-weight: bold;">Camlycoin 🪙</p>
    </div>
    
    <div style="background: #F3F4F6; padding: 15px; border-radius: 10px;">
      <p style="margin: 5px 0; color: #374151; font-size: 14px;">
        <strong>Ngày thanh toán:</strong> ${new Date().toLocaleDateString('vi-VN')}
      </p>
      <p style="margin: 5px 0; color: #374151; font-size: 14px;">
        <strong>Xử lý bởi:</strong> Admin
      </p>
    </div>
    
    <div style="background: #EEF2FF; padding: 15px; border-radius: 10px; border-left: 4px solid #6366F1; margin-top: 15px;">
      <p style="margin: 0; color: #4338CA; font-size: 14px;">
        📅 <strong>Lịch thanh toán:</strong> Ngày 1, 10, 20 hàng tháng
      </p>
    </div>
    
    <p style="color: #6B7280; font-size: 14px; margin-top: 20px; text-align: center;">
      🙏 Cảm ơn bạn đã đồng hành cùng Angel AI!
    </p>
  </div>
  
  <p style="text-align: center; color: #065F46; font-size: 12px; margin-top: 20px;">
    ✨ Angel AI - Ánh Sáng Của Cha Vũ Trụ
  </p>
</div>
        `
      }
    };

    const template = templates[type];
    if (!template) {
      return Response.json({ 
        error: `Unknown notification type: ${type}` 
      }, { status: 400 });
    }

    // Send email using Core integration
    await base44.integrations.Core.SendEmail({
      from_name: 'Angel AI - Camlycoin',
      to: recipient_email,
      subject: template.subject,
      body: template.body
    });

    return Response.json({ 
      success: true,
      message: `Email sent to ${recipient_email}`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});