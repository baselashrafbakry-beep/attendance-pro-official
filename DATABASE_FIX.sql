-- ============================================================
-- إصلاح قاعدة البيانات — Attendance & Salary Tracker v6.5
-- تشغيل هذا الملف في Supabase SQL Editor
-- ============================================================

-- 1. إضافة أعمدة require_gps و check_time_cheating لجدول user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS require_gps BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS check_time_cheating BOOLEAN DEFAULT TRUE;

-- 2. التأكد من وجود عمود device_info في attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS device_info JSONB;

-- 3. إضافة جدول push_tokens إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_self" ON public.push_tokens;
CREATE POLICY "push_tokens_self" ON public.push_tokens
FOR ALL USING (user_id = public.current_app_user_id() OR public.is_admin_user())
WITH CHECK (user_id = public.current_app_user_id() OR public.is_admin_user());

-- 4. إصلاح بيانات الموظفين الموجودين - إضافة gebrel إذا لم يكن موجوداً
INSERT INTO public.app_users (id, username, login_email, password_hash, name, role, department, base_salary, transport_allowance, work_start_time, work_end_time, weekly_off_day, weekly_off_day2)
VALUES (
  'gebrel',
  'gebrel',
  'gebrel@attendance.local',
  encode(digest('gebrel123', 'sha256'), 'hex'),
  'محمد جبريل',
  'employee',
  'المستودع',
  5000,
  500,
  '09:00',
  '17:00',
  5,
  6
)
ON CONFLICT (id) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  login_email = EXCLUDED.login_email;

-- 5. إضافة إعدادات لكل مستخدم إذا لم تكن موجودة
INSERT INTO public.user_settings (user_id, base_salary, transport_allowance, month_start_day, work_start_time, work_end_time, weekly_off_day, weekly_off_day2, late_deduction_multiplier, absence_deduction_multiplier, overtime_multiplier, late_grace_period, overtime_min_threshold, require_gps, check_time_cheating)
VALUES 
  ('admin', 0, 0, 27, '09:00', '17:00', 5, 6, 2, 2, 1.5, 10, 15, true, true),
  ('basel', 5000, 500, 27, '09:00', '17:00', 5, 6, 2, 2, 1.5, 10, 15, true, true),
  ('gebrel', 5000, 500, 27, '09:00', '17:00', 5, 6, 2, 2, 1.5, 10, 15, true, true)
ON CONFLICT (user_id) DO UPDATE SET
  require_gps = EXCLUDED.require_gps,
  check_time_cheating = EXCLUDED.check_time_cheating;

-- 6. التأكد من ربط المستخدمين بـ auth.users
-- تحديث auth_user_id بناءً على login_email
UPDATE public.app_users app
SET auth_user_id = au.id
FROM auth.users au
WHERE app.auth_user_id IS NULL
  AND app.login_email IS NOT NULL
  AND lower(au.email) = lower(app.login_email);

-- 7. الإجازات الرسمية المصرية 2026 (إضافة إذا لم تكن موجودة)
INSERT INTO public.official_holidays (name, date, is_paid) VALUES
  ('رأس السنة الميلادية', '2026-01-01', true),
  ('عيد الشرطة', '2026-01-25', true),
  ('ثورة 25 يناير', '2026-01-25', true),
  ('عيد الأم', '2026-03-21', false),
  ('شم النسيم', '2026-04-06', true),
  ('عيد الفطر (اليوم الأول)', '2026-03-30', true),
  ('عيد الفطر (اليوم الثاني)', '2026-03-31', true),
  ('عيد الفطر (اليوم الثالث)', '2026-04-01', true),
  ('عيد تحرير سيناء', '2026-04-25', true),
  ('عيد العمال', '2026-05-01', true),
  ('عيد الأضحى (اليوم الأول)', '2026-06-06', true),
  ('عيد الأضحى (اليوم الثاني)', '2026-06-07', true),
  ('عيد الأضحى (اليوم الثالث)', '2026-06-08', true),
  ('رأس السنة الهجرية', '2026-06-26', true),
  ('ثورة 23 يوليو', '2026-07-23', true),
  ('عيد القوات المسلحة', '2026-10-06', true)
ON CONFLICT (date) DO NOTHING;

-- 8. فحص وإصلاح سياسات Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leave_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END $$;

-- تأكيد الإصلاح
SELECT 'قاعدة البيانات تمت إصلاحها بنجاح ✅' AS status;
SELECT id, username, login_email, auth_user_id IS NOT NULL as has_auth FROM public.app_users ORDER BY id;

-- =====================================================================
-- Migration v6.6: إضافة حقول موقع العمل الجغرافي
-- =====================================================================
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS work_location_lat DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS work_location_lng DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS work_location_radius INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS work_location_name TEXT DEFAULT NULL;

-- تحديث التعليق
COMMENT ON COLUMN public.app_users.work_location_lat IS 'خط العرض لموقع العمل (يحدده المدير)';
COMMENT ON COLUMN public.app_users.work_location_lng IS 'خط الطول لموقع العمل (يحدده المدير)';
COMMENT ON COLUMN public.app_users.work_location_radius IS 'النطاق الجغرافي المسموح به بالمتر (افتراضي 100م)';
COMMENT ON COLUMN public.app_users.work_location_name IS 'اسم وصفي لموقع العمل';

SELECT 'Migration v6.6 completed ✅ — Work location fields added' AS status;
