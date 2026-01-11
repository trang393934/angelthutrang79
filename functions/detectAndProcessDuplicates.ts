import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { 
      target_user_email, 
      entity_type = 'QuestionAuditLog',
      similarity_threshold = 0.85,
      auto_delete = false
    } = await req.json();
    
    if (!target_user_email) {
      return Response.json({ error: 'Missing target_user_email' }, { status: 400 });
    }

    console.log(`🤖 AI Duplicate Detection: ${target_user_email} (similarity_threshold: ${similarity_threshold})`);

    // Fetch all records
    const records = await base44.asServiceRole.entities[entity_type].filter(
      { user_email: target_user_email },
      '-created_date',
      10000
    );

    console.log(`📊 Total records: ${records.length}`);

    // Group by transaction_id for QuestionAuditLog
    const groupedByTxId = {};
    records.forEach(record => {
      const txId = record.transaction_id || record.id;
      if (!groupedByTxId[txId]) {
        groupedByTxId[txId] = [];
      }
      groupedByTxId[txId].push(record);
    });

    console.log(`🔗 Unique groups: ${Object.keys(groupedByTxId).length}`);

    // Find duplicates using AI
    const duplicateGroups = [];
    const recordsToDelete = [];

    for (const [txId, groupRecords] of Object.entries(groupedByTxId)) {
      if (groupRecords.length <= 1) continue;

      // Use AI to analyze similarity
      const recordTexts = groupRecords.map(r => 
        r.question_text || r.content || JSON.stringify(r)
      );

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Phân tích các nội dung sau để tìm bản sao (duplicates):
        
${recordTexts.map((text, i) => `${i + 1}. "${text.substring(0, 100)}..."`).join('\n')}

Trả lời dưới dạng JSON:
{
  "is_duplicate": true/false,
  "similarity_score": 0-1,
  "explanation": "lý do",
  "keep_index": 0,
  "delete_indices": [1, 2]
}

Giữ lại record có chất lượng tốt nhất (hợp lệ hoặc mới nhất). Xóa các bản sao.`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_duplicate: { type: 'boolean' },
            similarity_score: { type: 'number' },
            explanation: { type: 'string' },
            keep_index: { type: 'number' },
            delete_indices: { type: 'array', items: { type: 'number' } }
          }
        }
      });

      if (aiResult.is_duplicate && aiResult.similarity_score >= similarity_threshold) {
        console.log(`\n⚠️  Duplicates found (score: ${aiResult.similarity_score}):`);
        console.log(`  Keep: ${aiResult.keep_index}`);
        console.log(`  Delete: ${aiResult.delete_indices.join(', ')}`);

        const toDelete = aiResult.delete_indices.map(idx => groupRecords[idx].id);
        recordsToDelete.push(...toDelete);

        duplicateGroups.push({
          tx_id: txId,
          similarity_score: aiResult.similarity_score,
          keep_record: groupRecords[aiResult.keep_index].id,
          delete_count: toDelete.length,
          explanation: aiResult.explanation
        });
      }
    }

    console.log(`\n📋 Total duplicates found: ${recordsToDelete.length}`);

    // Auto-delete if approved
    if (auto_delete && recordsToDelete.length > 0) {
      let deleted = 0;
      for (const recordId of recordsToDelete) {
        try {
          await base44.asServiceRole.entities[entity_type].delete(recordId);
          deleted++;
          await new Promise(resolve => setTimeout(resolve, 60)); // Delay to avoid rate limit
        } catch (err) {
          console.log(`⚠️  Failed to delete ${recordId}`);
        }
      }
      console.log(`✅ Auto-deleted: ${deleted}/${recordsToDelete.length}`);
    }

    return Response.json({
      success: true,
      user_email: target_user_email,
      total_records: records.length,
      unique_groups: Object.keys(groupedByTxId).length,
      duplicate_groups_count: duplicateGroups.length,
      total_duplicates_found: recordsToDelete.length,
      auto_deleted: auto_delete ? recordsToDelete.length : 0,
      duplicates: duplicateGroups.slice(0, 10),
      remaining_ids: auto_delete ? [] : recordsToDelete.slice(0, 20)
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});