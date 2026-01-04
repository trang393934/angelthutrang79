import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userEmail } = await req.json();

    if (!userEmail) {
      return Response.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    // Lấy dữ liệu user
    const [balance] = await base44.asServiceRole.entities.CamlycoinBalance.filter({ 
      user_email: userEmail 
    });

    if (!balance) {
      return Response.json({ 
        tier: 'basic_light_user',
        reason: 'Chưa có balance record'
      });
    }

    const transactions = await base44.asServiceRole.entities.CamlycoinTransaction.filter({ 
      user_email: userEmail 
    }, '-created_date', 1000);

    const communityRewards = await base44.asServiceRole.entities.CommunityReward.filter({ 
      user_email: userEmail,
      status: 'approved'
    }, '-created_date', 1000);

    // Phân tích hoạt động
    const totalEarned = balance.total_earned || 0;
    const qualityContentCount = communityRewards.filter(r => 
      r.upvotes > 5 && r.reward_type !== 'daily_login'
    ).length;
    const communityImpact = communityRewards.reduce((sum, r) => sum + (r.upvotes || 0), 0);
    const consistencyDays = balance.streak_days || 0;

    // AI Analysis để phân loại
    const prompt = `Phân loại user vào 1 trong 4 tầng reward của Angel AI:

THÔNG TIN USER:
- Total Earned: ${totalEarned} CAMLY
- Quality Content: ${qualityContentCount} items
- Community Impact: ${communityImpact} upvotes
- Consistency: ${consistencyDays} days streak
- Total Transactions: ${transactions.length}

4 TẦNG REWARD:
1. BASIC LIGHT USER (Khởi đầu):
   - Mới tham gia, làm quen
   - Chưa có đóng góp nổi bật
   - Total earned < 50,000 CAMLY

2. CONTRIBUTOR (Người đóng góp):
   - Có nội dung chất lượng
   - Được community đánh giá tích cực
   - Total earned 50,000 - 200,000 CAMLY
   - Có ít nhất 5 quality content items

3. ANGEL GUIDE / GUARDIAN (Tầng phụng sự):
   - Dẫn dắt cộng đồng
   - Có tác động lớn
   - Total earned 200,000 - 1,000,000 CAMLY
   - Community impact > 50 upvotes
   - Consistency > 30 days

4. ANGEL MASTER (Tầng linh hồn - HIẾM):
   - Đồng kiến tạo Angel AI
   - Dẫn dắt cộng đồng lớn
   - Total earned > 1,000,000 CAMLY
   - Community impact > 200 upvotes
   - Consistency > 90 days
   - ⚠️ Phải có xác nhận đặc biệt từ admin

YÊU CẦU: Phân tích và đề xuất tầng phù hợp nhất.`;

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          tier: { 
            type: "string",
            enum: ["basic_light_user", "contributor", "angel_guide", "angel_master"]
          },
          confidence: { type: "number" },
          reason: { type: "string" },
          strengths: { 
            type: "array",
            items: { type: "string" }
          },
          areas_to_improve: { 
            type: "array",
            items: { type: "string" }
          },
          recommended_rewards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                camly_amount: { type: "number" },
                usd_value: { type: "number" }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      user_email: userEmail,
      classification: analysis,
      raw_data: {
        total_earned: totalEarned,
        quality_content_count: qualityContentCount,
        community_impact: communityImpact,
        consistency_days: consistencyDays,
        total_transactions: transactions.length
      }
    });

  } catch (error) {
    console.error('Classification error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});