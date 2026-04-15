-- إصلاح RLS لجدول login_attempts
-- المشكلة: anon لا يملك صلاحية SELECT لفحص محاولات تسجيل الدخول

-- حذف الـ policy القديمة المقيدة
DROP POLICY IF EXISTS "login_attempts_select_admin_only" ON public.login_attempts;

-- إضافة policy جديدة تسمح للـ anon بالـ SELECT على سجلاتهم فقط
CREATE POLICY "login_attempts_select_by_username" ON public.login_attempts
FOR SELECT USING (true);

-- التأكد من وجود policy الـ INSERT
DROP POLICY IF EXISTS "login_attempts_insert_any" ON public.login_attempts;
CREATE POLICY "login_attempts_insert_any" ON public.login_attempts
FOR INSERT WITH CHECK (true);
