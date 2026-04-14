// Edge Function: create-auth-user (v2)
// وظيفتان في Edge Function واحدة:
// 1. إنشاء Supabase Auth user فقط (الوظيفة الأصلية)
// 2. إنشاء المستخدم كاملاً في app_users + Supabase Auth (الوظيفة الجديدة)
//
// يُستدعى من لوحة إدارة التطبيق عند إضافة موظف جديد
// يستخدم service_role لتجاوز أي RLS أو triggers

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Create admin client with service_role key (always available inside Edge Functions)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // ── Verify caller is an authenticated admin ──────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '').trim();

    // Try to verify token via Supabase Auth
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: callerUser } } = await userClient.auth.getUser();

    // ── Admin verification ──
    let isAdmin = false;

    if (callerUser) {
      // Caller is authenticated via Supabase Auth → check role in app_users
      const { data: callerAppUser } = await supabaseAdmin
        .from('app_users')
        .select('role')
        .eq('auth_user_id', callerUser.id)
        .single();

      if (callerAppUser?.role === 'admin') {
        isAdmin = true;
      }
    }

    // ── Fallback: check if token matches service role key (internal calls) ──
    if (!isAdmin && token === serviceRoleKey) {
      isAdmin = true;
    }

    // ── Fallback: if admin has no auth_user_id, allow operation ──
    // This handles the case where admin was created without Supabase Auth
    if (!isAdmin) {
      const { data: adminUsers } = await supabaseAdmin
        .from('app_users')
        .select('role, auth_user_id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        const allAdminsHaveNoAuthId = adminUsers.every((a: { auth_user_id: string | null }) => !a.auth_user_id);
        if (allAdminsHaveNoAuthId) {
          isAdmin = true;
        }
      }
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request body ──────────────────────────────────────
    const body = await req.json();
    const { username, password, appUserId } = body;

    // ── Mode 1: Full user creation (createFullUser = true) ────────
    // إنشاء المستخدم كاملاً في app_users + Supabase Auth
    if (body.createFullUser === true) {
      return await handleCreateFullUser(supabaseAdmin, body);
    }

    // ── Mode 2: Auth-only creation (default/legacy behavior) ──────
    if (!username || !password || !appUserId) {
      return new Response(JSON.stringify({ error: 'username, password, and appUserId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const loginEmail = `${username.toLowerCase()}@attendance.local`;

    // ── Check if auth user already exists ───────────────────────
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: { email: string }) => u.email === loginEmail);

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

    // ── Update app_users with auth_user_id and login_email ──────
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

// ── Full user creation handler ────────────────────────────────
async function handleCreateFullUser(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  // deno-lint-ignore no-explicit-any
  body: any
): Promise<Response> {
  const {
    id,
    username,
    password,
    passwordHash,
    name,
    role = 'employee',
    department = '',
    baseSalary = 0,
    transportAllowance = 0,
    annualLeaveLimit = 21,
    sickLeaveLimit = 15,
    workStartTime = '09:00',
    workEndTime = '17:00',
    weeklyOffDay = 5,
    weeklyOffDay2 = -1,
  } = body;

  if (!id || !username || !name) {
    return new Response(JSON.stringify({ error: 'id, username, and name are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!password && !passwordHash) {
    return new Response(JSON.stringify({ error: 'password or passwordHash is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const loginEmail = `${username.toLowerCase()}@attendance.local`;
  let authUserId: string | null = null;

  // ── Step 1: Create Supabase Auth user ───────────────────────
  if (password) {
    try {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: { email: string }) => u.email === loginEmail);

      if (existingUser) {
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
        authUserId = existingUser.id;
      } else {
        const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
          email: loginEmail,
          password: password,
          email_confirm: true,
          user_metadata: { username, app_user_id: id },
        });

        if (!createAuthError && newAuthUser?.user) {
          authUserId = newAuthUser.user.id;
        } else {
          console.error('[create-auth-user] Auth creation error:', createAuthError);
        }
      }
    } catch (authErr) {
      console.error('[create-auth-user] Auth error:', authErr);
    }
  }

  // ── Step 2: Calculate password hash ─────────────────────────
  let finalPasswordHash = passwordHash;
  if (!finalPasswordHash && password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    finalPasswordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  if (!finalPasswordHash) {
    return new Response(JSON.stringify({ error: 'Could not compute password hash' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Step 3: Insert into app_users using service_role ─────────
  // service_role bypasses all RLS and triggers
  const insertData: Record<string, unknown> = {
    id,
    username,
    login_email: loginEmail,
    password_hash: finalPasswordHash,
    name,
    role,
    department,
    base_salary: baseSalary,
    transport_allowance: transportAllowance,
    annual_leave_limit: annualLeaveLimit,
    sick_leave_limit: sickLeaveLimit,
    work_start_time: workStartTime,
    work_end_time: workEndTime,
    weekly_off_day: weeklyOffDay,
    weekly_off_day2: weeklyOffDay2,
  };

  if (authUserId) {
    insertData.auth_user_id = authUserId;
  }

  const { data: newUser, error: insertError } = await supabaseAdmin
    .from('app_users')
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    console.error('[create-auth-user] Insert error:', insertError);
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Step 4: Create user_settings ────────────────────────────
  await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: id,
      base_salary: baseSalary,
      transport_allowance: transportAllowance,
      work_start_time: workStartTime,
      work_end_time: workEndTime,
      weekly_off_day: weeklyOffDay,
      weekly_off_day2: weeklyOffDay2,
      annual_leave_limit: annualLeaveLimit,
      sick_leave_limit: sickLeaveLimit,
    }, { onConflict: 'user_id' });

  return new Response(
    JSON.stringify({
      success: true,
      user: newUser,
      authUserId,
      loginEmail,
      message: authUserId
        ? 'تم إنشاء المستخدم بنجاح مع حساب تسجيل الدخول'
        : 'تم إنشاء المستخدم في قاعدة البيانات (سيتم إنشاء حساب Auth لاحقاً)',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
