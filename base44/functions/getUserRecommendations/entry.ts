import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📊 Generating recommendations for ${user.email}`);

    // Fetch user data
    const [activities, balance, level, completedQuests, preferences] = await Promise.all([
      base44.entities.UserActivity.filter({ user_email: user.email }, '-created_date', 100),
      base44.entities.CamlycoinBalance.filter({ user_email: user.email }),
      base44.entities.UserLevel.filter({ user_email: user.email }),
      base44.entities.UserQuestProgress.filter({ user_email: user.email, status: 'completed' }),
      base44.entities.UserPreferences.filter({ created_by: user.email })
    ]);

    const userBalance = balance[0] || {};
    const userLevel = level[0] || {};
    const userPrefs = preferences[0] || {};

    // Analyze user behavior
    const activityTypes = {};
    const pageViews = {};
    let chatCount = 0;

    activities.forEach(activity => {
      activityTypes[activity.activity_type] = (activityTypes[activity.activity_type] || 0) + 1;
      
      if (activity.activity_type === 'page_view' && activity.activity_details?.page) {
        pageViews[activity.activity_details.page] = (pageViews[activity.activity_details.page] || 0) + 1;
      }

      if (activity.activity_type === 'chat_message') {
        chatCount++;
      }
    });

    // Check today's chat
    const todayChat = activities.filter(a => {
      if (a.activity_type !== 'chat_message') return false;
      const actDate = new Date(a.timestamp);
      const today = new Date();
      return actDate.toDateString() === today.toDateString();
    });

    // Build recommendation prompt
    const analysisPrompt = `Phân tích hành vi người dùng và tạo 3 đề xuất cá nhân hóa:

**THÔNG TIN NGƯỜI DÙNG:**
- Total Earned: ${userBalance.total_earned || 0} Camlycoin
- Available Balance: ${userBalance.available_balance || 0} Camlycoin
- Level: ${userLevel.current_level || 'bronze'} (${userLevel.level_number || 1})
- Quests đã hoàn thành: ${completedQuests.length}
- Chat hôm nay: ${todayChat.length}
- Tổng số chat: ${chatCount}

**HÀNH VI GẦN ĐÂY:**
- Loại hoạt động: ${JSON.stringify(activityTypes)}
- Trang đã xem nhiều nhất: ${JSON.stringify(pageViews)}

**SỞ THÍCH:**
- Phong cách: ${userPrefs.response_style || 'Chưa thiết lập'}
- Chủ đề quan tâm: ${userPrefs.topics_of_interest?.join(', ') || 'Chưa có'}

Dựa vào dữ liệu trên, hãy tạo 3 đề xuất thông minh và cá nhân hóa cho user.
Mỗi đề xuất phải có: title, description, action_text, target_page, priority (1-10)

Ví dụ đề xuất:
- Nếu chưa chat hôm nay -> Khuyến khích chat
- Nếu balance >= 100k -> Đề xuất rút tiền
- Nếu chưa làm quest -> Gợi ý quests
- Nếu hay xem một trang cụ thể -> Gợi ý tính năng liên quan
- Nếu level sắp lên -> Khuyến khích kiếm thêm điểm

**DANH SÁCH TRANG:**
Chat, CamlycoinHistory, WithdrawCamlycoin, Quests, BuildAndBounty, Leaderboard, Settings, KnowledgeBase, Library, PersonalVision

Trả lời JSON:`;

    const recommendations = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                action_text: { type: 'string' },
                target_page: { type: 'string' },
                priority: { type: 'number' }
              }
            }
          }
        }
      }
    });

    console.log(`✅ Generated ${recommendations.recommendations?.length || 0} recommendations`);

    return Response.json({
      success: true,
      recommendations: recommendations.recommendations || [],
      user_context: {
        balance: userBalance,
        level: userLevel,
        activity_summary: activityTypes
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});