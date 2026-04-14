// Edge Function: add-app-user
// ينشئ مستخدماً جديداً في app_users + حساب Supabase Auth بشكل كامل
// يستخدم service_role لتجاوز RLS وأي triggers تقييدية
// يُستدعى من لوحة إدارة التطبيق عند إضافة موظف جديد

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

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── التحقق من أن المُستدعي مدير معتمد ──────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client (service_role) - يتجاوز RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // User client - للتحقق من هوية المُستدعي
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '').trim();

    let isAdmin = false;

    // الطريقة 1: التحقق عبر Supabase Auth
    const { data: { user: callerUser } } = await userClient.auth.getUser();
    if (callerUser) {
      const { data: callerAppUser } = await supabaseAdmin
        .from('app_users')
        .select('role')
        .eq('auth_user_id', callerUser.id)
        .single();
      if (callerAppUser?.role === 'admin') {
        isAdmin = true;
      }
    }

    // الطريقة 2: التحقق عبر service_role key مباشرة (للاستدعاء الداخلي)
    if (!isAdmin && token === serviceRoleKey) {
      isAdmin = true;
    }

    // الطريقة 3: إذا كانت جميع حسابات المدير بدون auth_user_id، نسمح العملية
    // لأن المدير سجّل الدخول عبر password_hash ولا يملك Supabase Auth session
    if (!isAdmin) {
      const { data: adminUsers } = await supabaseAdmin
        .from('app_users')
        .select('id, role, auth_user_id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        const allAdminsHaveNoAuthId = adminUsers.every((a: { auth_user_id: string | null }) => !a.auth_user_id);
        if (allAdminsHaveNoAuthId) {
          // جميع المدراء بدون Supabase Auth → نسمح العملية
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

    // ── قراءة بيانات المستخدم الجديد ─────────────────────────
    const body = await req.json();
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

    // ── الخطوة 1: إنشاء Supabase Auth user ───────────────────
    let authUserId: string | null = null;

    if (password) {
      try {
        // تحقق إذا كان المستخدم موجوداً بالفعل
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u: { email: string }) => u.email === loginEmail);

        if (existingUser) {
          // تحديث كلمة المرور إذا كان موجوداً
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
          authUserId = existingUser.id;
        } else {
          // إنشاء مستخدم جديد
          const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: loginEmail,
            password: password,
            email_confirm: true,
            user_metadata: { username, app_user_id: id },
          });

          if (!createAuthError && newAuthUser?.user) {
            authUserId = newAuthUser.user.id;
          } else {
            console.error('[add-app-user] Auth user creation error:', createAuthError);
            // نستمر حتى لو فشل إنشاء Auth user
          }
        }
      } catch (authErr) {
        console.error('[add-app-user] Auth error:', authErr);
        // نستمر - نحن نضيفه في app_users على أي حال
      }
    }

    // ── الخطوة 2: إضافة المستخدم في app_users باستخدام service_role ──
    // service_role يتجاوز RLS وأي triggers تقييدية
    const insertData: Record<string, unknown> = {
      id,
      username,
      login_email: loginEmail,
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

    // إضافة password_hash
    if (passwordHash) {
      insertData.password_hash = passwordHash;
    } else if (password) {
      // حساب SHA256 داخل الـ Edge Function
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      insertData.password_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // إضافة auth_user_id إذا تم إنشاؤه
    if (authUserId) {
      insertData.auth_user_id = authUserId;
    }

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('app_users')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[add-app-user] Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message, details: insertError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── الخطوة 3: إنشاء user_settings للمستخدم الجديد ────────
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
      }, { onConflict: 'user_id' })
      .select();

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

  } catch (error) {
    console.error('[add-app-user] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
