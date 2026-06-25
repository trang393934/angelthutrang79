import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('🔍 Auditing frozen coins in detail...');

    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 50000);
    
    const auditResults = [];
    let totalExpectedFrozen = 0;
    let totalActualFrozen = 0;
    let discrepancyCount = 0;
    let majorDiscrepancies = [];

    for (const balance of allBalances) {
      try {
        const userEmail = balance.user_email;
        
        // Lấy tất cả audit logs để tính frozen
        const allLogs = await base44.asServiceRole.entities.QuestionAuditLog.filter({ 
          user_email: userEmail 
        });

        // Tính frozen từ các câu bị reject (không phải "valid")
        const frozenLogs = allLogs.filter(log => log.exclusion_reason !== 'valid');
        const expectedFrozen = frozenLogs.reduce((sum, log) => sum + (log.coins_earned || 0), 0);
        
        const actualFrozen = balance.frozen_balance || 0;
        const difference = expectedFrozen - actualFrozen;

        if (Math.abs(difference) > 0) {
          discrepancyCount++;

          const result = {
            email: userEmail,
            expected_frozen: expectedFrozen,
            actual_frozen: actualFrozen,
            difference: difference,
            frozen_question_count: frozenLogs.length,
            breakdown: {
              duplicate: frozenLogs.filter(l => l.exclusion_reason === 'duplicate').length,
              greeting: frozenLogs.filter(l => l.exclusion_reason === 'greeting').length,
              exceeds_daily_limit: frozenLogs.filter(l => l.exclusion_reason === 'exceeds_daily_limit').length,
              low_quality: frozenLogs.filter(l => l.exclusion_reason === 'low_quality').length,
              spam: frozenLogs.filter(l => l.exclusion_reason === 'spam').length
            }
          };

          auditResults.push(result);
          totalExpectedFrozen += expectedFrozen;
          totalActualFrozen += actualFrozen;

          // Ghi nhận discrepancies lớn (> 100 coins)
          if (Math.abs(difference) > 100) {
            majorDiscrepancies.push({
              email: userEmail,
              difference: difference,
              missing_coins: difference > 0 ? difference : 0,
              extra_coins: difference < 0 ? Math.abs(difference) : 0
            });
          }
        }
      } catch (error) {
        console.error(`Error auditing ${balance.user_email}:`, error.message);
      }
    }

    majorDiscrepancies.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    console.log(`\n📊 FROZEN COINS AUDIT SUMMARY:`);
    console.log(`Total Expected Frozen: ${totalExpectedFrozen.toLocaleString()}`);
    console.log(`Total Actual Frozen: ${totalActualFrozen.toLocaleString()}`);
    console.log(`Total Discrepancy: ${(totalExpectedFrozen - totalActualFrozen).toLocaleString()} coins`);
    console.log(`Users with discrepancies: ${discrepancyCount}`);
    console.log(`Major discrepancies (>100): ${majorDiscrepancies.length}`);

    return Response.json({
      success: true,
      summary: {
        total_expected_frozen: totalExpectedFrozen,
        total_actual_frozen: totalActualFrozen,
        system_discrepancy: totalExpectedFrozen - totalActualFrozen,
        users_with_discrepancies: discrepancyCount,
        major_discrepancies_count: majorDiscrepancies.length
      },
      top_major_discrepancies: majorDiscrepancies.slice(0, 20),
      detailed_audit: auditResults.slice(0, 100)
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});