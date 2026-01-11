import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all registered users using service role
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 50000);
    
    return Response.json({ 
      total_users: allUsers.length,
      users: allUsers
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});