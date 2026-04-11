// Edge Function: create-auth-user
// Creates a Supabase Auth user for a new app employee
// Called by the app when adding a new user from the admin panel

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client with service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller is authenticated and is an admin
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await userClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized - not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if caller is admin in app_users
    const { data: callerAppUser } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('auth_user_id', callerUser.id)
      .single();

    if (!callerAppUser || callerAppUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { username, password, appUserId } = await req.json();

    if (!username || !password || !appUserId) {
      return new Response(JSON.stringify({ error: 'username, password, and appUserId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const loginEmail = `${username.toLowerCase()}@attendance.local`;

    // Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === loginEmail);

    let authUserId: string;

    if (existingUser) {
      // Update password if user exists
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
      authUserId = existingUser.id;
    } else {
      // Create new auth user
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password: password,
        email_confirm: true,
        user_metadata: { username, app_user_id: appUserId },
      });

      if (createError || !newAuthUser?.user) {
        return new Response(JSON.stringify({ error: createError?.message || 'Failed to create auth user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authUserId = newAuthUser.user.id;
    }

    // Update app_users with auth_user_id and login_email
    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        auth_user_id: authUserId,
        login_email: loginEmail,
      })
      .eq('id', appUserId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, authUserId, loginEmail }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
