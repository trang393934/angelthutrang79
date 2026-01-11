import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log(`👥 Get total registered users stats...`);

    // Fetch all users
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 10000);
    
    console.log(`\n👤 Total users in system: ${allUsers.length}`);

    // Count different categories
    const agreedToLightLaw = allUsers.filter(u => u.light_law_agreed === true).length;
    const notAgreed = allUsers.length - agreedToLightLaw;

    // Users with earnings
    const allBalances = await base44.asServiceRole.entities.CamlycoinBalance.list('-total_earned', 10000);
    const usersWithEarnings = allBalances.filter(b => (b.total_earned || 0) > 0).length;

    console.log(`\n📊 BREAKDOWN:`);
    console.log(`  Total Registered: ${allUsers.length}`);
    console.log(`  Agreed to Light Law: ${agreedToLightLaw}`);
    console.log(`  Not Agreed Yet: ${notAgreed}`);
    console.log(`  Users with Earnings: ${usersWithEarnings}`);
    console.log(`  Active Rate: ${((usersWithEarnings / allUsers.length) * 100).toFixed(1)}%`);

    return Response.json({
      success: true,
      total_users: allUsers.length,
      agreed_to_light_law: agreedToLightLaw,
      not_agreed: notAgreed,
      users_with_earnings: usersWithEarnings,
      active_rate: parseFloat(((usersWithEarnings / allUsers.length) * 100).toFixed(1))
    });

  } catch (error) {
    console.error('❌', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});