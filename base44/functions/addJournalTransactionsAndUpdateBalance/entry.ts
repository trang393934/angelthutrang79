import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'Missing target_email' }, { status: 400 });
    }

    console.log(`\n💚 THÊM TRANSACTIONS CHO GRATITUDE JOURNALS: ${target_email}`);

    // Lấy tất cả journals chưa có transaction
    const journals = await base44.asServiceRole.entities.GratitudeJournal.filter(
      { user_email: target_email },
      '-created_date',
      100
    );

    console.log(`\n📝 Tìm thấy ${journals.length} journals`);

    // Lấy tất cả transactions hiện có
    const existingTx = await base44.asServiceRole.entities.CamlycoinTransaction.filter(
      { user_email: target_email },
      '-created_date',
      1000
    );

    // Tìm journals chưa có transaction
    const journalIds = new Set(existingTx.map(tx => tx.reference_id).filter(Boolean));
    const journalsWithoutTx = journals.filter(j => !journalIds.has(j.id));

    console.log(`\n✅ Journals chưa có transaction: ${journalsWithoutTx.length}`);

    if (journalsWithoutTx.length === 0) {
      return Response.json({
        success: true,
        message: 'Tất cả journals đã có transaction',
        journals_processed: 0
      });
    }

    // Tạo transactions cho từng journal
    let totalCoins = 0;
    const txToCreate = [];

    for (const journal of journalsWithoutTx) {
      const coins = journal.coins_earned || 0;
      totalCoins += coins;

      txToCreate.push({
        user_email: target_email,
        amount: coins,
        type: 'bounty_reward',
        description: `📖 Nhật ký biết ơn/sám hối (${journal.post_type}) - ${journal.word_count} từ`,
        reference_id: journal.id
      });
    }

    console.log(`\n💰 Tổng coins từ journals: ${totalCoins}`);

    // Tạo transactions batch
    if (txToCreate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < txToCreate.length; i += batchSize) {
        const batch = txToCreate.slice(i, i + batchSize);
        await base44.asServiceRole.entities.CamlycoinTransaction.bulkCreate(batch);
      }
      console.log(`✅ Đã tạo ${txToCreate.length} transactions`);
    }

    // Update balance - CỘNG THẲNG VÀO NET_VALID_COINS
    const balances = await base44.asServiceRole.entities.CamlycoinBalance.filter(
      { user_email: target_email }
    );
    const balance = balances[0];

    if (!balance) {
      return Response.json({ error: 'Balance not found' }, { status: 404 });
    }

    const oldNetValid = balance.net_valid_coins || 0;
    const newNetValid = oldNetValid + totalCoins;
    const paid = balance.paid_amount || 0;
    const newAvailable = newNetValid - paid;
    const newTotalEarned = newNetValid + (balance.frozen_balance || 0);

    await base44.asServiceRole.entities.CamlycoinBalance.update(balance.id, {
      net_valid_coins: newNetValid,
      total_earned: newTotalEarned,
      available_for_withdrawal: newAvailable
    });

    console.log(`\n📊 BALANCE MỚI:`);
    console.log(`  net_valid_coins: ${oldNetValid} → ${newNetValid} (+${totalCoins})`);
    console.log(`  available_for_withdrawal: ${balance.available_for_withdrawal} → ${newAvailable}`);
    console.log(`  total_earned: ${balance.total_earned} → ${newTotalEarned}`);

    return Response.json({
      success: true,
      journals_processed: journalsWithoutTx.length,
      total_coins_added: totalCoins,
      transactions_created: txToCreate.length,
      old_balance: {
        net_valid_coins: oldNetValid,
        available_for_withdrawal: balance.available_for_withdrawal,
        total_earned: balance.total_earned
      },
      new_balance: {
        net_valid_coins: newNetValid,
        available_for_withdrawal: newAvailable,
        total_earned: newTotalEarned
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});