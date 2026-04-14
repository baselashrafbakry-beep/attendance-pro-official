-- ============================================================
-- إصلاح حساب المدير في Supabase Auth
-- تشغيل هذا في Supabase SQL Editor
-- ============================================================

-- خطوة 1: فحص حالة المستخدمين الحاليين
SELECT 
  id, 
  username, 
  name, 
  role, 
  auth_user_id,
  login_email,
  CASE 
    WHEN auth_user_id IS NULL THEN '❌ لا يوجد Supabase Auth account'
    ELSE '✅ لديه Supabase Auth account'
  END as auth_status
FROM app_users
ORDER BY role DESC, name;

-- ============================================================
-- ملاحظة: 
-- المستخدمون الذين لديهم auth_user_id = NULL يحتاجون لإنشاء
-- حساب في Supabase Auth حتى يتمكنوا من تسجيل الدخول.
-- 
-- هذا يحدث عبر Edge Function create-auth-user التي تتطلب
-- صلاحيات service_role.
-- 
-- الآن بعد تحديث Edge Function، عند تسجيل دخول المدير
-- باستخدام password_hash fallback، سيتم تلقائياً إنشاء
-- Supabase Auth account له في الخلفية.
-- ============================================================
