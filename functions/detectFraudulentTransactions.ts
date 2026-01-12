import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Bắt đầu phát hiện gian lận tự động...');

    // Lấy tất cả transactions
    const allTransactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({});
    console.log(`📊 Tổng số transactions: ${allTransactions.length}`);

    // Lấy tất cả audit logs
    const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({});
    console.log(`📝 Tổng số audit logs: ${allLogs.length}`);

    // Lấy tất cả balances
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.filter({});

    // Phân tích theo từng user
    const userAnalysis = {};
    const fraudAlerts = [];

    // Group transactions by user
    allTransactions.forEach(tx => {
      if (!userAnalysis[tx.user_email]) {
        userAnalysis[tx.user_email] = {
          email: tx.user_email,
          transactions: [],
          manual_adds: [],
          suspicious_manual_adds: [],
          total_income: 0,
          total_manual_add: 0
        };
      }

      userAnalysis[tx.user_email].transactions.push(tx);
      
      if (tx.amount > 0) {
        userAnalysis[tx.user_email].total_income += tx.amount;
      }

      if (tx.type === 'manual_add') {
        userAnalysis[tx.user_email].manual_adds.push(tx);
        userAnalysis[tx.user_email].total_manual_add += tx.amount;

        // Phát hiện: Tự thêm cho mình
        if (tx.created_by === tx.user_email && (!tx.processed_by || tx.processed_by === tx.user_email)) {
          userAnalysis[tx.user_email].suspicious_manual_adds.push(tx);
        }
      }
    });

    // Phân tích từng user
    for (const [email, data] of Object.entries(userAnalysis)) {
      const issues = [];
      let riskScore = 0;

      // 1. Kiểm tra số lượng manual_add bất thường
      if (data.manual_adds.length > 20) {
        issues.push(`⚠️ Có ${data.manual_adds.length} giao dịch manual_add`);
        riskScore += data.manual_adds.length;
      }

      // 2. Kiểm tra tự thêm coins cho mình
      if (data.suspicious_manual_adds.length > 0) {
        issues.push(`❌ Có ${data.suspicious_manual_adds.length} giao dịch TỰ THÊM cho mình`);
        riskScore += data.suspicious_manual_adds.length * 10;
      }

      // 3. Kiểm tra giá trị bất thường
      const avgManualAdd = data.total_manual_add / (data.manual_adds.length || 1);
      if (avgManualAdd > 5000) {
        issues.push(`💰 Giá trị trung bình manual_add cao: ${Math.round(avgManualAdd)} coins`);
        riskScore += 5;
      }

      // 4. Kiểm tra tần suất
      const manualAddsByDate = {};
      data.manual_adds.forEach(tx => {
        const date = tx.created_date.split('T')[0];
        if (!manualAddsByDate[date]) manualAddsByDate[date] = [];
        manualAddsByDate[date].push(tx);
      });

      const maxPerDay = Math.max(...Object.values(manualAddsByDate).map(arr => arr.length));
      if (maxPerDay > 10) {
        issues.push(`⏰ Có ngày thực hiện ${maxPerDay} giao dịch manual_add`);
        riskScore += maxPerDay;
      }

      // 5. So sánh với audit logs
      const userLogs = allLogs.filter(log => log.user_email === email);
      const calculatedEarned = userLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
      const balance = allBalances.find(b => b.user_email === email);
      
      if (balance && balance.total_earned < calculatedEarned) {
        issues.push(`📉 Balance total_earned (${balance.total_earned}) thấp hơn calculated (${calculatedEarned})`);
        riskScore += 20;
      }

      // 6. Kiểm tra manual_add cao hơn earned từ logs
      if (data.total_manual_add > calculatedEarned * 2) {
        issues.push(`🚨 Manual_add (${data.total_manual_add}) cao gấp đôi earned từ logs (${calculatedEarned})`);
        riskScore += 50;
      }

      // Nếu có vấn đề, thêm vào danh sách cảnh báo
      if (issues.length > 0 && riskScore > 20) {
        fraudAlerts.push({
          email,
          risk_score: riskScore,
          risk_level: riskScore > 100 ? 'CRITICAL' : riskScore > 50 ? 'HIGH' : 'MEDIUM',
          issues,
          stats: {
            total_transactions: data.transactions.length,
            total_manual_adds: data.manual_adds.length,
            suspicious_manual_adds: data.suspicious_manual_adds.length,
            total_manual_add_amount: data.total_manual_add,
            calculated_from_logs: calculatedEarned,
            current_balance: balance?.total_earned || 0
          },
          suspicious_transactions: data.suspicious_manual_adds.slice(0, 5) // Lấy 5 giao dịch đầu làm mẫu
        });
      }
    }

    // Sắp xếp theo risk score
    fraudAlerts.sort((a, b) => b.risk_score - a.risk_score);

    console.log(`\n🚨 KẾT QUẢ PHÁT HIỆN GIAN LẬN:`);
    console.log(`❌ CRITICAL: ${fraudAlerts.filter(a => a.risk_level === 'CRITICAL').length}`);
    console.log(`⚠️ HIGH: ${fraudAlerts.filter(a => a.risk_level === 'HIGH').length}`);
    console.log(`⚡ MEDIUM: ${fraudAlerts.filter(a => a.risk_level === 'MEDIUM').length}`);

    // Tạo admin alerts cho các trường hợp nghiêm trọng
    const criticalAlerts = fraudAlerts.filter(a => a.risk_level === 'CRITICAL');
    for (const alert of criticalAlerts.slice(0, 5)) { // Chỉ tạo alert cho 5 trường hợp nghiêm trọng nhất
      await base44.asServiceRole.entities.AdminAlert.create({
        alert_type: 'fraud_detection',
        severity: 'critical',
        title: `Phát hiện gian lận: ${alert.email}`,
        message: `User có ${alert.stats.suspicious_manual_adds} giao dịch tự thêm coins, risk score: ${alert.risk_score}. ${alert.issues.join(', ')}`,
        user_email: alert.email,
        data: alert.stats,
        status: 'new'
      });
    }

    return Response.json({
      success: true,
      summary: {
        total_users_analyzed: Object.keys(userAnalysis).length,
        fraud_alerts: fraudAlerts.length,
        critical: fraudAlerts.filter(a => a.risk_level === 'CRITICAL').length,
        high: fraudAlerts.filter(a => a.risk_level === 'HIGH').length,
        medium: fraudAlerts.filter(a => a.risk_level === 'MEDIUM').length,
        admin_alerts_created: Math.min(criticalAlerts.length, 5)
      },
      fraud_alerts: fraudAlerts,
      top_10_risky: fraudAlerts.slice(0, 10)
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});